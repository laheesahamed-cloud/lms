"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const database_tokens_1 = require("../../database/database.tokens");
const plans_service_1 = require("../plans/plans.service");
const settings_service_1 = require("../settings/settings.service");
let SubscriptionsService = class SubscriptionsService {
    constructor(db, plansService, settingsService, configService) {
        this.db = db;
        this.plansService = plansService;
        this.settingsService = settingsService;
        this.configService = configService;
        this.unlimitedFreePlanEndDate = '9999-12-31';
    }
    async getAdminMeta() {
        const [studentRows] = await this.db.execute(`SELECT id, full_name, email, status
       FROM users
       WHERE role = 'student'
       ORDER BY FIELD(status, 'active', 'inactive'), full_name ASC`);
        const plans = await this.plansService.findAll();
        const featureCatalog = await this.plansService.getFeatureCatalog();
        const [courseRows] = await this.db.execute(`SELECT id, course_title
       FROM courses
       WHERE status = 'active'
       ORDER BY course_title ASC`);
        const [lessonRows] = await this.db.execute(`SELECT l.id, l.lesson_title, l.course_id, c.course_title
       FROM lessons l
       INNER JOIN courses c ON c.id = l.course_id
       WHERE l.status = 'active' AND c.status = 'active'
       ORDER BY c.course_title ASC, l.lesson_title ASC`);
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
        const [rows] = await this.db.execute(`SELECT
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
       ORDER BY us.created_at DESC, us.id DESC`);
        return Promise.all(rows.map((row) => this.mapSubscription(row)));
    }
    async assign(dto, assignedBy) {
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
            throw new common_1.BadRequestException('End date cannot be earlier than start date');
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
    async requestUpgrade(userId, dto) {
        const student = await this.getStudentOrThrow(userId);
        const plan = await this.plansService.findById(dto.planId);
        const scope = this.normalizeAccessScope(dto.accessScope, dto.courseIds, dto.lessonIds);
        const [existingRows] = await this.db.execute(`SELECT id FROM subscription_requests WHERE user_id = ? AND plan_id = ? AND status = 'pending' LIMIT 1`, [student.id, plan.id]);
        if (existingRows[0]) {
            throw new common_1.BadRequestException('You already have a pending request for this plan');
        }
        const [result] = await this.db.execute(`INSERT INTO subscription_requests (
         user_id, plan_id, message, access_scope, course_ids_json, lesson_ids_json, status
       ) VALUES (?, ?, ?, ?, ?, ?, 'pending')`, [
            student.id,
            plan.id,
            String(dto.message || '').trim(),
            scope.accessScope,
            JSON.stringify(scope.courseIds),
            JSON.stringify(scope.lessonIds),
        ]);
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
    async requestManualPayment(userId, dto) {
        const student = await this.getStudentOrThrow(userId);
        const plan = await this.plansService.findById(dto.planId);
        const scope = this.normalizeAccessScope(dto.accessScope, dto.courseIds, dto.lessonIds);
        const proofDataUrl = String(dto.proofDataUrl || '').trim();
        const proofMimeType = String(dto.proofMimeType || '').trim().toLowerCase();
        if (!proofDataUrl) {
            throw new common_1.BadRequestException('Please upload a payment slip or screenshot');
        }
        if (!/^data:(image\/(png|jpe?g|webp)|application\/pdf);base64,/i.test(proofDataUrl)) {
            throw new common_1.BadRequestException('Payment proof must be a PNG, JPG, WEBP, or PDF file');
        }
        if (proofDataUrl.length > 4_500_000) {
            throw new common_1.BadRequestException('Payment proof is too large. Please upload a smaller screenshot or PDF');
        }
        const [existingRows] = await this.db.execute(`SELECT id FROM subscription_requests WHERE user_id = ? AND plan_id = ? AND status = 'pending' LIMIT 1`, [student.id, plan.id]);
        if (existingRows[0]) {
            throw new common_1.BadRequestException('You already have a pending request for this plan');
        }
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
            throw new common_1.BadRequestException('Coupon cannot reduce a bank transfer payment to zero. Please contact admin for manual access.');
        }
        const currency = String(plan.currency || 'LKR').toUpperCase();
        const invoiceId = await this.generateInvoiceId();
        const savedProof = await this.savePaymentProofFile(invoiceId, proofDataUrl);
        const [result] = await this.db.execute(`INSERT INTO subscription_requests (
         user_id, plan_id, invoice_id, message, payment_method, payment_reference, payment_amount, payment_currency,
         coupon_code, discount_amount, payment_proof_name, payment_proof_mime, payment_proof_data_url,
         access_scope, course_ids_json, lesson_ids_json, status
       ) VALUES (?, ?, ?, ?, 'bank_transfer', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`, [
            student.id,
            plan.id,
            invoiceId,
            messageParts.join('\n'),
            String(dto.paymentReference || '').trim() || null,
            payableAmount,
            currency,
            coupon?.code || null,
            discountAmount,
            savedProof.fileName,
            savedProof.mimeType || proofMimeType || null,
            savedProof.publicPath,
            scope.accessScope,
            JSON.stringify(scope.courseIds),
            JSON.stringify(scope.lessonIds),
        ]);
        await this.logAudit({
            requestId: result.insertId,
            userId: student.id,
            actorId: student.id,
            eventType: 'bank_transfer_uploaded',
            summary: `${student.email} uploaded bank transfer proof for ${plan.name}`,
            details: { planId: plan.id, amount: payableAmount, originalAmount: amount, discountAmount, couponCode: coupon?.code || '', currency, invoiceId, paymentReference: dto.paymentReference || '', proofFileName: savedProof.fileName, ...scope },
        });
        return {
            ok: true,
            id: result.insertId,
            invoiceId,
            amount: this.formatAmount(payableAmount),
            originalAmount: this.formatAmount(amount),
            discountAmount: this.formatAmount(discountAmount),
            couponCode: coupon?.code || '',
            couponMode: coupon?.couponMode || '',
            currency,
        };
    }
    async savePaymentProofFile(invoiceId, proofDataUrl) {
        const match = proofDataUrl.match(/^data:(image\/(png|jpe?g|webp)|application\/pdf);base64,(.+)$/i);
        if (!match) {
            throw new common_1.BadRequestException('Payment proof must be a PNG, JPG, WEBP, or PDF file');
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
            throw new common_1.BadRequestException('Payment proof is too large. Please upload a smaller screenshot or PDF');
        }
        if (!this.hasValidPaymentProofSignature(buffer, mimeType)) {
            throw new common_1.BadRequestException('Payment proof file contents do not match the selected file type');
        }
        const uploadDir = (0, path_1.join)(process.cwd(), 'uploads', 'payment-proofs');
        await (0, promises_1.mkdir)(uploadDir, { recursive: true });
        const fileName = `${invoiceId}.${extension}`;
        await (0, promises_1.writeFile)((0, path_1.join)(uploadDir, fileName), buffer);
        return {
            fileName,
            mimeType,
            publicPath: `/uploads/payment-proofs/${fileName}`,
        };
    }
    async getPaymentProofFile(invoiceId) {
        const normalizedInvoiceId = String(invoiceId || '').trim();
        if (!normalizedInvoiceId || !/^[A-Za-z0-9_-]+$/.test(normalizedInvoiceId)) {
            throw new common_1.BadRequestException('Invalid invoice ID');
        }
        const [rows] = await this.db.execute(`SELECT invoice_id, payment_proof_name, payment_proof_mime, payment_proof_data_url
       FROM subscription_requests
       WHERE invoice_id = ?
       LIMIT 1`, [normalizedInvoiceId]);
        const request = rows[0];
        if (!request?.payment_proof_data_url) {
            throw new common_1.NotFoundException('Payment proof was not uploaded');
        }
        const storedProof = String(request.payment_proof_data_url || '').trim();
        const dataUrlMatch = storedProof.match(/^data:(image\/(?:png|jpe?g|webp)|application\/pdf);base64,(.+)$/i);
        if (dataUrlMatch) {
            const mimeType = dataUrlMatch[1].toLowerCase();
            const buffer = Buffer.from(dataUrlMatch[2], 'base64');
            if (!buffer.length || !this.hasValidPaymentProofSignature(buffer, mimeType)) {
                throw new common_1.NotFoundException('Payment proof file is unavailable');
            }
            return {
                buffer,
                mimeType,
                fileName: this.safeDownloadFileName(request.payment_proof_name, `payment-proof-${normalizedInvoiceId}.${this.extensionForMimeType(mimeType)}`),
            };
        }
        if (!storedProof.startsWith('/uploads/payment-proofs/')) {
            throw new common_1.NotFoundException('Payment proof file is unavailable');
        }
        const storedFileName = (0, path_1.basename)(storedProof);
        const filePath = (0, path_1.join)(process.cwd(), 'uploads', 'payment-proofs', storedFileName);
        const buffer = await (0, promises_1.readFile)(filePath).catch(() => null);
        if (!buffer?.length) {
            throw new common_1.NotFoundException('Payment proof file is unavailable');
        }
        const mimeType = String(request.payment_proof_mime || this.mimeTypeForFileName(storedFileName)).toLowerCase();
        return {
            buffer,
            mimeType,
            fileName: this.safeDownloadFileName(request.payment_proof_name, storedFileName),
        };
    }
    extensionForMimeType(mimeType) {
        if (mimeType.includes('pdf'))
            return 'pdf';
        if (mimeType.includes('png'))
            return 'png';
        if (mimeType.includes('webp'))
            return 'webp';
        return 'jpg';
    }
    mimeTypeForFileName(fileName) {
        const lower = String(fileName || '').toLowerCase();
        if (lower.endsWith('.pdf'))
            return 'application/pdf';
        if (lower.endsWith('.png'))
            return 'image/png';
        if (lower.endsWith('.webp'))
            return 'image/webp';
        return 'image/jpeg';
    }
    safeDownloadFileName(preferredName, fallbackName) {
        const safeName = String(preferredName || fallbackName || 'payment-proof')
            .replace(/[^\w.\- ]+/g, '_')
            .replace(/\s+/g, ' ')
            .trim();
        return safeName || fallbackName || 'payment-proof';
    }
    hasValidPaymentProofSignature(buffer, mimeType) {
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
    async generateInvoiceId() {
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            await connection.execute(`INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('subscription_invoice_next', '1122')`);
            const [rows] = await connection.execute(`SELECT setting_value FROM system_settings WHERE setting_key = 'subscription_invoice_next' FOR UPDATE`);
            const current = Math.max(1122, Number(rows[0]?.setting_value || 1122));
            const next = current + 1;
            await connection.execute(`UPDATE system_settings SET setting_value = ? WHERE setting_key = 'subscription_invoice_next'`, [String(next)]);
            await connection.commit();
            return String(current);
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async findAdminRequests() {
        const [rows] = await this.db.execute(`SELECT
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
       ORDER BY FIELD(sr.status, 'pending', 'approved', 'rejected', 'cancelled'), sr.requested_at DESC, sr.id DESC`);
        return rows.map((row) => this.mapRequest(row));
    }
    async resolveRequest(requestId, status, adminNote, adminId) {
        const request = await this.findRequestById(requestId);
        if (request.status !== 'pending') {
            throw new common_1.BadRequestException('Only pending subscription requests can be resolved');
        }
        let subscriptionId = null;
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
            if (request.couponCode) {
                await this.db.execute('UPDATE subscription_coupons SET redemption_count = redemption_count + 1 WHERE code = ?', [request.couponCode]);
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
        }
        else {
            await this.logAudit({
                requestId,
                userId: request.userId,
                actorId: adminId,
                eventType: status === 'rejected' ? 'request_rejected' : 'request_cancelled',
                summary: status === 'rejected' ? 'Rejected subscription request' : 'Cancelled subscription request',
                details: { planId: request.planId },
            });
        }
        await this.db.execute(`UPDATE subscription_requests
       SET status = ?, admin_note = ?, resolved_at = NOW(), resolved_by = ?, subscription_id = ?
       WHERE id = ?`, [status, String(adminNote || '').trim(), adminId, subscriptionId, requestId]);
        return { ok: true, id: requestId, subscriptionId };
    }
    async getStudentBilling(userId) {
        const [currentRows] = await this.db.execute(`SELECT
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
       LIMIT 1`, [userId]);
        const [historyRows] = await this.db.execute(`SELECT
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
       LIMIT 12`, [userId]);
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
        const [rows] = await this.db.execute(`SELECT *
       FROM subscription_coupons
       ORDER BY status ASC, updated_at DESC, id DESC`);
        return rows.map((row) => this.mapCoupon(row));
    }
    async findInvoice(invoiceIdInput) {
        const invoiceId = String(invoiceIdInput || '').trim();
        if (!/^\d{3,20}$/.test(invoiceId)) {
            throw new common_1.BadRequestException('Enter a valid invoice ID');
        }
        const [transactionRows] = await this.db.execute(`SELECT
         pt.*,
         student.full_name AS student_name,
         student.email AS student_email,
         plans.name AS plan_name
       FROM payment_transactions pt
       INNER JOIN users student ON student.id = pt.user_id
       INNER JOIN plans ON plans.id = pt.plan_id
       WHERE pt.invoice_id = ? OR pt.order_id = ?
       LIMIT 1`, [invoiceId, invoiceId]);
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
        const [requestRows] = await this.db.execute(`SELECT
         sr.*,
         student.full_name AS student_name,
         student.email AS student_email,
         plans.name AS plan_name
       FROM subscription_requests sr
       INNER JOIN users student ON student.id = sr.user_id
       INNER JOIN plans ON plans.id = sr.plan_id
       WHERE sr.invoice_id = ?
       LIMIT 1`, [invoiceId]);
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
    async createCoupon(dto, adminId) {
        const payload = this.normalizeCouponPayload(dto);
        const [result] = await this.db.execute(`
        INSERT INTO subscription_coupons (
          code, label, coupon_mode, discount_type, discount_value, plan_ids_json, status, starts_at, expires_at, max_redemptions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
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
        ]);
        await this.logAudit({
            actorId: adminId,
            eventType: 'coupon_created',
            summary: `Created coupon ${payload.code}`,
            details: payload,
        });
        return { ok: true, id: result.insertId };
    }
    async updateCoupon(id, dto, adminId) {
        await this.getCouponRowOrThrow(id);
        const payload = this.normalizeCouponPayload(dto);
        await this.db.execute(`
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
      `, [
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
        ]);
        await this.logAudit({
            actorId: adminId,
            eventType: 'coupon_updated',
            summary: `Updated coupon ${payload.code}`,
            details: { id, ...payload },
        });
        return { ok: true, id };
    }
    async deleteCoupon(id, adminId) {
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
    async initiatePayHereCheckout(userId, planId, checkoutInput = {}) {
        if (this.normalizeCouponCode(checkoutInput.couponCode)) {
            throw new common_1.BadRequestException('Coupon codes are available for bank transfers only.');
        }
        const student = await this.getStudentOrThrow(userId);
        const plan = await this.plansService.findById(planId);
        const settings = await this.settingsService.getPayHereCheckoutSettings();
        if (!settings.enabled) {
            throw new common_1.BadRequestException('Online payments are not enabled yet.');
        }
        if (!settings.merchantId || !settings.merchantSecret) {
            throw new common_1.BadRequestException('PayHere merchant details are not configured yet.');
        }
        const amount = Number(plan.effectivePrice || 0);
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new common_1.BadRequestException('This plan does not have a payable amount.');
        }
        const scope = this.normalizeAccessScope(checkoutInput.accessScope, checkoutInput.courseIds, checkoutInput.lessonIds);
        const discountAmount = 0;
        const payableAmount = amount;
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
        await this.db.execute(`
        INSERT INTO payment_transactions (
          provider, order_id, invoice_id, user_id, plan_id, amount, currency, coupon_code, discount_amount, order_note,
          access_scope, course_ids_json, lesson_ids_json, status
        ) VALUES ('payhere', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'initiated')
      `, [
            orderId,
            invoiceId,
            student.id,
            plan.id,
            payableAmount,
            currency,
            null,
            discountAmount,
            String(checkoutInput.message || '').trim() || null,
            scope.accessScope,
            JSON.stringify(scope.courseIds),
            JSON.stringify(scope.lessonIds),
        ]);
        await this.logAudit({
            userId: student.id,
            actorId: student.id,
            eventType: 'payhere_checkout_initiated',
            summary: `Started PayHere checkout for ${plan.name}`,
            details: { planId: plan.id, invoiceId, orderId, amount: amountFormatted, originalAmount: this.formatAmount(amount), discountAmount, couponCode: '', currency, sandboxMode: settings.sandboxMode, billingName, billingEmail, orderNote: checkoutInput.message || '', ...scope },
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
            couponCode: '',
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
    async handlePayHereNotification(body) {
        const settings = await this.settingsService.getPayHereCheckoutSettings();
        const merchantId = String(body.merchant_id || '').trim();
        const orderId = String(body.order_id || '').trim();
        const payhereAmount = String(body.payhere_amount || '').trim();
        const payhereCurrency = String(body.payhere_currency || '').trim();
        const statusCode = String(body.status_code || '').trim();
        const md5sig = String(body.md5sig || '').trim().toUpperCase();
        this.assertPayHereNotificationPayload({ merchantId, orderId, payhereAmount, payhereCurrency, statusCode, md5sig });
        if (!settings.merchantId || !settings.merchantSecret) {
            throw new common_1.BadRequestException('PayHere is not configured');
        }
        const localSig = this.generateNotificationHash(merchantId, orderId, payhereAmount, payhereCurrency, statusCode, settings.merchantSecret);
        const transaction = await this.findPaymentTransaction(orderId);
        if (!transaction ||
            merchantId !== settings.merchantId ||
            transaction.currency !== payhereCurrency ||
            this.formatAmount(Number(transaction.amount)) !== this.formatAmount(Number(payhereAmount)) ||
            localSig !== md5sig) {
            throw new common_1.BadRequestException('PayHere notification verification failed');
        }
        const nextStatus = this.mapPayHereStatus(statusCode);
        if (nextStatus === 'paid' && (transaction.status === 'paid' || transaction.subscription_id)) {
            throw new common_1.BadRequestException('PayHere notification was already processed');
        }
        let subscriptionId = transaction?.subscription_id ? Number(transaction.subscription_id) : null;
        await this.db.execute(`
        UPDATE payment_transactions
        SET status = ?,
            payhere_payment_id = ?,
            payment_method = ?,
            md5sig = ?,
            raw_notify_json = ?
        WHERE id = ?
      `, [
            nextStatus,
            String(body.payment_id || '').trim() || null,
            String(body.method || '').trim() || null,
            md5sig || null,
            JSON.stringify(body || {}),
            transaction.id,
        ]);
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
                await this.db.execute('UPDATE subscription_coupons SET redemption_count = redemption_count + 1 WHERE code = ?', [transaction.coupon_code]);
            }
            await this.logAudit({
                subscriptionId,
                userId: Number(transaction.user_id),
                eventType: 'payhere_payment_paid',
                summary: `Verified PayHere payment for ${plan.name}`,
                details: { orderId, paymentId: body.payment_id || '', amount: payhereAmount, currency: payhereCurrency, couponCode: transaction.coupon_code || '', discountAmount: transaction.discount_amount || 0, accessScope: transaction.access_scope || 'all', courseIds: this.parseIdList(transaction.course_ids_json), lessonIds: this.parseIdList(transaction.lesson_ids_json) },
            });
        }
        else {
            await this.logAudit({
                userId: Number(transaction.user_id),
                eventType: `payhere_payment_${nextStatus}`,
                summary: `PayHere payment marked ${nextStatus}`,
                details: { orderId, statusCode, paymentId: body.payment_id || '', amount: payhereAmount, currency: payhereCurrency },
            });
        }
        return { ok: true };
    }
    async extendSubscription(id, days, notes, adminId) {
        const subscription = await this.getSubscriptionOrThrow(id);
        const cleanDays = Math.max(1, Number(days || 0));
        await this.db.execute(`UPDATE user_subscriptions
       SET end_date = DATE_ADD(GREATEST(end_date, CURDATE()), INTERVAL ? DAY),
           status = 'active',
           notes = CONCAT(COALESCE(notes, ''), ?)
       WHERE id = ?`, [cleanDays, notes ? `\nExtended ${cleanDays} day(s): ${notes.trim()}` : `\nExtended ${cleanDays} day(s).`, id]);
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
    async renewSubscription(id, dto, adminId) {
        const existing = await this.getSubscriptionOrThrow(id);
        const plan = await this.plansService.findById(dto.planId);
        const startBase = this.normalizeDate(dto.startDate) || this.addDays(String(existing.end_date), 1);
        const startDate = startBase < this.toDateOnly(new Date()) ? this.toDateOnly(new Date()) : startBase;
        const paymentStatus = this.isFreePlan(plan) ? 'free_plan' : dto.paymentStatus || 'manual';
        const endDate = this.isFreePlanAssignment(paymentStatus, plan)
            ? this.unlimitedFreePlanEndDate
            : this.normalizeDate(dto.endDate) || this.addDays(startDate, Math.max(1, plan.durationDays) - 1);
        if (endDate < startDate) {
            throw new common_1.BadRequestException('End date cannot be earlier than start date');
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
    async cancelSubscription(id, notes, adminId) {
        const subscription = await this.getSubscriptionOrThrow(id);
        await this.db.execute(`UPDATE user_subscriptions
       SET status = 'cancelled',
           notes = CONCAT(COALESCE(notes, ''), ?)
       WHERE id = ?`, [notes ? `\nCancelled: ${notes.trim()}` : '\nCancelled by admin.', id]);
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
    async updatePayment(id, dto, adminId) {
        const subscription = await this.getSubscriptionOrThrow(id);
        const paymentDate = this.normalizeDate(dto.paymentDate);
        await this.db.execute(`UPDATE user_subscriptions
       SET payment_status = COALESCE(?, payment_status),
           amount_paid = ?,
           payment_method = ?,
           payment_reference = ?,
           payment_date = ?,
           receipt_url = ?
       WHERE id = ?`, [
            dto.paymentStatus || null,
            dto.amountPaid === undefined || dto.amountPaid === null ? null : Number(dto.amountPaid),
            String(dto.paymentMethod || '').trim() || null,
            String(dto.paymentReference || '').trim() || null,
            paymentDate || null,
            String(dto.receiptUrl || '').trim() || null,
            id,
        ]);
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
        const [rows] = await this.db.execute(`SELECT
         sae.*,
         actor.full_name AS actor_name,
         actor.email AS actor_email,
         student.full_name AS student_name,
         student.email AS student_email
       FROM subscription_audit_events sae
       LEFT JOIN users actor ON actor.id = sae.actor_id
       LEFT JOIN users student ON student.id = sae.user_id
       ORDER BY sae.created_at DESC, sae.id DESC
       LIMIT 80`);
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
    async createSubscription(input) {
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            if (input.cancelExisting) {
                await connection.execute(`UPDATE user_subscriptions
           SET status = CASE
             WHEN end_date < CURDATE() THEN 'expired'
             ELSE 'cancelled'
           END
           WHERE user_id = ? AND status IN ('active', 'pending')`, [input.userId]);
            }
            const [result] = await connection.execute(`INSERT INTO user_subscriptions (
           user_id, plan_id, assigned_by, notes, status, payment_status,
           amount_paid, payment_method, payment_reference, payment_date, receipt_url,
           access_scope, course_ids_json, lesson_ids_json, start_date, end_date
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
            ]);
            await connection.commit();
            return result.insertId;
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async findStudentRequests(userId) {
        const [rows] = await this.db.execute(`SELECT
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
       LIMIT 12`, [userId]);
        return rows.map((row) => this.mapRequest(row));
    }
    async findPaymentTransaction(orderId) {
        const [rows] = await this.db.execute('SELECT * FROM payment_transactions WHERE order_id = ? LIMIT 1', [orderId]);
        return rows[0] || null;
    }
    async getCouponRowOrThrow(id) {
        const [rows] = await this.db.execute('SELECT * FROM subscription_coupons WHERE id = ? LIMIT 1', [id]);
        const row = rows[0];
        if (!row) {
            throw new common_1.NotFoundException('Coupon not found');
        }
        return row;
    }
    async findCouponByCode(code) {
        const normalized = this.normalizeCouponCode(code);
        if (!normalized)
            return null;
        const [rows] = await this.db.execute('SELECT * FROM subscription_coupons WHERE code = ? LIMIT 1', [normalized]);
        return rows[0] || null;
    }
    async findRequestById(id) {
        const [rows] = await this.db.execute(`SELECT sr.*, student.full_name AS student_name, student.email AS student_email, plans.name AS plan_name
       FROM subscription_requests sr
       INNER JOIN users student ON student.id = sr.user_id
       INNER JOIN plans ON plans.id = sr.plan_id
       WHERE sr.id = ?
       LIMIT 1`, [id]);
        const row = rows[0];
        if (!row) {
            throw new common_1.NotFoundException('Subscription request not found');
        }
        return this.mapRequest(row);
    }
    async getSubscriptionOrThrow(id) {
        const [rows] = await this.db.execute('SELECT * FROM user_subscriptions WHERE id = ? LIMIT 1', [id]);
        const row = rows[0];
        if (!row) {
            throw new common_1.NotFoundException('Subscription not found');
        }
        return row;
    }
    async logAudit(input) {
        await this.db.execute(`INSERT INTO subscription_audit_events (
        subscription_id, request_id, user_id, actor_id, event_type, summary, details_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
            input.subscriptionId || null,
            input.requestId || null,
            input.userId || null,
            input.actorId || null,
            input.eventType,
            input.summary,
            JSON.stringify(input.details || {}),
        ]);
    }
    parseDetails(raw) {
        try {
            return raw ? JSON.parse(raw) : {};
        }
        catch {
            return {};
        }
    }
    mapRequest(row) {
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
    async getStudentOrThrow(userId) {
        const [rows] = await this.db.execute(`SELECT id, full_name, email, status
       FROM users
       WHERE id = ? AND role = 'student'
       LIMIT 1`, [userId]);
        const row = rows[0];
        if (!row) {
            throw new common_1.NotFoundException('Student not found');
        }
        return {
            id: Number(row.id),
            fullName: String(row.full_name || ''),
            email: String(row.email || ''),
            status: String(row.status || 'inactive'),
        };
    }
    normalizeDate(value) {
        const input = String(value || '').trim();
        if (!input) {
            return '';
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
            throw new common_1.BadRequestException('Invalid date provided');
        }
        const date = new Date(`${input}T00:00:00`);
        if (Number.isNaN(date.getTime())) {
            throw new common_1.BadRequestException('Invalid date provided');
        }
        return input;
    }
    toDateOnly(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    addDays(dateText, days) {
        const date = new Date(`${dateText}T00:00:00`);
        date.setDate(date.getDate() + days);
        return this.toDateOnly(date);
    }
    dateValueToText(value) {
        if (value instanceof Date) {
            return this.toDateOnly(value);
        }
        return String(value || '').slice(0, 10);
    }
    timestampValueToText(value) {
        if (!value)
            return null;
        if (value instanceof Date) {
            if (Number.isNaN(value.getTime()))
                return null;
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
    normalizeAccessScope(accessScope, courseIds = [], lessonIds = []) {
        const scope = accessScope || 'all';
        const cleanCourseIds = this.cleanIdList(courseIds);
        const cleanLessonIds = this.cleanIdList(lessonIds);
        if (scope === 'courses' && cleanCourseIds.length === 0) {
            throw new common_1.BadRequestException('Choose at least one course for course-scoped access');
        }
        if (scope === 'lessons' && cleanLessonIds.length === 0) {
            throw new common_1.BadRequestException('Choose at least one lesson for lesson-scoped access');
        }
        return {
            accessScope: scope,
            courseIds: scope === 'courses' ? cleanCourseIds : [],
            lessonIds: scope === 'lessons' ? cleanLessonIds : [],
        };
    }
    cleanIdList(values) {
        return Array.from(new Set(values
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value > 0)));
    }
    parseIdList(raw) {
        try {
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? this.cleanIdList(parsed) : [];
        }
        catch {
            return [];
        }
    }
    async mapSubscription(row) {
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
    normalizePaymentCurrency(value) {
        void value;
        return 'LKR';
    }
    isFreePlanPaymentStatus(value) {
        const status = String(value || '').trim().toLowerCase();
        return status === 'free_plan' || status === 'free' || status === 'waived';
    }
    isFreePlan(plan) {
        return String(plan?.slug || '').toLowerCase() === 'free'
            || (String(plan?.name || '').trim().toLowerCase() === 'free' && Number(plan?.effectivePrice || 0) <= 0);
    }
    isFreePlanAssignment(paymentStatus, plan) {
        return this.isFreePlanPaymentStatus(paymentStatus) || this.isFreePlan(plan);
    }
    generateCheckoutHash(merchantId, orderId, amount, currency, merchantSecret) {
        return this.md5(`${merchantId}${orderId}${amount}${currency}${this.md5(merchantSecret)}`);
    }
    generateNotificationHash(merchantId, orderId, amount, currency, statusCode, merchantSecret) {
        return this.md5(`${merchantId}${orderId}${amount}${currency}${statusCode}${this.md5(merchantSecret)}`);
    }
    md5(value) {
        return (0, crypto_1.createHash)('md5').update(value).digest('hex').toUpperCase();
    }
    formatAmount(value) {
        return Number(value || 0).toFixed(2);
    }
    normalizeCouponPayload(dto) {
        const code = this.normalizeCouponCode(dto.code);
        if (!code) {
            throw new common_1.BadRequestException('Coupon code is required');
        }
        const couponMode = dto.couponMode === 'package' ? 'package' : 'discount';
        const discountType = dto.discountType === 'fixed' ? 'fixed' : 'percent';
        const discountValue = Number(dto.discountValue || 0);
        if (couponMode === 'discount' && (!Number.isFinite(discountValue) || discountValue <= 0)) {
            throw new common_1.BadRequestException('Coupon discount must be greater than zero');
        }
        if (couponMode === 'discount' && discountType === 'percent' && discountValue > 100) {
            throw new common_1.BadRequestException('Percent coupon cannot exceed 100%');
        }
        const planIds = this.cleanIdList(Array.isArray(dto.planIds) ? dto.planIds : []);
        if (couponMode === 'package' && planIds.length === 0) {
            throw new common_1.BadRequestException('Select at least one package for a package coupon');
        }
        const startsAt = this.normalizeDate(dto.startsAt);
        const expiresAt = this.normalizeDate(dto.expiresAt);
        if (startsAt && expiresAt && expiresAt < startsAt) {
            throw new common_1.BadRequestException('Coupon expiry cannot be earlier than the start date');
        }
        return {
            code,
            label: String(dto.label || '').trim() || null,
            couponMode,
            discountType,
            discountValue: couponMode === 'package' ? 0 : discountValue,
            planIds: couponMode === 'package' ? planIds : [],
            status: dto.status === 'inactive' ? 'inactive' : 'active',
            startsAt,
            expiresAt,
            maxRedemptions: dto.maxRedemptions === undefined || dto.maxRedemptions === null ? null : Number(dto.maxRedemptions),
        };
    }
    normalizeCouponCode(value) {
        return String(value || '')
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9_-]/g, '');
    }
    async resolveCouponForCheckout(code, amount, planId) {
        const normalizedCode = this.normalizeCouponCode(code);
        if (!normalizedCode)
            return null;
        const coupon = await this.findCouponByCode(normalizedCode);
        if (!coupon) {
            throw new common_1.BadRequestException('Coupon code was not found');
        }
        if (coupon.status !== 'active') {
            throw new common_1.BadRequestException('Coupon code is not active');
        }
        const today = this.toDateOnly(new Date());
        const startsAt = coupon.starts_at ? this.toDateOnly(new Date(coupon.starts_at)) : '';
        const expiresAt = coupon.expires_at ? this.toDateOnly(new Date(coupon.expires_at)) : '';
        if (startsAt && today < startsAt) {
            throw new common_1.BadRequestException('Coupon code is not active yet');
        }
        if (expiresAt && today > expiresAt) {
            throw new common_1.BadRequestException('Coupon code has expired');
        }
        if (coupon.max_redemptions && Number(coupon.redemption_count || 0) >= Number(coupon.max_redemptions)) {
            throw new common_1.BadRequestException('Coupon code has reached its usage limit');
        }
        const couponMode = coupon.coupon_mode === 'package' ? 'package' : 'discount';
        const planIds = this.parseIdList(coupon.plan_ids_json);
        if (couponMode === 'package' && !planIds.includes(Number(planId))) {
            throw new common_1.BadRequestException('Coupon code is not valid for this package');
        }
        const value = Number(coupon.discount_value || 0);
        const discountAmount = couponMode === 'discount'
            ? (coupon.discount_type === 'fixed' ? Math.min(amount, value) : Math.min(amount, amount * (value / 100)))
            : 0;
        return {
            code: String(coupon.code || '').trim(),
            couponMode,
            discountAmount: Number(this.formatAmount(discountAmount)),
            planIds,
        };
    }
    mapCoupon(row) {
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
    mapPayHereStatus(statusCode) {
        if (statusCode === '2')
            return 'paid';
        if (statusCode === '0')
            return 'pending';
        if (statusCode === '-1')
            return 'cancelled';
        if (statusCode === '-3')
            return 'chargedback';
        return 'failed';
    }
    assertPayHereNotificationPayload(input) {
        if (!input.merchantId || !input.orderId || !input.payhereAmount || !input.payhereCurrency || !input.statusCode || !input.md5sig) {
            throw new common_1.BadRequestException('PayHere notification payload is incomplete');
        }
        if (!/^\d+(?:\.\d{1,2})?$/.test(input.payhereAmount)) {
            throw new common_1.BadRequestException('PayHere notification amount is invalid');
        }
        if (!/^[A-Z]{3}$/.test(input.payhereCurrency)) {
            throw new common_1.BadRequestException('PayHere notification currency is invalid');
        }
        if (!['2', '0', '-1', '-2', '-3'].includes(input.statusCode)) {
            throw new common_1.BadRequestException('PayHere notification status is invalid');
        }
        if (!/^[a-f0-9]{32}$/i.test(input.md5sig)) {
            throw new common_1.BadRequestException('PayHere notification signature is invalid');
        }
    }
    splitName(fullName) {
        const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
        return {
            firstName: parts[0] || 'Student',
            lastName: parts.slice(1).join(' ') || 'LMS',
        };
    }
    resolveFrontendUrl() {
        return String(this.configService.get('frontendUrl') || 'http://localhost:5174').replace(/\/+$/, '');
    }
    resolveApiPublicUrl() {
        const configured = String(this.configService.get('PAYHERE_PUBLIC_API_URL') || '').trim();
        if (configured) {
            return configured.replace(/\/+$/, '');
        }
        const frontendUrl = this.resolveFrontendUrl();
        if (/localhost|127\.0\.0\.1/i.test(frontendUrl)) {
            return 'http://localhost:3000/api';
        }
        return `${frontendUrl}/api`;
    }
};
exports.SubscriptionsService = SubscriptionsService;
exports.SubscriptionsService = SubscriptionsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object, plans_service_1.PlansService,
        settings_service_1.SettingsService,
        config_1.ConfigService])
], SubscriptionsService);
//# sourceMappingURL=subscriptions.service.js.map