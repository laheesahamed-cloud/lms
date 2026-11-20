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
var SchemaSyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaSyncService = exports.PAYER_EMAIL_TABLES = exports.CRITICAL_SCHEMA_VERSION = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = require("bcryptjs");
const database_tokens_1 = require("../../database/database.tokens");
const sql_safety_1 = require("../../database/sql-safety");
const structure_order_1 = require("../../common/utils/structure-order");
const structure_counts_1 = require("../../common/utils/structure-counts");
const planner_doc_1 = require("../../common/utils/planner-doc");
const quiz_counts_1 = require("../../common/utils/quiz-counts");
const question_content_1 = require("../../common/utils/question-content");
const subscription_catalog_1 = require("../plans/subscription-catalog");
const admin_counters_1 = require("../../common/utils/admin-counters");
exports.CRITICAL_SCHEMA_VERSION = '2026-11-20.1';
exports.PAYER_EMAIL_TABLES = [
    'user_subscriptions',
    'subscription_requests',
    'payment_transactions',
    'subscription_audit_events',
];
let SchemaSyncService = SchemaSyncService_1 = class SchemaSyncService {
    constructor(db) {
        this.db = db;
        this.logger = new common_1.Logger(SchemaSyncService_1.name);
    }
    shouldRunSchemaSync() {
        const flag = String(process.env.SCHEMA_SYNC ?? '').trim().toLowerCase();
        if (flag === '1' || flag === 'true' || flag === 'yes')
            return true;
        if (flag === '0' || flag === 'false' || flag === 'no')
            return false;
        return process.env.NODE_ENV !== 'production';
    }
    async onModuleInit() {
        let connection = null;
        await this.ensureCriticalTables();
        if (!this.shouldRunSchemaSync()) {
            this.logger.log('Schema sync skipped for fast boot (set SCHEMA_SYNC=1 to run it).');
            return;
        }
        try {
            connection = await this.db.getConnection();
            await this.ensurePlansTable(connection);
            await this.ensureUserSubscriptionsTable(connection);
            await this.ensureIapTables(connection);
            await this.ensureSubscriptionCouponsTable(connection);
            await this.ensurePaymentTransactionsTable(connection);
            await this.ensurePapersTable(connection);
            await this.ensureQuestionReportsTable(connection);
            await this.ensureNativePushTokensTable(connection);
            await this.ensureStudyPlannerTasksTable(connection);
            await this.ensureSystemSettingsTable(connection);
            await this.ensureAiProviderConfigsTable(connection);
            await this.ensureLessonFlashcardsTable(connection);
            await this.ensureSubscriptionFeaturesTables(connection);
            await this.ensureSubscriptionRequestTables(connection);
            await this.ensureEcgTables(connection);
            await this.ensureAuscultationTables(connection);
            await this.ensureUserRoleColumnSupportsStaff(connection);
            await this.ensureColumn(connection, 'users', 'avatar_key', "VARCHAR(64) NULL AFTER status");
            await this.ensureColumn(connection, 'users', 'session_expires_at', 'DATETIME NULL AFTER session_token');
            await this.ensureColumn(connection, 'users', 'password_reset_token', 'VARCHAR(128) NULL AFTER session_expires_at');
            await this.ensureColumn(connection, 'users', 'password_reset_expires_at', 'DATETIME NULL AFTER password_reset_token');
            await this.ensureColumn(connection, 'users', 'deleted_at', 'DATETIME NULL AFTER password_reset_expires_at');
            await this.ensureColumn(connection, 'users', 'email_verified', 'TINYINT(1) NOT NULL DEFAULT 1 AFTER deleted_at');
            await this.ensureColumn(connection, 'users', 'email_otp_code', 'VARCHAR(128) NULL AFTER email_verified');
            await this.ensureColumn(connection, 'users', 'email_otp_expires_at', 'DATETIME NULL AFTER email_otp_code');
            await this.ensureColumn(connection, 'users', 'email_otp_attempts', 'INT NOT NULL DEFAULT 0 AFTER email_otp_expires_at');
            await this.ensureColumn(connection, 'users', 'email_otp_last_sent_at', 'DATETIME NULL AFTER email_otp_attempts');
            await this.ensureColumn(connection, 'users', 'permissions', 'TEXT NULL AFTER role');
            await this.ensureColumn(connection, 'study_planner_tasks', 'category', "ENUM('general','lesson','quiz','exam','review','flashcards') NOT NULL DEFAULT 'general' AFTER status");
            await this.ensureColumn(connection, 'study_planner_tasks', 'priority', "ENUM('low','medium','high') NOT NULL DEFAULT 'medium' AFTER category");
            await this.ensureColumn(connection, 'study_planner_tasks', 'estimated_minutes', 'INT NULL AFTER priority');
            await this.ensureColumn(connection, 'lessons', 'note_data', 'LONGTEXT NULL');
            await this.ensureColumn(connection, 'lessons', 'raw_text', 'LONGTEXT NULL');
            await this.ensureColumn(connection, 'lessons', 'engine_key', "VARCHAR(32) NOT NULL DEFAULT 'gemini'");
            await this.ensureColumn(connection, 'lessons', 'is_public', 'TINYINT NOT NULL DEFAULT 1');
            await this.ensureColumn(connection, 'lessons', 'pdf_url', 'VARCHAR(500) NULL');
            await this.ensureColumn(connection, 'lesson_flashcards', 'image_url', 'LONGTEXT NULL AFTER source_hint');
            await this.ensureColumn(connection, 'lesson_flashcards', 'image_fit', "ENUM('contain','cover') NOT NULL DEFAULT 'contain' AFTER image_url");
            await this.ensureColumn(connection, 'questions', 'subtopic_id', 'INT NULL AFTER topic_id');
            await this.ensureColumn(connection, 'questions', 'lesson_id', 'INT NULL AFTER subtopic_id');
            await this.ensureColumn(connection, 'questions', 'paper_id', 'INT NULL AFTER lesson_id');
            await this.ensureColumn(connection, 'questions', 'question_category', "VARCHAR(20) NULL AFTER category");
            await this.ensureColumn(connection, 'questions', 'explanation_image_url', 'LONGTEXT NULL AFTER explanation');
            await this.ensureColumn(connection, 'questions', 'question_approach', 'LONGTEXT NULL AFTER explanation_image_url');
            await this.ensureColumn(connection, 'questions', 'question_approach_highlights', 'LONGTEXT NULL AFTER question_approach');
            await this.ensureQuestionCategoryColumns(connection);
            await this.ensureColumn(connection, 'courses', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');
            await this.ensureColumn(connection, 'topics', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');
            await this.ensureColumn(connection, 'lessons', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');
            await this.ensureColumn(connection, 'papers', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');
            await this.ensureColumn(connection, 'questions', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');
            await this.ensureColumn(connection, 'quizzes', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');
            await this.ensureColumn(connection, 'quizzes', 'subtopic_id', 'INT NULL AFTER topic_id');
            await this.ensureColumn(connection, 'quizzes', 'category', 'VARCHAR(120) NULL AFTER subtopic_id');
            await this.ensureColumn(connection, 'quizzes', 'is_free', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER category');
            await this.ensureColumn(connection, 'quizzes', 'quiz_number', 'INT NULL DEFAULT NULL');
            await this.ensureColumn(connection, 'lessons', 'is_free', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER video_url');
            await this.ensureColumn(connection, 'plans', 'slug', 'VARCHAR(160) NULL AFTER name');
            await this.ensureColumn(connection, 'plans', 'regular_price', 'DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER description');
            await this.ensureColumn(connection, 'plans', 'offer_price', 'DECIMAL(10, 2) NULL AFTER regular_price');
            await this.ensureColumn(connection, 'plans', 'offer_enabled', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER offer_price');
            await this.ensureColumn(connection, 'plans', 'sort_order', 'INT NOT NULL DEFAULT 0 AFTER status');
            await this.ensureColumn(connection, 'plans', 'recommended', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER sort_order');
            await this.ensureColumn(connection, 'user_subscriptions', 'amount_paid', 'DECIMAL(10, 2) NULL AFTER payment_status');
            await this.ensureColumn(connection, 'user_subscriptions', 'payment_method', 'VARCHAR(80) NULL AFTER amount_paid');
            await this.ensureColumn(connection, 'user_subscriptions', 'payment_reference', 'VARCHAR(191) NULL AFTER payment_method');
            await this.ensureColumn(connection, 'user_subscriptions', 'payment_date', 'DATE NULL AFTER payment_reference');
            await this.ensureColumn(connection, 'user_subscriptions', 'receipt_url', 'VARCHAR(1000) NULL AFTER payment_date');
            await this.ensureColumn(connection, 'user_subscriptions', 'access_scope', "ENUM('all','courses','lessons') NOT NULL DEFAULT 'all' AFTER receipt_url");
            await this.ensureColumn(connection, 'user_subscriptions', 'course_ids_json', 'TEXT NULL AFTER access_scope');
            await this.ensureColumn(connection, 'user_subscriptions', 'lesson_ids_json', 'TEXT NULL AFTER course_ids_json');
            await this.ensureFreePlanPaymentStatus(connection);
            await this.ensureUnlimitedFreePlanDates(connection);
            await this.ensureColumn(connection, 'subscription_requests', 'invoice_id', 'VARCHAR(20) NULL AFTER plan_id');
            await this.ensureColumn(connection, 'subscription_requests', 'payment_method', 'VARCHAR(80) NULL AFTER message');
            await this.ensureColumn(connection, 'subscription_requests', 'payment_reference', 'VARCHAR(191) NULL AFTER payment_method');
            await this.ensureColumn(connection, 'subscription_requests', 'payment_amount', 'DECIMAL(10, 2) NULL AFTER payment_reference');
            await this.ensureColumn(connection, 'subscription_requests', 'payment_currency', 'VARCHAR(10) NULL AFTER payment_amount');
            await this.ensureColumn(connection, 'subscription_requests', 'coupon_code', 'VARCHAR(40) NULL AFTER payment_currency');
            await this.ensureColumn(connection, 'subscription_requests', 'discount_amount', 'DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER coupon_code');
            await this.ensureColumn(connection, 'subscription_requests', 'payment_proof_name', 'VARCHAR(255) NULL AFTER discount_amount');
            await this.ensureColumn(connection, 'subscription_requests', 'payment_proof_mime', 'VARCHAR(80) NULL AFTER payment_proof_name');
            await this.ensureColumn(connection, 'subscription_requests', 'payment_proof_data_url', 'LONGTEXT NULL AFTER payment_proof_mime');
            await this.ensureColumn(connection, 'subscription_requests', 'access_scope', "ENUM('all','courses','lessons') NOT NULL DEFAULT 'all' AFTER payment_proof_data_url");
            await this.ensureColumn(connection, 'subscription_requests', 'course_ids_json', 'TEXT NULL AFTER access_scope');
            await this.ensureColumn(connection, 'subscription_requests', 'lesson_ids_json', 'TEXT NULL AFTER course_ids_json');
            await this.ensureColumn(connection, 'payment_transactions', 'invoice_id', 'VARCHAR(20) NULL AFTER order_id');
            await this.ensureColumn(connection, 'payment_transactions', 'coupon_code', 'VARCHAR(40) NULL AFTER currency');
            await this.ensureColumn(connection, 'payment_transactions', 'discount_amount', 'DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER coupon_code');
            await this.ensureColumn(connection, 'payment_transactions', 'order_note', 'TEXT NULL AFTER discount_amount');
            await this.ensureColumn(connection, 'payment_transactions', 'access_scope', "ENUM('all','courses','lessons') NOT NULL DEFAULT 'all' AFTER order_note");
            await this.ensureColumn(connection, 'payment_transactions', 'course_ids_json', 'TEXT NULL AFTER access_scope');
            await this.ensureColumn(connection, 'payment_transactions', 'lesson_ids_json', 'TEXT NULL AFTER course_ids_json');
            await this.ensureColumn(connection, 'subscription_coupons', 'coupon_mode', "ENUM('discount','package') NOT NULL DEFAULT 'discount' AFTER label");
            await this.ensureColumn(connection, 'subscription_coupons', 'plan_ids_json', 'TEXT NULL AFTER discount_value');
            await this.ensureColumn(connection, 'question_quizzes', 'sort_order', 'INT NOT NULL DEFAULT 0');
            await this.ensureColumn(connection, 'quizzes', 'show_theory_recap_in_practice', 'TINYINT(1) NOT NULL DEFAULT 1');
            await this.ensureColumn(connection, 'quizzes', 'show_theory_recap_in_review', 'TINYINT(1) NOT NULL DEFAULT 1');
            await this.ensureIndex(connection, 'questions', 'idx_questions_subtopic_id', 'subtopic_id');
            await this.ensureIndex(connection, 'questions', 'idx_questions_lesson_id', 'lesson_id');
            await this.ensureIndex(connection, 'questions', 'idx_questions_paper_id', 'paper_id');
            await this.ensureIndex(connection, 'quizzes', 'idx_quizzes_subtopic_id', 'subtopic_id');
            await this.ensureIndex(connection, 'plans', 'idx_plans_slug', 'slug');
            await this.ensureIndex(connection, 'users', 'idx_users_password_reset_token', 'password_reset_token');
            await this.ensureIndex(connection, 'users', 'idx_users_session_token_expires', 'session_token, session_expires_at');
            await this.ensureIndex(connection, 'plans', 'idx_plans_sort_order', 'sort_order');
            await this.ensureIndex(connection, 'question_quizzes', 'idx_question_quizzes_quiz_sort', 'quiz_id, sort_order');
            await this.ensureIndex(connection, 'question_quizzes', 'idx_question_quizzes_question_quiz', 'question_id, quiz_id');
            await this.ensureIndex(connection, 'questions', 'idx_questions_status_type_id', 'status, question_type, id');
            await this.ensureIndex(connection, 'questions', 'idx_questions_created_at', 'created_at');
            await this.ensureIndex(connection, 'lessons', 'idx_lessons_created_at', 'created_at');
            await this.ensureIndex(connection, 'questions', 'idx_questions_dynamic_course_scope', 'status, course_id, topic_id, subtopic_id, lesson_id, question_type, id');
            await this.ensureIndex(connection, 'questions', 'idx_questions_dynamic_paper_scope', 'status, paper_id, question_type, id');
            await this.ensureIndex(connection, 'questions', 'idx_questions_dynamic_question_category', 'status, question_category, question_type, id');
            await this.ensureIndex(connection, 'questions', 'idx_questions_dynamic_legacy_category', 'status, category, question_type, id');
            await this.ensureIndex(connection, 'quizzes', 'idx_quizzes_status_course_id', 'status, course_id, id');
            await this.ensureIndex(connection, 'subscription_features', 'idx_subscription_features_key', 'feature_key');
            await this.ensureIndex(connection, 'subscription_features', 'idx_subscription_features_category', 'category');
            await this.ensureIndex(connection, 'subscription_plan_features', 'idx_subscription_plan_features_feature_id', 'feature_id');
            await this.ensureIndex(connection, 'subscription_requests', 'idx_subscription_requests_user', 'user_id');
            await this.ensureIndex(connection, 'subscription_requests', 'idx_subscription_requests_status', 'status');
            await this.ensureIndex(connection, 'subscription_requests', 'idx_subscription_requests_invoice', 'invoice_id');
            await this.ensureIndex(connection, 'subscription_audit_events', 'idx_subscription_audit_subscription', 'subscription_id');
            await this.ensureIndex(connection, 'subscription_audit_events', 'idx_subscription_audit_request', 'request_id');
            await this.ensureIndex(connection, 'payment_transactions', 'idx_payment_transactions_order_id', 'order_id');
            await this.ensureIndex(connection, 'payment_transactions', 'idx_payment_transactions_invoice', 'invoice_id');
            await this.ensureIndex(connection, 'payment_transactions', 'idx_payment_transactions_user', 'user_id');
            await this.ensureIndex(connection, 'subscription_coupons', 'idx_subscription_coupons_status', 'status');
            await this.ensureIndex(connection, 'native_push_tokens', 'idx_native_push_tokens_user', 'user_id');
            await this.ensureIndex(connection, 'native_push_tokens', 'idx_native_push_tokens_enabled', 'enabled');
            await this.ensureIndex(connection, 'study_planner_tasks', 'idx_study_planner_user_due', 'user_id, due_date');
            await this.ensureIndex(connection, 'lessons', 'idx_lessons_public_status_course', 'is_public, status, course_id, topic_id');
            await this.ensureIndex(connection, 'lessons', 'idx_lessons_engine_pub_status', 'engine_key, is_public, status, updated_at');
            await this.ensureIndex(connection, 'lesson_flashcards', 'idx_lesson_flashcards_note_status', 'note_id, status');
            await this.ensureIndex(connection, 'lesson_flashcards', 'idx_lesson_flashcards_lesson_status', 'lesson_id, status');
            await this.backfillPlanSubscriptionColumns(connection);
            await this.seedSubscriptionFeatureCatalog(connection);
            await this.seedDefaultPlans(connection);
            await this.backfillPlanFeatureMaps(connection);
            await this.hashLegacyPlaintextPasswords(connection);
        }
        catch (error) {
            const message = error instanceof Error ? error.stack || error.message : String(error);
            this.logger.error(`Schema sync skipped because the database is not ready: ${message}`);
        }
        finally {
            connection?.release();
        }
    }
    async hashLegacyPlaintextPasswords(connection) {
        const [rows] = await connection.execute(`SELECT id, password
       FROM users
       WHERE password IS NOT NULL
         AND password <> ''
         AND password NOT LIKE '$2a$%'
         AND password NOT LIKE '$2b$%'
         AND password NOT LIKE '$2y$%'`);
        for (const row of rows) {
            const hashedPassword = await bcrypt.hash(String(row.password), 10);
            await connection.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, Number(row.id)]);
        }
        if (rows.length > 0) {
            this.logger.warn(`Hashed ${rows.length} legacy plaintext user password(s).`);
        }
    }
    async ensurePapersTable(connection) {
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS papers (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        paper_title VARCHAR(255) NOT NULL,
        year INT NOT NULL,
        exam_source ENUM('local', 'erpm') NOT NULL DEFAULT 'local',
        keywords_text TEXT NULL,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    }
    async ensurePlansTable(connection) {
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS plans (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        currency VARCHAR(10) NOT NULL DEFAULT 'LKR',
        billing_period VARCHAR(50) NOT NULL DEFAULT 'month',
        duration_days INT NOT NULL DEFAULT 30,
        features_json JSON NULL,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_plans_status (status)
      )
    `);
    }
    async ensureUserSubscriptionsTable(connection) {
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_subscriptions (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        plan_id INT NOT NULL,
        assigned_by INT NULL,
        notes TEXT NULL,
        status ENUM('active', 'pending', 'expired', 'cancelled') NOT NULL DEFAULT 'active',
        payment_status ENUM('manual', 'paid', 'unpaid', 'free_plan') NOT NULL DEFAULT 'manual',
        amount_paid DECIMAL(10, 2) NULL,
        payment_method VARCHAR(80) NULL,
        payment_reference VARCHAR(191) NULL,
        payment_date DATE NULL,
        receipt_url VARCHAR(1000) NULL,
        access_scope ENUM('all','courses','lessons') NOT NULL DEFAULT 'all',
        course_ids_json TEXT NULL,
        lesson_ids_json TEXT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_subscriptions_user (user_id),
        INDEX idx_user_subscriptions_plan (plan_id),
        INDEX idx_user_subscriptions_status (status),
        INDEX idx_user_subscriptions_dates (start_date, end_date)
      )
    `);
    }
    async ensureIapTables(connection) {
        try {
            await this.ensureColumn(connection, 'plans', 'apple_product_id', 'VARCHAR(191) NULL AFTER billing_period');
            await this.ensureUniqueIndex(connection, 'plans', 'uniq_plans_apple_product', 'apple_product_id');
        }
        catch (error) {
            this.logger.warn(`Deferred plans.apple_product_id until the plans table exists: ${error.message}`);
        }
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS iap_transactions (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        subscription_id INT NULL,
        platform VARCHAR(20) NOT NULL DEFAULT 'apple',
        product_id VARCHAR(191) NOT NULL,
        transaction_id VARCHAR(191) NOT NULL,
        original_transaction_id VARCHAR(191) NOT NULL,
        environment VARCHAR(20) NOT NULL,
        purchase_date DATETIME NULL,
        expires_date DATETIME NULL,
        revocation_date DATETIME NULL,
        raw_payload MEDIUMTEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_iap_transaction (transaction_id),
        INDEX idx_iap_original (original_transaction_id),
        INDEX idx_iap_user (user_id)
      )
    `);
        await this.ensureApplePlanMappings(connection);
    }
    async ensureApplePlanMappings(connection) {
        for (const product of subscription_catalog_1.APPLE_IAP_PRODUCTS) {
            try {
                const [rows] = await connection.execute('SELECT id, apple_product_id FROM plans WHERE slug = ? LIMIT 1', [product.slug]);
                const planId = rows[0] ? Number(rows[0].id) : 0;
                if (!planId) {
                    this.logger.warn(`No plan with slug "${product.slug}" for Apple product ${product.productId} — ` +
                        'purchases of it will be rejected at redemption until a plan carries that product id.');
                    continue;
                }
                if (String(rows[0].apple_product_id || '') === product.productId)
                    continue;
                await connection.execute('UPDATE plans SET apple_product_id = ? WHERE id = ? AND apple_product_id IS NULL', [
                    product.productId,
                    planId,
                ]);
            }
            catch (error) {
                this.logger.error(`Could not map Apple product ${product.productId} to plan ${product.slug}`, error);
            }
        }
    }
    async ensureSubscriptionCouponsTable(connection) {
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS subscription_coupons (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(40) NOT NULL,
        label VARCHAR(120) NULL,
        coupon_mode ENUM('discount','package') NOT NULL DEFAULT 'discount',
        discount_type ENUM('percent', 'fixed') NOT NULL DEFAULT 'percent',
        discount_value DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        plan_ids_json TEXT NULL,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        starts_at DATE NULL,
        expires_at DATE NULL,
        max_redemptions INT NULL,
        redemption_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_subscription_coupons_code (code),
        INDEX idx_subscription_coupons_status (status)
      )
    `);
    }
    async ensurePaymentTransactionsTable(connection) {
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        provider VARCHAR(40) NOT NULL DEFAULT 'payhere',
        order_id VARCHAR(120) NOT NULL,
        invoice_id VARCHAR(20) NULL,
        user_id INT NOT NULL,
        plan_id INT NOT NULL,
        subscription_id INT NULL,
        amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        currency VARCHAR(10) NOT NULL DEFAULT 'LKR',
        coupon_code VARCHAR(40) NULL,
        discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        order_note TEXT NULL,
        access_scope ENUM('all','courses','lessons') NOT NULL DEFAULT 'all',
        course_ids_json TEXT NULL,
        lesson_ids_json TEXT NULL,
        status ENUM('initiated', 'pending', 'paid', 'cancelled', 'failed', 'chargedback', 'invalid') NOT NULL DEFAULT 'initiated',
        payhere_payment_id VARCHAR(120) NULL,
        payment_method VARCHAR(80) NULL,
        md5sig VARCHAR(64) NULL,
        raw_notify_json JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_payment_transactions_order_id (order_id),
        INDEX idx_payment_transactions_user (user_id),
        INDEX idx_payment_transactions_plan (plan_id),
        INDEX idx_payment_transactions_status (status)
      )
    `);
    }
    async ensureQuestionReportsTable(connection) {
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS question_reports (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        question_id INT NOT NULL,
        user_id INT NOT NULL,
        reason VARCHAR(120) NOT NULL,
        comment TEXT NULL,
        status ENUM('open', 'resolved', 'rejected') NOT NULL DEFAULT 'open',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_question_reports_question_id (question_id),
        INDEX idx_question_reports_user_id (user_id),
        INDEX idx_question_reports_status (status)
      )
    `);
    }
    async ensureLessonGenerationJobsTable(connection) {
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS lesson_generation_jobs (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        status ENUM('running', 'done', 'error') NOT NULL DEFAULT 'running',
        stages_json LONGTEXT NOT NULL,
        result_json LONGTEXT NULL,
        error_text TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_lesson_generation_jobs_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        await this.ensureColumn(connection, 'lesson_generation_jobs', 'partial', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER status');
        try {
            await connection.execute(`
        ALTER TABLE lesson_generation_jobs CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
      `);
        }
        catch {
        }
    }
    async ensureNativePushTokensTable(connection) {
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS native_push_tokens (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token_hash CHAR(64) NOT NULL,
        token TEXT NOT NULL,
        platform ENUM('ios','android','unknown') NOT NULL DEFAULT 'unknown',
        delivery_mode ENUM('inside','outside','both') NOT NULL DEFAULT 'outside',
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        last_error VARCHAR(500) NULL,
        failed_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_native_push_token_hash (token_hash),
        INDEX idx_native_push_tokens_user (user_id),
        INDEX idx_native_push_tokens_enabled (enabled)
      )
    `);
    }
    async ensureStudyPlannerTasksTable(connection) {
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS study_planner_tasks (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(220) NOT NULL,
        description TEXT NULL,
        due_date DATE NULL,
        status ENUM('todo','done') NOT NULL DEFAULT 'todo',
        category ENUM('general','lesson','quiz','exam','review','flashcards') NOT NULL DEFAULT 'general',
        priority ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
        estimated_minutes INT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_study_planner_user_due (user_id, due_date),
        INDEX idx_study_planner_status (status)
      )
    `);
    }
    async ensureUserRoleColumnSupportsStaff(connection) {
        try {
            await connection.execute("ALTER TABLE users MODIFY role VARCHAR(40) NOT NULL DEFAULT 'student'");
        }
        catch (error) {
            this.logger.warn(`Could not widen users.role for staff roles: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async ensureQuestionCategoryColumns(connection) {
        try {
            await connection.execute("ALTER TABLE questions MODIFY category VARCHAR(20) NOT NULL DEFAULT 'mock'");
            await connection.execute("UPDATE questions SET category = 'past' WHERE category = 'past_paper'");
            await connection.execute("ALTER TABLE questions MODIFY question_category VARCHAR(20) NOT NULL DEFAULT 'mock'");
            await connection.execute("UPDATE questions SET question_category = 'past_paper' WHERE question_category = 'past'");
        }
        catch (error) {
            this.logger.warn(`Could not widen question category columns: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async ensureCriticalTables() {
        let connection = null;
        try {
            connection = await this.db.getConnection();
        }
        catch (error) {
            this.logger.error('Could not get a connection to ensure critical tables', error);
            return;
        }
        const conn = connection;
        let failed = 0;
        const step = async (name, run) => {
            try {
                await run();
            }
            catch (error) {
                failed += 1;
                this.logger.error(`Critical schema step failed: ${name}`, error);
            }
        };
        try {
            await conn.execute(`
        CREATE TABLE IF NOT EXISTS system_settings (
          setting_key VARCHAR(120) NOT NULL PRIMARY KEY,
          setting_value TEXT NULL,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
            const [done] = await conn.execute(`SELECT setting_value FROM system_settings WHERE setting_key = 'critical_schema_version' LIMIT 1`);
            if (done[0] && String(done[0].setting_value) === exports.CRITICAL_SCHEMA_VERSION) {
                connection.release();
                return;
            }
        }
        catch (error) {
            this.logger.warn(`Could not read critical_schema_version: ${error.message}`);
        }
        try {
            await step('users.permissions', () => this.ensureColumn(conn, 'users', 'permissions', 'TEXT NULL AFTER role'));
            await step('user_subscriptions.access_expires_at', () => this.ensureColumn(conn, 'user_subscriptions', 'access_expires_at', 'DATETIME NULL AFTER end_date'));
            await step('access_expires_at backfill', () => this.backfillAccessExpiresAt(conn));
            for (const table of exports.PAYER_EMAIL_TABLES) {
                await step(`${table}.payer_email`, () => this.ensureColumn(conn, table, 'payer_email', 'VARCHAR(255) NULL'));
            }
            await step('ai provider configs', () => this.ensureAiProviderConfigsTable(conn));
            await step('lesson generation jobs', () => this.ensureLessonGenerationJobsTable(conn));
            await step('iap tables', () => this.ensureIapTables(conn));
            await step('lessons.sort_order', async () => {
                const added = await this.ensureColumn(conn, 'lessons', 'sort_order', 'INT NOT NULL DEFAULT 0 AFTER subtopic_id');
                await this.ensureIndex(conn, 'lessons', 'idx_lessons_sort', 'topic_id, subtopic_id, sort_order');
                if (added)
                    await this.backfillLessonSortOrder(conn);
            });
            await step('topics.sort_order', async () => {
                const added = await this.ensureColumn(conn, 'topics', 'sort_order', 'INT NOT NULL DEFAULT 0 AFTER course_id');
                await this.ensureIndex(conn, 'topics', 'idx_topics_sort', 'course_id, sort_order');
                if (added)
                    await this.backfillSortOrder(conn, 'topics', 'topic_name', 'course_id');
            });
            await step('subtopics.sort_order', async () => {
                const added = await this.ensureColumn(conn, 'subtopics', 'sort_order', 'INT NOT NULL DEFAULT 0 AFTER topic_id');
                await this.ensureIndex(conn, 'subtopics', 'idx_subtopics_sort', 'topic_id, sort_order');
                if (added)
                    await this.backfillSortOrder(conn, 'subtopics', 'subtopic_name', 'topic_id');
            });
            await step('osce tables', () => this.ensureOsceTables(conn));
            await step('study_planner_tasks item link', async () => {
                await this.ensureColumn(conn, 'study_planner_tasks', 'item_type', 'VARCHAR(16) NULL');
                await this.ensureColumn(conn, 'study_planner_tasks', 'item_id', 'INT NULL');
                await this.ensureColumn(conn, 'study_planner_tasks', 'rule_json', 'TEXT NULL');
            });
            await step('users.needs_profile_setup', () => this.ensureColumn(conn, 'users', 'needs_profile_setup', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER avatar_key'));
            await step('structure counts and course order', async () => {
                const addedOrder = await this.ensureColumn(conn, 'courses', 'sort_order', 'INT NOT NULL DEFAULT 0 AFTER status');
                if (addedOrder) {
                    await conn.query('SET @course_order := 0');
                    await conn.query('UPDATE courses SET sort_order = (@course_order := @course_order + 10) ORDER BY course_title ASC, id ASC');
                }
                await this.ensureIndex(conn, 'courses', 'idx_courses_sort', 'sort_order, id');
                const addedCounts = [
                    await this.ensureColumn(conn, 'courses', 'lesson_count', 'INT NOT NULL DEFAULT 0'),
                    await this.ensureColumn(conn, 'courses', 'subject_count', 'INT NOT NULL DEFAULT 0'),
                    await this.ensureColumn(conn, 'topics', 'lesson_count', 'INT NOT NULL DEFAULT 0'),
                    await this.ensureColumn(conn, 'topics', 'subtopic_count', 'INT NOT NULL DEFAULT 0'),
                ].some(Boolean);
                await this.ensureIndex(conn, 'lessons', 'idx_lessons_topic_engine_pub_sort', 'topic_id, engine_key, is_public, sort_order, id');
                if (addedCounts)
                    await (0, structure_counts_1.recountStructure)(conn);
            });
            await step('structure gap ranks', async () => {
                await (0, structure_order_1.convertToGapRanks)(conn, (msg) => this.logger.log(msg));
            });
            await step('assessment folder counts', async () => {
                const added = [
                    await this.ensureColumn(conn, 'topics', 'quiz_total', 'INT NOT NULL DEFAULT 0'),
                    await this.ensureColumn(conn, 'topics', 'quiz_active', 'INT NOT NULL DEFAULT 0'),
                    await this.ensureColumn(conn, 'courses', 'quiz_general_total', 'INT NOT NULL DEFAULT 0'),
                    await this.ensureColumn(conn, 'courses', 'quiz_general_active', 'INT NOT NULL DEFAULT 0'),
                    await this.ensureColumn(conn, 'courses', 'quiz_unfiled_total', 'INT NOT NULL DEFAULT 0'),
                    await this.ensureColumn(conn, 'courses', 'quiz_unfiled_active', 'INT NOT NULL DEFAULT 0'),
                ].some(Boolean);
                await this.ensureIndex(conn, 'quizzes', 'idx_quizzes_topic_general', 'topic_id, is_general, id, status');
                await this.ensureIndex(conn, 'quizzes', 'idx_quizzes_course_general', 'course_id, is_general, id, status');
                if (added)
                    await (0, quiz_counts_1.recountQuizCounts)(conn);
            });
            await step('question link counts', async () => {
                const added = await this.ensureColumn(conn, 'questions', 'quiz_count', 'INT NOT NULL DEFAULT 0');
                if (added)
                    await (0, quiz_counts_1.recountQuestionLinks)(conn);
            });
            await step('dashboard totals', async () => {
                const addedQuestions = await this.ensureColumn(conn, 'courses', 'question_total', 'INT NOT NULL DEFAULT 0');
                const addedQuizzes = await this.ensureColumn(conn, 'courses', 'quiz_total', 'INT NOT NULL DEFAULT 0');
                if (addedQuestions)
                    await (0, quiz_counts_1.recountCourseQuestionTotals)(conn);
                if (addedQuizzes)
                    await (0, quiz_counts_1.recountCourseQuizTotals)(conn);
                await this.ensureIndex(conn, 'users', 'idx_users_role_status_live', 'role, status, deleted_at');
                await this.ensureIndex(conn, 'users', 'idx_users_created', 'created_at, id');
                await this.ensureIndex(conn, 'user_subscriptions', 'idx_user_subscriptions_status_end', 'status, end_date');
                await this.ensureColumn(conn, 'user_subscriptions', 'is_collected', "TINYINT GENERATED ALWAYS AS (IF(payment_status IN ('paid', 'manual') AND amount_paid > 0, 1, 0)) VIRTUAL");
                await this.ensureIndex(conn, 'user_subscriptions', 'idx_user_subscriptions_collected', 'is_collected, created_at, id');
                await this.ensureIndex(conn, 'user_subscriptions', 'idx_user_subscriptions_collected_day', 'is_collected, payment_date, updated_at');
                await this.ensureColumn(conn, 'subscription_requests', 'admin_visible', "TINYINT GENERATED ALWAYS AS (IF(invoice_id IS NULL OR payment_proof_data_url IS NOT NULL OR status = 'approved' OR subscription_id IS NOT NULL, 1, 0)) VIRTUAL");
                await this.ensureIndex(conn, 'subscription_requests', 'idx_subscription_requests_visible', 'admin_visible, status, requested_at, id');
            });
            await step('admin search indexes', async () => {
                await this.ensureFulltextIndex(conn, 'lessons', 'ft_lessons_title', 'lesson_title');
                await this.ensureFulltextIndex(conn, 'quizzes', 'ft_quizzes_title', 'quiz_title');
                await this.ensureFulltextIndex(conn, 'users', 'ft_users_name_email', 'full_name, email');
            });
            await step('subscriptions page indexes', async () => {
                await this.ensureIndex(conn, 'user_subscriptions', 'idx_user_subscriptions_payment_status', 'payment_status, id');
                await this.ensureIndex(conn, 'plans', 'idx_plans_apple_product', 'apple_product_id');
            });
            await step('users page index', async () => {
                await this.ensureIndex(conn, 'users', 'idx_users_status_live', 'status, deleted_at');
            });
            await step('drugs list index', async () => {
                await this.ensureIndex(conn, 'drugs', 'idx_drugs_name_id', 'name, id');
            });
            await step('one row per student', async () => {
                await this.ensureStudyStatsTables(conn);
                await this.ensureColumn(conn, 'student_study_summary', 'practice_seq', 'INT UNSIGNED NOT NULL DEFAULT 0');
                for (const column of ['streak_grace', 'streak_for_day', 'streak_today_active', 'area_trimmed_through', 'quiz_progress_built',
                    'lessons_today', 'lessons_day', 'exams_today', 'exam_pct_today', 'exams_day', 'days14']) {
                    const [cols] = await conn.execute(`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_study_summary' AND COLUMN_NAME = ?`, [column]);
                    if (cols.length)
                        await conn.query(`ALTER TABLE student_study_summary DROP COLUMN ${column}`);
                }
            });
            await step('users university country and name', async () => {
                const [old] = await conn.execute(`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'country'`);
                if (old.length)
                    await conn.query('ALTER TABLE users CHANGE COLUMN country university_country VARCHAR(64) NULL');
                await this.ensureColumn(conn, 'users', 'university_country', 'VARCHAR(64) NULL');
                await this.ensureColumn(conn, 'users', 'university', 'VARCHAR(160) NULL');
            });
            await step('drop flashcard reviews table', async () => {
                await conn.query('DROP TABLE IF EXISTS lesson_flashcard_reviews');
            });
            await step('questions hold options and recap', async () => {
                await this.ensureColumn(conn, 'questions', 'options_json', 'LONGTEXT NULL');
                await this.ensureColumn(conn, 'questions', 'recap_json', 'LONGTEXT NULL');
                const exists = async (table) => {
                    const [t] = await conn.execute('SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [table]);
                    return t.length > 0;
                };
                const hasOptions = await exists('question_options');
                const hasRecaps = await exists('question_theory_recaps');
                if (!hasOptions && !hasRecaps)
                    return;
                const recapCols = 'id, question_id, ' + question_content_1.RECAP_KEYS.join(', ') + ', created_at, updated_at';
                const [idRows] = await conn.query('SELECT id FROM questions ORDER BY id');
                const ids = idRows.map((r) => Number(r.id));
                const oldOptions = new Map();
                const oldRecaps = new Map();
                for (let i = 0; i < ids.length; i += 500) {
                    const part = ids.slice(i, i + 500);
                    const marks = part.map(() => '?').join(',');
                    if (hasOptions) {
                        const [o] = await conn.query(`SELECT id, question_id, option_label, option_text, is_correct, why_incorrect FROM question_options
                WHERE question_id IN (${marks}) ORDER BY question_id, option_label, id`, part);
                        for (const row of o) {
                            const list = oldOptions.get(Number(row.question_id)) || [];
                            list.push(row);
                            oldOptions.set(Number(row.question_id), list);
                        }
                    }
                    if (hasRecaps) {
                        const [r] = await conn.query(`SELECT ${recapCols} FROM question_theory_recaps WHERE question_id IN (${marks}) ORDER BY id`, part);
                        for (const row of r)
                            oldRecaps.set(Number(row.question_id), row);
                    }
                    for (const id of part) {
                        const opts = (oldOptions.get(id) || []).map((o) => ({
                            id: Number(o.id), option_label: String(o.option_label), option_text: o.option_text == null ? '' : String(o.option_text),
                            is_correct: Number(o.is_correct) === 1 ? 1 : 0, why_incorrect: o.why_incorrect == null ? null : String(o.why_incorrect),
                        }));
                        const rec = oldRecaps.get(id);
                        const recap = rec ? Object.fromEntries(['id', ...question_content_1.RECAP_KEYS, 'created_at', 'updated_at'].map((k) => [k, rec[k] instanceof Date ? rec[k].toISOString() : (rec[k] ?? null)])) : null;
                        await conn.execute('UPDATE questions SET options_json = ?, recap_json = ? WHERE id = ?', [JSON.stringify(opts), recap ? JSON.stringify(recap) : null, id]);
                    }
                }
                const [stored] = await conn.query('SELECT id, options_json, recap_json FROM questions');
                let mismatches = 0;
                for (const row of stored) {
                    const id = Number(row.id);
                    const now = (0, question_content_1.optionsOf)(id, row.options_json);
                    const before = oldOptions.get(id) || [];
                    if (now.length !== before.length) {
                        mismatches++;
                        continue;
                    }
                    for (let k = 0; k < now.length; k++) {
                        const b = before[k];
                        if (now[k].id !== Number(b.id) || now[k].option_label !== String(b.option_label)
                            || now[k].option_text !== (b.option_text == null ? '' : String(b.option_text))
                            || now[k].is_correct !== (Number(b.is_correct) === 1 ? 1 : 0)
                            || now[k].why_incorrect !== (b.why_incorrect == null ? null : String(b.why_incorrect))) {
                            mismatches++;
                            break;
                        }
                    }
                    const rNow = (0, question_content_1.recapOf)(id, row.recap_json);
                    const rBefore = oldRecaps.get(id);
                    if (!!rNow !== !!rBefore) {
                        mismatches++;
                        continue;
                    }
                    if (rNow && rBefore) {
                        for (const k of ['id', ...question_content_1.RECAP_KEYS]) {
                            const a1 = rNow[k];
                            const b1 = rBefore[k];
                            if (String(a1 ?? '') !== String(b1 ?? '')) {
                                mismatches++;
                                break;
                            }
                        }
                    }
                }
                const oldOptionTotal = [...oldOptions.values()].reduce((n, l) => n + l.length, 0);
                if (mismatches > 0) {
                    throw new Error(`question content move: ${mismatches} question(s) differ — old tables kept, nothing dropped`);
                }
                this.logger.log(`Question content moved and verified: ${stored.length} questions, ${oldOptionTotal} options, ${oldRecaps.size} recaps.`);
                const [fks] = await conn.execute(`SELECT DISTINCT TABLE_NAME AS t, CONSTRAINT_NAME AS c FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IN ('question_options', 'question_theory_recaps')
              AND TABLE_NAME NOT IN ('question_options', 'question_theory_recaps')`);
                for (const fk of fks) {
                    await conn.query(`ALTER TABLE \`${fk.t}\` DROP FOREIGN KEY \`${fk.c}\``);
                }
                await conn.query('DROP TABLE IF EXISTS question_options');
                await conn.query('DROP TABLE IF EXISTS question_theory_recaps');
            });
            await step('drop lessons.lesson_content', async () => {
                const [cols] = await conn.execute(`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lessons' AND COLUMN_NAME = 'lesson_content'`);
                if (cols.length)
                    await conn.query('ALTER TABLE lessons DROP COLUMN lesson_content');
            });
            await step('drop unused tables', async () => {
                for (const table of ['announcement_reads', 'notification_dismissals', 'question_review_items',
                    'lesson_doubts', 'practice_answers', 'practice_sessions',
                    'content_audit_events', 'admin_audit_events',
                    'content_versions', 'content_workflow_states',
                    'announcements',
                    'smart_notes', 'account_deletion_audit',
                    'lesson_annotations', 'push_subscriptions', 'question_keyword_map']) {
                    await conn.query(`DROP TABLE IF EXISTS \`${table}\``);
                }
            });
            await step('drop today bits', async () => {
                for (const column of ['today_bits', 'today_day']) {
                    const [cols] = await conn.execute(`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_study_summary' AND COLUMN_NAME = ?`, [column]);
                    if (cols.length)
                        await conn.query(`ALTER TABLE student_study_summary DROP COLUMN ${column}`);
                }
            });
            await step('drop exam totals', async () => {
                for (const column of ['attempts_total', 'passed_total', 'percentage_sum']) {
                    const [cols] = await conn.execute(`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_study_summary' AND COLUMN_NAME = ?`, [column]);
                    if (cols.length)
                        await conn.query(`ALTER TABLE student_study_summary DROP COLUMN ${column}`);
                }
            });
            await step('question_quizzes quiz order index', () => this.ensureIndex(conn, 'question_quizzes', 'idx_question_quizzes_quiz_sort_question', 'quiz_id, sort_order, question_id'));
            await step('subscriptions by user, status and end date', async () => {
                await this.ensureIndex(conn, 'user_subscriptions', 'idx_user_subscriptions_user_status_end', 'user_id, status, end_date');
            });
            await step('quiz content stamp', async () => {
                await this.ensureColumn(conn, 'quizzes', 'content_stamp', 'INT UNSIGNED NOT NULL DEFAULT 1');
            });
            await step('flashcard history flag in the summary row', async () => {
                await this.ensureStudyStatsTables(conn);
                const added = await this.ensureColumn(conn, 'student_study_summary', 'flash_history', 'TINYINT(1) NOT NULL DEFAULT 0');
                void added;
            });
            await step('planner one row', async () => {
                await this.ensureStudyPlannerTasksTable(conn);
                await this.ensureColumn(conn, 'study_planner_tasks', 'item_type', 'VARCHAR(16) NULL');
                await this.ensureColumn(conn, 'study_planner_tasks', 'item_id', 'INT NULL');
                await this.ensureColumn(conn, 'study_planner_tasks', 'rule_json', 'TEXT NULL');
                const [cols] = await conn.execute(`SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'study_planner_tasks' AND COLUMN_NAME IN ('category', 'rule_json')`);
                const type = (name) => String(cols.find((c) => c.COLUMN_NAME === name)?.COLUMN_TYPE || '').toLowerCase();
                if (!type('category').includes("'plan'")) {
                    await conn.execute("ALTER TABLE study_planner_tasks MODIFY category ENUM('general','lesson','quiz','exam','review','flashcards','plan') NOT NULL DEFAULT 'general'");
                }
                if (type('rule_json') !== 'mediumtext') {
                    await conn.execute('ALTER TABLE study_planner_tasks MODIFY rule_json MEDIUMTEXT NULL');
                }
                const addedOwner = await this.ensureColumn(conn, 'study_planner_tasks', 'plan_owner', "INT GENERATED ALWAYS AS (IF(category = 'plan', user_id, NULL)) PERSISTENT");
                const [idx] = await conn.execute(`SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'study_planner_tasks' AND INDEX_NAME = 'uniq_planner_plan_owner' LIMIT 1`);
                if (!idx.length)
                    await conn.execute('ALTER TABLE study_planner_tasks ADD UNIQUE KEY uniq_planner_plan_owner (plan_owner)');
                if (addedOwner)
                    await (0, planner_doc_1.foldPlannerRows)(conn);
            });
            await step('planner old rows and old exam sessions', async () => {
                await conn.query(`DELETE t FROM study_planner_tasks t
             JOIN study_planner_tasks p ON p.user_id = t.user_id AND p.category = 'plan'
            WHERE t.category <> 'plan'`);
            });
            await step('drop old exam, bookmark and migration tables', async () => {
                const OLD = ['student_answers', 'exam_sessions', 'quiz_attempts', 'study_bookmarks', 'schema_migrations'];
                const marks = OLD.map(() => '?').join(', ');
                const [fks] = await conn.execute(`SELECT DISTINCT TABLE_NAME AS t, CONSTRAINT_NAME AS c FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IN (${marks}) AND TABLE_NAME NOT IN (${marks})`, [...OLD, ...OLD]);
                for (const fk of fks)
                    await conn.query(`ALTER TABLE \`${fk.t}\` DROP FOREIGN KEY \`${fk.c}\``);
                for (const table of OLD)
                    await conn.query(`DROP TABLE IF EXISTS \`${table}\``);
            });
            await step('questions missing-content flags', async () => {
                const [cols] = await conn.execute(`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'questions' AND COLUMN_NAME = 'missing_mask'`);
                if (!cols.length) {
                    await conn.query(`ALTER TABLE questions ADD COLUMN missing_mask TINYINT UNSIGNED AS (${(0, question_content_1.sqlMissingMaskExpression)()}) STORED`);
                }
                await this.ensureIndex(conn, 'questions', 'idx_questions_missing_mask', 'missing_mask, id');
            });
            await step('drop unused set columns and question keywords', async () => {
                const [idx] = await conn.execute(`SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quizzes' AND INDEX_NAME = 'ft_quizzes_titles' LIMIT 1`);
                if (idx.length)
                    await conn.query('ALTER TABLE quizzes DROP INDEX ft_quizzes_titles');
                const DROP = ['lesson_id', 'paper_id', 'collection_tags', 'subtopic', 'quiz_description', 'blueprint_json',
                    'randomization_mode', 'quiz_mode', 'display_title_mode', 'exam_mode_only', 'hide_time_limit',
                    'hide_passing_marks', 'show_theory_recap_in_exam', 'admin_name', 'student_title'];
                const [cols] = await conn.execute(`SELECT COLUMN_NAME AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quizzes' AND COLUMN_NAME IN (${DROP.map(() => '?').join(', ')})`, DROP);
                if (cols.length)
                    await conn.query(`ALTER TABLE quizzes ${cols.map((r) => `DROP COLUMN \`${r.c}\``).join(', ')}`);
                await this.ensureFulltextIndex(conn, 'quizzes', 'ft_quizzes_title', 'quiz_title');
                const [kw] = await conn.execute(`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'questions' AND COLUMN_NAME = 'keywords_text' LIMIT 1`);
                if (kw.length)
                    await conn.query('ALTER TABLE questions DROP COLUMN keywords_text');
                await conn.query('DROP TABLE IF EXISTS question_keywords');
            });
            await step('drop dynamic quiz randomization plan feature', async () => {
                await conn.query(`DELETE spf FROM subscription_plan_features spf
             JOIN subscription_features sf ON sf.id = spf.feature_id
            WHERE sf.feature_key = 'dynamic_quiz_randomization'`);
                await conn.query(`DELETE FROM subscription_features WHERE feature_key = 'dynamic_quiz_randomization'`);
            });
            await step('admin counters table', async () => {
                await conn.query(`CREATE TABLE IF NOT EXISTS admin_counters (
             name VARCHAR(80) NOT NULL PRIMARY KEY,
             value BIGINT NOT NULL DEFAULT 0
           ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
                const [[has]] = await conn.query('SELECT COUNT(*) AS n FROM admin_counters');
                if (!Number(has?.n))
                    await (0, admin_counters_1.rebuildAdminCountersOn)(conn);
            });
            await step('summary last-active index', async () => {
                await this.ensureIndex(conn, 'student_study_summary', 'idx_summary_last_active', 'last_active_day');
            });
            await step('ecg topic card count', async () => {
                const [cols] = await conn.execute(`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ecg_topics' AND COLUMN_NAME = 'card_count'`);
                if (!cols.length) {
                    await conn.query('ALTER TABLE ecg_topics ADD COLUMN card_count INT UNSIGNED NOT NULL DEFAULT 0');
                    await conn.query('UPDATE ecg_topics t SET t.card_count = (SELECT COUNT(*) FROM ecg_cards c WHERE c.topic_id = t.id)');
                }
            });
            if (failed === 0) {
                await step('record critical_schema_version', () => conn.execute(`INSERT INTO system_settings (setting_key, setting_value) VALUES ('critical_schema_version', ?)
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`, [exports.CRITICAL_SCHEMA_VERSION]));
            }
        }
        finally {
            connection.release();
        }
    }
    async ensureOsceTables(connection) {
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS osce_categories (
        id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        course_id   INT NOT NULL,
        name        VARCHAR(160) NOT NULL,
        sort_order  INT NOT NULL DEFAULT 0,
        is_active   TINYINT(1) NOT NULL DEFAULT 1,
        created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_osce_categories_course (course_id, sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS osce_cases (
        id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        course_id   INT NOT NULL,
        topic_id    INT NOT NULL,
        title       VARCHAR(200) NOT NULL,
        slug        VARCHAR(200) NOT NULL,
        summary     TEXT NULL,
        difficulty  ENUM('core','intermediate','advanced') NOT NULL DEFAULT 'core',
        case_data   LONGTEXT NULL,
        status      ENUM('draft','published') NOT NULL DEFAULT 'draft',
        is_public   TINYINT(1) NOT NULL DEFAULT 1,
        is_free     TINYINT(1) NOT NULL DEFAULT 0,
        sort_order  INT NOT NULL DEFAULT 0,
        created_by  INT NULL,
        created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_osce_case_slug (slug),
        INDEX idx_osce_cases_topic (topic_id, sort_order),
        INDEX idx_osce_cases_course (course_id),
        INDEX idx_osce_cases_status (status, is_public)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        await this.ensureColumn(connection, 'osce_cases', 'course_id', 'INT NOT NULL DEFAULT 0 AFTER id');
        await this.ensureColumn(connection, 'osce_cases', 'topic_id', 'INT NOT NULL DEFAULT 0 AFTER course_id');
        await this.ensureColumn(connection, 'osce_cases', 'is_free', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER is_public');
        await this.ensureColumn(connection, 'osce_cases', 'category_id', 'INT UNSIGNED NULL AFTER topic_id');
        await this.ensureColumn(connection, 'osce_cases', 'station_type', "ENUM('short','long') NOT NULL DEFAULT 'short' AFTER difficulty");
        const [staleCols] = await connection.execute(`SELECT COLUMN_NAME FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'osce_cases' AND COLUMN_NAME = 'system_id'`);
        if (staleCols.length) {
            await connection.execute('ALTER TABLE osce_cases DROP COLUMN system_id').catch(() => undefined);
        }
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS osce_media (
        id           INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        case_id      INT UNSIGNED NOT NULL,
        slot_key     VARCHAR(120) NOT NULL,
        storage_key  VARCHAR(255) NOT NULL,
        thumb_key    VARCHAR(255) NULL,
        mime         VARCHAR(80) NOT NULL DEFAULT 'image/webp',
        source       ENUM('upload','ai') NOT NULL DEFAULT 'upload',
        bytes        INT UNSIGNED NOT NULL DEFAULT 0,
        width        INT UNSIGNED NULL,
        height       INT UNSIGNED NULL,
        created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_osce_media_slot (case_id, slot_key),
        INDEX idx_osce_media_case (case_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        await this.ensureColumn(connection, 'osce_media', 'source', "ENUM('upload','ai') NOT NULL DEFAULT 'upload' AFTER mime");
        await this.ensureColumn(connection, 'osce_media', 'external_url', 'VARCHAR(500) NULL AFTER storage_key');
        await connection.query("ALTER TABLE osce_media MODIFY COLUMN storage_key VARCHAR(255) NOT NULL DEFAULT ''").catch(() => undefined);
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS osce_progress (
        id             INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id        INT NOT NULL,
        case_id        INT UNSIGNED NOT NULL,
        checklist_json JSON NULL,
        seen_json      JSON NULL,
        is_favourite   TINYINT(1) NOT NULL DEFAULT 0,
        completed_at   DATETIME NULL,
        updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_osce_progress (user_id, case_id),
        INDEX idx_osce_progress_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        await this.ensureColumn(connection, 'osce_progress', 'is_favourite', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER seen_json');
        await connection.execute('DROP TABLE IF EXISTS osce_systems').catch(() => undefined);
    }
    async ensureSystemSettingsTable(connection) {
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS system_settings (
        setting_key VARCHAR(120) NOT NULL PRIMARY KEY,
        setting_value TEXT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    }
    async ensureEcgTables(connection) {
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS ecg_topics (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        position INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ecg_topics_active (is_active),
        INDEX idx_ecg_topics_position (position)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        await this.ensureColumn(connection, 'ecg_topics', 'category', 'VARCHAR(80) NULL AFTER description');
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS ecg_cards (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        topic_id INT UNSIGNED NOT NULL,
        title VARCHAR(255) NOT NULL,
        image_url LONGTEXT NULL,
        explanation TEXT NULL,
        position INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ecg_cards_topic (topic_id),
        INDEX idx_ecg_cards_active (is_active),
        INDEX idx_ecg_cards_position (position)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        await this.ensureColumn(connection, 'ecg_cards', 'annotations_json', 'LONGTEXT NULL AFTER explanation');
        await this.ensureColumn(connection, 'ecg_cards', 'source_credit', 'VARCHAR(255) NULL AFTER annotations_json');
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS ecg_quiz_questions (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        question_text VARCHAR(500) NOT NULL DEFAULT 'What does this ECG show?',
        image_url LONGTEXT NULL,
        options_json JSON NULL,
        explanation TEXT NULL,
        position INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ecg_quiz_active (is_active),
        INDEX idx_ecg_quiz_position (position)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    }
    async ensureAuscultationTables(connection) {
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS auscultation_topics (
        id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        category    ENUM('heart','lung') NOT NULL DEFAULT 'heart',
        title       VARCHAR(255) NOT NULL,
        description TEXT NULL,
        position    INT NOT NULL DEFAULT 0,
        is_active   TINYINT(1) NOT NULL DEFAULT 1,
        created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ausc_topics_cat (category),
        INDEX idx_ausc_topics_active (is_active),
        INDEX idx_ausc_topics_position (position)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS auscultation_cards (
        id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        topic_id    INT UNSIGNED NOT NULL,
        title       VARCHAR(255) NOT NULL,
        audio_file  VARCHAR(255) NULL,
        audio_mime  VARCHAR(80) NULL,
        explanation TEXT NULL,
        position    INT NOT NULL DEFAULT 0,
        is_active   TINYINT(1) NOT NULL DEFAULT 1,
        created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ausc_cards_topic (topic_id),
        INDEX idx_ausc_cards_active (is_active),
        INDEX idx_ausc_cards_position (position)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS auscultation_quiz_questions (
        id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        category      ENUM('heart','lung') NOT NULL DEFAULT 'heart',
        question_text VARCHAR(500) NOT NULL DEFAULT 'What is this sound?',
        audio_file    VARCHAR(255) NULL,
        audio_mime    VARCHAR(80) NULL,
        source_card_id INT UNSIGNED NULL,
        options_json  JSON NULL,
        explanation   TEXT NULL,
        position      INT NOT NULL DEFAULT 0,
        is_active     TINYINT(1) NOT NULL DEFAULT 1,
        created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ausc_quiz_cat (category),
        INDEX idx_ausc_quiz_active (is_active),
        INDEX idx_ausc_quiz_position (position)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        await this.ensureColumn(connection, 'auscultation_quiz_questions', 'source_card_id', 'INT UNSIGNED NULL AFTER audio_mime');
    }
    async ensureAiProviderConfigsTable(connection) {
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS ai_provider_configs (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        provider_key VARCHAR(32) NOT NULL,
        provider_label VARCHAR(120) NOT NULL,
        api_key_encrypted TEXT NULL,
        api_code_encrypted TEXT NULL,
        base_url VARCHAR(255) NULL,
        model VARCHAR(160) NULL,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        is_active TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ai_provider_configs_provider_key (provider_key),
        INDEX idx_ai_provider_configs_status (status),
        INDEX idx_ai_provider_configs_is_active (is_active)
      )
    `);
    }
    async ensureLessonFlashcardsTable(connection) {
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS lesson_flashcards (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        note_id INT NOT NULL,
        lesson_id INT NULL,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        source_hint TEXT NULL,
        image_url LONGTEXT NULL,
        image_fit ENUM('contain','cover') NOT NULL DEFAULT 'contain',
        status ENUM('draft','approved','rejected') NOT NULL DEFAULT 'draft',
        sort_order INT NOT NULL DEFAULT 0,
        generated_by ENUM('ai','manual') NOT NULL DEFAULT 'ai',
        reviewed_by INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_lesson_flashcards_note_status (note_id, status),
        INDEX idx_lesson_flashcards_lesson_status (lesson_id, status)
      )
    `);
    }
    async ensureSubscriptionFeaturesTables(connection) {
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS subscription_features (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        feature_name VARCHAR(191) NOT NULL,
        feature_key VARCHAR(191) NOT NULL,
        description TEXT NULL,
        category VARCHAR(120) NOT NULL,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_subscription_features_feature_key (feature_key)
      )
    `);
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS subscription_plan_features (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        plan_id INT NOT NULL,
        feature_id INT NOT NULL,
        is_enabled TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_subscription_plan_feature (plan_id, feature_id),
        INDEX idx_subscription_plan_features_plan_id (plan_id)
      )
    `);
    }
    async ensureSubscriptionRequestTables(connection) {
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS subscription_requests (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        plan_id INT NOT NULL,
        invoice_id VARCHAR(20) NULL,
        status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
        message TEXT NULL,
        payment_method VARCHAR(80) NULL,
        payment_reference VARCHAR(191) NULL,
        payment_amount DECIMAL(10, 2) NULL,
        payment_currency VARCHAR(10) NULL,
        coupon_code VARCHAR(40) NULL,
        discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        payment_proof_name VARCHAR(255) NULL,
        payment_proof_mime VARCHAR(80) NULL,
        payment_proof_data_url LONGTEXT NULL,
        access_scope ENUM('all','courses','lessons') NOT NULL DEFAULT 'all',
        course_ids_json TEXT NULL,
        lesson_ids_json TEXT NULL,
        admin_note TEXT NULL,
        requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP NULL DEFAULT NULL,
        resolved_by INT NULL,
        subscription_id INT NULL,
        INDEX idx_subscription_requests_plan (plan_id)
      )
    `);
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS subscription_audit_events (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        subscription_id INT NULL,
        request_id INT NULL,
        user_id INT NULL,
        actor_id INT NULL,
        event_type VARCHAR(80) NOT NULL,
        summary VARCHAR(255) NOT NULL,
        details_json JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_subscription_audit_user (user_id),
        INDEX idx_subscription_audit_actor (actor_id),
        INDEX idx_subscription_audit_created (created_at)
      )
    `);
    }
    async ensureStudyStatsTables(connection) {
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS student_study_summary (
        user_id INT NOT NULL PRIMARY KEY,
        streak INT NOT NULL DEFAULT 0,
        last_active_day DATE NULL,
        streak_forgiven_day DATE NULL,
        streak_after_forgiven INT NOT NULL DEFAULT 0,
        xp_total INT NOT NULL DEFAULT 0,
        xp_today INT NOT NULL DEFAULT 0,
        xp_day DATE NULL,
        streak_xp_day DATE NULL,
        streak7_paid TINYINT NOT NULL DEFAULT 0,
        streak30_paid TINYINT NOT NULL DEFAULT 0,
        lessons_done BLOB NULL,
        progress_version INT NOT NULL DEFAULT 0,
        quiz_marks BLOB NULL,
        recent_results MEDIUMTEXT NULL,
        exam_nonce VARCHAR(32) NULL,
        exam_quiz_id INT NULL,
        practice_seq INT UNSIGNED NOT NULL DEFAULT 0,
        flash_history TINYINT(1) NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    }
    async backfillAccessExpiresAt(connection) {
        try {
            await connection.execute(`UPDATE user_subscriptions us
         JOIN (
           SELECT original_transaction_id, MAX(expires_date) AS expires_date
           FROM iap_transactions
           WHERE platform = 'apple' AND expires_date IS NOT NULL
           GROUP BY original_transaction_id
         ) t ON t.original_transaction_id = us.payment_reference
         SET us.access_expires_at = t.expires_date
         WHERE us.payment_method = 'apple_iap' AND us.access_expires_at IS NULL`);
        }
        catch (error) {
            this.logger.warn(`Skipped access_expires_at backfill: ${error.message}`);
        }
    }
    async backfillPlanSubscriptionColumns(connection) {
        const [planRows] = await connection.execute('SELECT id, name, price, regular_price, slug, sort_order FROM plans ORDER BY id ASC');
        for (const [index, row] of planRows.entries()) {
            const slug = String(row.slug || '').trim() || this.slugify(String(row.name || `plan-${row.id}`));
            const regularPrice = row.regular_price === null || row.regular_price === undefined
                ? Number(row.price || 0)
                : Number(row.regular_price || 0);
            const sortOrder = Number(row.sort_order || 0) > 0 ? Number(row.sort_order) : index + 1;
            await connection.execute('UPDATE plans SET slug = ?, regular_price = ?, sort_order = ? WHERE id = ?', [slug, regularPrice, sortOrder, Number(row.id)]);
        }
    }
    async seedSubscriptionFeatureCatalog(connection) {
        for (const feature of subscription_catalog_1.DEFAULT_SUBSCRIPTION_FEATURES) {
            await connection.execute(`
          INSERT INTO subscription_features (feature_name, feature_key, description, category, status)
          VALUES (?, ?, ?, ?, 'active')
          ON DUPLICATE KEY UPDATE
            feature_name = VALUES(feature_name),
            description = VALUES(description),
            category = VALUES(category)
        `, [feature.featureName, feature.featureKey, feature.description, feature.category]);
        }
    }
    async seedDefaultPlans(connection) {
        const [planCountRows] = await connection.execute('SELECT COUNT(*) AS total FROM plans');
        if (Number(planCountRows[0]?.total || 0) > 0) {
            return;
        }
        for (const plan of subscription_catalog_1.DEFAULT_PLAN_BLUEPRINTS) {
            const featureNames = subscription_catalog_1.DEFAULT_SUBSCRIPTION_FEATURES
                .filter((feature) => plan.featureKeys.includes(feature.featureKey))
                .map((feature) => feature.featureName);
            const [existingRows] = await connection.execute('SELECT id FROM plans WHERE slug = ? LIMIT 1', [plan.slug]);
            if (existingRows[0]) {
                await this.syncDefaultPlanFeatureMap(connection, Number(existingRows[0].id), [...plan.featureKeys]);
                continue;
            }
            const [result] = await connection.execute(`
          INSERT INTO plans (
            name, slug, description, price, regular_price, offer_price, offer_enabled, currency, billing_period,
            duration_days, features_json, status, sort_order, recommended
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'month', ?, ?, ?, ?, ?)
        `, [
                plan.name,
                plan.slug,
                plan.description,
                plan.regularPrice,
                plan.regularPrice,
                plan.offerPrice,
                plan.offerEnabled,
                plan.currency,
                plan.durationDays,
                JSON.stringify(featureNames),
                plan.status,
                plan.sortOrder,
                plan.recommended,
            ]);
            await this.syncDefaultPlanFeatureMap(connection, Number(result.insertId || 0), [...plan.featureKeys]);
        }
    }
    async syncDefaultPlanFeatureMap(connection, planId, featureKeys) {
        if (!planId) {
            return;
        }
        const [featureRows] = await connection.execute(`SELECT id, feature_key FROM subscription_features`);
        const selectedFeatureIds = featureRows
            .filter((feature) => featureKeys.includes(String(feature.feature_key)))
            .map((feature) => Number(feature.id))
            .filter((id) => id > 0);
        await connection.execute('DELETE FROM subscription_plan_features WHERE plan_id = ?', [planId]);
        for (const featureId of selectedFeatureIds) {
            await connection.execute('INSERT IGNORE INTO subscription_plan_features (plan_id, feature_id, is_enabled) VALUES (?, ?, 1)', [planId, featureId]);
        }
    }
    async backfillPlanFeatureMaps(connection) {
        const [featureRows] = await connection.execute('SELECT id, feature_name, feature_key, category FROM subscription_features');
        const featureIdByKey = new Map(featureRows.map((row) => [String(row.feature_key), Number(row.id)]));
        const featureIdByName = new Map(featureRows.map((row) => [String(row.feature_name).trim().toLowerCase(), Number(row.id)]));
        const [planRows] = await connection.execute('SELECT id, slug, name, features_json FROM plans ORDER BY sort_order ASC, id ASC');
        for (const planRow of planRows) {
            const planId = Number(planRow.id);
            const [mappingRows] = await connection.execute('SELECT id FROM subscription_plan_features WHERE plan_id = ? LIMIT 1', [planId]);
            if (mappingRows.length > 0) {
                continue;
            }
            const defaultBlueprint = subscription_catalog_1.DEFAULT_PLAN_BLUEPRINTS.find((plan) => plan.slug === String(planRow.slug || '').trim().toLowerCase());
            const legacyFeatures = this.parseFeatureArray(String(planRow.features_json || ''));
            const featureIds = new Set();
            if (defaultBlueprint) {
                for (const featureKey of defaultBlueprint.featureKeys) {
                    const featureId = featureIdByKey.get(featureKey);
                    if (featureId) {
                        featureIds.add(featureId);
                    }
                }
            }
            for (const featureName of legacyFeatures) {
                let featureId = featureIdByName.get(featureName.trim().toLowerCase());
                if (!featureId) {
                    const featureKey = this.slugify(featureName).replace(/-/g, '_');
                    await connection.execute(`
              INSERT INTO subscription_features (feature_name, feature_key, description, category, status)
              VALUES (?, ?, ?, 'Support / Extras', 'active')
              ON DUPLICATE KEY UPDATE feature_name = VALUES(feature_name)
            `, [featureName, featureKey, 'Imported from a legacy plan feature list.']);
                    const [newFeatureRows] = await connection.execute('SELECT id, feature_name FROM subscription_features WHERE feature_key = ? LIMIT 1', [featureKey]);
                    if (newFeatureRows[0]) {
                        featureId = Number(newFeatureRows[0].id);
                        featureIdByName.set(String(newFeatureRows[0].feature_name).trim().toLowerCase(), featureId);
                        featureIdByKey.set(featureKey, featureId);
                    }
                }
                if (featureId) {
                    featureIds.add(featureId);
                }
            }
            for (const featureId of featureIds) {
                await connection.execute('INSERT IGNORE INTO subscription_plan_features (plan_id, feature_id, is_enabled) VALUES (?, ?, 1)', [planId, featureId]);
            }
        }
    }
    parseFeatureArray(raw) {
        try {
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed)
                ? parsed.map((value) => String(value || '').trim()).filter(Boolean)
                : [];
        }
        catch {
            return [];
        }
    }
    slugify(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'item';
    }
    async ensureColumn(connection, tableName, columnName, definition) {
        const table = (0, sql_safety_1.sqlIdentifier)(tableName, undefined, 'schema table');
        const column = (0, sql_safety_1.sqlIdentifier)(columnName, undefined, 'schema column');
        const [rows] = await connection.execute(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
        LIMIT 1
      `, [tableName, columnName]);
        if (rows.length > 0) {
            return false;
        }
        await connection.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        this.logger.log(`Added ${tableName}.${columnName}`);
        return true;
    }
    async backfillLessonSortOrder(connection) {
        const [rows] = await connection.execute(`SELECT id, topic_id, subtopic_id FROM lessons ORDER BY topic_id ASC, subtopic_id ASC, lesson_title ASC, id ASC`);
        const counters = new Map();
        for (const row of rows) {
            const key = `${row.topic_id ?? 0}|${row.subtopic_id ?? 0}`;
            const next = (counters.get(key) ?? 0) + 10;
            counters.set(key, next);
            await connection.execute(`UPDATE lessons SET sort_order = ? WHERE id = ?`, [next, row.id]);
        }
        if (rows.length)
            this.logger.log(`Backfilled sort_order for ${rows.length} lesson(s)`);
    }
    async backfillSortOrder(connection, table, nameColumn, scopeColumn) {
        const tableIdent = (0, sql_safety_1.sqlIdentifier)(table, undefined, 'schema table');
        const nameIdent = (0, sql_safety_1.sqlIdentifier)(nameColumn, undefined, 'schema column');
        const scopeIdent = (0, sql_safety_1.sqlIdentifier)(scopeColumn, undefined, 'schema column');
        const [rows] = await connection.execute(`SELECT id, ${scopeIdent} AS scope_value FROM ${tableIdent} ORDER BY ${scopeIdent} ASC, ${nameIdent} ASC, id ASC`);
        const counters = new Map();
        for (const row of rows) {
            const key = String(row.scope_value ?? 0);
            const next = (counters.get(key) ?? 0) + 10;
            counters.set(key, next);
            await connection.execute(`UPDATE ${tableIdent} SET sort_order = ? WHERE id = ?`, [next, row.id]);
        }
        if (rows.length)
            this.logger.log(`Backfilled sort_order for ${rows.length} row(s) in ${table}`);
    }
    async ensureFreePlanPaymentStatus(connection) {
        const [rows] = await connection.execute(`
        SELECT COLUMN_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_subscriptions' AND COLUMN_NAME = 'payment_status'
        LIMIT 1
      `);
        const columnType = String(rows[0]?.COLUMN_TYPE || '');
        if (columnType.includes("'free_plan'") && !columnType.includes("'waived'")) {
            return;
        }
        await connection.execute("ALTER TABLE user_subscriptions MODIFY payment_status ENUM('manual','paid','unpaid','waived','free_plan') NOT NULL DEFAULT 'manual'");
        await connection.execute("UPDATE user_subscriptions SET payment_status = 'free_plan' WHERE payment_status = 'waived'");
        await connection.execute("ALTER TABLE user_subscriptions MODIFY payment_status ENUM('manual','paid','unpaid','free_plan') NOT NULL DEFAULT 'manual'");
        this.logger.log('Renamed user_subscriptions.payment_status waived to free_plan');
    }
    async ensureUnlimitedFreePlanDates(connection) {
        await connection.execute(`UPDATE user_subscriptions us
       INNER JOIN plans p ON p.id = us.plan_id
       SET us.end_date = '9999-12-31'
       WHERE us.payment_status = 'free_plan'
          OR (p.slug = 'free' AND p.price = 0)`);
    }
    async ensureIndex(connection, tableName, indexName, columnNames) {
        const table = (0, sql_safety_1.sqlIdentifier)(tableName, undefined, 'schema table');
        const index = (0, sql_safety_1.sqlIdentifier)(indexName, undefined, 'schema index');
        const columns = columnNames
            .split(',')
            .map((columnName) => (0, sql_safety_1.sqlIdentifier)(columnName.trim(), undefined, 'schema column'))
            .join(', ');
        const [rows] = await connection.execute(`
        SELECT INDEX_NAME
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?
        LIMIT 1
      `, [tableName, indexName]);
        if (rows.length > 0) {
            return;
        }
        await connection.execute(`ALTER TABLE ${table} ADD INDEX ${index} (${columns})`);
        this.logger.log(`Added index ${indexName} on ${tableName}.${columnNames}`);
    }
    async ensureFulltextIndex(connection, tableName, indexName, columnNames) {
        const table = (0, sql_safety_1.sqlIdentifier)(tableName, undefined, 'schema table');
        const index = (0, sql_safety_1.sqlIdentifier)(indexName, undefined, 'schema index');
        const columns = columnNames.split(',').map((c) => (0, sql_safety_1.sqlIdentifier)(c.trim(), undefined, 'schema column')).join(', ');
        const [rows] = await connection.execute(`SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`, [tableName, indexName]);
        if (rows.length > 0)
            return;
        await connection.execute(`ALTER TABLE ${table} ADD FULLTEXT ${index} (${columns})`);
        this.logger.log(`Added FULLTEXT index ${indexName} on ${tableName}.${columnNames}`);
    }
    async ensureUniqueIndex(connection, tableName, indexName, columnNames) {
        const table = (0, sql_safety_1.sqlIdentifier)(tableName, undefined, 'schema table');
        const index = (0, sql_safety_1.sqlIdentifier)(indexName, undefined, 'schema index');
        const columns = columnNames
            .split(',')
            .map((columnName) => (0, sql_safety_1.sqlIdentifier)(columnName.trim(), undefined, 'schema column'))
            .join(', ');
        const [rows] = await connection.execute(`
        SELECT INDEX_NAME
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?
        LIMIT 1
      `, [tableName, indexName]);
        if (rows.length > 0) {
            return;
        }
        try {
            await connection.execute(`ALTER TABLE ${table} ADD UNIQUE INDEX ${index} (${columns})`);
            this.logger.log(`Added unique index ${indexName} on ${tableName}.${columnNames}`);
        }
        catch (error) {
            this.logger.error(`Could not add unique index ${indexName} on ${tableName}.${columnNames} — resolve duplicates first`, error);
        }
    }
};
exports.SchemaSyncService = SchemaSyncService;
exports.SchemaSyncService = SchemaSyncService = SchemaSyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object])
], SchemaSyncService);
//# sourceMappingURL=schema-sync.service.js.map