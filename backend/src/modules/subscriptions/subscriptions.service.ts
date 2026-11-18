import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { basename, join } from 'path';
import { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { normalizePagination, PaginationInput } from '../../common/utils/pagination';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { PlansService } from '../plans/plans.service';
import { searchWords, wordSearchFilter } from '../../common/utils/word-search';
import { SettingsService } from '../settings/settings.service';
import { AssignSubscriptionDto } from './dto/assign-subscription.dto';
import { ManualPaymentRequestDto } from './dto/manual-payment-request.dto';
import { RequestSubscriptionDto } from './dto/request-subscription.dto';
import { SubscriptionCouponDto } from './dto/subscription-coupon.dto';
import { AppleIapService, AppleTransaction } from './apple-iap.service';

type SubscriptionRow = RowDataPacket & {
  /** Apple's exact expiry; NULL for manual/bank-transfer/PayHere subscriptions. */
  access_expires_at?: string | Date | null;
  /** 1 once access_expires_at has passed, computed by MySQL in UTC. */
  access_lapsed?: number | null;
  id: number;
  user_id: number;
  plan_id: number;
  assigned_by: number | null;
  notes: string | null;
  status: 'active' | 'pending' | 'expired' | 'cancelled';
  payment_status: 'manual' | 'paid' | 'unpaid' | 'free_plan';
  amount_paid: string | number | null;
  payment_method: string | null;
  payment_reference: string | null;
  payment_date: string | null;
  receipt_url: string | null;
  access_scope: 'all' | 'courses' | 'lessons' | null;
  course_ids_json: string | null;
  lesson_ids_json: string | null;
  start_date: string;
  end_date: string;
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
  student_name?: string | null;
  student_email?: string | null;
  assigned_by_name?: string | null;
  assigned_by_email?: string | null;
  plan_name?: string | null;
  plan_regular_price?: string | number | null;
  plan_offer_price?: string | number | null;
  plan_offer_enabled?: number | null;
  plan_currency?: string | null;
  plan_duration_days?: number | null;
  plan_recommended?: number | null;
};

type SubscriptionRequestRow = RowDataPacket & {
  id: number;
  user_id: number;
  plan_id: number;
  invoice_id: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  message: string | null;
  admin_note: string | null;
  requested_at: string | Date;
  resolved_at: string | Date | null;
  resolved_by: number | null;
  subscription_id: number | null;
  payment_method: string | null;
  payment_reference: string | null;
  payment_amount: string | number | null;
  payment_currency: string | null;
  coupon_code: string | null;
  discount_amount: string | number | null;
  payment_proof_name: string | null;
  payment_proof_mime: string | null;
  payment_proof_data_url: string | null;
  access_scope: 'all' | 'courses' | 'lessons' | null;
  course_ids_json: string | null;
  lesson_ids_json: string | null;
  student_name?: string | null;
  student_email?: string | null;
  plan_name?: string | null;
  plan_regular_price?: string | number | null;
  plan_offer_price?: string | number | null;
  plan_offer_enabled?: number | null;
  plan_currency?: string | null;
  resolved_by_name?: string | null;
  resolved_by_email?: string | null;
};

type PaymentProofFile = {
  mimeType: string;
  extension: string;
  buffer: Buffer;
};

type SubscriptionAuditRow = RowDataPacket & {
  id: number;
  subscription_id: number | null;
  request_id: number | null;
  user_id: number | null;
  actor_id: number | null;
  event_type: string;
  summary: string;
  details_json: string | null;
  created_at: string | Date;
  actor_name?: string | null;
  actor_email?: string | null;
  student_name?: string | null;
  student_email?: string | null;
};

type PaymentTransactionRow = RowDataPacket & {
  id: number;
  order_id: string;
  invoice_id: string | null;
  user_id: number;
  plan_id: number;
  subscription_id: number | null;
  amount: string | number;
  currency: string;
  coupon_code: string | null;
  discount_amount: string | number;
  order_note: string | null;
  access_scope: 'all' | 'courses' | 'lessons' | null;
  course_ids_json: string | null;
  lesson_ids_json: string | null;
  status: 'initiated' | 'pending' | 'paid' | 'cancelled' | 'failed' | 'chargedback' | 'invalid';
};

type SubscriptionCouponRow = RowDataPacket & {
  id: number;
  code: string;
  label: string | null;
  coupon_mode: 'discount' | 'package' | null;
  discount_type: 'percent' | 'fixed';
  discount_value: string | number;
  plan_ids_json: string | null;
  status: 'active' | 'inactive';
  starts_at: string | null;
  expires_at: string | null;
  max_redemptions: number | null;
  redemption_count: number;
  created_at: string;
  updated_at: string;
};

const SUBSCRIPTION_LIST_COLUMNS = `
  us.id,
  us.user_id,
  us.plan_id,
  us.assigned_by,
  us.notes,
  us.status,
  us.payment_status,
  us.amount_paid,
  us.payment_method,
  us.payment_reference,
  us.payment_date,
  us.receipt_url,
  us.access_scope,
  us.course_ids_json,
  us.lesson_ids_json,
  us.start_date,
  us.end_date,
  us.access_expires_at,
  -- Evaluated by MySQL, deliberately, rather than parsed in JS.
  --
  -- access_expires_at is stored in UTC, but mysql2 has no dateStrings option
  -- here, so it hands back a JS Date built by reading that value as LOCAL
  -- time. Every attempt to re-derive the instant in JS was wrong: stringifying
  -- the Date gives "Tue Oct 14 2026 20:00:00 GMT+0300 (...)", which no amount
  -- of massaging parses back correctly, and the failures were silent — an
  -- Invalid Date read as "not lapsed", so a finished subscription kept showing
  -- as active with Change plan and Manage buttons.
  --
  -- MySQL compares two UTC values with no timezone round-trip at all.
  (us.access_expires_at IS NOT NULL AND us.access_expires_at <= UTC_TIMESTAMP()) AS access_lapsed,
  us.created_at,
  us.updated_at
`;

@Injectable()
export class SubscriptionsService {
  private readonly unlimitedFreePlanEndDate = '9999-12-31';

  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Pool,
    private readonly plansService: PlansService,
    private readonly settingsService: SettingsService,
    private readonly configService: ConfigService,
    private readonly appleIapService: AppleIapService
  ) {}

  async getAdminMeta() {
    const [studentRows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, full_name, email, status
       FROM users
       WHERE role = 'student'
       ORDER BY FIELD(status, 'active', 'inactive'), full_name ASC`
    );
    const plans = await this.plansService.findAll();
    const featureCatalog = await this.plansService.getFeatureCatalog();
    const [courseRows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, course_title
       FROM courses
       WHERE status = 'active'
       ORDER BY course_title ASC`
    );
    const [lessonRows] = await this.db.execute<RowDataPacket[]>(
      `SELECT l.id, l.lesson_title, l.course_id, c.course_title
       FROM lessons l
       INNER JOIN courses c ON c.id = l.course_id
       WHERE l.status = 'active' AND c.status = 'active'
       ORDER BY c.course_title ASC, l.lesson_title ASC`
    );

    return {
      students: studentRows.map((row) => ({
        id: Number(row.id),
        fullName: String(row.full_name || ''),
        email: String(row.email || ''),
        status: String(row.status || 'inactive'),
      })),
      plans,
      courses: courseRows.map((row) => ({
        id: Number(row.id),
        courseTitle: String(row.course_title || ''),
      })),
      lessons: lessonRows.map((row) => ({
        id: Number(row.id),
        lessonTitle: String(row.lesson_title || ''),
        courseId: Number(row.course_id),
        courseTitle: String(row.course_title || ''),
      })),
      featureCategories: featureCatalog.categories,
      features: featureCatalog.features,
    };
  }

  /**
   * Admin Hub money numbers, over ALL rows (the page used to work them out
   * from the first 100 subscriptions only). Each statement reads only what it
   * returns, by index: active = index count; expiring = active rows ending in
   * the next 7 days; recent payments = the 4 newest confirmed payments; today
   * = today's confirmed payments; pending = requests waiting for the admin.
   * Plan names for the few rows shown come by id. `day` is the
   * admin's own date (YYYY-MM-DD) for "today", as on the page before.
   */
  async adminDashboardFinance(db: Pool | PoolConnection, day: string | null) {
    const serverToday = this.toDateOnly(new Date());
    const today = day || serverToday;

    // Only rows whose student still exists, like the Subscriptions list (a
    // hard user delete leaves its subscriptions behind; see OPTIMIZE P9).
    const [[activeRow]] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS n FROM user_subscriptions us FORCE INDEX (idx_user_subscriptions_status_end)
       INNER JOIN users student ON student.id = us.user_id
       WHERE us.status = 'active'`);
    // Days left 1–7 (same reading as the Subscriptions list: end date counted
    // on the server's date, Apple's exact expiry wins, free plans excluded).
    const [expiringRows] = await db.query<RowDataPacket[]>(
      `SELECT us.plan_id, us.payment_status,
         (us.access_expires_at IS NOT NULL AND us.access_expires_at <= UTC_TIMESTAMP()) AS access_lapsed
       FROM user_subscriptions us FORCE INDEX (idx_user_subscriptions_status_end)
       INNER JOIN users student ON student.id = us.user_id
       WHERE us.status = 'active' AND us.end_date BETWEEN ? AND ?`,
      [serverToday, this.addDays(serverToday, 6)]);
    const [recentRows] = await db.query<RowDataPacket[]>(
      `SELECT us.id, us.plan_id, us.payment_status, us.amount_paid, us.payment_date, us.updated_at,
         student.full_name AS student_name, COALESCE(us.payer_email, student.email) AS student_email
       FROM user_subscriptions us FORCE INDEX (idx_user_subscriptions_collected)
       INNER JOIN users student ON student.id = us.user_id
       WHERE us.is_collected = 1
       ORDER BY us.created_at DESC, us.id DESC
       LIMIT 4`);
    // Collected "today" = its payment date, or when it has none, its last update.
    const [todayRows] = await db.query<RowDataPacket[]>(
      `SELECT us.amount_paid
       FROM user_subscriptions us FORCE INDEX (idx_user_subscriptions_collected_day)
       INNER JOIN users student ON student.id = us.user_id
       WHERE us.is_collected = 1
         AND (us.payment_date = ? OR (us.payment_date IS NULL AND us.updated_at >= ? AND us.updated_at < CAST(? AS DATE) + INTERVAL 1 DAY))`,
      [today, today, today]);
    const [pendingRows] = await db.query<RowDataPacket[]>(
      `SELECT sr.id, sr.plan_id, sr.invoice_id, sr.payment_amount, sr.payment_currency, sr.requested_at,
         (sr.payment_proof_data_url IS NOT NULL AND sr.payment_proof_data_url <> '') AS has_proof,
         student.full_name AS student_name, COALESCE(sr.payer_email, student.email) AS student_email
       FROM subscription_requests sr FORCE INDEX (idx_subscription_requests_visible)
       INNER JOIN users student ON student.id = sr.user_id
       WHERE sr.admin_visible = 1 AND sr.status = 'pending'
       ORDER BY sr.requested_at DESC, sr.id DESC`);

    const queueRows = pendingRows.slice(0, 5);
    const pendingPaidRows = pendingRows.filter((r) => Number(r.payment_amount || 0) > 0).slice(0, 3);
    const shown = [...recentRows, ...queueRows, ...pendingPaidRows];
    const planIds = [...new Set([...expiringRows, ...shown].map((r) => Number(r.plan_id)).filter((v) => v > 0))];
    const [planRows] = planIds.length
      ? await db.query<RowDataPacket[]>(
        'SELECT id, name, slug, price, regular_price, offer_price, offer_enabled FROM plans WHERE id IN (?)', [planIds])
      : [[] as RowDataPacket[]];
    const plans = new Map(planRows.map((p) => {
      const regularPrice = Number(p.regular_price ?? p.price ?? 0);
      const offerPrice = p.offer_price === null || p.offer_price === undefined ? null : Number(p.offer_price);
      const effectivePrice = Number(p.offer_enabled) === 1 && offerPrice !== null ? offerPrice : regularPrice;
      return [Number(p.id), { name: String(p.name || ''), slug: String(p.slug || ''), effectivePrice }];
    }));
    const who = (r: RowDataPacket) => ({ studentName: String(r.student_name || ''), studentEmail: String(r.student_email || '') });
    const request = (r: RowDataPacket) => ({
      id: Number(r.id),
      ...who(r),
      planName: plans.get(Number(r.plan_id))?.name || '',
      invoiceId: r.invoice_id ? String(r.invoice_id) : null,
      paymentAmount: r.payment_amount === null || r.payment_amount === undefined ? null : Number(r.payment_amount),
      paymentCurrency: String(r.payment_currency || ''),
      planCurrency: this.normalizePaymentCurrency(null),
      hasProof: Number(r.has_proof) === 1,
      requestedAt: this.timestampValueToText(r.requested_at),
    });

    return {
      currency: this.normalizePaymentCurrency(null),
      activeSubscriptions: Number(activeRow?.n || 0),
      expiringSoon: expiringRows.filter((r) =>
        Number(r.access_lapsed) !== 1
        && !this.isFreePlanAssignment(r.payment_status, plans.get(Number(r.plan_id)) || {})).length,
      todayRevenue: todayRows.reduce((t, r) => t + Number(r.amount_paid || 0), 0),
      pendingRequests: pendingRows.length,
      pendingAmount: pendingRows.reduce((t, r) => t + Number(r.payment_amount || 0), 0),
      approvalQueue: queueRows.map(request),
      pendingPayments: pendingPaidRows.map(request),
      recentPayments: recentRows.map((r) => ({
        id: Number(r.id),
        ...who(r),
        planName: plans.get(Number(r.plan_id))?.name || '',
        amountPaid: Number(r.amount_paid || 0),
        planCurrency: this.normalizePaymentCurrency(null),
        paymentStatus: String(r.payment_status || ''),
        // Same date the page showed: payment date, else last update.
        collectedAt: r.payment_date ? this.dateValueToText(r.payment_date) : this.timestampValueToText(r.updated_at),
      })),
    };
  }

  /** The page's own free-plan rule (the Free plan every student gets on signup). */
  private isListedFree(paymentStatus: unknown, plan?: { name?: string; effectivePrice?: number } | null) {
    return String(paymentStatus || '') === 'free_plan'
      || (String(plan?.name || '').trim().toLowerCase() === 'free' && Number(plan?.effectivePrice || 0) <= 0);
  }

  /** All plans, slim (a handful of rows): names, prices, free check. */
  private async loadSlimPlans(db: Pool | PoolConnection) {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT id, name, slug, price, regular_price, offer_price, offer_enabled, currency, duration_days, recommended FROM plans');
    return new Map(rows.map((p) => {
      const regularPrice = Number(p.regular_price ?? p.price ?? 0);
      const offerPrice = p.offer_price === null || p.offer_price === undefined ? null : Number(p.offer_price);
      const offerEnabled = Number(p.offer_enabled) === 1;
      return [Number(p.id), {
        id: Number(p.id), name: String(p.name || ''), slug: String(p.slug || ''), currency: String(p.currency || 'LKR'),
        regularPrice, offerPrice, offerEnabled, effectivePrice: offerEnabled && offerPrice !== null ? offerPrice : regularPrice,
        durationDays: Number(p.duration_days || 0), recommended: Number(p.recommended) === 1,
        features: [], enabledFeatures: [], featureKeys: [],
      }];
    }));
  }

  /**
   * Subscriptions page header: counts and the course list (4 rows), one
   * connection. Same rules as the page used, but over ALL rows (the page
   * counted the newest 100 it had downloaded). Subscriptions and requests of
   * deleted students are left out, as the lists do (see OPTIMIZE P9).
   */
  async adminSubscriptionsOverview() {
    const conn = await this.db.getConnection();
    try {
      const serverToday = this.toDateOnly(new Date());
      const plans = await this.loadSlimPlans(conn);
      const freePlanIds = [...plans.values()].filter((p) => this.isListedFree('', p)).map((p) => p.id);
      const expiringFreeIds = [...plans.values()].filter((p) => this.isFreePlan(p)).map((p) => p.id);
      const [[students]] = await conn.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM users FORCE INDEX (idx_users_role_status_live) WHERE role = 'student' AND deleted_at IS NULL");
      const [[pending]] = await conn.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS n FROM subscription_requests sr FORCE INDEX (idx_subscription_requests_visible)
         INNER JOIN users student ON student.id = sr.user_id
         WHERE sr.admin_visible = 1 AND sr.status = 'pending'`);
      const [[paid]] = await conn.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total,
           COALESCE(SUM(us.status = 'active'), 0) AS active,
           COALESCE(SUM(us.status = 'active' AND us.end_date BETWEEN ? AND ?
             AND NOT (us.access_expires_at IS NOT NULL AND us.access_expires_at <= UTC_TIMESTAMP())
             AND us.plan_id NOT IN (?)), 0) AS expiring
         FROM user_subscriptions us FORCE INDEX (idx_user_subscriptions_payment_status)
         INNER JOIN users student ON student.id = us.user_id
         -- The three non-free values (the index is not used for "<> 'free_plan'").
         WHERE us.payment_status IN ('manual', 'paid', 'unpaid') AND us.plan_id NOT IN (?)`,
        [serverToday, this.addDays(serverToday, 6), expiringFreeIds.length ? expiringFreeIds : [0], freePlanIds.length ? freePlanIds : [0]]);
      const [courses] = await conn.query<RowDataPacket[]>('SELECT id, course_title FROM courses');
      return {
        students: Number(students?.n || 0),
        pendingRequests: Number(pending?.n || 0),
        paidTotal: Number(paid?.total || 0),
        activePaid: Number(paid?.active || 0),
        expiringSoon: Number(paid?.expiring || 0),
        courses: courses.map((c) => ({ id: Number(c.id), courseTitle: String(c.course_title || '') })),
      };
    } finally {
      conn.release();
    }
  }

  /**
   * The Subscriptions tab: every subscription except the free plan, without
   * the plan's feature list in each row (that was most of the old 491 KB for
   * 100 rows). The free-plan rows are skipped by index; names come by id.
   */
  async findAdminPaidList() {
    const conn = await this.db.getConnection();
    try {
      const plans = await this.loadSlimPlans(conn);
      const [rows] = await conn.query<SubscriptionRow[]>(
        `SELECT ${SUBSCRIPTION_LIST_COLUMNS}, us.payer_email
         FROM user_subscriptions us FORCE INDEX (idx_user_subscriptions_payment_status)
         -- The three non-free values (the index is not used for "<> 'free_plan'").
         WHERE us.payment_status IN ('manual', 'paid', 'unpaid')`);
      // Newest first, as the old list endpoint sorted (in the app, not a database sort).
      const time = (v: unknown) => (v instanceof Date ? v.getTime() : new Date(String(v || 0)).getTime()) || 0;
      const listed = rows
        .filter((row) => !this.isListedFree(row.payment_status, plans.get(Number(row.plan_id))))
        .sort((a, b) => time(b.created_at) - time(a.created_at) || Number(b.id) - Number(a.id));
      const userIds = [...new Set(listed.flatMap((row) => [Number(row.user_id), Number(row.assigned_by || 0)]).filter((v) => v > 0))];
      const [userRows] = userIds.length
        ? await conn.query<RowDataPacket[]>('SELECT id, full_name, email FROM users FORCE INDEX (PRIMARY) WHERE id IN (?)', [userIds])
        : [[] as RowDataPacket[]];
      const users = new Map(userRows.map((u) => [Number(u.id), u]));
      const result = [];
      for (const row of listed) {
        const student = users.get(Number(row.user_id));
        if (!student) continue; // deleted student: hidden, as before
        const plan = plans.get(Number(row.plan_id));
        if (!plan) continue; // no plan row: hidden, as before (INNER JOIN plans)
        const admin = row.assigned_by ? users.get(Number(row.assigned_by)) : undefined;
        const mapped: Record<string, unknown> = await this.mapSubscription({
          ...row,
          student_name: student.full_name,
          student_email: (row as any).payer_email || student.email,
          assigned_by_name: admin?.full_name || '',
          assigned_by_email: admin?.email || '',
          plan_name: plan.name,
          plan_regular_price: plan.regularPrice,
          plan_offer_price: plan.offerPrice,
          plan_offer_enabled: plan.offerEnabled ? 1 : 0,
          plan_currency: plan.currency,
          plan_duration_days: plan.durationDays,
          plan_recommended: plan.recommended ? 1 : 0,
        } as SubscriptionRow, plan as any);
        delete mapped.planFeatures;
        delete mapped.enabledFeatures;
        delete mapped.featureKeys;
        result.push(mapped);
      }
      return result;
    } finally {
      conn.release();
    }
  }

  /** Finance "Gateway totals": online payment transactions per status (one grouped read; same numbers as Reports). */
  async paymentTotals() {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT status, COUNT(*) AS count_value, SUM(amount) AS amount_total
       FROM payment_transactions GROUP BY status`);
    return rows.map((row) => ({
      status: String(row.status || 'unknown'),
      currency: 'LKR',
      count: Number(row.count_value || 0),
      amount: Number(row.amount_total || 0),
    }));
  }

  /** Assign form: students by name or e-mail (word start, up to 20). */
  async searchStudentsForAssign(query: string | undefined) {
    const filter = wordSearchFilter(['full_name', 'email'], searchWords(String(query || '')));
    if (!filter) return [];
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id, full_name, email, status FROM users WHERE ${filter.sql} AND role = 'student' AND deleted_at IS NULL LIMIT 20`, filter.params);
    return rows.map((r) => ({ id: Number(r.id), fullName: String(r.full_name || ''), email: String(r.email || ''), status: String(r.status || '') }));
  }

  /**
   * Lesson titles for lesson-scoped subscriptions: by id (a subscription's
   * details), or all of them when the admin picks "lessons" in the assign form.
   */
  async findLessonTitles(ids?: number[]) {
    const clean = (ids || []).filter((v) => Number.isInteger(v) && v > 0).slice(0, 500);
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT l.id, l.lesson_title, l.course_id, c.course_title
       FROM lessons l INNER JOIN courses c ON c.id = l.course_id
       WHERE l.is_public = 1 AND l.engine_key = 'gemini' ${ids ? 'AND l.id IN (?)' : ''}`,
      ids ? [clean.length ? clean : [0]] : []);
    return rows.map((r) => ({ id: Number(r.id), lessonTitle: String(r.lesson_title || ''), courseId: Number(r.course_id), courseTitle: String(r.course_title || '') }));
  }

  async findAdminList(pagination: PaginationInput = {}) {
    const { limit, offset } = normalizePagination(pagination, { defaultLimit: 50, maxLimit: 100 });
    const [rows] = await this.db.execute<SubscriptionRow[]>(
      `SELECT
         ${SUBSCRIPTION_LIST_COLUMNS},
         student.full_name AS student_name,
         COALESCE(us.payer_email, student.email) AS student_email,
         admin.full_name AS assigned_by_name,
         admin.email AS assigned_by_email,
         plans.name AS plan_name,
         plans.regular_price AS plan_regular_price,
         plans.offer_price AS plan_offer_price,
         plans.offer_enabled AS plan_offer_enabled,
         plans.currency AS plan_currency,
         plans.duration_days AS plan_duration_days,
         plans.recommended AS plan_recommended
       FROM user_subscriptions us
       INNER JOIN users student ON student.id = us.user_id
       INNER JOIN plans ON plans.id = us.plan_id
       LEFT JOIN users admin ON admin.id = us.assigned_by
       ORDER BY us.created_at DESC, us.id DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const planMap = await this.loadSubscriptionPlanMap(rows);
    return Promise.all(rows.map((row) => this.mapSubscription(row, planMap.get(Number(row.plan_id)))));
  }

  async assign(dto: AssignSubscriptionDto, assignedBy: number) {
    const student = await this.getStudentOrThrow(dto.userId);
    const plan = await this.plansService.findById(dto.planId);
    const startDate = this.normalizeDate(dto.startDate) || this.toDateOnly(new Date());
    const status = dto.status || 'active';
    const paymentStatus = this.isFreePlan(plan) ? 'free_plan' : dto.paymentStatus || 'manual';
    const endDate = this.isFreePlanAssignment(paymentStatus, plan)
      ? this.unlimitedFreePlanEndDate
      : this.normalizeDate(dto.endDate) || this.addDays(startDate, Math.max(1, plan.durationDays) - 1);
    const scope = this.normalizeAccessScope(dto.accessScope, dto.courseIds, dto.lessonIds);

    if (endDate < startDate) {
      throw new BadRequestException('End date cannot be earlier than start date');
    }

    const subscriptionId = await this.createSubscription({
      userId: student.id,
      planId: plan.id,
      assignedBy,
      notes: dto.notes,
      status,
      paymentStatus,
      startDate,
      endDate,
      amountPaid: dto.amountPaid,
      paymentMethod: dto.paymentMethod,
      paymentReference: dto.paymentReference,
      paymentDate: dto.paymentDate,
      receiptUrl: dto.receiptUrl,
      accessScope: scope.accessScope,
      courseIds: scope.courseIds,
      lessonIds: scope.lessonIds,
      cancelExisting: true,
    });

    await this.logAudit({
      subscriptionId,
      userId: student.id,
      actorId: assignedBy,
      eventType: 'assigned',
      summary: `Assigned ${plan.name} to ${student.email}`,
      details: { planId: plan.id, startDate, endDate, paymentStatus, ...scope },
    });

    return { ok: true, id: subscriptionId };
  }

  async requestUpgrade(userId: number, dto: Pick<RequestSubscriptionDto, 'planId' | 'message' | 'accessScope' | 'courseIds' | 'lessonIds'>) {
    const student = await this.getStudentOrThrow(userId);
    const plan = await this.plansService.findById(dto.planId);
    const scope = this.normalizeAccessScope(dto.accessScope, dto.courseIds, dto.lessonIds);

    const [existingRows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id FROM subscription_requests WHERE user_id = ? AND plan_id = ? AND status = 'pending' LIMIT 1`,
      [student.id, plan.id]
    );
    if (existingRows[0]) {
      throw new BadRequestException('You already have a pending request for this plan');
    }

    const [result] = await this.db.execute<ResultSetHeader>(
      `INSERT INTO subscription_requests (
         user_id, plan_id, message, access_scope, course_ids_json, lesson_ids_json, status
       ) VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [
        student.id,
        plan.id,
        String(dto.message || '').trim(),
        scope.accessScope,
        JSON.stringify(scope.courseIds),
        JSON.stringify(scope.lessonIds),
      ]
    );

    await this.logAudit({
      requestId: result.insertId,
      userId: student.id,
      actorId: student.id,
      eventType: 'request_created',
      summary: `${student.email} requested ${plan.name}`,
      details: { planId: plan.id, ...scope },
    });

    return { ok: true, id: result.insertId };
  }

  async previewCheckoutCoupon(userId: number, dto: RequestSubscriptionDto) {
    await this.getStudentOrThrow(userId);
    const plan = await this.plansService.findById(dto.planId);
    this.normalizeAccessScope(dto.accessScope, dto.courseIds, dto.lessonIds);
    return this.buildCheckoutCouponQuote(plan, dto.couponCode, true);
  }

  async requestCouponApproval(userId: number, dto: RequestSubscriptionDto) {
    const student = await this.getStudentOrThrow(userId);
    const plan = await this.plansService.findById(dto.planId);
    const scope = this.normalizeAccessScope(dto.accessScope, dto.courseIds, dto.lessonIds);
    const quote = await this.buildCheckoutCouponQuote(plan, dto.couponCode, true);

    if (!quote.requiresApproval) {
      throw new BadRequestException('This coupon still requires payment. Choose bank transfer or Card / PayHere to continue.');
    }

    const [existingRows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id FROM subscription_requests WHERE user_id = ? AND plan_id = ? AND status = 'pending' LIMIT 1`,
      [student.id, plan.id]
    );
    if (existingRows[0]) {
      throw new BadRequestException('You already have a pending request for this plan');
    }

    const messageParts = [
      String(dto.message || '').trim(),
      `Coupon approval requested: ${quote.couponCode}`,
    ].filter(Boolean);

    const [result] = await this.db.execute<ResultSetHeader>(
      `INSERT INTO subscription_requests (
         user_id, plan_id, message, payment_method, payment_reference, payment_amount, payment_currency,
         coupon_code, discount_amount, access_scope, course_ids_json, lesson_ids_json, status
       ) VALUES (?, ?, ?, 'coupon', ?, 0.00, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        student.id,
        plan.id,
        messageParts.join('\n'),
        quote.couponCode,
        quote.currency,
        quote.couponCode,
        Number(quote.discountAmount),
        scope.accessScope,
        JSON.stringify(scope.courseIds),
        JSON.stringify(scope.lessonIds),
      ]
    );

    await this.logAudit({
      requestId: result.insertId,
      userId: student.id,
      actorId: student.id,
      eventType: 'coupon_approval_requested',
      summary: `${student.email} requested coupon approval for ${plan.name}`,
      details: { planId: plan.id, originalAmount: quote.originalAmount, discountAmount: quote.discountAmount, couponCode: quote.couponCode, currency: quote.currency, ...scope },
    });

    return {
      ok: true,
      id: result.insertId,
      ...quote,
    };
  }

  async requestManualPayment(
    userId: number,
    dto: ManualPaymentRequestDto,
    known?: { id: number; fullName?: string; email?: string; status?: string },
  ) {
    // 10.50 F2: the controller's fresh sign-in check already read this student.
    const student = known && Number(known.id) === Number(userId)
      ? { id: Number(known.id), fullName: String(known.fullName || ''), email: String(known.email || ''), status: String(known.status || 'active') }
      : await this.getStudentOrThrow(userId);
    const plan = await this.plansService.findById(dto.planId);
    const scope = this.normalizeAccessScope(dto.accessScope, dto.courseIds, dto.lessonIds);
    const proofDataUrl = String(dto.proofDataUrl || '').trim();

    const [existingRows] = await this.db.execute<SubscriptionRequestRow[]>(
      `SELECT id, invoice_id, payment_proof_data_url
       FROM subscription_requests
       WHERE user_id = ? AND plan_id = ? AND status = 'pending'
         AND (payment_method = 'bank_transfer' OR payment_method IS NULL)
       ORDER BY id DESC
       LIMIT 1`,
      [student.id, plan.id]
    );
    const existing = existingRows[0] || null;
    if (existing?.payment_proof_data_url) {
      throw new BadRequestException('You already uploaded payment proof for this plan');
    }
    const proofFile = proofDataUrl ? this.parsePaymentProofDataUrl(proofDataUrl) : null;

    const messageParts = [
      String(dto.message || '').trim(),
      dto.billingName ? `Billing name: ${String(dto.billingName).trim()}` : '',
      dto.billingEmail ? `Billing email: ${String(dto.billingEmail).trim()}` : '',
      dto.phone ? `Phone: ${String(dto.phone).trim()}` : '',
      dto.couponCode ? `Coupon: ${String(dto.couponCode).trim().toUpperCase()}` : '',
    ].filter(Boolean);

    const amount = Number(plan.effectivePrice || 0);
    const coupon = await this.resolveCouponForCheckout(dto.couponCode, amount, plan.id);
    const discountAmount = coupon ? coupon.discountAmount : 0;
    const payableAmount = Number(this.formatAmount(Math.max(0, amount - discountAmount)));
    if (coupon && payableAmount <= 0) {
      throw new BadRequestException('This coupon covers the full amount. Request admin approval instead of uploading a bank transfer proof.');
    }
    const currency = String(plan.currency || 'LKR').toUpperCase();
    const invoiceId = String(existing?.invoice_id || '') || await this.generateInvoiceId();
    const message = messageParts.join('\n');
    let requestId = existing ? Number(existing.id) : 0;

    if (!existing) {
      const [result] = await this.db.execute<ResultSetHeader>(
        `INSERT INTO subscription_requests (
           user_id, plan_id, invoice_id, message, payment_method, payment_reference, payment_amount, payment_currency,
           coupon_code, discount_amount, access_scope, course_ids_json, lesson_ids_json, status
         ) VALUES (?, ?, ?, ?, 'bank_transfer', ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          student.id,
          plan.id,
          invoiceId,
          message,
          String(dto.paymentReference || '').trim() || null,
          payableAmount,
          currency,
          coupon?.code || null,
          discountAmount,
          scope.accessScope,
          JSON.stringify(scope.courseIds),
          JSON.stringify(scope.lessonIds),
        ]
      );
      requestId = result.insertId;

      await this.logAudit({
        requestId,
        userId: student.id,
        actorId: student.id,
        eventType: 'bank_transfer_invoice_created',
        summary: `${student.email} created bank transfer invoice ${invoiceId} for ${plan.name}`,
        details: { planId: plan.id, amount: payableAmount, originalAmount: amount, discountAmount, couponCode: coupon?.code || '', currency, invoiceId, ...scope },
      });
    } else {
      await this.db.execute(
        `UPDATE subscription_requests
         SET invoice_id = ?, payment_method = 'bank_transfer',
             message = ?, payment_reference = ?, payment_amount = ?, payment_currency = ?,
             coupon_code = ?, discount_amount = ?, access_scope = ?, course_ids_json = ?, lesson_ids_json = ?
         WHERE id = ?`,
        [
          invoiceId,
          message,
          String(dto.paymentReference || '').trim() || null,
          payableAmount,
          currency,
          coupon?.code || null,
          discountAmount,
          scope.accessScope,
          JSON.stringify(scope.courseIds),
          JSON.stringify(scope.lessonIds),
          requestId,
        ]
      );
    }

    if (proofDataUrl) {
      const savedProof = await this.savePaymentProofFile(invoiceId, proofFile);
      await this.db.execute(
        `UPDATE subscription_requests
         SET payment_proof_name = ?, payment_proof_mime = ?, payment_proof_data_url = ?
         WHERE id = ?`,
        [savedProof.fileName, savedProof.mimeType, savedProof.publicPath, requestId]
      );

      await this.logAudit({
        requestId,
        userId: student.id,
        actorId: student.id,
        eventType: 'bank_transfer_uploaded',
        summary: `${student.email} uploaded bank transfer proof for ${plan.name}`,
        details: { planId: plan.id, amount: payableAmount, originalAmount: amount, discountAmount, couponCode: coupon?.code || '', currency, invoiceId, paymentReference: dto.paymentReference || '', proofFileName: savedProof.fileName, ...scope },
      });
    }

    return {
      ok: true,
      id: requestId,
      invoiceId,
      amount: this.formatAmount(payableAmount),
      originalAmount: this.formatAmount(amount),
      discountAmount: this.formatAmount(discountAmount),
      couponCode: coupon?.code || '',
      couponMode: coupon?.couponMode || '',
      currency,
      proofUploaded: Boolean(proofDataUrl),
    };
  }

  async cancelStudentPendingInvoice(userId: number, requestId: number) {
    const request = await this.findRequestById(requestId);
    if (request.userId !== userId) {
      throw new NotFoundException('Pending invoice not found');
    }
    if (request.status !== 'pending') {
      throw new BadRequestException('Only pending invoices can be removed');
    }
    if (!request.invoiceId || !['bank_transfer', 'payhere'].includes(request.paymentMethod)) {
      throw new BadRequestException('Only pending invoices can be removed');
    }
    if (request.paymentProofDataUrl) {
      throw new BadRequestException('Payment proof is already uploaded. Please wait for admin approval.');
    }

    const [result] = await this.db.execute<ResultSetHeader>(
      `UPDATE subscription_requests
       SET status = 'cancelled',
           admin_note = 'Cancelled by student before payment proof upload.',
           resolved_at = NOW(),
           resolved_by = NULL
       WHERE id = ? AND user_id = ? AND status = 'pending' AND payment_proof_data_url IS NULL`,
      [requestId, userId]
    );

    if (result.affectedRows !== 1) {
      throw new BadRequestException('Unable to remove this pending invoice');
    }

    if (request.paymentMethod === 'payhere') {
      await this.db.execute(
        `UPDATE payment_transactions
         SET status = 'cancelled'
         WHERE user_id = ?
           AND (order_id = ? OR invoice_id = ?)
           AND status IN ('initiated', 'pending')`,
        [userId, request.invoiceId, request.invoiceId]
      );
    }

    await this.logAudit({
      requestId,
      userId,
      actorId: userId,
      eventType: 'student_invoice_cancelled',
      summary: `Student removed pending invoice ${request.invoiceId}`,
      details: {
        planId: request.planId,
        planName: request.planName,
        invoiceId: request.invoiceId,
        paymentMethod: request.paymentMethod,
      },
    });

    return { ok: true, id: requestId, invoiceId: request.invoiceId };
  }

  private parsePaymentProofDataUrl(proofDataUrl: string): PaymentProofFile {
    if (!/^data:(image\/(png|jpe?g|webp)|application\/pdf);base64,/i.test(proofDataUrl)) {
      throw new BadRequestException('Payment proof must be a PNG, JPG, WEBP, or PDF file');
    }
    if (proofDataUrl.length > 4_500_000) {
      throw new BadRequestException('Payment proof is too large. Please upload a smaller screenshot or PDF');
    }

    const match = proofDataUrl.match(/^data:(image\/(png|jpe?g|webp)|application\/pdf);base64,(.+)$/i);
    if (!match) {
      throw new BadRequestException('Payment proof must be a PNG, JPG, WEBP, or PDF file');
    }

    const mimeType = match[1].toLowerCase();
    const extension = mimeType.includes('pdf')
      ? 'pdf'
      : mimeType.includes('png')
        ? 'png'
        : mimeType.includes('webp')
          ? 'webp'
          : 'jpg';
    const buffer = Buffer.from(match[3], 'base64');
    if (!buffer.length || buffer.length > 3_500_000) {
      throw new BadRequestException('Payment proof is too large. Please upload a smaller screenshot or PDF');
    }
    if (!this.hasValidPaymentProofSignature(buffer, mimeType)) {
      throw new BadRequestException('Payment proof file contents do not match the selected file type');
    }

    return { mimeType, extension, buffer };
  }

  private async savePaymentProofFile(invoiceId: string, proofFile: PaymentProofFile | null) {
    if (!proofFile) {
      throw new BadRequestException('Payment proof must be a PNG, JPG, WEBP, or PDF file');
    }

    const uploadDir = join(process.cwd(), 'uploads', 'payment-proofs');
    await mkdir(uploadDir, { recursive: true });

    const fileName = `${invoiceId}.${proofFile.extension}`;
    await writeFile(join(uploadDir, fileName), proofFile.buffer);

    return {
      fileName,
      mimeType: proofFile.mimeType,
      publicPath: `/uploads/payment-proofs/${fileName}`,
    };
  }

  async getPaymentProofFile(invoiceId: string) {
    const normalizedInvoiceId = String(invoiceId || '').trim();
    if (!normalizedInvoiceId || !/^[A-Za-z0-9_-]+$/.test(normalizedInvoiceId)) {
      throw new BadRequestException('Invalid invoice ID');
    }

    const [rows] = await this.db.execute<SubscriptionRequestRow[]>(
      `SELECT invoice_id, payment_proof_name, payment_proof_mime, payment_proof_data_url
       FROM subscription_requests
       WHERE invoice_id = ?
       LIMIT 1`,
      [normalizedInvoiceId]
    );
    const request = rows[0];
    if (!request?.payment_proof_data_url) {
      throw new NotFoundException('Payment proof was not uploaded');
    }

    const storedProof = String(request.payment_proof_data_url || '').trim();
    const dataUrlMatch = storedProof.match(/^data:(image\/(?:png|jpe?g|webp)|application\/pdf);base64,(.+)$/i);
    if (dataUrlMatch) {
      const mimeType = dataUrlMatch[1].toLowerCase();
      const buffer = Buffer.from(dataUrlMatch[2], 'base64');
      if (!buffer.length || !this.hasValidPaymentProofSignature(buffer, mimeType)) {
        throw new NotFoundException('Payment proof file is unavailable');
      }
      return {
        buffer,
        mimeType,
        fileName: this.safeDownloadFileName(request.payment_proof_name, `payment-proof-${normalizedInvoiceId}.${this.extensionForMimeType(mimeType)}`),
      };
    }

    if (!storedProof.startsWith('/uploads/payment-proofs/')) {
      throw new NotFoundException('Payment proof file is unavailable');
    }

    const storedFileName = basename(storedProof);
    const filePath = join(process.cwd(), 'uploads', 'payment-proofs', storedFileName);
    const buffer = await readFile(filePath).catch(() => null);
    if (!buffer?.length) {
      throw new NotFoundException('Payment proof file is unavailable');
    }

    const mimeType = String(request.payment_proof_mime || this.mimeTypeForFileName(storedFileName)).toLowerCase();
    return {
      buffer,
      mimeType,
      fileName: this.safeDownloadFileName(request.payment_proof_name, storedFileName),
    };
  }

  private extensionForMimeType(mimeType: string) {
    if (mimeType.includes('pdf')) return 'pdf';
    if (mimeType.includes('png')) return 'png';
    if (mimeType.includes('webp')) return 'webp';
    return 'jpg';
  }

  private mimeTypeForFileName(fileName: string) {
    const lower = String(fileName || '').toLowerCase();
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  }

  private safeDownloadFileName(preferredName: string | null | undefined, fallbackName: string) {
    const safeName = String(preferredName || fallbackName || 'payment-proof')
      .replace(/[^\w.\- ]+/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
    return safeName || fallbackName || 'payment-proof';
  }

  private hasValidPaymentProofSignature(buffer: Buffer, mimeType: string) {
    if (mimeType === 'application/pdf') {
      return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    }
    if (mimeType === 'image/png') {
      return buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a;
    }
    if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }
    if (mimeType === 'image/webp') {
      return buffer.length >= 12 &&
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    }
    return false;
  }

  private async generateInvoiceId() {
    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      const lockCounter = () => connection.execute<RowDataPacket[]>(
        `SELECT setting_value FROM system_settings WHERE setting_key = 'subscription_invoice_next' FOR UPDATE`
      );
      let [rows] = await lockCounter();
      // 10.50 F2: the counter row is created only the first time (it was an
      // INSERT IGNORE on every invoice).
      if (!rows.length) {
        await connection.execute(
          `INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('subscription_invoice_next', '1122')`
        );
        [rows] = await lockCounter();
      }
      const current = Math.max(1122, Number(rows[0]?.setting_value || 1122));
      const next = current + 1;
      await connection.execute(
        `UPDATE system_settings SET setting_value = ? WHERE setting_key = 'subscription_invoice_next'`,
        [String(next)]
      );
      await connection.commit();
      return String(current);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async findAdminRequests() {
    const [rows] = await this.db.execute<SubscriptionRequestRow[]>(
      `SELECT
         sr.id,
         sr.user_id,
         sr.plan_id,
         sr.invoice_id,
         sr.status,
         sr.message,
         sr.admin_note,
         sr.requested_at,
         sr.resolved_at,
         sr.resolved_by,
         sr.subscription_id,
         sr.payment_method,
         sr.payment_reference,
         sr.payment_amount,
         sr.payment_currency,
         sr.coupon_code,
         sr.discount_amount,
         sr.payment_proof_name,
         sr.payment_proof_mime,
         CASE
           WHEN sr.payment_proof_data_url LIKE 'data:%' AND sr.invoice_id IS NOT NULL THEN CONCAT('/uploads/payment-proofs/', sr.invoice_id)
           ELSE sr.payment_proof_data_url
         END AS payment_proof_data_url,
         sr.access_scope,
         sr.course_ids_json,
         sr.lesson_ids_json,
         student.full_name AS student_name,
         COALESCE(sr.payer_email, student.email) AS student_email,
         plans.name AS plan_name,
         plans.regular_price AS plan_regular_price,
         plans.offer_price AS plan_offer_price,
         plans.offer_enabled AS plan_offer_enabled,
         plans.currency AS plan_currency,
         admin.full_name AS resolved_by_name,
         admin.email AS resolved_by_email
       FROM subscription_requests sr FORCE INDEX (idx_subscription_requests_visible)
       INNER JOIN users student ON student.id = sr.user_id
       INNER JOIN plans ON plans.id = sr.plan_id
       LEFT JOIN users admin ON admin.id = sr.resolved_by
       -- admin_visible = not an abandoned online checkout (same rule as
       -- before, as an indexed VIRTUAL column), so abandoned ones aren't read.
       WHERE sr.admin_visible = 1
       ORDER BY FIELD(sr.status, 'pending', 'approved', 'rejected', 'cancelled'), sr.requested_at DESC, sr.id DESC`
    );

    return rows.map((row) => this.mapRequest(row));
  }

  async resolveRequest(requestId: number, status: 'approved' | 'rejected' | 'cancelled', adminNote: string | undefined, adminId: number) {
    const request = await this.findRequestById(requestId);
    if (request.status !== 'pending') {
      throw new BadRequestException('Only pending subscription requests can be resolved');
    }

    let subscriptionId: number | null = null;
    if (status === 'approved') {
      const plan = await this.plansService.findById(request.planId);
      const startDate = this.toDateOnly(new Date());
      const endDate = this.addDays(startDate, Math.max(1, plan.durationDays) - 1);
      subscriptionId = await this.createSubscription({
        userId: request.userId,
        planId: request.planId,
        assignedBy: adminId,
        notes: adminNote || `Approved upgrade request #${requestId}`,
        status: 'active',
        paymentStatus: this.isPaidSubscriptionRequest(request) ? 'paid' : 'manual',
        amountPaid: request.paymentAmount ?? undefined,
        paymentMethod: request.paymentMethod || undefined,
        paymentReference: request.paymentReference || undefined,
        paymentDate: this.isPaidSubscriptionRequest(request) ? startDate : undefined,
        startDate,
        endDate,
        accessScope: request.accessScope,
        courseIds: request.courseIds,
        lessonIds: request.lessonIds,
        cancelExisting: true,
      });

      if (request.couponCode) {
        await this.db.execute(
          'UPDATE subscription_coupons SET redemption_count = redemption_count + 1 WHERE code = ?',
          [request.couponCode]
        );
      }

      await this.logAudit({
        subscriptionId,
        requestId,
        userId: request.userId,
        actorId: adminId,
        eventType: 'request_approved',
        summary: `Approved request for ${plan.name}`,
        details: { planId: request.planId, startDate, endDate, paymentMethod: request.paymentMethod || '', paymentReference: request.paymentReference || '', couponCode: request.couponCode || '', discountAmount: request.discountAmount || 0, accessScope: request.accessScope, courseIds: request.courseIds, lessonIds: request.lessonIds },
      });
    } else {
      await this.logAudit({
        requestId,
        userId: request.userId,
        actorId: adminId,
        eventType: status === 'rejected' ? 'request_rejected' : 'request_cancelled',
        summary: status === 'rejected' ? 'Rejected subscription request' : 'Cancelled subscription request',
        details: { planId: request.planId },
      });
    }

    await this.db.execute(
      `UPDATE subscription_requests
       SET status = ?, admin_note = ?, resolved_at = NOW(), resolved_by = ?, subscription_id = ?
       WHERE id = ?`,
      [status, String(adminNote || '').trim(), adminId, subscriptionId, requestId]
    );

    return { ok: true, id: requestId, subscriptionId };
  }

  /**
   * 10.56: the app's Subscription page. One indexed statement for the
   * student's current subscription (same pick order as getStudentBilling);
   * the plan name comes from the plan memory. Only the fields the app reads.
   */
  async getStudentCurrentPlanForApp(userId: number) {
    const [raw] = await this.db.execute<SubscriptionRow[]>(
      `SELECT ${SUBSCRIPTION_LIST_COLUMNS}
       FROM user_subscriptions us
       WHERE us.user_id = ?
       ORDER BY FIELD(us.status, 'active', 'pending', 'expired', 'cancelled'), us.end_date DESC, us.id DESC
       LIMIT 1`,
      [userId]
    );
    const plans = await this.plansService.findByIds(raw.map((row) => Number(row.plan_id)));
    const row = this.withPlanColumns(raw, plans)[0];
    if (!row) return { currentSubscription: null };
    const s = await this.mapSubscription(row, plans.get(Number(row.plan_id)));
    return {
      currentSubscription: {
        planName: s.planName,
        status: s.status,
        computedStatus: s.computedStatus,
        isFreePlan: s.isFreePlan,
        isUnlimitedAccess: s.isUnlimitedAccess,
        startDate: s.startDate,
        endDate: s.endDate,
        daysRemaining: s.daysRemaining,
        isExpiringSoon: s.isExpiringSoon,
      },
    };
  }

  async getStudentBilling(userId: number) {
    // 10.35: one statement for the history AND the current subscription (was
    // two reads of the same rows). The current one is picked here with the
    // same order the old query used; only a student with more than 12 rows
    // (none today) falls back to the dedicated query.
    // 10.50: only the student's own rows (examined = returned); plan names and
    // prices come from the plan memory, and the admin's name is not shown to
    // students, so no joins.
    const [rawHistoryRows] = await this.db.execute<SubscriptionRow[]>(
      `SELECT ${SUBSCRIPTION_LIST_COLUMNS}
       FROM user_subscriptions us
       WHERE us.user_id = ?
       ORDER BY us.id DESC
       LIMIT 13`,
      [userId]
    );
    const historyRows = this.withPlanColumns(
      rawHistoryRows,
      await this.plansService.findByIds(rawHistoryRows.map((row) => Number(row.plan_id))),
    );
    let currentRows: SubscriptionRow[];
    if (historyRows.length > 12) {
      historyRows.length = 12;
      const [rawCurrent] = await this.db.execute<SubscriptionRow[]>(
        `SELECT ${SUBSCRIPTION_LIST_COLUMNS}
         FROM user_subscriptions us
         WHERE us.user_id = ?
         ORDER BY FIELD(us.status, 'active', 'pending', 'expired', 'cancelled'), us.end_date DESC, us.id DESC
         LIMIT 1`,
        [userId]
      );
      currentRows = this.withPlanColumns(rawCurrent, await this.plansService.findByIds(rawCurrent.map((row) => Number(row.plan_id))));
    } else {
      // FIELD() gives 0 for any other status, which sorts first in SQL.
      const rank = (status: unknown) => ['active', 'pending', 'expired', 'cancelled'].indexOf(String(status)) + 1;
      const endOf = (row: SubscriptionRow) => {
        const t = new Date(row.end_date as any).getTime();
        return Number.isFinite(t) ? t : -Infinity;
      };
      const best = [...historyRows].sort((a, b) =>
        rank(a.status) - rank(b.status) || endOf(b) - endOf(a) || Number(b.id) - Number(a.id))[0];
      currentRows = best ? [best] : [];
    }

    const availablePlans = await this.plansService.findActive();
    const planMap = await this.loadSubscriptionPlanMap([...currentRows, ...historyRows]);
    const paymentSettings = await this.settingsService.getPayHereCheckoutSettings();

    return {
      currentSubscription: currentRows[0] ? await this.mapSubscription(currentRows[0], planMap.get(Number(currentRows[0].plan_id))) : null,
      history: (await Promise.all(historyRows.map((row) => this.mapSubscription(row, planMap.get(Number(row.plan_id))))))
        .filter((subscription) => !subscription.isFreePlan),
      availablePlans,
      requests: await this.findStudentRequests(userId),
      payment: this.settingsService.studentPaymentSettingsFrom(paymentSettings),
      // Tells the mobile app which checkout to use: native PayHere SDK or web
      // fallback (web admin → PayHere → App SDK). Flippable without an app update.
      appCheckoutMode: paymentSettings.appCheckoutMode,
    };
  }

  async findCoupons() {
    const [rows] = await this.db.execute<SubscriptionCouponRow[]>(
      `SELECT
         id, code, label, coupon_mode, discount_type, discount_value, plan_ids_json,
         status, starts_at, expires_at, max_redemptions, redemption_count, created_at, updated_at
       FROM subscription_coupons
       ORDER BY status ASC, updated_at DESC, id DESC`
    );

    return rows.map((row) => this.mapCoupon(row));
  }

  async findInvoice(invoiceIdInput: string) {
    const invoiceId = String(invoiceIdInput || '').trim();
    if (!/^\d{3,20}$/.test(invoiceId)) {
      throw new BadRequestException('Enter a valid invoice ID');
    }

    const [transactionRows] = await this.db.execute<RowDataPacket[]>(
      `SELECT
         pt.id,
         pt.provider,
         pt.invoice_id,
         pt.order_id,
         pt.status,
         pt.amount,
         pt.currency,
         pt.coupon_code,
         pt.discount_amount,
         pt.order_note,
         pt.payhere_payment_id,
         pt.payment_method,
         pt.created_at,
         pt.updated_at,
         student.full_name AS student_name,
         COALESCE(pt.payer_email, student.email) AS student_email,
         plans.name AS plan_name
       FROM payment_transactions pt
       INNER JOIN users student ON student.id = pt.user_id
       INNER JOIN plans ON plans.id = pt.plan_id
       WHERE pt.invoice_id = ? OR pt.order_id = ?
       LIMIT 1`,
      [invoiceId, invoiceId]
    );
    if (transactionRows[0]) {
      const row = transactionRows[0];
      return {
        found: true,
        type: 'card',
        provider: String(row.provider || 'payhere'),
        invoiceId: String(row.invoice_id || row.order_id || ''),
        orderId: String(row.order_id || ''),
        status: String(row.status || ''),
        studentName: String(row.student_name || ''),
        studentEmail: String(row.student_email || ''),
        planName: String(row.plan_name || ''),
        amount: Number(row.amount || 0),
        currency: this.normalizePaymentCurrency(row.currency),
        couponCode: String(row.coupon_code || ''),
        discountAmount: Number(row.discount_amount || 0),
        orderNote: String(row.order_note || ''),
        payherePaymentId: String(row.payhere_payment_id || ''),
        paymentMethod: String(row.payment_method || ''),
        createdAt: this.timestampValueToText(row.created_at),
        updatedAt: this.timestampValueToText(row.updated_at),
      };
    }

    const [requestRows] = await this.db.execute<RowDataPacket[]>(
      `SELECT
         sr.id,
         sr.user_id,
         sr.plan_id,
         sr.invoice_id,
         sr.status,
         sr.message,
         sr.admin_note,
         sr.requested_at,
         sr.resolved_at,
         sr.resolved_by,
         sr.subscription_id,
         sr.payment_method,
         sr.payment_reference,
         sr.payment_amount,
         sr.payment_currency,
         sr.coupon_code,
         sr.discount_amount,
         sr.payment_proof_name,
         sr.payment_proof_mime,
         sr.payment_proof_data_url,
         sr.access_scope,
         sr.course_ids_json,
         sr.lesson_ids_json,
         student.full_name AS student_name,
         COALESCE(sr.payer_email, student.email) AS student_email,
         plans.name AS plan_name
       FROM subscription_requests sr
       INNER JOIN users student ON student.id = sr.user_id
       INNER JOIN plans ON plans.id = sr.plan_id
       WHERE sr.invoice_id = ?
       LIMIT 1`,
      [invoiceId]
    );
    if (requestRows[0]) {
      const row = requestRows[0];
      return {
        found: true,
        type: 'bank_transfer',
        invoiceId: String(row.invoice_id || ''),
        status: String(row.status || ''),
        studentName: String(row.student_name || ''),
        studentEmail: String(row.student_email || ''),
        planName: String(row.plan_name || ''),
        amount: row.payment_amount === null || row.payment_amount === undefined ? null : Number(row.payment_amount),
        currency: this.normalizePaymentCurrency(row.payment_currency),
        couponCode: String(row.coupon_code || ''),
        discountAmount: Number(row.discount_amount || 0),
        paymentReference: String(row.payment_reference || ''),
        paymentProofName: String(row.payment_proof_name || ''),
        paymentProofMime: String(row.payment_proof_mime || ''),
        paymentProofDataUrl: String(row.payment_proof_data_url || ''),
        requestedAt: this.timestampValueToText(row.requested_at),
        resolvedAt: this.timestampValueToText(row.resolved_at),
        adminNote: String(row.admin_note || ''),
      };
    }

    return { found: false, invoiceId };
  }

  async createCoupon(dto: SubscriptionCouponDto, adminId: number) {
    const payload = this.normalizeCouponPayload(dto);
    const [result] = await this.db.execute<ResultSetHeader>(
      `
        INSERT INTO subscription_coupons (
          code, label, coupon_mode, discount_type, discount_value, plan_ids_json, status, starts_at, expires_at, max_redemptions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payload.code,
        payload.label,
        payload.couponMode,
        payload.discountType,
        payload.discountValue,
        JSON.stringify(payload.planIds),
        payload.status,
        payload.startsAt || null,
        payload.expiresAt || null,
        payload.maxRedemptions,
      ]
    );

    await this.logAudit({
      actorId: adminId,
      eventType: 'coupon_created',
      summary: `Created coupon ${payload.code}`,
      details: payload,
    });

    return { ok: true, id: result.insertId };
  }

  async updateCoupon(id: number, dto: SubscriptionCouponDto, adminId: number) {
    await this.getCouponRowOrThrow(id);
    const payload = this.normalizeCouponPayload(dto);
    await this.db.execute(
      `
        UPDATE subscription_coupons
        SET code = ?,
            label = ?,
            coupon_mode = ?,
            discount_type = ?,
            discount_value = ?,
            plan_ids_json = ?,
            status = ?,
            starts_at = ?,
            expires_at = ?,
            max_redemptions = ?
        WHERE id = ?
      `,
      [
        payload.code,
        payload.label,
        payload.couponMode,
        payload.discountType,
        payload.discountValue,
        JSON.stringify(payload.planIds),
        payload.status,
        payload.startsAt || null,
        payload.expiresAt || null,
        payload.maxRedemptions,
        id,
      ]
    );

    await this.logAudit({
      actorId: adminId,
      eventType: 'coupon_updated',
      summary: `Updated coupon ${payload.code}`,
      details: { id, ...payload },
    });

    return { ok: true, id };
  }

  async deleteCoupon(id: number, adminId: number) {
    const coupon = await this.getCouponRowOrThrow(id);
    await this.db.execute('DELETE FROM subscription_coupons WHERE id = ?', [id]);
    await this.logAudit({
      actorId: adminId,
      eventType: 'coupon_deleted',
      summary: `Deleted coupon ${coupon.code}`,
      details: { id, code: coupon.code },
    });
    return { ok: true, id };
  }

  async initiatePayHereCheckout(userId: number, planId: number, checkoutInput: {
    couponCode?: string;
    billingName?: string;
    billingEmail?: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
    message?: string;
    accessScope?: 'all' | 'courses' | 'lessons';
    courseIds?: number[];
    lessonIds?: number[];
  } = {}) {
    const student = await this.getStudentOrThrow(userId);
    const plan = await this.plansService.findById(planId);
    const settings = await this.settingsService.getPayHereCheckoutSettings();

    if (!settings.enabled) {
      throw new BadRequestException('Online payments are not enabled yet.');
    }
    if (!settings.merchantId || !settings.merchantSecret) {
      throw new BadRequestException('PayHere merchant details are not configured yet.');
    }

    const amount = Number(plan.effectivePrice || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('This plan does not have a payable amount.');
    }
    const scope = this.normalizeAccessScope(checkoutInput.accessScope, checkoutInput.courseIds, checkoutInput.lessonIds);

    const coupon = await this.resolveCouponForCheckout(checkoutInput.couponCode, amount, plan.id);
    const discountAmount = coupon ? coupon.discountAmount : 0;
    const payableAmount = Number(this.formatAmount(Math.max(0, amount - discountAmount)));
    if (coupon && payableAmount <= 0) {
      throw new BadRequestException('This coupon covers the full amount. Request admin approval instead of starting Card / PayHere checkout.');
    }

    const currency = settings.currency || String(plan.currency || 'LKR').toUpperCase();
    const invoiceId = await this.generateInvoiceId();
    const orderId = invoiceId;
    const amountFormatted = this.formatAmount(payableAmount);
    const baseFrontendUrl = this.resolveFrontendUrl();
    const returnUrl = settings.returnUrl || `${baseFrontendUrl}/#/subscriptions?payment=return&order_id=${encodeURIComponent(orderId)}`;
    const cancelUrl = settings.cancelUrl || `${baseFrontendUrl}/#/subscriptions?payment=cancel&order_id=${encodeURIComponent(orderId)}`;
    const notifyUrl = this.resolvePayHereNotifyUrl(settings.notifyUrl);
    const billingName = String(checkoutInput.billingName || student.fullName || '').trim() || student.fullName;
    const billingEmail = String(checkoutInput.billingEmail || student.email || '').trim() || student.email;
    const nameParts = this.splitName(billingName);
    const phone = String(checkoutInput.phone || '').trim() || '0770000000';
    const address = String(checkoutInput.address || '').trim() || 'Student account';
    const city = String(checkoutInput.city || '').trim() || 'Colombo';
    const country = String(checkoutInput.country || '').trim() || 'Sri Lanka';

    const requestId = await this.createPayHerePendingRequest({
      userId: student.id,
      planId: plan.id,
      invoiceId,
      orderId,
      message: checkoutInput.message,
      amount: payableAmount,
      currency,
      couponCode: coupon?.code || null,
      discountAmount,
      accessScope: scope.accessScope,
      courseIds: scope.courseIds,
      lessonIds: scope.lessonIds,
    });

    await this.db.execute(
      `
        INSERT INTO payment_transactions (
          provider, order_id, invoice_id, user_id, plan_id, amount, currency, coupon_code, discount_amount, order_note,
          access_scope, course_ids_json, lesson_ids_json, status
        ) VALUES ('payhere', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'initiated')
      `,
      [
        orderId,
        invoiceId,
        student.id,
        plan.id,
        payableAmount,
        currency,
        coupon?.code || null,
        discountAmount,
        String(checkoutInput.message || '').trim() || null,
        scope.accessScope,
        JSON.stringify(scope.courseIds),
        JSON.stringify(scope.lessonIds),
      ]
    );

    await this.logAudit({
      requestId,
      userId: student.id,
      actorId: student.id,
      eventType: 'payhere_checkout_initiated',
      summary: `Started PayHere checkout for ${plan.name}`,
      details: { planId: plan.id, invoiceId, orderId, amount: amountFormatted, originalAmount: this.formatAmount(amount), discountAmount, couponCode: coupon?.code || '', currency, sandboxMode: settings.sandboxMode, billingName, billingEmail, orderNote: checkoutInput.message || '', ...scope },
    });

    return {
      ok: true,
      provider: 'payhere',
      sandboxMode: settings.sandboxMode,
      // Per-app secret for the native mobile SDK (web admin → PayHere → App SDK).
      // Empty string when not configured — the app then can't run native checkout.
      appMerchantSecret: settings.appMerchantSecret || '',
      actionUrl: settings.sandboxMode ? 'https://sandbox.payhere.lk/pay/checkout' : 'https://www.payhere.lk/pay/checkout',
      invoiceId,
      orderId,
      requestId,
      amount: amountFormatted,
      originalAmount: this.formatAmount(amount),
      discountAmount: this.formatAmount(discountAmount),
      couponCode: coupon?.code || '',
      couponMode: coupon?.couponMode || '',
      currency,
      fields: {
        merchant_id: settings.merchantId,
        return_url: returnUrl,
        cancel_url: cancelUrl,
        notify_url: notifyUrl,
        first_name: nameParts.firstName,
        last_name: nameParts.lastName,
        email: billingEmail,
        phone,
        address,
        city,
        country,
        order_id: orderId,
        items: [
          `${settings.checkoutTitle || 'xyndrome subscription'} - ${plan.name}`,
          checkoutInput.message ? `- ${String(checkoutInput.message).slice(0, 80)}` : '',
        ].filter(Boolean).join(' '),
        currency,
        amount: amountFormatted,
        custom_1: String(student.id),
        custom_2: String(plan.id),
        platform: 'xyndrome',
        hash: this.generateCheckoutHash(settings.merchantId, orderId, amountFormatted, currency, settings.merchantSecret),
      },
    };
  }

  async handlePayHereNotification(body: Record<string, string | undefined>) {
    const settings = await this.settingsService.getPayHereCheckoutSettings();
    const merchantId = String(body.merchant_id || '').trim();
    const orderId = String(body.order_id || '').trim();
    const payhereAmount = String(body.payhere_amount || '').trim();
    const payhereCurrency = String(body.payhere_currency || '').trim();
    const statusCode = String(body.status_code || '').trim();
    const md5sig = String(body.md5sig || '').trim().toUpperCase();

    this.assertPayHereNotificationPayload({ merchantId, orderId, payhereAmount, payhereCurrency, statusCode, md5sig });

    if (!settings.merchantId || !settings.merchantSecret) {
      throw new BadRequestException('PayHere is not configured');
    }

    const localSig = this.generateNotificationHash(merchantId, orderId, payhereAmount, payhereCurrency, statusCode, settings.merchantSecret);
    const transaction = await this.findPaymentTransaction(orderId);
    if (!transaction ||
        merchantId !== settings.merchantId ||
        transaction.currency !== payhereCurrency ||
        this.formatAmount(Number(transaction.amount)) !== this.formatAmount(Number(payhereAmount)) ||
        !this.signaturesMatch(localSig, md5sig)) {
      throw new BadRequestException('PayHere notification verification failed');
    }

    const nextStatus = this.mapPayHereStatus(statusCode);
    if (nextStatus === 'paid' && (transaction.status === 'paid' || transaction.subscription_id)) {
      throw new BadRequestException('PayHere notification was already processed');
    }
    let subscriptionId = transaction?.subscription_id ? Number(transaction.subscription_id) : null;
    // Claim the payment before anything is granted. PayHere retries, and two
    // notifications arriving together both pass the check above, so the claim is
    // one conditional UPDATE: only the first to run changes a row, the second
    // finds it already paid and stops here instead of activating a second plan.
    if (nextStatus === 'paid') {
      const [claim] = await this.db.execute<ResultSetHeader>(
        `UPDATE payment_transactions SET status = 'paid' WHERE id = ? AND status <> 'paid' AND subscription_id IS NULL`,
        [transaction.id]
      );
      if (!claim.affectedRows) {
        throw new BadRequestException('PayHere notification was already processed');
      }
    }
    const cardRequest = await this.findPayHereRequest(
      String(transaction.invoice_id || orderId),
      Number(transaction.user_id),
      Number(transaction.plan_id)
    );
    const paymentReference = String(body.payment_id || orderId).trim();

    await this.db.execute(
      `
        UPDATE payment_transactions
        SET status = ?,
            payhere_payment_id = ?,
            payment_method = ?,
            md5sig = ?,
            raw_notify_json = ?
        WHERE id = ?
      `,
      [
        nextStatus,
        String(body.payment_id || '').trim() || null,
        String(body.method || '').trim() || null,
        md5sig || null,
        JSON.stringify(body || {}),
        transaction.id,
      ]
    );

    if (nextStatus === 'paid' && !subscriptionId && settings.autoActivatePaidSubscriptions) {
      const plan = await this.plansService.findById(Number(transaction.plan_id));
      const startDate = this.toDateOnly(new Date());
      const endDate = this.addDays(startDate, Math.max(1, plan.durationDays) - 1);
      subscriptionId = await this.createSubscription({
        userId: Number(transaction.user_id),
        planId: Number(transaction.plan_id),
        assignedBy: null,
        notes: `Activated by verified PayHere payment ${String(body.payment_id || orderId).trim()}.`,
        status: 'active',
        paymentStatus: 'paid',
        startDate,
        endDate,
        amountPaid: Number(transaction.amount),
        paymentMethod: String(body.method || 'PayHere').trim() || 'PayHere',
        paymentReference: String(body.payment_id || orderId).trim(),
        paymentDate: startDate,
        accessScope: transaction.access_scope || 'all',
        courseIds: this.parseIdList(transaction.course_ids_json),
        lessonIds: this.parseIdList(transaction.lesson_ids_json),
        cancelExisting: true,
      });
      await this.db.execute('UPDATE payment_transactions SET subscription_id = ? WHERE id = ?', [subscriptionId, transaction.id]);
      if (cardRequest?.id) {
        await this.markPayHereRequestVerified({
          requestId: cardRequest.id,
          subscriptionId,
          paymentReference,
          adminNote: `PayHere payment verified automatically. Payment ID: ${paymentReference}.`,
        });
      }
      if (transaction.coupon_code) {
        await this.db.execute(
          'UPDATE subscription_coupons SET redemption_count = redemption_count + 1 WHERE code = ?',
          [transaction.coupon_code]
        );
      }
      await this.logAudit({
        subscriptionId,
        userId: Number(transaction.user_id),
        eventType: 'payhere_payment_paid',
        summary: `Verified PayHere payment for ${plan.name}`,
        requestId: cardRequest?.id || null,
        details: { orderId, paymentId: body.payment_id || '', amount: payhereAmount, currency: payhereCurrency, couponCode: transaction.coupon_code || '', discountAmount: transaction.discount_amount || 0, accessScope: transaction.access_scope || 'all', courseIds: this.parseIdList(transaction.course_ids_json), lessonIds: this.parseIdList(transaction.lesson_ids_json) },
      });
    } else {
      if (cardRequest?.id) {
        await this.updatePayHereRequestAfterNotification({
          requestId: cardRequest.id,
          nextStatus,
          paymentReference,
          adminNote: `PayHere payment marked ${nextStatus}. Status code: ${statusCode}.`,
        });
      }
      await this.logAudit({
        userId: Number(transaction.user_id),
        requestId: cardRequest?.id || null,
        eventType: `payhere_payment_${nextStatus}`,
        summary: `PayHere payment marked ${nextStatus}`,
        details: { orderId, statusCode, paymentId: body.payment_id || '', amount: payhereAmount, currency: payhereCurrency },
      });
    }

    return { ok: true };
  }

  async extendSubscription(id: number, days: number, notes: string | undefined, adminId: number) {
    const subscription = await this.getSubscriptionOrThrow(id);
    const cleanDays = Math.max(1, Number(days || 0));
    await this.db.execute(
      `UPDATE user_subscriptions
       SET end_date = DATE_ADD(GREATEST(end_date, CURDATE()), INTERVAL ? DAY),
           status = 'active',
           notes = CONCAT(COALESCE(notes, ''), ?)
       WHERE id = ?`,
      [cleanDays, notes ? `\nExtended ${cleanDays} day(s): ${notes.trim()}` : `\nExtended ${cleanDays} day(s).`, id]
    );

    await this.logAudit({
      subscriptionId: id,
      userId: subscription.user_id,
      actorId: adminId,
      eventType: 'extended',
      summary: `Extended subscription by ${cleanDays} day(s)`,
      details: { days: cleanDays, notes: notes || '' },
    });

    return { ok: true, id };
  }

  async renewSubscription(id: number, dto: { planId: number; startDate?: string; endDate?: string; notes?: string; paymentStatus?: 'manual' | 'paid' | 'unpaid' | 'free_plan' }, adminId: number) {
    const existing = await this.getSubscriptionOrThrow(id);
    const plan = await this.plansService.findById(dto.planId);

    // mysql2 hands DATE columns back as JS Date objects, so String(end_date) is
    // "Fri Apr 02 2027 ..." — not a date this code can add days to. That made every
    // renewal fail. Read it as YYYY-MM-DD first.
    const existingEnd = this.dateValueToText(existing.end_date);
    const today = this.toDateOnly(new Date());

    // Renewing replaces the current subscription (it is cancelled), but a renewal of
    // something still running would not start until the day after it ends — leaving
    // the student with no access in between. Adding days is the right move there.
    const stillActive = existing.status === 'active'
      && existingEnd >= today
      && Number(existing.access_lapsed) !== 1;
    if (stillActive) {
      throw new BadRequestException('This subscription is still active, so it cannot be renewed yet. Use Extend to add more days instead.');
    }

    const startBase = this.normalizeDate(dto.startDate) || this.addDays(existingEnd, 1);
    const startDate = startBase < today ? today : startBase;
    const paymentStatus = this.isFreePlan(plan) ? 'free_plan' : dto.paymentStatus || 'manual';
    const endDate = this.isFreePlanAssignment(paymentStatus, plan)
      ? this.unlimitedFreePlanEndDate
      : this.normalizeDate(dto.endDate) || this.addDays(startDate, Math.max(1, plan.durationDays) - 1);
    if (endDate < startDate) {
      throw new BadRequestException('End date cannot be earlier than start date');
    }

    const subscriptionId = await this.createSubscription({
      userId: Number(existing.user_id),
      planId: plan.id,
      assignedBy: adminId,
      notes: dto.notes || `Renewed from subscription #${id}`,
      status: 'active',
      paymentStatus,
      startDate,
      endDate,
      cancelExisting: true,
    });

    await this.logAudit({
      subscriptionId,
      userId: Number(existing.user_id),
      actorId: adminId,
      eventType: 'renewed',
      summary: `Renewed subscription with ${plan.name}`,
      details: { previousSubscriptionId: id, planId: plan.id, startDate, endDate },
    });

    return { ok: true, id: subscriptionId };
  }

  async cancelSubscription(id: number, notes: string | undefined, adminId: number) {
    const subscription = await this.getSubscriptionOrThrow(id);
    await this.db.execute(
      `UPDATE user_subscriptions
       SET status = 'cancelled',
           notes = CONCAT(COALESCE(notes, ''), ?)
       WHERE id = ?`,
      [notes ? `\nCancelled: ${notes.trim()}` : '\nCancelled by admin.', id]
    );

    await this.logAudit({
      subscriptionId: id,
      userId: subscription.user_id,
      actorId: adminId,
      eventType: 'cancelled',
      summary: 'Cancelled subscription',
      details: { notes: notes || '' },
    });

    return { ok: true, id };
  }

  async updatePayment(id: number, dto: {
    paymentStatus?: 'manual' | 'paid' | 'unpaid' | 'free_plan';
    amountPaid?: number;
    paymentMethod?: string;
    paymentReference?: string;
    paymentDate?: string;
    receiptUrl?: string;
  }, adminId: number) {
    const subscription = await this.getSubscriptionOrThrow(id);
    const paymentDate = this.normalizeDate(dto.paymentDate);
    await this.db.execute(
      `UPDATE user_subscriptions
       SET payment_status = COALESCE(?, payment_status),
           amount_paid = ?,
           payment_method = ?,
           payment_reference = ?,
           payment_date = ?,
           receipt_url = ?
       WHERE id = ?`,
      [
        dto.paymentStatus || null,
        dto.amountPaid === undefined || dto.amountPaid === null ? null : Number(dto.amountPaid),
        String(dto.paymentMethod || '').trim() || null,
        String(dto.paymentReference || '').trim() || null,
        paymentDate || null,
        String(dto.receiptUrl || '').trim() || null,
        id,
      ]
    );

    await this.logAudit({
      subscriptionId: id,
      userId: subscription.user_id,
      actorId: adminId,
      eventType: 'payment_updated',
      summary: 'Updated payment details',
      details: dto,
    });

    return { ok: true, id };
  }

  async findAuditEvents(limit = 80) {
    const take = Math.min(200, Math.max(1, Math.trunc(Number(limit) || 80)));
    const [rows] = await this.db.execute<SubscriptionAuditRow[]>(
      `SELECT
         sae.id,
         sae.subscription_id,
         sae.request_id,
         sae.user_id,
         sae.actor_id,
         sae.event_type,
         sae.summary,
         sae.details_json,
         sae.created_at,
         actor.full_name AS actor_name,
         actor.email AS actor_email,
         student.full_name AS student_name,
         COALESCE(sae.payer_email, student.email) AS student_email
       FROM subscription_audit_events sae
       LEFT JOIN users actor ON actor.id = sae.actor_id
       LEFT JOIN users student ON student.id = sae.user_id
       -- Newest first by id (same order as by time: ids only grow), so only
       -- the rows shown are read.
       ORDER BY sae.id DESC
       LIMIT ${take}`
    );

    return rows.map((row) => ({
      id: Number(row.id),
      subscriptionId: row.subscription_id ? Number(row.subscription_id) : null,
      requestId: row.request_id ? Number(row.request_id) : null,
      userId: row.user_id ? Number(row.user_id) : null,
      actorId: row.actor_id ? Number(row.actor_id) : null,
      eventType: String(row.event_type || ''),
      summary: String(row.summary || ''),
      actorName: String(row.actor_name || ''),
      actorEmail: String(row.actor_email || ''),
      studentName: String(row.student_name || ''),
      studentEmail: String(row.student_email || ''),
      details: this.parseDetails(row.details_json),
      createdAt: this.timestampValueToText(row.created_at),
    }));
  }

  private async createSubscription(input: {
    userId: number;
    planId: number;
    assignedBy: number | null;
    notes?: string;
    status: 'active' | 'pending' | 'expired' | 'cancelled';
    paymentStatus: 'manual' | 'paid' | 'unpaid' | 'free_plan';
    startDate: string;
    endDate: string;
    amountPaid?: number;
    paymentMethod?: string;
    paymentReference?: string;
    paymentDate?: string;
    receiptUrl?: string;
    accessScope?: 'all' | 'courses' | 'lessons';
    courseIds?: number[];
    lessonIds?: number[];
    cancelExisting: boolean;
    /** Exact expiry for store-backed subscriptions; NULL keeps date-only behaviour. */
    accessExpiresAt?: string | null;
  }) {
    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();

      if (input.cancelExisting) {
        await connection.execute(
          `UPDATE user_subscriptions
           SET status = CASE
             WHEN end_date < CURDATE() THEN 'expired'
             ELSE 'cancelled'
           END
           WHERE user_id = ? AND status IN ('active', 'pending')`,
          [input.userId]
        );
      }

      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO user_subscriptions (
           user_id, plan_id, assigned_by, notes, status, payment_status,
           amount_paid, payment_method, payment_reference, payment_date, receipt_url,
           access_scope, course_ids_json, lesson_ids_json, start_date, end_date, access_expires_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.userId,
          input.planId,
          input.assignedBy,
          String(input.notes || '').trim(),
          input.status,
          input.paymentStatus,
          input.amountPaid === undefined || input.amountPaid === null ? null : Number(input.amountPaid),
          String(input.paymentMethod || '').trim() || null,
          String(input.paymentReference || '').trim() || null,
          this.normalizeDate(input.paymentDate) || null,
          String(input.receiptUrl || '').trim() || null,
          input.accessScope || 'all',
          JSON.stringify(input.courseIds || []),
          JSON.stringify(input.lessonIds || []),
          input.startDate,
          this.isFreePlanPaymentStatus(input.paymentStatus) ? this.unlimitedFreePlanEndDate : input.endDate,
          // A free plan never expires, so it must not inherit a deadline.
          this.isFreePlanPaymentStatus(input.paymentStatus) ? null : (input.accessExpiresAt ?? null),
        ]
      );

      await connection.commit();
      return result.insertId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ─── Apple in-app purchase ─────────────────────────────────────────────────

  /**
   * Redeem a StoreKit 2 signed transaction and grant the matching subscription.
   *
   * Everything that decides access is derived server-side from the *verified*
   * payload — the client supplies only the signed JWS, never a plan or a price.
   */
  async redeemAppleTransaction(userId: number, signedTransaction: string) {
    const transaction = this.appleIapService.verifyTransaction(signedTransaction);

    const [planRows] = await this.db.execute<RowDataPacket[]>(
      'SELECT id, duration_days FROM plans WHERE apple_product_id = ? LIMIT 1',
      [transaction.productId]
    );
    const plan = planRows[0];
    if (!plan) {
      throw new BadRequestException('This purchase does not match a known plan.');
    }

    // Replay / account-sharing guard. `original_transaction_id` is stable across
    // renewals, so it identifies the subscription itself: whoever redeemed it
    // first owns it, and a second account replaying the same receipt is refused.
    //
    // A DELETED account does not own anything. The guard used to consider the
    // first redeemer the owner forever, which meant deleting your account and
    // signing up again locked you out of a subscription Apple was still
    // charging you for — Restore answered "already linked to another account",
    // and the only account that could have used it no longer exists. That is
    // also a path App Review walks: delete the account (5.1.1(v)), register
    // again, tap Restore.
    //
    // Only a LIVE owner blocks a claim, so account sharing is refused exactly
    // as strictly as before. Nothing is given away by relaxing it either: a
    // claim still requires a receipt signed by Apple for that Apple ID, so only
    // the genuine owner can present one.
    const [ownerRows] = await this.db.execute<RowDataPacket[]>(
      `SELECT t.user_id
       FROM iap_transactions t
       INNER JOIN users u ON u.id = t.user_id
       WHERE t.original_transaction_id = ? AND u.deleted_at IS NULL
       ORDER BY t.id ASC
       LIMIT 1`,
      [transaction.originalTransactionId]
    );
    if (ownerRows[0] && Number(ownerRows[0].user_id) !== userId) {
      this.logger.warn(
        `Apple transaction ${transaction.originalTransactionId} replayed by user ${userId}; owned by ${ownerRows[0].user_id}.`
      );
      throw new ConflictException('This purchase is already linked to another account.');
    }

    // Recovery after deletion leaves a trail: the iap_transactions rows keep
    // every user_id this subscription has been claimed by, in order, and this
    // line names the moment the handover happened.
    const [priorRows] = await this.db.execute<RowDataPacket[]>(
      'SELECT user_id FROM iap_transactions WHERE original_transaction_id = ? ORDER BY id ASC LIMIT 1',
      [transaction.originalTransactionId]
    );
    if (priorRows[0] && Number(priorRows[0].user_id) !== userId) {
      this.logger.log(
        `Apple transaction ${transaction.originalTransactionId} reclaimed by user ${userId}; `
          + `previous owner ${priorRows[0].user_id} is deleted.`
      );
    }

    const entitled = this.appleIapService.isEntitled(transaction);

    // Claim the transaction id first. UNIQUE(transaction_id) makes this the
    // atomic gate, so two concurrent redemptions cannot both proceed to insert
    // a subscription.
    await this.db.execute(
      `INSERT INTO iap_transactions (
         user_id, platform, product_id, transaction_id, original_transaction_id,
         environment, purchase_date, expires_date, revocation_date, raw_payload
       ) VALUES (?, 'apple', ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         expires_date = VALUES(expires_date),
         revocation_date = VALUES(revocation_date),
         updated_at = CURRENT_TIMESTAMP`,
      [
        userId,
        transaction.productId,
        transaction.transactionId,
        transaction.originalTransactionId,
        transaction.environment,
        this.epochToSqlTimestamp(transaction.purchaseDate),
        this.epochToSqlTimestamp(transaction.expiresDate),
        this.epochToSqlTimestamp(transaction.revocationDate),
        JSON.stringify({
          productId: transaction.productId,
          type: transaction.type,
          environment: transaction.environment,
          expiresDate: transaction.expiresDate,
          revocationReason: transaction.revocationReason,
        }),
      ]
    );

    if (!entitled) {
      // ONLY a revocation closes the subscription from here.
      //
      // This runs on the device's launch/resume replay too, and StoreKit hands
      // back entitlements that are in Apple's BILLING GRACE PERIOD — still
      // valid, but with `expiresDate` already in the past, so `isEntitled` is
      // false. Expiring on that basis would cut off a subscriber Apple still
      // considers paid, which is the one failure mode worse than granting too
      // much. A genuine lapse needs no action: access_expires_at has passed, so
      // the entitlement checks already deny it, and Apple's EXPIRED
      // notification sets the status.
      if (transaction.revocationDate !== null) {
        await this.expireAppleSubscription(transaction.originalTransactionId, true);
      }
      return this.getStudentBilling(userId);
    }

    // Apple's expiry is authoritative; the plan's duration is only a fallback.
    const startDate = this.toDateOnly(new Date());
    const endDate = transaction.expiresDate
      ? this.toDateOnly(new Date(transaction.expiresDate))
      : this.addDays(startDate, Number(plan.duration_days) || 30);

    // Already granted for this exact renewal of this exact plan → idempotent.
    //
    // `plan_id` is part of the test on purpose. Apple keeps
    // `originalTransactionId` IDENTICAL across an upgrade or downgrade inside a
    // subscription group, so without it a plan change looked like a repeat
    // renewal of the plan the student already had: the guard matched, the
    // method returned early, and the billing card kept showing the OLD
    // package. `end_date` is stored date-only, and sandbox compresses every
    // duration into minutes, so in sandbox each plan's end_date lands on the
    // same calendar day and the stale match was close to guaranteed — which is
    // why "Change plan" appeared to do nothing there.
    //
    // A genuine repeat redemption of the same renewal still has the same
    // plan_id AND the same expiry, so idempotency is preserved.
    //
    // THE EXPIRY TEST IS ON THE TIMESTAMP, NOT THE DATE. A renewal of the same
    // plan keeps the same originalTransactionId and the same plan_id — only
    // the expiry moves — so `end_date` was the single field that could tell a
    // renewal apart from a replay. Stored date-only, it could not: in sandbox a
    // "1 month" plan lasts three minutes, so the renewed expiry lands on the
    // SAME calendar day, `end_date >= endDate` matched, and the renewal was
    // discarded as a duplicate. The subscription then expired after one period
    // while Apple went on renewing it — which is exactly the reported symptom,
    // and why Apple still showed an upcoming renewal for a plan the app had
    // already written off.
    //
    // A product with no expiry (not auto-renewable) has no timestamp to
    // compare, so it keeps the date test.
    const accessExpiresAt = this.epochToSqlTimestamp(transaction.expiresDate);
    const [activeRows] = accessExpiresAt
      ? await this.db.execute<RowDataPacket[]>(
          `SELECT id FROM user_subscriptions
           WHERE user_id = ? AND payment_method = 'apple_iap' AND payment_reference = ?
             AND plan_id = ? AND status = 'active'
             AND access_expires_at IS NOT NULL AND access_expires_at >= ?
           LIMIT 1`,
          [userId, transaction.originalTransactionId, Number(plan.id), accessExpiresAt]
        )
      : await this.db.execute<RowDataPacket[]>(
          `SELECT id FROM user_subscriptions
           WHERE user_id = ? AND payment_method = 'apple_iap' AND payment_reference = ?
             AND plan_id = ? AND status = 'active' AND end_date >= ?
           LIMIT 1`,
          [userId, transaction.originalTransactionId, Number(plan.id), endDate]
        );

    if (!activeRows[0]) {
      const subscriptionId = await this.createSubscription({
        userId,
        planId: Number(plan.id),
        assignedBy: null,
        notes: `Apple in-app purchase (${transaction.productId})`,
        status: 'active',
        paymentStatus: 'paid',
        startDate,
        endDate,
        paymentMethod: 'apple_iap',
        paymentReference: transaction.originalTransactionId,
        // Apple's exact expiry drives access; end_date stays for display and
        // for every non-Apple code path that still reasons in whole days.
        accessExpiresAt,
        paymentDate: startDate,
        accessScope: 'all',
        cancelExisting: true,
      });

      await this.db.execute('UPDATE iap_transactions SET subscription_id = ? WHERE transaction_id = ?', [
        subscriptionId,
        transaction.transactionId,
      ]);
    }

    return this.getStudentBilling(userId);
  }

  /**
   * Apple in-app purchases, newest first, for the admin panel.
   *
   * Exists because nothing in the panel could see IAP at all: when the yearly
   * product was rejected there was no way to tell whether Apple had refused it
   * or our own redemption had, and the only record lived in a table reachable
   * by SQL. `plan_name` being NULL here is the exact signature of an unmapped
   * product, and `subscription_id` being NULL means the purchase never granted
   * access.
   *
   * `raw_payload` is deliberately not selected — it is a MEDIUMTEXT blob per
   * row and nothing in the list needs it.
   */
  async listAppleTransactions(params: { limit?: number; environment?: string; search?: string } = {}) {
    const limit = Math.min(Math.max(Number(params.limit) || 100, 1), 500);
    const filters: string[] = ["t.platform = 'apple'"];
    const values: Array<string | number> = [];

    const environment = String(params.environment || '').trim();
    if (environment) {
      filters.push('t.environment = ?');
      values.push(environment);
    }

    const search = String(params.search || '').trim();
    if (search) {
      filters.push('(u.full_name LIKE ? OR u.email LIKE ? OR t.product_id LIKE ? OR t.original_transaction_id LIKE ?)');
      const like = `%${search}%`;
      values.push(like, like, like, like);
    }

    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT
         t.id, t.user_id, t.subscription_id, t.product_id, t.transaction_id,
         t.original_transaction_id, t.environment, t.purchase_date, t.expires_date,
         t.revocation_date, t.created_at,
         u.full_name AS user_name, u.email AS user_email,
         p.name AS plan_name,
         s.status AS subscription_status, s.end_date AS subscription_end_date
       -- Newest first by primary key, so only the rows shown are read (it
       -- scanned and sorted the whole table before).
       FROM iap_transactions t FORCE INDEX (PRIMARY)
       LEFT JOIN users u ON u.id = t.user_id
       LEFT JOIN plans p FORCE INDEX (idx_plans_apple_product) ON p.apple_product_id = t.product_id
       LEFT JOIN user_subscriptions s ON s.id = t.subscription_id
       WHERE ${filters.join(' AND ')}
       ORDER BY t.id DESC
       LIMIT ${limit}`,
      values
    );

    return {
      items: rows.map((row) => ({
        id: Number(row.id),
        userId: Number(row.user_id),
        userName: row.user_name ? String(row.user_name) : '',
        userEmail: row.user_email ? String(row.user_email) : '',
        productId: String(row.product_id || ''),
        transactionId: String(row.transaction_id || ''),
        originalTransactionId: String(row.original_transaction_id || ''),
        environment: String(row.environment || ''),
        // NULL = no plan carries this product id, so redeeming it is rejected.
        planName: row.plan_name ? String(row.plan_name) : null,
        subscriptionId: row.subscription_id ? Number(row.subscription_id) : null,
        subscriptionStatus: row.subscription_status ? String(row.subscription_status) : null,
        subscriptionEndDate: row.subscription_end_date ? String(row.subscription_end_date) : null,
        purchaseDate: row.purchase_date ? String(row.purchase_date) : null,
        expiresDate: row.expires_date ? String(row.expires_date) : null,
        revocationDate: row.revocation_date ? String(row.revocation_date) : null,
        createdAt: row.created_at ? String(row.created_at) : null,
      })),
    };
  }

  /**
   * Apply an App Store Server Notification V2. Called by Apple, not by a user,
   * so the signature is the only authentication.
   */
  async handleAppleNotification(signedPayload: string) {
    const notification = this.appleIapService.verifyNotification(signedPayload);

    if (!notification.signedTransactionInfo) {
      // Nothing subscription-shaped to apply (e.g. TEST notifications).
      return { handled: false, notificationType: notification.notificationType };
    }

    const transaction = this.appleIapService.verifyTransaction(notification.signedTransactionInfo);

    const [ownerRows] = await this.db.execute<RowDataPacket[]>(
      'SELECT user_id FROM iap_transactions WHERE original_transaction_id = ? ORDER BY id ASC LIMIT 1',
      [transaction.originalTransactionId]
    );
    const userId = ownerRows[0] ? Number(ownerRows[0].user_id) : 0;
    if (!userId) {
      // A purchase we've never seen redeemed. The device reconciles on next
      // launch, so acknowledge rather than error.
      this.logger.warn(`Apple notification for unknown transaction ${transaction.originalTransactionId}.`);
      return { handled: false, notificationType: notification.notificationType };
    }

    await this.db.execute(
      `INSERT INTO iap_transactions (
         user_id, platform, product_id, transaction_id, original_transaction_id,
         environment, purchase_date, expires_date, revocation_date, raw_payload
       ) VALUES (?, 'apple', ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         expires_date = VALUES(expires_date),
         revocation_date = VALUES(revocation_date),
         updated_at = CURRENT_TIMESTAMP`,
      [
        userId,
        transaction.productId,
        transaction.transactionId,
        transaction.originalTransactionId,
        transaction.environment,
        this.epochToSqlTimestamp(transaction.purchaseDate),
        this.epochToSqlTimestamp(transaction.expiresDate),
        this.epochToSqlTimestamp(transaction.revocationDate),
        JSON.stringify({ notificationType: notification.notificationType, subtype: notification.subtype }),
      ]
    );

    switch (notification.notificationType) {
      case 'SUBSCRIBED':
      case 'DID_RENEW':
      case 'OFFER_REDEEMED':
      case 'DID_CHANGE_RENEWAL_PREF':
        if (this.appleIapService.isEntitled(transaction)) {
          await this.applyAppleRenewal(userId, transaction);
        }
        break;

      case 'EXPIRED':
        await this.expireAppleSubscription(transaction.originalTransactionId, false);
        break;

      case 'REFUND':
      case 'REVOKE':
        await this.expireAppleSubscription(transaction.originalTransactionId, true);
        break;

      // A renewal payment failed. Apple may still be granting access: with a
      // billing grace period configured, the subscriber keeps everything while
      // Apple retries, even though the transaction's expiresDate has passed.
      // That window is only described in the RENEWAL half of the notification,
      // so extend the precise gate to cover it. Without this, making expiry
      // exact would lock out a subscriber Apple still treats as paid.
      case 'DID_FAIL_TO_RENEW': {
        const grace = this.readGracePeriodExpiry(notification.signedRenewalInfo);
        if (grace) {
          await this.db.execute(
            `UPDATE user_subscriptions
             SET status = 'active', end_date = GREATEST(end_date, ?), access_expires_at = ?
             WHERE payment_method = 'apple_iap' AND payment_reference = ?
               AND status IN ('active', 'pending')`,
            [this.toDateOnly(new Date(grace)), this.epochToSqlTimestamp(grace), transaction.originalTransactionId]
          );
        }
        break;
      }

      // DID_CHANGE_RENEWAL_STATUS (auto-renew turned off) intentionally leaves
      // access intact — Apple sends EXPIRED when it actually ends.
      default:
        break;
    }

    return { handled: true, notificationType: notification.notificationType };
  }

  /**
   * Grace-period deadline from a notification's renewal info, in epoch ms, or
   * null when Apple is not granting one.
   *
   * Never throws: a renewal payload we cannot read must not fail the webhook,
   * because Apple then retries it indefinitely.
   */
  private readGracePeriodExpiry(signedRenewalInfo: string | null): number | null {
    if (!signedRenewalInfo) return null;
    try {
      const info = this.appleIapService.verifyRenewalInfo(signedRenewalInfo);
      if (!info.gracePeriodExpiresDate) return null;
      return info.gracePeriodExpiresDate > Date.now() ? info.gracePeriodExpiresDate : null;
    } catch (error) {
      this.logger.warn(`Could not read Apple renewal info: ${(error as Error).message}`);
      return null;
    }
  }

  /** Extend (or re-create) the subscription behind a renewed Apple purchase. */
  private async applyAppleRenewal(userId: number, transaction: AppleTransaction) {
    const endDate = transaction.expiresDate ? this.toDateOnly(new Date(transaction.expiresDate)) : '';
    if (!endDate) return;

    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id FROM user_subscriptions
       WHERE user_id = ? AND payment_method = 'apple_iap' AND payment_reference = ?
       ORDER BY id DESC LIMIT 1`,
      [userId, transaction.originalTransactionId]
    );

    if (rows[0]) {
      await this.db.execute(
        "UPDATE user_subscriptions SET status = 'active', end_date = ?, access_expires_at = ? WHERE id = ?",
        [endDate, this.epochToSqlTimestamp(transaction.expiresDate), Number(rows[0].id)]
      );
      return;
    }

    const [planRows] = await this.db.execute<RowDataPacket[]>(
      'SELECT id FROM plans WHERE apple_product_id = ? LIMIT 1',
      [transaction.productId]
    );
    if (!planRows[0]) return;

    await this.createSubscription({
      userId,
      planId: Number(planRows[0].id),
      assignedBy: null,
      notes: `Apple in-app purchase renewal (${transaction.productId})`,
      status: 'active',
      paymentStatus: 'paid',
      startDate: this.toDateOnly(new Date()),
      endDate,
      accessExpiresAt: this.epochToSqlTimestamp(transaction.expiresDate),
      paymentMethod: 'apple_iap',
      paymentReference: transaction.originalTransactionId,
      paymentDate: this.toDateOnly(new Date()),
      accessScope: 'all',
      cancelExisting: true,
    });
  }

  /** Close out an Apple subscription: expired naturally, or refunded/revoked. */
  private async expireAppleSubscription(originalTransactionId: string, revoked: boolean) {
    await this.db.execute(
      `UPDATE user_subscriptions
       SET status = ?, end_date = LEAST(end_date, CURDATE()), access_expires_at = UTC_TIMESTAMP()
       WHERE payment_method = 'apple_iap' AND payment_reference = ? AND status IN ('active', 'pending')`,
      [revoked ? 'cancelled' : 'expired', originalTransactionId]
    );
  }

  private epochToSqlTimestamp(value: number | null) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 19).replace('T', ' ');
  }

  private async findStudentRequests(userId: number) {
    const [rows] = await this.db.execute<SubscriptionRequestRow[]>(
      `SELECT
         sr.id,
         sr.user_id,
         sr.plan_id,
         sr.invoice_id,
         sr.status,
         sr.message,
         sr.admin_note,
         sr.requested_at,
         sr.resolved_at,
         sr.resolved_by,
         sr.subscription_id,
         sr.payment_method,
         sr.payment_reference,
         sr.payment_amount,
         sr.payment_currency,
         sr.coupon_code,
         sr.discount_amount,
         sr.payment_proof_name,
         sr.payment_proof_mime,
         sr.payment_proof_data_url,
         sr.access_scope,
         sr.course_ids_json,
         sr.lesson_ids_json
       FROM subscription_requests sr
       WHERE sr.user_id = ?
       ORDER BY sr.id DESC
       LIMIT 12`,
      [userId]
    );
    // Newest first straight off the user index (no sort pass); pending first here.
    const rank = (status: unknown) => ['pending', 'approved', 'rejected', 'cancelled'].indexOf(String(status)) + 1;
    rows.sort((a, b) => rank(a.status) - rank(b.status) || Number(b.id) - Number(a.id));
    // 10.50: plan name / prices from the plan memory (no joins; examined = returned).
    const withPlans = this.withPlanColumns(rows, await this.plansService.findByIds(rows.map((row) => Number(row.plan_id))));
    return withPlans.map((row) => this.mapRequest(row));
  }

  /**
   * 10.50: the plan columns the student queries used to join in, filled from
   * the plan memory. Rows whose plan no longer exists are left out (as the old
   * INNER JOIN did).
   */
  private withPlanColumns<T extends { plan_id?: number | string | null }>(rows: T[], plans: Map<number, any>): T[] {
    return rows
      .filter((row) => plans.has(Number(row.plan_id)))
      .map((row) => {
        const plan = plans.get(Number(row.plan_id));
        return {
          ...row,
          plan_name: plan.name,
          plan_regular_price: plan.regularPrice,
          plan_offer_price: plan.offerPrice,
          plan_offer_enabled: plan.offerEnabled ? 1 : 0,
          plan_currency: plan.currency,
          plan_duration_days: plan.durationDays,
          plan_recommended: plan.recommended ? 1 : 0,
        };
      });
  }

  private async findPaymentTransaction(orderId: string) {
    const [rows] = await this.db.execute<PaymentTransactionRow[]>(
      `SELECT
         id, order_id, invoice_id, user_id, plan_id, subscription_id, amount, currency,
         coupon_code, discount_amount, order_note, access_scope, course_ids_json, lesson_ids_json, status
       FROM payment_transactions
       WHERE order_id = ?
       LIMIT 1`,
      [orderId]
    );
    return rows[0] || null;
  }

  private async createPayHerePendingRequest(input: {
    userId: number;
    planId: number;
    invoiceId: string;
    orderId: string;
    message?: string;
    amount: number;
    currency: string;
    couponCode?: string | null;
    discountAmount: number;
    accessScope: 'all' | 'courses' | 'lessons';
    courseIds: number[];
    lessonIds: number[];
  }) {
    const [result] = await this.db.execute<ResultSetHeader>(
      `INSERT INTO subscription_requests (
         user_id, plan_id, invoice_id, message, payment_method, payment_reference, payment_amount, payment_currency,
         coupon_code, discount_amount, access_scope, course_ids_json, lesson_ids_json, status
       ) VALUES (?, ?, ?, ?, 'payhere', ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        input.userId,
        input.planId,
        input.invoiceId,
        String(input.message || '').trim(),
        input.orderId,
        input.amount,
        this.normalizePaymentCurrency(input.currency),
        input.couponCode || null,
        input.discountAmount,
        input.accessScope,
        JSON.stringify(input.courseIds),
        JSON.stringify(input.lessonIds),
      ]
    );
    return result.insertId;
  }

  private async findPayHereRequest(invoiceId: string, userId: number, planId: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, status, subscription_id
       FROM subscription_requests
       WHERE invoice_id = ?
         AND user_id = ?
         AND plan_id = ?
         AND payment_method = 'payhere'
       ORDER BY id DESC
       LIMIT 1`,
      [invoiceId, userId, planId]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: Number(row.id),
      status: String(row.status || 'pending'),
      subscriptionId: row.subscription_id ? Number(row.subscription_id) : null,
    };
  }

  private async markPayHereRequestVerified(input: {
    requestId: number;
    subscriptionId: number;
    paymentReference: string;
    adminNote: string;
  }) {
    await this.db.execute(
      `UPDATE subscription_requests
       SET status = 'approved',
           admin_note = ?,
           resolved_at = NOW(),
           resolved_by = NULL,
           subscription_id = ?,
           payment_reference = ?
       WHERE id = ?`,
      [input.adminNote, input.subscriptionId, input.paymentReference, input.requestId]
    );
  }

  private async updatePayHereRequestAfterNotification(input: {
    requestId: number;
    nextStatus: PaymentTransactionRow['status'];
    paymentReference: string;
    adminNote: string;
  }) {
    if (input.nextStatus === 'paid') {
      await this.db.execute(
        `UPDATE subscription_requests
         SET admin_note = ?,
             payment_reference = ?
         WHERE id = ? AND status = 'pending'`,
        [input.adminNote, input.paymentReference, input.requestId]
      );
      return;
    }

    if (['cancelled', 'failed', 'chargedback'].includes(input.nextStatus)) {
      await this.db.execute(
        `UPDATE subscription_requests
         SET status = 'cancelled',
             admin_note = ?,
             resolved_at = NOW(),
             resolved_by = NULL,
             payment_reference = ?
         WHERE id = ? AND status = 'pending'`,
        [input.adminNote, input.paymentReference, input.requestId]
      );
      return;
    }

    await this.db.execute(
      `UPDATE subscription_requests
       SET admin_note = ?,
           payment_reference = ?
       WHERE id = ? AND status = 'pending'`,
      [input.adminNote, input.paymentReference, input.requestId]
    );
  }

  private async getCouponRowOrThrow(id: number) {
    const [rows] = await this.db.execute<SubscriptionCouponRow[]>(
      `SELECT
         id, code, label, coupon_mode, discount_type, discount_value, plan_ids_json,
         status, starts_at, expires_at, max_redemptions, redemption_count, created_at, updated_at
       FROM subscription_coupons
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    const row = rows[0];
    if (!row) {
      throw new NotFoundException('Coupon not found');
    }
    return row;
  }

  private async findCouponByCode(code: string) {
    const normalized = this.normalizeCouponCode(code);
    if (!normalized) return null;
    const [rows] = await this.db.execute<SubscriptionCouponRow[]>(
      `SELECT
         id, code, label, coupon_mode, discount_type, discount_value, plan_ids_json,
         status, starts_at, expires_at, max_redemptions, redemption_count, created_at, updated_at
       FROM subscription_coupons
       WHERE code = ?
       LIMIT 1`,
      [normalized]
    );
    return rows[0] || null;
  }

  private async findRequestById(id: number) {
    const [rows] = await this.db.execute<SubscriptionRequestRow[]>(
      `SELECT
         sr.id,
         sr.user_id,
         sr.plan_id,
         sr.invoice_id,
         sr.status,
         sr.message,
         sr.admin_note,
         sr.requested_at,
         sr.resolved_at,
         sr.resolved_by,
         sr.subscription_id,
         sr.payment_method,
         sr.payment_reference,
         sr.payment_amount,
         sr.payment_currency,
         sr.coupon_code,
         sr.discount_amount,
         sr.payment_proof_name,
         sr.payment_proof_mime,
         sr.payment_proof_data_url,
         sr.access_scope,
         sr.course_ids_json,
         sr.lesson_ids_json,
         student.full_name AS student_name,
         COALESCE(sr.payer_email, student.email) AS student_email,
         plans.name AS plan_name
       FROM subscription_requests sr
       INNER JOIN users student ON student.id = sr.user_id
       INNER JOIN plans ON plans.id = sr.plan_id
       WHERE sr.id = ?
       LIMIT 1`,
      [id]
    );
    const row = rows[0];
    if (!row) {
      throw new NotFoundException('Subscription request not found');
    }
    return this.mapRequest(row);
  }

  private async getSubscriptionOrThrow(id: number) {
    const [rows] = await this.db.execute<SubscriptionRow[]>(
      `SELECT
         ${SUBSCRIPTION_LIST_COLUMNS}
       FROM user_subscriptions us
       WHERE us.id = ?
       LIMIT 1`,
      [id]
    );
    const row = rows[0];
    if (!row) {
      throw new NotFoundException('Subscription not found');
    }
    return row;
  }

  private async logAudit(input: {
    subscriptionId?: number | null;
    requestId?: number | null;
    userId?: number | null;
    actorId?: number | null;
    eventType: string;
    summary: string;
    details?: unknown;
  }) {
    await this.db.execute(
      `INSERT INTO subscription_audit_events (
        subscription_id, request_id, user_id, actor_id, event_type, summary, details_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.subscriptionId || null,
        input.requestId || null,
        input.userId || null,
        input.actorId || null,
        input.eventType,
        input.summary,
        JSON.stringify(input.details || {}),
      ]
    );
  }

  private parseDetails(raw: string | null) {
    try {
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private mapRequest(row: SubscriptionRequestRow) {
    const regularPrice = Number(row.plan_regular_price || 0);
    const offerPrice = row.plan_offer_price === null || row.plan_offer_price === undefined ? null : Number(row.plan_offer_price);
    const offerEnabled = Number(row.plan_offer_enabled || 0) === 1;
    return {
      id: Number(row.id),
      userId: Number(row.user_id),
      planId: Number(row.plan_id),
      status: row.status,
      message: String(row.message || ''),
      adminNote: String(row.admin_note || ''),
      requestedAt: this.timestampValueToText(row.requested_at),
      resolvedAt: this.timestampValueToText(row.resolved_at),
      resolvedBy: row.resolved_by ? Number(row.resolved_by) : null,
      resolvedByName: String(row.resolved_by_name || ''),
      resolvedByEmail: String(row.resolved_by_email || ''),
      subscriptionId: row.subscription_id ? Number(row.subscription_id) : null,
      paymentMethod: String(row.payment_method || ''),
      paymentReference: String(row.payment_reference || ''),
      paymentAmount: row.payment_amount === null || row.payment_amount === undefined ? null : Number(row.payment_amount),
      paymentCurrency: String(row.payment_currency || ''),
      couponCode: String(row.coupon_code || ''),
      discountAmount: Number(row.discount_amount || 0),
      paymentProofName: String(row.payment_proof_name || ''),
      paymentProofMime: String(row.payment_proof_mime || ''),
      paymentProofDataUrl: String(row.payment_proof_data_url || ''),
      accessScope: row.access_scope || 'all',
      courseIds: this.parseIdList(row.course_ids_json),
      lessonIds: this.parseIdList(row.lesson_ids_json),
      invoiceId: String(row.invoice_id || ''),
      studentName: String(row.student_name || ''),
      studentEmail: String(row.student_email || ''),
      planName: String(row.plan_name || ''),
      planCurrency: this.normalizePaymentCurrency(row.plan_currency),
      planRegularPrice: regularPrice,
      planOfferPrice: offerPrice,
      planOfferEnabled: offerEnabled,
      planEffectivePrice: offerEnabled && offerPrice !== null ? offerPrice : regularPrice,
    };
  }

  private async getStudentOrThrow(userId: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, full_name, email, status
       FROM users
       WHERE id = ? AND role = 'student'
       LIMIT 1`,
      [userId]
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundException('Student not found');
    }

    return {
      id: Number(row.id),
      fullName: String(row.full_name || ''),
      email: String(row.email || ''),
      status: String(row.status || 'inactive'),
    };
  }

  private normalizeDate(value?: string) {
    const input = String(value || '').trim();
    if (!input) {
      return '';
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      throw new BadRequestException('Invalid date provided');
    }

    const date = new Date(`${input}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date provided');
    }

    return input;
  }

  private toDateOnly(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private addDays(dateText: string, days: number) {
    const date = new Date(`${dateText}T00:00:00`);
    date.setDate(date.getDate() + days);
    return this.toDateOnly(date);
  }

  private dateValueToText(value: string | Date | null | undefined) {
    if (value instanceof Date) {
      return this.toDateOnly(value);
    }

    return String(value || '').slice(0, 10);
  }

  private timestampValueToText(value: string | Date | null | undefined) {
    if (!value) return null;

    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return null;
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      const hours = String(value.getHours()).padStart(2, '0');
      const minutes = String(value.getMinutes()).padStart(2, '0');
      const seconds = String(value.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    const text = String(value).trim();
    return text || null;
  }

  private normalizeAccessScope(
    accessScope?: 'all' | 'courses' | 'lessons',
    courseIds: number[] = [],
    lessonIds: number[] = []
  ) {
    const scope = accessScope || 'all';
    const cleanCourseIds = this.cleanIdList(courseIds);
    const cleanLessonIds = this.cleanIdList(lessonIds);

    if (scope === 'courses' && cleanCourseIds.length === 0) {
      throw new BadRequestException('Choose at least one course for course-scoped access');
    }
    if (scope === 'lessons' && cleanLessonIds.length === 0) {
      throw new BadRequestException('Choose at least one lesson for lesson-scoped access');
    }

    return {
      accessScope: scope,
      courseIds: scope === 'courses' ? cleanCourseIds : [],
      lessonIds: scope === 'lessons' ? cleanLessonIds : [],
    };
  }

  private cleanIdList(values: unknown[]) {
    return Array.from(new Set(
      values
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    ));
  }

  private parseIdList(raw: string | null) {
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? this.cleanIdList(parsed) : [];
    } catch {
      return [];
    }
  }

  private async loadSubscriptionPlanMap(rows: Array<Pick<SubscriptionRow, 'plan_id'>>) {
    const planIds = Array.from(
      new Set(
        rows
          .map((row) => Number(row.plan_id))
          .filter((planId) => Number.isInteger(planId) && planId > 0)
      )
    );
    return this.plansService.findByIds(planIds);
  }

  private async mapSubscription(row: SubscriptionRow, planOverride?: Awaited<ReturnType<PlansService['findById']>>) {
    const plan = planOverride || await this.plansService.findById(Number(row.plan_id));
    const startDate = this.dateValueToText(row.start_date);
    const endDate = this.dateValueToText(row.end_date);
    const end = new Date(`${endDate}T00:00:00`);
    const today = new Date(`${this.toDateOnly(new Date())}T00:00:00`);
    const rawDaysRemaining = Math.floor((end.getTime() - today.getTime()) / 86400000) + 1;
    const isFreePlan = this.isFreePlanAssignment(row.payment_status, plan);
    const daysRemaining = isFreePlan ? null : rawDaysRemaining;

    // The precise gate, so the page cannot report "active" for a subscription
    // the entitlement checks are already refusing. Store-backed rows carry
    // Apple's exact expiry; everything else leaves it NULL and keeps the
    // day-based reading it has always had.
    // Straight from SQL — see access_lapsed in SUBSCRIPTION_LIST_COLUMNS.
    const lapsedByTimestamp = Number(row.access_lapsed) === 1;

    const computedStatus =
      row.status === 'active' && !isFreePlan && (rawDaysRemaining <= 0 || lapsedByTimestamp)
        ? 'expired'
        : row.status;

    return {
      id: Number(row.id),
      userId: Number(row.user_id),
      planId: Number(row.plan_id),
      assignedBy: row.assigned_by ? Number(row.assigned_by) : null,
      notes: String(row.notes || ''),
      status: row.status,
      computedStatus,
      paymentStatus: row.payment_status,
      isFreePlan,
      isUnlimitedAccess: isFreePlan,
      amountPaid: row.amount_paid === null || row.amount_paid === undefined ? null : Number(row.amount_paid),
      paymentMethod: String(row.payment_method || ''),
      paymentReference: String(row.payment_reference || ''),
      paymentDate: row.payment_date ? this.dateValueToText(row.payment_date) : null,
      receiptUrl: String(row.receipt_url || ''),
      accessScope: row.access_scope || 'all',
      courseIds: this.parseIdList(row.course_ids_json),
      lessonIds: this.parseIdList(row.lesson_ids_json),
      startDate,
      endDate,
      daysRemaining,
      isExpiringSoon: !isFreePlan && computedStatus === 'active' && Number(daysRemaining) > 0 && Number(daysRemaining) <= 7,
      createdAt: this.timestampValueToText(row.created_at),
      updatedAt: this.timestampValueToText(row.updated_at),
      studentName: String(row.student_name || ''),
      studentEmail: String(row.student_email || ''),
      assignedByName: String(row.assigned_by_name || ''),
      assignedByEmail: String(row.assigned_by_email || ''),
      planName: String(row.plan_name || plan.name),
      planPrice: Number(row.plan_regular_price ?? plan.regularPrice ?? 0),
      planRegularPrice: Number(row.plan_regular_price ?? plan.regularPrice ?? 0),
      planOfferPrice: row.plan_offer_price === null || row.plan_offer_price === undefined ? plan.offerPrice : Number(row.plan_offer_price),
      planOfferEnabled: row.plan_offer_enabled === null || row.plan_offer_enabled === undefined ? plan.offerEnabled : Number(row.plan_offer_enabled) === 1,
      planEffectivePrice: plan.effectivePrice,
      planCurrency: this.normalizePaymentCurrency(row.plan_currency || plan.currency),
      planDurationDays: Number(row.plan_duration_days || plan.durationDays || 0),
      planRecommended: row.plan_recommended === null || row.plan_recommended === undefined ? plan.recommended : Number(row.plan_recommended) === 1,
      planFeatures: plan.features,
      enabledFeatures: plan.enabledFeatures,
      featureKeys: plan.featureKeys,
    };
  }

  private normalizePaymentCurrency(value?: string | null) {
    void value;
    return 'LKR';
  }

  private isFreePlanPaymentStatus(value: unknown) {
    const status = String(value || '').trim().toLowerCase();
    return status === 'free_plan' || status === 'free' || status === 'waived';
  }

  private isFreePlan(plan: { slug?: string; name?: string; effectivePrice?: number }) {
    return String(plan?.slug || '').toLowerCase() === 'free'
      || (String(plan?.name || '').trim().toLowerCase() === 'free' && Number(plan?.effectivePrice || 0) <= 0);
  }

  private isFreePlanAssignment(paymentStatus: unknown, plan: { slug?: string; name?: string; effectivePrice?: number }) {
    return this.isFreePlanPaymentStatus(paymentStatus) || this.isFreePlan(plan);
  }

  private isPaidSubscriptionRequest(request: {
    paymentMethod?: string;
    paymentProofDataUrl?: string;
  }) {
    const paymentMethod = String(request.paymentMethod || '').trim().toLowerCase();
    return Boolean(request.paymentProofDataUrl) || paymentMethod === 'payhere' || paymentMethod === 'coupon';
  }

  private generateCheckoutHash(merchantId: string, orderId: string, amount: string, currency: string, merchantSecret: string) {
    return this.md5(`${merchantId}${orderId}${amount}${currency}${this.md5(merchantSecret)}`);
  }

  /** Compares two hex signatures without leaking where they first differ. */
  private signaturesMatch(expected: string, received: string) {
    const a = Buffer.from(String(expected || ''));
    const b = Buffer.from(String(received || ''));
    return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
  }

  private generateNotificationHash(
    merchantId: string,
    orderId: string,
    amount: string,
    currency: string,
    statusCode: string,
    merchantSecret: string
  ) {
    return this.md5(`${merchantId}${orderId}${amount}${currency}${statusCode}${this.md5(merchantSecret)}`);
  }

  private md5(value: string) {
    return createHash('md5').update(value).digest('hex').toUpperCase();
  }

  private formatAmount(value: number) {
    return Number(value || 0).toFixed(2);
  }

  private normalizeCouponPayload(dto: SubscriptionCouponDto) {
    const code = this.normalizeCouponCode(dto.code);
    if (!code) {
      throw new BadRequestException('Coupon code is required');
    }
    const couponMode = dto.couponMode === 'package' ? 'package' : 'discount';
    const discountType = dto.discountType === 'fixed' ? 'fixed' : 'percent';
    const discountValue = Number(dto.discountValue || 0);
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      throw new BadRequestException('Coupon discount must be greater than zero');
    }
    if (discountType === 'percent' && discountValue > 100) {
      throw new BadRequestException('Percent coupon cannot exceed 100%');
    }
    const planIds = this.cleanIdList(Array.isArray(dto.planIds) ? dto.planIds : []);
    if (couponMode === 'package' && planIds.length === 0) {
      throw new BadRequestException('Select at least one package for a package coupon');
    }

    const startsAt = this.normalizeDate(dto.startsAt);
    const expiresAt = this.normalizeDate(dto.expiresAt);
    if (startsAt && expiresAt && expiresAt < startsAt) {
      throw new BadRequestException('Coupon expiry cannot be earlier than the start date');
    }

    return {
      code,
      label: String(dto.label || '').trim() || null,
      couponMode,
      discountType,
      discountValue,
      planIds: couponMode === 'package' ? planIds : [],
      status: dto.status === 'inactive' ? 'inactive' : 'active',
      startsAt,
      expiresAt,
      maxRedemptions: dto.maxRedemptions === undefined || dto.maxRedemptions === null ? null : Number(dto.maxRedemptions),
    };
  }

  private normalizeCouponCode(value?: string) {
    return String(value || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '');
  }

  private async buildCheckoutCouponQuote(
    plan: { id: number; effectivePrice?: number; currency?: string },
    couponCode: string | undefined,
    requireCoupon: boolean
  ) {
    const amount = Number(plan.effectivePrice || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('This plan does not have a payable amount.');
    }

    if (requireCoupon && !this.normalizeCouponCode(couponCode)) {
      throw new BadRequestException('Enter a coupon code');
    }

    const coupon = await this.resolveCouponForCheckout(couponCode, amount, plan.id);
    const discountAmount = coupon ? coupon.discountAmount : 0;
    const payableAmount = Number(this.formatAmount(Math.max(0, amount - discountAmount)));
    return {
      couponCode: coupon?.code || '',
      couponMode: coupon?.couponMode || '',
      originalAmount: this.formatAmount(amount),
      discountAmount: this.formatAmount(discountAmount),
      amount: this.formatAmount(payableAmount),
      currency: String(plan.currency || 'LKR').toUpperCase(),
      requiresApproval: Boolean(coupon && payableAmount <= 0),
    };
  }

  private async resolveCouponForCheckout(code: string | undefined, amount: number, planId: number) {
    const normalizedCode = this.normalizeCouponCode(code);
    if (!normalizedCode) return null;

    const coupon = await this.findCouponByCode(normalizedCode);
    if (!coupon) {
      throw new BadRequestException('Coupon code was not found');
    }
    if (coupon.status !== 'active') {
      throw new BadRequestException('Coupon code is not active');
    }

    const today = this.toDateOnly(new Date());
    const startsAt = coupon.starts_at ? this.toDateOnly(new Date(coupon.starts_at)) : '';
    const expiresAt = coupon.expires_at ? this.toDateOnly(new Date(coupon.expires_at)) : '';
    if (startsAt && today < startsAt) {
      throw new BadRequestException('Coupon code is not active yet');
    }
    if (expiresAt && today > expiresAt) {
      throw new BadRequestException('Coupon code has expired');
    }
    if (coupon.max_redemptions && Number(coupon.redemption_count || 0) >= Number(coupon.max_redemptions)) {
      throw new BadRequestException('Coupon code has reached its usage limit');
    }

    const couponMode = coupon.coupon_mode === 'package' ? 'package' : 'discount';
    const planIds = this.parseIdList(coupon.plan_ids_json);
    if (couponMode === 'package' && !planIds.includes(Number(planId))) {
      throw new BadRequestException('Coupon code is not valid for this package');
    }

    const value = Number(coupon.discount_value || 0);
    const discountAmount = coupon.discount_type === 'fixed'
      ? Math.min(amount, value)
      : Math.min(amount, amount * (value / 100));
    return {
      code: String(coupon.code || '').trim(),
      couponMode,
      discountAmount: Number(this.formatAmount(discountAmount)),
      planIds,
    };
  }

  private mapCoupon(row: SubscriptionCouponRow) {
    return {
      id: Number(row.id),
      code: String(row.code || ''),
      label: String(row.label || ''),
      couponMode: row.coupon_mode === 'package' ? 'package' : 'discount',
      discountType: row.discount_type,
      discountValue: Number(row.discount_value || 0),
      planIds: this.parseIdList(row.plan_ids_json),
      status: row.status,
      startsAt: row.starts_at || '',
      expiresAt: row.expires_at || '',
      maxRedemptions: row.max_redemptions === null || row.max_redemptions === undefined ? null : Number(row.max_redemptions),
      redemptionCount: Number(row.redemption_count || 0),
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
    };
  }

  private mapPayHereStatus(statusCode: string): PaymentTransactionRow['status'] {
    if (statusCode === '2') return 'paid';
    if (statusCode === '0') return 'pending';
    if (statusCode === '-1') return 'cancelled';
    if (statusCode === '-3') return 'chargedback';
    return 'failed';
  }

  private assertPayHereNotificationPayload(input: {
    merchantId: string;
    orderId: string;
    payhereAmount: string;
    payhereCurrency: string;
    statusCode: string;
    md5sig: string;
  }) {
    if (!input.merchantId || !input.orderId || !input.payhereAmount || !input.payhereCurrency || !input.statusCode || !input.md5sig) {
      throw new BadRequestException('PayHere notification payload is incomplete');
    }
    if (!/^\d+(?:\.\d{1,2})?$/.test(input.payhereAmount)) {
      throw new BadRequestException('PayHere notification amount is invalid');
    }
    if (!/^[A-Z]{3}$/.test(input.payhereCurrency)) {
      throw new BadRequestException('PayHere notification currency is invalid');
    }
    if (!['2', '0', '-1', '-2', '-3'].includes(input.statusCode)) {
      throw new BadRequestException('PayHere notification status is invalid');
    }
    if (!/^[a-f0-9]{32}$/i.test(input.md5sig)) {
      throw new BadRequestException('PayHere notification signature is invalid');
    }
  }

  private splitName(fullName: string) {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    return {
      firstName: parts[0] || 'Student',
      lastName: parts.slice(1).join(' ') || 'LMS',
    };
  }

  private resolveFrontendUrl() {
    return String(this.configService.get<string>('frontendUrl') || 'http://localhost:5174').replace(/\/+$/, '');
  }

  private resolvePayHereNotifyUrl(configuredNotifyUrl?: string | null) {
    const explicitNotifyUrl = this.normalizePublicPayHereUrl(configuredNotifyUrl);
    if (explicitNotifyUrl) {
      return explicitNotifyUrl;
    }

    const apiPublicUrl = this.resolveApiPublicUrl();
    if (!apiPublicUrl) {
      throw new BadRequestException('PayHere notify URL must be a public HTTPS API URL before card checkout can start.');
    }

    return `${apiPublicUrl}/subscriptions/payhere/notify`;
  }

  private resolveApiPublicUrl() {
    const candidates = [
      this.configService.get<string>('PAYHERE_PUBLIC_API_URL'),
      this.configService.get<string>('API_PUBLIC_URL'),
      this.configService.get<string>('frontendUrl'),
      this.configService.get<string>('FRONTEND_URL'),
      this.configService.get<string>('APP_PUBLIC_URL'),
    ];

    for (const candidate of candidates) {
      const publicUrl = this.normalizePublicPayHereUrl(candidate);
      if (!publicUrl) continue;
      return /\/api$/i.test(publicUrl) ? publicUrl : `${publicUrl}/api`;
    }

    return '';
  }

  private normalizePublicPayHereUrl(value?: string | null) {
    const input = String(value || '').trim();
    if (!input) return '';

    let url: URL;
    try {
      url = new URL(input);
    } catch {
      return '';
    }

    if (url.protocol !== 'https:') {
      return '';
    }
    if (this.isBlockedPaymentCallbackHost(url.hostname)) {
      return '';
    }

    const path = url.pathname.replace(/\/+$/, '');
    return `${url.origin}${path}${url.search}`;
  }

  private isBlockedPaymentCallbackHost(hostname: string) {
    const host = String(hostname || '').trim().toLowerCase();
    return !host ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.includes('your-public-domain') ||
      host.includes('your-domain') ||
      host === 'example.com' ||
      host.endsWith('.example.com') ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
  }
}
