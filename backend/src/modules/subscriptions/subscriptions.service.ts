import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { PlansService } from '../plans/plans.service';
import { SettingsService } from '../settings/settings.service';
import { AssignSubscriptionDto } from './dto/assign-subscription.dto';
import { ManualPaymentRequestDto } from './dto/manual-payment-request.dto';
import { RequestSubscriptionDto } from './dto/request-subscription.dto';
import { SubscriptionCouponDto } from './dto/subscription-coupon.dto';

type SubscriptionRow = RowDataPacket & {
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
  discount_type: 'percent' | 'fixed';
  discount_value: string | number;
  status: 'active' | 'inactive';
  starts_at: string | null;
  expires_at: string | null;
  max_redemptions: number | null;
  redemption_count: number;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class SubscriptionsService {
  private readonly unlimitedFreePlanEndDate = '9999-12-31';

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Pool,
    private readonly plansService: PlansService,
    private readonly settingsService: SettingsService,
    private readonly configService: ConfigService
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

  async findAdminList() {
    const [rows] = await this.db.execute<SubscriptionRow[]>(
      `SELECT
         us.*,
         student.full_name AS student_name,
         student.email AS student_email,
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
       ORDER BY us.created_at DESC, us.id DESC`
    );

    return Promise.all(rows.map((row) => this.mapSubscription(row)));
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

  async requestManualPayment(userId: number, dto: ManualPaymentRequestDto) {
    const student = await this.getStudentOrThrow(userId);
    const plan = await this.plansService.findById(dto.planId);
    const scope = this.normalizeAccessScope(dto.accessScope, dto.courseIds, dto.lessonIds);
    const proofDataUrl = String(dto.proofDataUrl || '').trim();
    const proofMimeType = String(dto.proofMimeType || '').trim().toLowerCase();

    if (!proofDataUrl) {
      throw new BadRequestException('Please upload a payment slip or screenshot');
    }
    if (!/^data:(image\/(png|jpe?g|webp)|application\/pdf);base64,/i.test(proofDataUrl)) {
      throw new BadRequestException('Payment proof must be a PNG, JPG, WEBP, or PDF file');
    }
    if (proofDataUrl.length > 4_500_000) {
      throw new BadRequestException('Payment proof is too large. Please upload a smaller screenshot or PDF');
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
      dto.billingName ? `Billing name: ${String(dto.billingName).trim()}` : '',
      dto.billingEmail ? `Billing email: ${String(dto.billingEmail).trim()}` : '',
      dto.phone ? `Phone: ${String(dto.phone).trim()}` : '',
      dto.couponCode ? `Coupon: ${String(dto.couponCode).trim().toUpperCase()}` : '',
    ].filter(Boolean);

    const amount = Number(plan.effectivePrice || 0);
    const currency = String(plan.currency || 'LKR').toUpperCase();
    const invoiceId = await this.generateInvoiceId();
    const savedProof = await this.savePaymentProofFile(invoiceId, proofDataUrl);
    const [result] = await this.db.execute<ResultSetHeader>(
      `INSERT INTO subscription_requests (
         user_id, plan_id, invoice_id, message, payment_method, payment_reference, payment_amount, payment_currency,
         payment_proof_name, payment_proof_mime, payment_proof_data_url, access_scope, course_ids_json, lesson_ids_json, status
       ) VALUES (?, ?, ?, ?, 'bank_transfer', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        student.id,
        plan.id,
        invoiceId,
        messageParts.join('\n'),
        String(dto.paymentReference || '').trim() || null,
        amount,
        currency,
        savedProof.fileName,
        savedProof.mimeType || proofMimeType || null,
        savedProof.publicPath,
        scope.accessScope,
        JSON.stringify(scope.courseIds),
        JSON.stringify(scope.lessonIds),
      ]
    );

    await this.logAudit({
      requestId: result.insertId,
      userId: student.id,
      actorId: student.id,
      eventType: 'bank_transfer_uploaded',
      summary: `${student.email} uploaded bank transfer proof for ${plan.name}`,
      details: { planId: plan.id, amount, currency, invoiceId, paymentReference: dto.paymentReference || '', proofFileName: savedProof.fileName, ...scope },
    });

    return { ok: true, id: result.insertId, invoiceId };
  }

  private async savePaymentProofFile(invoiceId: string, proofDataUrl: string) {
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

    const uploadDir = join(process.cwd(), 'uploads', 'payment-proofs');
    await mkdir(uploadDir, { recursive: true });

    const fileName = `${invoiceId}.${extension}`;
    await writeFile(join(uploadDir, fileName), buffer);

    return {
      fileName,
      mimeType,
      publicPath: `/uploads/payment-proofs/${fileName}`,
    };
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
      await connection.execute(
        `INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('subscription_invoice_next', '1122')`
      );
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT setting_value FROM system_settings WHERE setting_key = 'subscription_invoice_next' FOR UPDATE`
      );
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
         sr.*,
         student.full_name AS student_name,
         student.email AS student_email,
         plans.name AS plan_name,
         plans.regular_price AS plan_regular_price,
         plans.offer_price AS plan_offer_price,
         plans.offer_enabled AS plan_offer_enabled,
         plans.currency AS plan_currency,
         admin.full_name AS resolved_by_name,
         admin.email AS resolved_by_email
       FROM subscription_requests sr
       INNER JOIN users student ON student.id = sr.user_id
       INNER JOIN plans ON plans.id = sr.plan_id
       LEFT JOIN users admin ON admin.id = sr.resolved_by
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
        paymentStatus: request.paymentProofDataUrl ? 'paid' : 'manual',
        amountPaid: request.paymentAmount ?? undefined,
        paymentMethod: request.paymentMethod || undefined,
        paymentReference: request.paymentReference || undefined,
        paymentDate: request.paymentProofDataUrl ? startDate : undefined,
        startDate,
        endDate,
        accessScope: request.accessScope,
        courseIds: request.courseIds,
        lessonIds: request.lessonIds,
        cancelExisting: true,
      });

      await this.logAudit({
        subscriptionId,
        requestId,
        userId: request.userId,
        actorId: adminId,
        eventType: 'request_approved',
        summary: `Approved request for ${plan.name}`,
        details: { planId: request.planId, startDate, endDate, paymentMethod: request.paymentMethod || '', paymentReference: request.paymentReference || '', accessScope: request.accessScope, courseIds: request.courseIds, lessonIds: request.lessonIds },
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

  async getStudentBilling(userId: number) {
    const [currentRows] = await this.db.execute<SubscriptionRow[]>(
      `SELECT
         us.*,
         plans.name AS plan_name,
         plans.regular_price AS plan_regular_price,
         plans.offer_price AS plan_offer_price,
         plans.offer_enabled AS plan_offer_enabled,
         plans.currency AS plan_currency,
         plans.duration_days AS plan_duration_days,
         plans.recommended AS plan_recommended
       FROM user_subscriptions us
       INNER JOIN plans ON plans.id = us.plan_id
       WHERE us.user_id = ?
       ORDER BY FIELD(us.status, 'active', 'pending', 'expired', 'cancelled'), us.end_date DESC, us.id DESC
       LIMIT 1`,
      [userId]
    );

    const [historyRows] = await this.db.execute<SubscriptionRow[]>(
      `SELECT
         us.*,
         admin.full_name AS assigned_by_name,
         plans.name AS plan_name,
         plans.regular_price AS plan_regular_price,
         plans.offer_price AS plan_offer_price,
         plans.offer_enabled AS plan_offer_enabled,
         plans.currency AS plan_currency,
         plans.duration_days AS plan_duration_days,
         plans.recommended AS plan_recommended
       FROM user_subscriptions us
       INNER JOIN plans ON plans.id = us.plan_id
       LEFT JOIN users admin ON admin.id = us.assigned_by
       WHERE us.user_id = ?
       ORDER BY us.created_at DESC, us.id DESC
       LIMIT 12`,
      [userId]
    );

    const availablePlans = await this.plansService.findActive();

    return {
      currentSubscription: currentRows[0] ? await this.mapSubscription(currentRows[0]) : null,
      history: (await Promise.all(historyRows.map((row) => this.mapSubscription(row))))
        .filter((subscription) => !subscription.isFreePlan),
      availablePlans,
      requests: await this.findStudentRequests(userId),
      payment: await this.settingsService.getStudentPaymentSettings(),
    };
  }

  async findCoupons() {
    const [rows] = await this.db.execute<SubscriptionCouponRow[]>(
      `SELECT *
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
         pt.*,
         student.full_name AS student_name,
         student.email AS student_email,
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
         sr.*,
         student.full_name AS student_name,
         student.email AS student_email,
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
          code, label, discount_type, discount_value, status, starts_at, expires_at, max_redemptions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payload.code,
        payload.label,
        payload.discountType,
        payload.discountValue,
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
            discount_type = ?,
            discount_value = ?,
            status = ?,
            starts_at = ?,
            expires_at = ?,
            max_redemptions = ?
        WHERE id = ?
      `,
      [
        payload.code,
        payload.label,
        payload.discountType,
        payload.discountValue,
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

    const coupon = await this.resolveCouponForCheckout(checkoutInput.couponCode, amount);
    const discountAmount = coupon ? coupon.discountAmount : 0;
    const payableAmount = Math.max(0, amount - discountAmount);
    if (payableAmount <= 0) {
      throw new BadRequestException('Coupon cannot reduce a PayHere checkout to zero. Use manual admin assignment for Free Plan access.');
    }

    const currency = settings.currency || String(plan.currency || 'LKR').toUpperCase();
    const invoiceId = await this.generateInvoiceId();
    const orderId = invoiceId;
    const amountFormatted = this.formatAmount(payableAmount);
    const baseFrontendUrl = this.resolveFrontendUrl();
    const returnUrl = settings.returnUrl || `${baseFrontendUrl}/lms/#/subscriptions?payment=return&order_id=${encodeURIComponent(orderId)}`;
    const cancelUrl = settings.cancelUrl || `${baseFrontendUrl}/lms/#/subscriptions?payment=cancel&order_id=${encodeURIComponent(orderId)}`;
    const notifyUrl = settings.notifyUrl || `${this.resolveApiPublicUrl()}/subscriptions/payhere/notify`;
    const billingName = String(checkoutInput.billingName || student.fullName || '').trim() || student.fullName;
    const billingEmail = String(checkoutInput.billingEmail || student.email || '').trim() || student.email;
    const nameParts = this.splitName(billingName);
    const phone = String(checkoutInput.phone || '').trim() || '0770000000';
    const address = String(checkoutInput.address || '').trim() || 'Student account';
    const city = String(checkoutInput.city || '').trim() || 'Colombo';
    const country = String(checkoutInput.country || '').trim() || 'Sri Lanka';

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
      actionUrl: settings.sandboxMode ? 'https://sandbox.payhere.lk/pay/checkout' : 'https://www.payhere.lk/pay/checkout',
      invoiceId,
      orderId,
      amount: amountFormatted,
      originalAmount: this.formatAmount(amount),
      discountAmount: this.formatAmount(discountAmount),
      couponCode: coupon?.code || '',
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
          `${settings.checkoutTitle || 'ERPM LMS subscription'} - ${plan.name}`,
          coupon?.code ? `(${coupon.code})` : '',
          checkoutInput.message ? `- ${String(checkoutInput.message).slice(0, 80)}` : '',
        ].filter(Boolean).join(' '),
        currency,
        amount: amountFormatted,
        custom_1: String(student.id),
        custom_2: String(plan.id),
        platform: 'ERPM LMS',
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
        localSig !== md5sig) {
      throw new BadRequestException('PayHere notification verification failed');
    }

    const nextStatus = this.mapPayHereStatus(statusCode);
    if (nextStatus === 'paid' && (transaction.status === 'paid' || transaction.subscription_id)) {
      throw new BadRequestException('PayHere notification was already processed');
    }
    let subscriptionId = transaction?.subscription_id ? Number(transaction.subscription_id) : null;

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
        details: { orderId, paymentId: body.payment_id || '', amount: payhereAmount, currency: payhereCurrency, couponCode: transaction.coupon_code || '', discountAmount: transaction.discount_amount || 0, accessScope: transaction.access_scope || 'all', courseIds: this.parseIdList(transaction.course_ids_json), lessonIds: this.parseIdList(transaction.lesson_ids_json) },
      });
    } else {
      await this.logAudit({
        userId: Number(transaction.user_id),
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
    const startBase = this.normalizeDate(dto.startDate) || this.addDays(String(existing.end_date), 1);
    const startDate = startBase < this.toDateOnly(new Date()) ? this.toDateOnly(new Date()) : startBase;
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

  async findAuditEvents() {
    const [rows] = await this.db.execute<SubscriptionAuditRow[]>(
      `SELECT
         sae.*,
         actor.full_name AS actor_name,
         actor.email AS actor_email,
         student.full_name AS student_name,
         student.email AS student_email
       FROM subscription_audit_events sae
       LEFT JOIN users actor ON actor.id = sae.actor_id
       LEFT JOIN users student ON student.id = sae.user_id
       ORDER BY sae.created_at DESC, sae.id DESC
       LIMIT 80`
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
           access_scope, course_ids_json, lesson_ids_json, start_date, end_date
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

  private async findStudentRequests(userId: number) {
    const [rows] = await this.db.execute<SubscriptionRequestRow[]>(
      `SELECT
         sr.*,
         plans.name AS plan_name,
         plans.regular_price AS plan_regular_price,
         plans.offer_price AS plan_offer_price,
         plans.offer_enabled AS plan_offer_enabled,
         plans.currency AS plan_currency,
         admin.full_name AS resolved_by_name
       FROM subscription_requests sr
       INNER JOIN plans ON plans.id = sr.plan_id
       LEFT JOIN users admin ON admin.id = sr.resolved_by
       WHERE sr.user_id = ?
       ORDER BY FIELD(sr.status, 'pending', 'approved', 'rejected', 'cancelled'), sr.requested_at DESC, sr.id DESC
       LIMIT 12`,
      [userId]
    );
    return rows.map((row) => this.mapRequest(row));
  }

  private async findPaymentTransaction(orderId: string) {
    const [rows] = await this.db.execute<PaymentTransactionRow[]>(
      'SELECT * FROM payment_transactions WHERE order_id = ? LIMIT 1',
      [orderId]
    );
    return rows[0] || null;
  }

  private async getCouponRowOrThrow(id: number) {
    const [rows] = await this.db.execute<SubscriptionCouponRow[]>(
      'SELECT * FROM subscription_coupons WHERE id = ? LIMIT 1',
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
      'SELECT * FROM subscription_coupons WHERE code = ? LIMIT 1',
      [normalized]
    );
    return rows[0] || null;
  }

  private async findRequestById(id: number) {
    const [rows] = await this.db.execute<SubscriptionRequestRow[]>(
      `SELECT sr.*, student.full_name AS student_name, student.email AS student_email, plans.name AS plan_name
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
      'SELECT * FROM user_subscriptions WHERE id = ? LIMIT 1',
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

  private async mapSubscription(row: SubscriptionRow) {
    const plan = await this.plansService.findById(Number(row.plan_id));
    const startDate = this.dateValueToText(row.start_date);
    const endDate = this.dateValueToText(row.end_date);
    const end = new Date(`${endDate}T00:00:00`);
    const today = new Date(`${this.toDateOnly(new Date())}T00:00:00`);
    const rawDaysRemaining = Math.floor((end.getTime() - today.getTime()) / 86400000) + 1;
    const isFreePlan = this.isFreePlanAssignment(row.payment_status, plan);
    const daysRemaining = isFreePlan ? null : rawDaysRemaining;
    const computedStatus = row.status === 'active' && !isFreePlan && rawDaysRemaining <= 0 ? 'expired' : row.status;

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

  private generateCheckoutHash(merchantId: string, orderId: string, amount: string, currency: string, merchantSecret: string) {
    return this.md5(`${merchantId}${orderId}${amount}${currency}${this.md5(merchantSecret)}`);
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
    const discountType = dto.discountType === 'fixed' ? 'fixed' : 'percent';
    const discountValue = Number(dto.discountValue || 0);
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      throw new BadRequestException('Coupon discount must be greater than zero');
    }
    if (discountType === 'percent' && discountValue > 100) {
      throw new BadRequestException('Percent coupon cannot exceed 100%');
    }

    const startsAt = this.normalizeDate(dto.startsAt);
    const expiresAt = this.normalizeDate(dto.expiresAt);
    if (startsAt && expiresAt && expiresAt < startsAt) {
      throw new BadRequestException('Coupon expiry cannot be earlier than the start date');
    }

    return {
      code,
      label: String(dto.label || '').trim() || null,
      discountType,
      discountValue,
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

  private async resolveCouponForCheckout(code: string | undefined, amount: number) {
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

    const value = Number(coupon.discount_value || 0);
    const discountAmount = coupon.discount_type === 'fixed' ? Math.min(amount, value) : Math.min(amount, amount * (value / 100));
    return {
      code: String(coupon.code || '').trim(),
      discountAmount: Number(this.formatAmount(discountAmount)),
    };
  }

  private mapCoupon(row: SubscriptionCouponRow) {
    return {
      id: Number(row.id),
      code: String(row.code || ''),
      label: String(row.label || ''),
      discountType: row.discount_type,
      discountValue: Number(row.discount_value || 0),
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

  private resolveApiPublicUrl() {
    const configured = String(this.configService.get<string>('PAYHERE_PUBLIC_API_URL') || '').trim();
    if (configured) {
      return configured.replace(/\/+$/, '');
    }

    const frontendUrl = this.resolveFrontendUrl();
    if (/localhost|127\.0\.0\.1/i.test(frontendUrl)) {
      return 'http://localhost:3000/api';
    }

    return `${frontendUrl}/api`;
  }
}
