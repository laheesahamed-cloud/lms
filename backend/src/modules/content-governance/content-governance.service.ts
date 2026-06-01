import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Pool, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';

type EvidenceFilters = {
  entityType?: string;
  entityId?: number;
  workflowState?: string;
  actorId?: number;
};

type EvidenceRow = RowDataPacket & {
  entity_type: string;
  entity_id: number;
  workflow_state: 'draft' | 'in_review' | 'published' | 'archived';
  workflow_updated_by: number | null;
  workflow_updated_at: string | Date | null;
  version_id: number | null;
  version_number: number | null;
  version_created_at: string | Date | null;
  author_id: number | null;
  authored_at: string | Date | null;
  published_actor_id: number | null;
  published_at: string | Date | null;
};

const ENTITY_TYPES = ['course', 'topic', 'subtopic', 'lesson', 'paper', 'question', 'quiz'] as const;
const WORKFLOW_STATES = ['draft', 'in_review', 'published', 'archived'] as const;
const ROLLBACK_ROUTE_BY_ENTITY: Record<string, string> = {
  course: '/api/courses/:id/rollback/:versionNumber',
  topic: '/api/topics/:id/rollback/:versionNumber',
  subtopic: '/api/subtopics/:id/rollback/:versionNumber',
  lesson: '/api/lessons/:id/rollback/:versionNumber',
  paper: '/api/papers/:id/rollback/:versionNumber',
  question: '/api/questions/:id/rollback/:versionNumber',
  quiz: '/api/quizzes/:id/rollback/:versionNumber',
};

@Injectable()
export class ContentGovernanceService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Pool) {}

  async listEvidence(filters: EvidenceFilters = {}) {
    const normalized = this.normalizeFilters(filters);
    const where = ['1 = 1'];
    const params: Array<string | number> = [];

    if (normalized.entityType) {
      where.push('cws.entity_type = ?');
      params.push(normalized.entityType);
    }

    if (normalized.entityId) {
      where.push('cws.entity_id = ?');
      params.push(normalized.entityId);
    }

    if (normalized.workflowState) {
      where.push('cws.workflow_state = ?');
      params.push(normalized.workflowState);
    }

    const [rows] = await this.db.execute<EvidenceRow[]>(
      `
        SELECT
          cws.entity_type,
          cws.entity_id,
          cws.workflow_state,
          cws.updated_by AS workflow_updated_by,
          cws.updated_at AS workflow_updated_at,
          (
            SELECT cv.id
            FROM content_versions cv
            WHERE cv.entity_type = cws.entity_type AND cv.entity_id = cws.entity_id
            ORDER BY cv.version_number DESC, cv.id DESC
            LIMIT 1
          ) AS version_id,
          (
            SELECT cv.version_number
            FROM content_versions cv
            WHERE cv.entity_type = cws.entity_type AND cv.entity_id = cws.entity_id
            ORDER BY cv.version_number DESC, cv.id DESC
            LIMIT 1
          ) AS version_number,
          (
            SELECT cv.created_at
            FROM content_versions cv
            WHERE cv.entity_type = cws.entity_type AND cv.entity_id = cws.entity_id
            ORDER BY cv.version_number DESC, cv.id DESC
            LIMIT 1
          ) AS version_created_at,
          (
            SELECT cv.created_by
            FROM content_versions cv
            WHERE cv.entity_type = cws.entity_type AND cv.entity_id = cws.entity_id
            ORDER BY cv.version_number ASC, cv.id ASC
            LIMIT 1
          ) AS author_id,
          (
            SELECT cv.created_at
            FROM content_versions cv
            WHERE cv.entity_type = cws.entity_type AND cv.entity_id = cws.entity_id
            ORDER BY cv.version_number ASC, cv.id ASC
            LIMIT 1
          ) AS authored_at,
          (
            SELECT cae.actor_id
            FROM content_audit_events cae
            WHERE cae.entity_type = cws.entity_type
              AND cae.entity_id = cws.entity_id
              AND cae.action IN ('published', 'created', 'updated')
            ORDER BY cae.created_at DESC, cae.id DESC
            LIMIT 1
          ) AS published_actor_id,
          (
            SELECT cae.created_at
            FROM content_audit_events cae
            WHERE cae.entity_type = cws.entity_type
              AND cae.entity_id = cws.entity_id
              AND cae.action IN ('published', 'created', 'updated')
            ORDER BY cae.created_at DESC, cae.id DESC
            LIMIT 1
          ) AS published_at
        FROM content_workflow_states cws
        WHERE ${where.join(' AND ')}
        ORDER BY cws.updated_at DESC, cws.entity_type ASC, cws.entity_id DESC
        LIMIT 1000
      `,
      params
    );

    const userIds = Array.from(new Set(
      rows.flatMap((row) => [
        row.author_id ? Number(row.author_id) : null,
        row.published_actor_id ? Number(row.published_actor_id) : null,
        row.workflow_updated_by ? Number(row.workflow_updated_by) : null,
      ]).filter((value): value is number => value !== null && Number.isInteger(value) && value > 0)
    ));
    const userNames = await this.loadUserNames(userIds);

    const evidence = rows.map((row) => this.mapEvidence(row, userNames));

    await this.logAdminAuditEvent({
      eventType: 'content_governance_evidence.viewed',
      actorId: normalized.actorId,
      summary: 'Content governance evidence viewed',
      metadata: {
        entityType: normalized.entityType || '',
        entityId: normalized.entityId || null,
        workflowState: normalized.workflowState || '',
        rowCount: evidence.length,
      },
    });

    return {
      ok: true,
      evidence,
      filters: {
        entityType: normalized.entityType || '',
        entityId: normalized.entityId || null,
        workflowState: normalized.workflowState || '',
      },
    };
  }

  async exportEvidence(filters: EvidenceFilters = {}) {
    const result = await this.listEvidence(filters);
    const headers = [
      'entity_type',
      'entity_id',
      'workflow_state',
      'author_id',
      'author_name',
      'authored_at',
      'reviewer_id',
      'reviewer_name',
      'approval_date',
      'version_id',
      'version_number',
      'version_created_at',
      'rollback_path',
    ];
    const rows = result.evidence.map((item) => [
      item.entityType,
      item.entityId,
      item.workflowState,
      item.author?.id || '',
      item.author?.name || '',
      item.authoredAt || '',
      item.reviewer?.id || '',
      item.reviewer?.name || '',
      item.approvalDate || '',
      item.version?.id || '',
      item.version?.number || '',
      item.version?.createdAt || '',
      item.rollbackPath || '',
    ]);

    return Buffer.from([headers, ...rows].map((row) => row.map((cell) => this.escapeCsvCell(cell)).join(',')).join('\n'), 'utf8');
  }

  private normalizeFilters(filters: EvidenceFilters) {
    const entityType = String(filters.entityType || '').trim();
    const workflowState = String(filters.workflowState || '').trim();
    const entityId = Number(filters.entityId || 0);

    if (entityType && !ENTITY_TYPES.includes(entityType as (typeof ENTITY_TYPES)[number])) {
      throw new BadRequestException('Unsupported content entity type');
    }

    if (workflowState && !WORKFLOW_STATES.includes(workflowState as (typeof WORKFLOW_STATES)[number])) {
      throw new BadRequestException('Unsupported content workflow state');
    }

    if (filters.entityId !== undefined && (!Number.isInteger(entityId) || entityId <= 0)) {
      throw new BadRequestException('Content entity ID is invalid');
    }

    return {
      entityType,
      workflowState,
      entityId: entityId || 0,
      actorId: filters.actorId,
    };
  }

  private async loadUserNames(userIds: number[]) {
    if (userIds.length === 0) return new Map<number, string>();
    const placeholders = userIds.map(() => '?').join(', ');
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, full_name FROM users WHERE id IN (${placeholders})`,
      userIds
    );
    return new Map(rows.map((row) => [Number(row.id), String(row.full_name || `User ${row.id}`)]));
  }

  private mapEvidence(row: EvidenceRow, userNames: Map<number, string>) {
    const versionNumber = Number(row.version_number || 0);
    const reviewerId = row.workflow_state === 'published'
      ? Number(row.published_actor_id || row.workflow_updated_by || 0)
      : 0;
    const approvalDate = row.workflow_state === 'published'
      ? row.published_at || row.workflow_updated_at || null
      : null;

    return {
      entityType: row.entity_type,
      entityId: Number(row.entity_id),
      workflowState: row.workflow_state,
      author: row.author_id
        ? { id: Number(row.author_id), name: userNames.get(Number(row.author_id)) || `User ${row.author_id}` }
        : null,
      authoredAt: row.authored_at || null,
      reviewer: reviewerId
        ? { id: reviewerId, name: userNames.get(reviewerId) || `User ${reviewerId}` }
        : null,
      approvalDate,
      version: versionNumber
        ? {
            id: row.version_id ? Number(row.version_id) : null,
            number: versionNumber,
            label: `v${versionNumber}`,
            createdAt: row.version_created_at || null,
          }
        : null,
      rollbackPath: versionNumber
        ? this.rollbackPath(row.entity_type, Number(row.entity_id), versionNumber)
        : '',
    };
  }

  private rollbackPath(entityType: string, entityId: number, versionNumber: number) {
    const template = ROLLBACK_ROUTE_BY_ENTITY[entityType];
    if (!template) return '';
    return template
      .replace(':id', String(entityId))
      .replace(':versionNumber', String(versionNumber));
  }

  private async logAdminAuditEvent(input: {
    eventType: string;
    actorId?: number | null;
    summary: string;
    metadata?: unknown;
  }) {
    await this.db.execute(
      `INSERT INTO admin_audit_events
        (event_type, actor_id, target_type, summary, metadata_json)
       VALUES (?, ?, ?, ?, ?)`,
      [
        input.eventType,
        input.actorId || null,
        'content_governance_evidence',
        input.summary,
        input.metadata === undefined ? null : JSON.stringify(input.metadata),
      ]
    );
  }

  private escapeCsvCell(value: unknown) {
    const cell = String(value ?? '');
    if (/[",\r\n]/.test(cell)) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  }
}
