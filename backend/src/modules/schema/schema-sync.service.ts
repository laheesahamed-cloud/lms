import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import * as bcrypt from 'bcryptjs';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { sqlIdentifier, sqlPlaceholders } from '../../database/sql-safety';
import { convertToGapRanks } from '../../common/utils/structure-order';
import { recountStructure } from '../../common/utils/structure-counts';
import { foldPlannerRows } from '../../common/utils/planner-doc';
import { lessonBits } from '../../common/utils/lesson-bits';
import { localDateKey, toDayNumber } from '../xp/streak';
import { streakStateFromDays } from '../xp/streak-sql';
import { recountCourseQuestionTotals, recountCourseQuizTotals, recountQuestionLinks, recountQuizCounts } from '../../common/utils/quiz-counts';
import { RECAP_KEYS, optionsOf, recapOf, sqlMissingMaskExpression } from '../../common/utils/question-content';
import { APPLE_IAP_PRODUCTS, DEFAULT_PLAN_BLUEPRINTS, DEFAULT_SUBSCRIPTION_FEATURES } from '../plans/subscription-catalog';
import { rebuildAdminCountersOn } from '../../common/utils/admin-counters';

/// Non-IAP payment records that keep the payer's email when an account is
/// deleted. Apple purchases (iap_transactions) are deliberately not here.
// ensureCriticalTables() runs once per value of this marker (kept in
// system_settings.critical_schema_version), not on every boot.
// CHANGE THIS VALUE whenever a step is added to or changed in
// ensureCriticalTables(), or the new step will never run on a database that
// already recorded the old value.
export const CRITICAL_SCHEMA_VERSION = '2026-11-20.1';

export const PAYER_EMAIL_TABLES = [
  'user_subscriptions',
  'subscription_requests',
  'payment_transactions',
  'subscription_audit_events',
] as const;

@Injectable()
export class SchemaSyncService implements OnModuleInit {
  private readonly logger = new Logger(SchemaSyncService.name);

  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Pool) {}

  // Whether to run the 200+ table/column/index setup checks on boot. These only
  // matter right after a schema change, but they run sequentially and add many
  // seconds to every cold start on shared hosting. Skip them unless explicitly
  // enabled (SCHEMA_SYNC=1) — run `npm run migrate`, or set SCHEMA_SYNC=1 for one
  // boot, after changing the schema. Defaults to running only outside production.
  private shouldRunSchemaSync(): boolean {
    const flag = String(process.env.SCHEMA_SYNC ?? '').trim().toLowerCase();
    if (flag === '1' || flag === 'true' || flag === 'yes') return true;
    if (flag === '0' || flag === 'false' || flag === 'no') return false;
    return process.env.NODE_ENV !== 'production';
  }

  async onModuleInit() {
    let connection: PoolConnection | null = null;

    // These small governance/audit tables are written to by core flows (lesson
    // create/update, staff access changes). A missing one throws mid-transaction
    // and surfaces as a 500 ("internal server error"). They must exist even when
    // the full schema sync is skipped for fast boot (SCHEMA_SYNC=0 on prod), so
    // ensure them unconditionally — CREATE TABLE IF NOT EXISTS is metadata-only
    // (near-zero cost) when they already exist.
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
      // Onboarding email OTP verification (students). DEFAULT 1 grandfathers every
      // existing/admin-created account as verified; register() inserts 0 explicitly
      // so only self-signup students are forced through the 6-digit check.
      await this.ensureColumn(connection, 'users', 'email_verified', 'TINYINT(1) NOT NULL DEFAULT 1 AFTER deleted_at');
      await this.ensureColumn(connection, 'users', 'email_otp_code', 'VARCHAR(128) NULL AFTER email_verified');
      await this.ensureColumn(connection, 'users', 'email_otp_expires_at', 'DATETIME NULL AFTER email_otp_code');
      await this.ensureColumn(connection, 'users', 'email_otp_attempts', 'INT NOT NULL DEFAULT 0 AFTER email_otp_expires_at');
      await this.ensureColumn(connection, 'users', 'email_otp_last_sent_at', 'DATETIME NULL AFTER email_otp_attempts');
      await this.ensureColumn(connection, 'users', 'permissions', 'TEXT NULL AFTER role');
      await this.ensureColumn(connection, 'study_planner_tasks', 'category', "ENUM('general','lesson','quiz','exam','review','flashcards') NOT NULL DEFAULT 'general' AFTER status");
      await this.ensureColumn(connection, 'study_planner_tasks', 'priority', "ENUM('low','medium','high') NOT NULL DEFAULT 'medium' AFTER category");
      await this.ensureColumn(connection, 'study_planner_tasks', 'estimated_minutes', 'INT NULL AFTER priority');
      await this.ensureColumn(connection, 'lessons', 'note_data',  'LONGTEXT NULL');
      await this.ensureColumn(connection, 'lessons', 'raw_text',   'LONGTEXT NULL');
      await this.ensureColumn(connection, 'lessons', 'engine_key', "VARCHAR(32) NOT NULL DEFAULT 'gemini'");
      await this.ensureColumn(connection, 'lessons', 'is_public',  'TINYINT NOT NULL DEFAULT 1');
      await this.ensureColumn(connection, 'lessons', 'pdf_url',    'VARCHAR(500) NULL');
      // lessons.sort_order is ensured unconditionally in ensureCriticalTables()
      // (runs before this, on every boot) since every lesson query depends on it.
      await this.ensureColumn(connection, 'lesson_flashcards', 'image_url', 'LONGTEXT NULL AFTER source_hint');
      await this.ensureColumn(connection, 'lesson_flashcards', 'image_fit', "ENUM('contain','cover') NOT NULL DEFAULT 'contain' AFTER image_url");
      await this.ensureColumn(connection, 'questions', 'subtopic_id', 'INT NULL AFTER topic_id');
      await this.ensureColumn(connection, 'questions', 'lesson_id', 'INT NULL AFTER subtopic_id');
      await this.ensureColumn(connection, 'questions', 'paper_id', 'INT NULL AFTER lesson_id');
      await this.ensureColumn(connection, 'questions', 'question_category', "VARCHAR(20) NULL AFTER category");
      await this.ensureColumn(connection, 'questions', 'explanation_image_url', 'LONGTEXT NULL AFTER explanation');
      // "How to approach this question" — a clue-by-clue reasoning walkthrough for
      // the STEM (distinct from `explanation`, which covers why each option is
      // right/wrong). `question_approach_highlights` is a JSON array of short
      // phrases copied verbatim from question_text, so the frontend can locate and
      // highlight them in the stem once the student reveals the answer.
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
      // 10.54: lesson_id, paper_id, collection_tags, admin_name, student_title, display_title_mode,
      // blueprint_json, randomization_mode (and other unused set columns) were dropped — not re-added.
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
      // Admin dashboard "added per day" charts (questions, lessons) and the
      // question-of-the-day correct-option check. See sql/2026-11-13_perf_indexes.sql.
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
    } catch (error) {
      const message = error instanceof Error ? error.stack || error.message : String(error);
      this.logger.error(`Schema sync skipped because the database is not ready: ${message}`);
    } finally {
      connection?.release();
    }
  }

  private async hashLegacyPlaintextPasswords(connection: PoolConnection) {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT id, password
       FROM users
       WHERE password IS NOT NULL
         AND password <> ''
         AND password NOT LIKE '$2a$%'
         AND password NOT LIKE '$2b$%'
         AND password NOT LIKE '$2y$%'`
    );

    for (const row of rows) {
      const hashedPassword = await bcrypt.hash(String(row.password), 10);
      await connection.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, Number(row.id)]);
    }

    if (rows.length > 0) {
      this.logger.warn(`Hashed ${rows.length} legacy plaintext user password(s).`);
    }
  }

  private async ensurePapersTable(connection: PoolConnection) {
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

  private async ensurePlansTable(connection: PoolConnection) {
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

  private async ensureUserSubscriptionsTable(connection: PoolConnection) {
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

  // Apple in-app purchase. `plans.apple_product_id` maps a StoreKit product to a
  // plan, and `iap_transactions` is the replay guard: UNIQUE(transaction_id)
  // makes redemption idempotent, and original_transaction_id is the stable
  // identity of one subscription across renewals, bound to the first user who
  // redeems it so one purchase cannot unlock several accounts.
  private async ensureIapTables(connection: PoolConnection) {
    // `plans` is created later in the full sync, so on a first-ever boot it may
    // not exist yet. Don't let that abort the rest of the critical-table pass —
    // the next boot picks it up.
    try {
      await this.ensureColumn(connection, 'plans', 'apple_product_id', 'VARCHAR(191) NULL AFTER billing_period');
      // NULL repeats are allowed in a MySQL UNIQUE index, so plans without an
      // Apple product are unaffected.
      await this.ensureUniqueIndex(connection, 'plans', 'uniq_plans_apple_product', 'apple_product_id');
    } catch (error) {
      this.logger.warn(`Deferred plans.apple_product_id until the plans table exists: ${(error as Error).message}`);
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

  // Points each StoreKit product at the plan that supplies its duration. Runs on
  // every boot (prod skips the full sync), and is idempotent: an existing
  // apple_product_id is never overwritten, so an admin's manual remap survives.
  private async ensureApplePlanMappings(connection: PoolConnection) {
    for (const product of APPLE_IAP_PRODUCTS) {
      try {
        const [rows] = await connection.execute<RowDataPacket[]>(
          'SELECT id, apple_product_id FROM plans WHERE slug = ? LIMIT 1',
          [product.slug]
        );

        const planId = rows[0] ? Number(rows[0].id) : 0;

        if (!planId) {
          // Deliberately does NOT create the plan. The old fallback inserted a
          // second, inactive plan and then hit the UNIQUE index on
          // apple_product_id, leaving junk rows and an error on every boot.
          // Mapping a product is an admin action now (the product-id field on
          // the plan), so a missing one is reported and left alone.
          this.logger.warn(
            `No plan with slug "${product.slug}" for Apple product ${product.productId} — ` +
              'purchases of it will be rejected at redemption until a plan carries that product id.'
          );
          continue;
        }

        if (String(rows[0].apple_product_id || '') === product.productId) continue;

        await connection.execute('UPDATE plans SET apple_product_id = ? WHERE id = ? AND apple_product_id IS NULL', [
          product.productId,
          planId,
        ]);
      } catch (error) {
        this.logger.error(`Could not map Apple product ${product.productId} to plan ${product.slug}`, error as Error);
      }
    }
  }

  private async ensureSubscriptionCouponsTable(connection: PoolConnection) {
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

  private async ensurePaymentTransactionsTable(connection: PoolConnection) {
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


  private async ensureQuestionReportsTable(connection: PoolConnection) {
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


  private async ensureLessonGenerationJobsTable(connection: PoolConnection) {
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
    // The table above was originally created without an explicit charset, so on
    // any environment where it already exists it inherited the DB's default
    // charset (utf8, 3-byte) instead of utf8mb4 — result_json can contain a
    // generated lesson's real content, including emoji like the "🚨 Red flags"
    // section heading, which needs 4-byte utf8mb4 or the INSERT throws
    // "Incorrect string value". CONVERT TO is a no-op (fast) if already utf8mb4.
    // Marks a job that finished with banked work rather than a clean run.
    await this.ensureColumn(connection, 'lesson_generation_jobs', 'partial', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER status');
    try {
      await connection.execute(`
        ALTER TABLE lesson_generation_jobs CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
      `);
    } catch {
      // best-effort — table may be mid-use or already correct; never block boot on this
    }
  }

  private async ensureNativePushTokensTable(connection: PoolConnection) {
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

  private async ensureStudyPlannerTasksTable(connection: PoolConnection) {
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

  private async ensureUserRoleColumnSupportsStaff(connection: PoolConnection) {
    try {
      await connection.execute("ALTER TABLE users MODIFY role VARCHAR(40) NOT NULL DEFAULT 'student'");
    } catch (error) {
      this.logger.warn(`Could not widen users.role for staff roles: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async ensureQuestionCategoryColumns(connection: PoolConnection) {
    try {
      await connection.execute("ALTER TABLE questions MODIFY category VARCHAR(20) NOT NULL DEFAULT 'mock'");
      await connection.execute("UPDATE questions SET category = 'past' WHERE category = 'past_paper'");
      await connection.execute("ALTER TABLE questions MODIFY question_category VARCHAR(20) NOT NULL DEFAULT 'mock'");
      await connection.execute("UPDATE questions SET question_category = 'past_paper' WHERE question_category = 'past'");
    } catch (error) {
      this.logger.warn(`Could not widen question category columns: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Runs on every boot regardless of the SCHEMA_SYNC flag. Keep this limited to
  // the few tables that core write paths depend on, so it stays cheap.
  /**
   * Tables and columns that core write paths depend on, ensured on every boot.
   *
   * Prod runs SCHEMA_SYNC=0, so the full sync is skipped and these would
   * otherwise never be created. Each step is guarded on its own: they are
   * unrelated migrations, and a single shared try meant one failure silently
   * skipped everything after it — which is exactly how the OSCE tables (last in
   * the list) ended up missing while the server booted looking healthy.
   */
  private async ensureCriticalTables() {
    let connection: PoolConnection | null = null;
    try {
      connection = await this.db.getConnection();
    } catch (error) {
      this.logger.error('Could not get a connection to ensure critical tables', error as Error);
      return;
    }

    const conn = connection;
    let failed = 0;
    const step = async (name: string, run: () => Promise<unknown>) => {
      try {
        await run();
      } catch (error) {
        failed += 1;
        // Named, so the log says which migration failed rather than just that
        // "something" did.
        this.logger.error(`Critical schema step failed: ${name}`, error as Error);
      }
    };

    // These steps used to run on EVERY boot: ~80 queries including ALTER TABLEs,
    // a DROP TABLE and a backfill UPDATE. The host restarts the app every few
    // minutes, so that was repeated heavy schema work at exactly the moments the
    // server was coldest. They now run once per CRITICAL_SCHEMA_VERSION, and
    // only a run with no failed step is recorded, so a failure retries next boot.
    try {
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS system_settings (
          setting_key VARCHAR(120) NOT NULL PRIMARY KEY,
          setting_value TEXT NULL,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      const [done] = await conn.execute<RowDataPacket[]>(
        `SELECT setting_value FROM system_settings WHERE setting_key = 'critical_schema_version' LIMIT 1`,
      );
      if (done[0] && String(done[0].setting_value) === CRITICAL_SCHEMA_VERSION) {
        connection.release();
        return;
      }
    } catch (error) {
      // Could not read the marker: fall through and run the steps as before.
      this.logger.warn(`Could not read critical_schema_version: ${(error as Error).message}`);
    }

    try {
      // Read on EVERY authenticated request (session serialization selects it), so a
      // missing column would break all auth — not just the Roles & Access feature.
      await step('users.permissions', () =>
        this.ensureColumn(conn, 'users', 'permissions', 'TEXT NULL AFTER role'));
      // READ BY EVERY ENTITLEMENT CHECK (11 sites across 8 services), so a
      // missing column does not degrade one feature — it 500s every gated
      // request in the app. It must therefore NOT depend on SCHEMA_SYNC, which
      // is 0 on production: the gated block below would never create it and
      // the whole app would fail on the first content request after deploy.
      // Same lesson as the content-governance tables above.
      // Written by the account-deletion path, which must work whether or not
      // schema sync runs — same reason as the columns below.
      await step('user_subscriptions.access_expires_at', () =>
        this.ensureColumn(conn, 'user_subscriptions', 'access_expires_at', 'DATETIME NULL AFTER end_date'));
      await step('access_expires_at backfill', () => this.backfillAccessExpiresAt(conn));
      // The payer's address, kept on payment records after the account is
      // deleted (the users row is anonymised). Written by the deletion path,
      // so it must exist whether or not the full sync runs.
      for (const table of PAYER_EMAIL_TABLES) {
        await step(`${table}.payer_email`, () =>
          this.ensureColumn(conn, table, 'payer_email', 'VARCHAR(255) NULL'));
      }
      // Read directly (no try/catch) by resolveActiveCanvasProvider() on every
      // "Generate Lesson" call — missing on prod would throw a raw, unhandled 500.
      await step('ai provider configs', () => this.ensureAiProviderConfigsTable(conn));
      // Generation-progress job tracking is a write path hit on every "Generate
      // Lesson" click — must not depend on the full sync being enabled either.
      await step('lesson generation jobs', () => this.ensureLessonGenerationJobsTable(conn));
      // IAP redemption is a write path that runs on prod, where the full sync is
      // skipped (SCHEMA_SYNC=0) — so these must not depend on it.
      await step('iap tables', () => this.ensureIapTables(conn));
      // Every lesson list query (admin + student + course detail) ORDER BYs this
      // column — missing on prod would 500 every one of them.
      await step('lessons.sort_order', async () => {
        const added = await this.ensureColumn(conn, 'lessons', 'sort_order', 'INT NOT NULL DEFAULT 0 AFTER subtopic_id');
        await this.ensureIndex(conn, 'lessons', 'idx_lessons_sort', 'topic_id, subtopic_id, sort_order');
        if (added) await this.backfillLessonSortOrder(conn);
        // (The old one-time "flatten lesson order across the course" step is
        // gone: lessons are now ranked inside their topic — see the
        // 'structure gap ranks' step below.)
      });
      // Same as above, one level up the hierarchy — subjects (topics) within a
      // course, and topics (subtopics) within a subject, also need an
      // admin-editable order (e.g. "Introduction" pinned first).
      await step('topics.sort_order', async () => {
        const added = await this.ensureColumn(conn, 'topics', 'sort_order', 'INT NOT NULL DEFAULT 0 AFTER course_id');
        await this.ensureIndex(conn, 'topics', 'idx_topics_sort', 'course_id, sort_order');
        if (added) await this.backfillSortOrder(conn, 'topics', 'topic_name', 'course_id');
      });
      await step('subtopics.sort_order', async () => {
        const added = await this.ensureColumn(conn, 'subtopics', 'sort_order', 'INT NOT NULL DEFAULT 0 AFTER topic_id');
        await this.ensureIndex(conn, 'subtopics', 'idx_subtopics_sort', 'topic_id, sort_order');
        if (added) await this.backfillSortOrder(conn, 'subtopics', 'subtopic_name', 'topic_id');
      });
      // OSCE Clinical is a write path from both sides — admins save case documents,
      // students write checklist progress — so it can't sit behind the full sync
      // either (prod runs SCHEMA_SYNC=0).
      await step('osce tables', () => this.ensureOsceTables(conn));
      // Written on every exam submit and lesson completion, so they must exist
      // whether or not SCHEMA_SYNC runs.
      // Which lesson or quiz a generated planner task is. Read and written by
      // every planner request, so it must not wait for SCHEMA_SYNC.
      await step('study_planner_tasks item link', async () => {
        await this.ensureColumn(conn, 'study_planner_tasks', 'item_type', 'VARCHAR(16) NULL');
        await this.ensureColumn(conn, 'study_planner_tasks', 'item_id', 'INT NULL');
        // A whole plan saved as one rule row; the phone works out the days.
        await this.ensureColumn(conn, 'study_planner_tasks', 'rule_json', 'TEXT NULL');
      });
      // Read on EVERY login and session restore (serializeUser) and written the
      // moment an Apple/Google sign-in creates an account, so it cannot sit
      // behind the full sync either. Default 0: every account that already
      // exists has been through onboarding or never needed it, and a column
      // that defaulted to 1 would greet the entire user base as new.
      await step('users.needs_profile_setup', () =>
        this.ensureColumn(
          conn,
          'users',
          'needs_profile_setup',
          'TINYINT(1) NOT NULL DEFAULT 0 AFTER avatar_key',
        ));
      // Admin Structure page: course order and stored counts, so its lists read
      // one row per course/subject instead of counting on every open.
      await step('structure counts and course order', async () => {
        const addedOrder = await this.ensureColumn(conn, 'courses', 'sort_order', 'INT NOT NULL DEFAULT 0 AFTER status');
        if (addedOrder) {
          // Start from today's order (by title), spaced by 10 like lessons.
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
        // One subject's lessons, read already in order (no sort pass), so the
        // rows examined equal the lessons listed.
        await this.ensureIndex(conn, 'lessons', 'idx_lessons_topic_engine_pub_sort', 'topic_id, engine_key, is_public, sort_order, id');
        // Filled once, when the columns are first created. After that every
        // save keeps them right itself; there is no recount at startup.
        if (addedCounts) await recountStructure(conn);
      });
      // Structure page order: every level ranked inside its own parent with
      // gaps (1000, 2000…), so a move changes one row. Converted once, in the
      // order students see today; rolled back if any visible order would change.
      await step('structure gap ranks', async () => {
        await convertToGapRanks(conn, (msg) => this.logger.log(msg));
      });
      // Assessments folder view: stored counts per subject and per course
      // (general / no subject), adjusted by every assessment save. Filled once
      // when the columns are created. Indexes serve a folder's list in id order
      // (pages "after id X") and index-only counting for Fix counts.
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
        if (added) await recountQuizCounts(conn);
      });
      // Question bank: how many assessments use each question, stored so the
      // list and the "unused" filters/counts don't count links on every read.
      await step('question link counts', async () => {
        const added = await this.ensureColumn(conn, 'questions', 'quiz_count', 'INT NOT NULL DEFAULT 0');
        if (added) await recountQuestionLinks(conn);
      });
      // Admin dashboard: whole-site totals read from the 4 course rows
      // (questions and assessments per course, adjusted by every save), and
      // indexes so each user / money number reads only the rows it needs.
      // The two computed flags are VIRTUAL (nothing stored, no app write
      // changes, Apple purchase paths untouched); only their indexes are kept.
      await step('dashboard totals', async () => {
        const addedQuestions = await this.ensureColumn(conn, 'courses', 'question_total', 'INT NOT NULL DEFAULT 0');
        const addedQuizzes = await this.ensureColumn(conn, 'courses', 'quiz_total', 'INT NOT NULL DEFAULT 0');
        if (addedQuestions) await recountCourseQuestionTotals(conn);
        if (addedQuizzes) await recountCourseQuizTotals(conn);
        // Deleted (anonymized) accounts are left out of counts and lists, so
        // deleted_at is in the index: counts stay index-only.
        await this.ensureIndex(conn, 'users', 'idx_users_role_status_live', 'role, status, deleted_at');
        await this.ensureIndex(conn, 'users', 'idx_users_created', 'created_at, id');
        await this.ensureIndex(conn, 'user_subscriptions', 'idx_user_subscriptions_status_end', 'status, end_date');
        // A confirmed payment with an amount ("Recent payments", "Today's earnings").
        await this.ensureColumn(conn, 'user_subscriptions', 'is_collected',
          "TINYINT GENERATED ALWAYS AS (IF(payment_status IN ('paid', 'manual') AND amount_paid > 0, 1, 0)) VIRTUAL");
        await this.ensureIndex(conn, 'user_subscriptions', 'idx_user_subscriptions_collected', 'is_collected, created_at, id');
        await this.ensureIndex(conn, 'user_subscriptions', 'idx_user_subscriptions_collected_day', 'is_collected, payment_date, updated_at');
        // A request the admin pages list: not an online checkout that was
        // started and abandoned (same rule as the Subscriptions requests list).
        await this.ensureColumn(conn, 'subscription_requests', 'admin_visible',
          "TINYINT GENERATED ALWAYS AS (IF(invoice_id IS NULL OR payment_proof_data_url IS NOT NULL OR status = 'approved' OR subscription_id IS NOT NULL, 1, 0)) VIRTUAL");
        await this.ensureIndex(conn, 'subscription_requests', 'idx_subscription_requests_visible', 'admin_visible, status, requested_at, id');
      });
      // Admin search (header box + Structure lesson search): word-start
      // matching that reads only the matching rows. The first FULLTEXT index
      // on a table rebuilds it once (lessons, 28 MB locally: 0.6 s).
      await step('admin search indexes', async () => {
        await this.ensureFulltextIndex(conn, 'lessons', 'ft_lessons_title', 'lesson_title');
        await this.ensureFulltextIndex(conn, 'quizzes', 'ft_quizzes_title', 'quiz_title'); // 10.54: one name column
        await this.ensureFulltextIndex(conn, 'users', 'ft_users_name_email', 'full_name, email');
      });
      // Subscriptions page: the paid list skips the one free-plan row every
      // student has; Apple purchases find their plan by product id.
      await step('subscriptions page indexes', async () => {
        await this.ensureIndex(conn, 'user_subscriptions', 'idx_user_subscriptions_payment_status', 'payment_status, id');
        await this.ensureIndex(conn, 'plans', 'idx_plans_apple_product', 'apple_product_id');
      });
      // Users page pages by status then newest id; announcements newest first by id.
      await step('users page index', async () => {
        await this.ensureIndex(conn, 'users', 'idx_users_status_live', 'status, deleted_at');
      });
      // Drugs admin list: name order by index.
      await step('drugs list index', async () => {
        await this.ensureIndex(conn, 'drugs', 'idx_drugs_name_id', 'name, id');
      });
      // OPTIMIZE 10.28: one row per student. The row has every column it
      // needs; the columns the day rows / topic stats used are removed.
      await step('one row per student', async () => {
        await this.ensureStudyStatsTables(conn);
        await this.ensureColumn(conn, 'student_study_summary', 'practice_seq', 'INT UNSIGNED NOT NULL DEFAULT 0');
        for (const column of ['streak_grace', 'streak_for_day', 'streak_today_active', 'area_trimmed_through', 'quiz_progress_built',
          'lessons_today', 'lessons_day', 'exams_today', 'exam_pct_today', 'exams_day', 'days14']) {
          const [cols] = await conn.execute<RowDataPacket[]>(
            `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_study_summary' AND COLUMN_NAME = ?`,
            [column],
          );
          if (cols.length) await conn.query(`ALTER TABLE student_study_summary DROP COLUMN ${column}`);
        }
      });
      // OPTIMIZE 10.29: the all-time exam totals are gone — exams taken, passed
      // and the average marks come from quiz_marks (one byte per quiz).
      // 2026-11-17: the university's country (from a list) and the university's
      // name (typed), asked at sign-up and on the onboarding screen.
      await step('users university country and name', async () => {
        const [old] = await conn.execute<RowDataPacket[]>(
          `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'country'`,
        );
        if (old.length) await conn.query('ALTER TABLE users CHANGE COLUMN country university_country VARCHAR(64) NULL');
        await this.ensureColumn(conn, 'users', 'university_country', 'VARCHAR(64) NULL');
        await this.ensureColumn(conn, 'users', 'university', 'VARCHAR(160) NULL');
      });
      // OPTIMIZE 10.37: flashcard progress is phone-only; the old per-card
      // review table (frozen since 10.23) is dropped. Backup first.
      await step('drop flashcard reviews table', async () => {
        await conn.query('DROP TABLE IF EXISTS lesson_flashcard_reviews');
      });
      // OPTIMIZE 10.43: each question's options and theory recap move INTO the
      // question row (options_json / recap_json, old column names kept, option
      // ids kept). Every question is read back and compared field by field with
      // the old rows; only when ALL match are the old tables dropped. Any
      // mismatch stops here and changes nothing else.
      await step('questions hold options and recap', async () => {
        await this.ensureColumn(conn, 'questions', 'options_json', 'LONGTEXT NULL');
        await this.ensureColumn(conn, 'questions', 'recap_json', 'LONGTEXT NULL');
        const exists = async (table: string) => {
          const [t] = await conn.execute<RowDataPacket[]>(
            'SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [table]);
          return t.length > 0;
        };
        const hasOptions = await exists('question_options');
        const hasRecaps = await exists('question_theory_recaps');
        if (!hasOptions && !hasRecaps) return;
        const recapCols = 'id, question_id, ' + RECAP_KEYS.join(', ') + ', created_at, updated_at';
        const [idRows] = await conn.query<RowDataPacket[]>('SELECT id FROM questions ORDER BY id');
        const ids = idRows.map((r) => Number(r.id));
        const oldOptions = new Map<number, RowDataPacket[]>();
        const oldRecaps = new Map<number, RowDataPacket>();
        for (let i = 0; i < ids.length; i += 500) {
          const part = ids.slice(i, i + 500);
          const marks = part.map(() => '?').join(',');
          if (hasOptions) {
            const [o] = await conn.query<RowDataPacket[]>(
              `SELECT id, question_id, option_label, option_text, is_correct, why_incorrect FROM question_options
                WHERE question_id IN (${marks}) ORDER BY question_id, option_label, id`, part);
            for (const row of o) {
              const list = oldOptions.get(Number(row.question_id)) || [];
              list.push(row);
              oldOptions.set(Number(row.question_id), list);
            }
          }
          if (hasRecaps) {
            const [r] = await conn.query<RowDataPacket[]>(
              `SELECT ${recapCols} FROM question_theory_recaps WHERE question_id IN (${marks}) ORDER BY id`, part);
            for (const row of r) oldRecaps.set(Number(row.question_id), row);
          }
          for (const id of part) {
            const opts = (oldOptions.get(id) || []).map((o) => ({
              id: Number(o.id), option_label: String(o.option_label), option_text: o.option_text == null ? '' : String(o.option_text),
              is_correct: Number(o.is_correct) === 1 ? 1 : 0, why_incorrect: o.why_incorrect == null ? null : String(o.why_incorrect),
            }));
            const rec = oldRecaps.get(id);
            const recap = rec ? Object.fromEntries(
              ['id', ...RECAP_KEYS, 'created_at', 'updated_at'].map((k) => [k, rec[k] instanceof Date ? (rec[k] as Date).toISOString() : (rec[k] ?? null)]),
            ) : null;
            await conn.execute('UPDATE questions SET options_json = ?, recap_json = ? WHERE id = ?',
              [JSON.stringify(opts), recap ? JSON.stringify(recap) : null, id]);
          }
        }
        // Read back and compare.
        const [stored] = await conn.query<RowDataPacket[]>('SELECT id, options_json, recap_json FROM questions');
        let mismatches = 0;
        for (const row of stored) {
          const id = Number(row.id);
          const now = optionsOf(id, row.options_json);
          const before = oldOptions.get(id) || [];
          if (now.length !== before.length) { mismatches++; continue; }
          for (let k = 0; k < now.length; k++) {
            const b = before[k];
            if (now[k].id !== Number(b.id) || now[k].option_label !== String(b.option_label)
              || now[k].option_text !== (b.option_text == null ? '' : String(b.option_text))
              || now[k].is_correct !== (Number(b.is_correct) === 1 ? 1 : 0)
              || now[k].why_incorrect !== (b.why_incorrect == null ? null : String(b.why_incorrect))) { mismatches++; break; }
          }
          const rNow = recapOf(id, row.recap_json);
          const rBefore = oldRecaps.get(id);
          if (!!rNow !== !!rBefore) { mismatches++; continue; }
          if (rNow && rBefore) {
            for (const k of ['id', ...RECAP_KEYS]) {
              const a1 = (rNow as any)[k]; const b1 = rBefore[k];
              if (String(a1 ?? '') !== String(b1 ?? '')) { mismatches++; break; }
            }
          }
        }
        const oldOptionTotal = [...oldOptions.values()].reduce((n, l) => n + l.length, 0);
        if (mismatches > 0) {
          throw new Error(`question content move: ${mismatches} question(s) differ — old tables kept, nothing dropped`);
        }
        this.logger.log(`Question content moved and verified: ${stored.length} questions, ${oldOptionTotal} options, ${oldRecaps.size} recaps.`);
        // Foreign keys pointing at the old tables (student_answers.option_id →
        // question_options) go first; the option_id column stays, ids are kept.
        const [fks] = await conn.execute<RowDataPacket[]>(
          `SELECT DISTINCT TABLE_NAME AS t, CONSTRAINT_NAME AS c FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IN ('question_options', 'question_theory_recaps')
              AND TABLE_NAME NOT IN ('question_options', 'question_theory_recaps')`,
        );
        for (const fk of fks) {
          await conn.query(`ALTER TABLE \`${fk.t}\` DROP FOREIGN KEY \`${fk.c}\``);
        }
        await conn.query('DROP TABLE IF EXISTS question_options');
        await conn.query('DROP TABLE IF EXISTS question_theory_recaps');
      });
      // OPTIMIZE 10.42: lessons.lesson_content — the first lesson system's text,
      // written by old saves, never read (the lesson is note_data; the source is raw_text).
      await step('drop lessons.lesson_content', async () => {
        const [cols] = await conn.execute<RowDataPacket[]>(
          `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lessons' AND COLUMN_NAME = 'lesson_content'`,
        );
        if (cols.length) await conn.query('ALTER TABLE lessons DROP COLUMN lesson_content');
      });
      // OPTIMIZE 10.37 audit: tables no code uses (notices moved to the JSON
      // feed; the old practice / doubts / review-queue features were replaced).
      // Backup: ~/Desktop/lms-backups/unused-tables-before-10.37-*.sql.
      await step('drop unused tables', async () => {
        for (const table of ['announcement_reads', 'notification_dismissals', 'question_review_items',
          'lesson_doubts', 'practice_answers', 'practice_sessions', // answers first: FK to sessions
          'content_audit_events', 'admin_audit_events', // written, never read (111 MB)
          'content_versions', 'content_workflow_states', // 10.39: never read (≈60 MB)
          'announcements', // 10.40: announcements live in the JSON notices / popups files
          'smart_notes', 'account_deletion_audit', // 10.41: old feature; no deletion record kept (user)
          'lesson_annotations', 'push_subscriptions', 'question_keyword_map']) { // 10.42: unused / never read
          await conn.query(`DROP TABLE IF EXISTS \`${table}\``);
        }
      });
      // OPTIMIZE 10.30: today's 4 goals are counted on the phone; the day counts
      // when its day-done mark rides along (last_active_day), so no goal bits.
      await step('drop today bits', async () => {
        for (const column of ['today_bits', 'today_day']) {
          const [cols] = await conn.execute<RowDataPacket[]>(
            `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_study_summary' AND COLUMN_NAME = ?`,
            [column],
          );
          if (cols.length) await conn.query(`ALTER TABLE student_study_summary DROP COLUMN ${column}`);
        }
      });
      await step('drop exam totals', async () => {
        for (const column of ['attempts_total', 'passed_total', 'percentage_sum']) {
          const [cols] = await conn.execute<RowDataPacket[]>(
            `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_study_summary' AND COLUMN_NAME = ?`,
            [column],
          );
          if (cols.length) await conn.query(`ALTER TABLE student_study_summary DROP COLUMN ${column}`);
        }
      });
      await step('question_quizzes quiz order index', () =>
        this.ensureIndex(conn, 'question_quizzes', 'idx_question_quizzes_quiz_sort_question', 'quiz_id, sort_order, question_id'));
      // OPTIMIZE 10.23 F6: whether the student has old (server-side) flashcard
      // review history, so the app imports it only when there is some. Read
      // with the summary row the start-up request already reads.
      // OPTIMIZE 10.24: a student's active subscription found directly (sign-in,
      // token renewal): examined = returned instead of every subscription row.
      await step('subscriptions by user, status and end date', async () => {
        await this.ensureIndex(conn, 'user_subscriptions', 'idx_user_subscriptions_user_status_end', 'user_id, status, end_date');
      });
      await step('quiz content stamp', async () => {
        await this.ensureColumn(conn, 'quizzes', 'content_stamp', 'INT UNSIGNED NOT NULL DEFAULT 1');
      });
      await step('flashcard history flag in the summary row', async () => {
        await this.ensureStudyStatsTables(conn);
        const added = await this.ensureColumn(conn, 'student_study_summary', 'flash_history', 'TINYINT(1) NOT NULL DEFAULT 0');
        void added; // 10.37: the review table is gone, nothing to back-fill
      });
      // OPTIMIZE 10.12: the whole planner is ONE row per student (category
      // 'plan', items in rule_json), found by the UNIQUE plan_owner key. Old
      // per-item rows keep plan_owner NULL; they are folded in once and kept.
      await step('planner one row', async () => {
        await this.ensureStudyPlannerTasksTable(conn);
        await this.ensureColumn(conn, 'study_planner_tasks', 'item_type', 'VARCHAR(16) NULL');
        await this.ensureColumn(conn, 'study_planner_tasks', 'item_id', 'INT NULL');
        await this.ensureColumn(conn, 'study_planner_tasks', 'rule_json', 'TEXT NULL');
        const [cols] = await conn.execute<RowDataPacket[]>(
          `SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'study_planner_tasks' AND COLUMN_NAME IN ('category', 'rule_json')`,
        );
        const type = (name: string) => String(cols.find((c) => c.COLUMN_NAME === name)?.COLUMN_TYPE || '').toLowerCase();
        if (!type('category').includes("'plan'")) {
          await conn.execute(
            "ALTER TABLE study_planner_tasks MODIFY category ENUM('general','lesson','quiz','exam','review','flashcards','plan') NOT NULL DEFAULT 'general'",
          );
        }
        if (type('rule_json') !== 'mediumtext') {
          await conn.execute('ALTER TABLE study_planner_tasks MODIFY rule_json MEDIUMTEXT NULL');
        }
        const addedOwner = await this.ensureColumn(conn, 'study_planner_tasks', 'plan_owner',
          "INT GENERATED ALWAYS AS (IF(category = 'plan', user_id, NULL)) PERSISTENT");
        const [idx] = await conn.execute<RowDataPacket[]>(
          `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'study_planner_tasks' AND INDEX_NAME = 'uniq_planner_plan_owner' LIMIT 1`,
        );
        if (!idx.length) await conn.execute('ALTER TABLE study_planner_tasks ADD UNIQUE KEY uniq_planner_plan_owner (plan_owner)');
        if (addedOwner) await foldPlannerRows(conn);
      });
      // OPTIMIZE 10.40: old per-item planner rows (folded into the student's
      // one plan row above; never read) and exam sessions that a newer session
      // of the same exam replaced (only the latest per student + exam is read).
      // Runs after the fold, and only for students who have their plan row.
      await step('planner old rows and old exam sessions', async () => {
        await conn.query(
          `DELETE t FROM study_planner_tasks t
             JOIN study_planner_tasks p ON p.user_id = t.user_id AND p.category = 'plan'
            WHERE t.category <> 'plan'`,
        );
      });
      // OPTIMIZE 10.44: tables the new app and website never use — the old
      // exam flow (attempts, per-option answers, server-side exam sessions:
      // exams are on the progress row since 10.16), server bookmarks (on the
      // device since 10.25) and an empty migrations table. Foreign keys that
      // point at them go first.
      await step('drop old exam, bookmark and migration tables', async () => {
        const OLD = ['student_answers', 'exam_sessions', 'quiz_attempts', 'study_bookmarks', 'schema_migrations'];
        const marks = OLD.map(() => '?').join(', ');
        const [fks] = await conn.execute<RowDataPacket[]>(
          `SELECT DISTINCT TABLE_NAME AS t, CONSTRAINT_NAME AS c FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IN (${marks}) AND TABLE_NAME NOT IN (${marks})`,
          [...OLD, ...OLD],
        );
        for (const fk of fks) await conn.query(`ALTER TABLE \`${fk.t}\` DROP FOREIGN KEY \`${fk.c}\``);
        for (const table of OLD) await conn.query(`DROP TABLE IF EXISTS \`${table}\``);
      });
      // OPTIMIZE 10.47: which content pieces a question lacks, as one STORED
      // generated flag column with an index, for the admin "Missing content"
      // filters (they scanned and parsed every question before).
      await step('questions missing-content flags', async () => {
        const [cols] = await conn.execute<RowDataPacket[]>(
          `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'questions' AND COLUMN_NAME = 'missing_mask'`,
        );
        if (!cols.length) {
          await conn.query(
            `ALTER TABLE questions ADD COLUMN missing_mask TINYINT UNSIGNED AS (${sqlMissingMaskExpression()}) STORED`,
          );
        }
        await this.ensureIndex(conn, 'questions', 'idx_questions_missing_mask', 'missing_mask, id');
      });
      // OPTIMIZE 10.54: set columns no set used, and question keywords (option C).
      // The server now answers with the fixed values these columns held, so the
      // phone app and websites see the same replies. The old two-column title
      // index goes; admin search uses the one-column index from the step above.
      await step('drop unused set columns and question keywords', async () => {
        const [idx] = await conn.execute<RowDataPacket[]>(
          `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quizzes' AND INDEX_NAME = 'ft_quizzes_titles' LIMIT 1`,
        );
        if (idx.length) await conn.query('ALTER TABLE quizzes DROP INDEX ft_quizzes_titles');
        const DROP = ['lesson_id', 'paper_id', 'collection_tags', 'subtopic', 'quiz_description', 'blueprint_json',
          'randomization_mode', 'quiz_mode', 'display_title_mode', 'exam_mode_only', 'hide_time_limit',
          'hide_passing_marks', 'show_theory_recap_in_exam', 'admin_name', 'student_title'];
        const [cols] = await conn.execute<RowDataPacket[]>(
          `SELECT COLUMN_NAME AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quizzes' AND COLUMN_NAME IN (${DROP.map(() => '?').join(', ')})`,
          DROP,
        );
        if (cols.length) await conn.query(`ALTER TABLE quizzes ${cols.map((r) => `DROP COLUMN \`${r.c}\``).join(', ')}`);
        await this.ensureFulltextIndex(conn, 'quizzes', 'ft_quizzes_title', 'quiz_title');
        const [kw] = await conn.execute<RowDataPacket[]>(
          `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'questions' AND COLUMN_NAME = 'keywords_text' LIMIT 1`,
        );
        if (kw.length) await conn.query('ALTER TABLE questions DROP COLUMN keywords_text');
        await conn.query('DROP TABLE IF EXISTS question_keywords');
      });
      // OPTIMIZE 10.54: random sets were removed, so their plan feature goes too
      // ("Dynamic quiz randomization" was listed on one plan).
      await step('drop dynamic quiz randomization plan feature', async () => {
        await conn.query(
          `DELETE spf FROM subscription_plan_features spf
             JOIN subscription_features sf ON sf.id = spf.feature_id
            WHERE sf.feature_key = 'dynamic_quiz_randomization'`,
        );
        await conn.query(`DELETE FROM subscription_features WHERE feature_key = 'dynamic_quiz_randomization'`);
      });
      // OPTIMIZE 10.57: stored admin counters (users by role/status, subscriptions
      // per plan/payment/status, drugs total) — filled once here, then kept by
      // each save (common/utils/admin-counters.ts); Fix counts rebuilds them.
      await step('admin counters table', async () => {
        await conn.query(
          `CREATE TABLE IF NOT EXISTS admin_counters (
             name VARCHAR(80) NOT NULL PRIMARY KEY,
             value BIGINT NOT NULL DEFAULT 0
           ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        );
        const [[has]] = await conn.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM admin_counters');
        if (!Number(has?.n)) await rebuildAdminCountersOn(conn);
      });
      // OPTIMIZE 10.57: Reports "inactive students" reads the least recently
      // active students by this index (was a join + sort over every student).
      await step('summary last-active index', async () => {
        await this.ensureIndex(conn, 'student_study_summary', 'idx_summary_last_active', 'last_active_day');
      });
      // OPTIMIZE 10.57: each ECG topic's card count, stored (adjusted on card
      // add / delete / move), in place of a count subquery per topic.
      await step('ecg topic card count', async () => {
        const [cols] = await conn.execute<RowDataPacket[]>(
          `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ecg_topics' AND COLUMN_NAME = 'card_count'`,
        );
        if (!cols.length) {
          await conn.query('ALTER TABLE ecg_topics ADD COLUMN card_count INT UNSIGNED NOT NULL DEFAULT 0');
          await conn.query('UPDATE ecg_topics t SET t.card_count = (SELECT COUNT(*) FROM ecg_cards c WHERE c.topic_id = t.id)');
        }
      });
      if (failed === 0) {
        await step('record critical_schema_version', () => conn.execute(
          `INSERT INTO system_settings (setting_key, setting_value) VALUES ('critical_schema_version', ?)
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
          [CRITICAL_SCHEMA_VERSION],
        ));
      }
    } finally {
      connection.release();
    }
  }

  private async ensureOsceTables(connection: PoolConnection) {
    // OSCE categories are the admin's own, not the course's lesson subjects.
    // A station may be filed under "Thyroid lumps" even when no such lesson
    // subject exists, and the OSCE order is independent of the teaching order.
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

    // Station categories are the course's own SUBJECTS (`topics`), not a
    // separate list — add "Cardiology" under Medicine and it becomes an OSCE
    // category automatically. Anchoring to the course also means the existing
    // subscription scope (user_subscriptions.course_ids_json) gates OSCE for
    // free, instead of needing its own access rules.
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
    // Pre-refactor installs keyed cases to a standalone systems table.
    await this.ensureColumn(connection, 'osce_cases', 'course_id', 'INT NOT NULL DEFAULT 0 AFTER id');
    await this.ensureColumn(connection, 'osce_cases', 'topic_id', 'INT NOT NULL DEFAULT 0 AFTER course_id');
    await this.ensureColumn(connection, 'osce_cases', 'is_free', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER is_public');
    await this.ensureColumn(connection, 'osce_cases', 'category_id', 'INT UNSIGNED NULL AFTER topic_id');
    // Short case = examination-led. Long case = history-led, played as a
    // conversation with the patient.
    await this.ensureColumn(connection, 'osce_cases', 'station_type',
      "ENUM('short','long') NOT NULL DEFAULT 'short' AFTER difficulty");
    // Categories moved from a standalone systems table to the course's own
    // subjects. CREATE TABLE IF NOT EXISTS leaves the old NOT NULL column in
    // place on installs that ran the earlier shape, which then rejects every
    // insert — so drop it explicitly.
    const [staleCols] = await connection.execute<any[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'osce_cases' AND COLUMN_NAME = 'system_id'`
    );
    if (staleCols.length) {
      await connection.execute('ALTER TABLE osce_cases DROP COLUMN system_id').catch(() => undefined);
    }

    // One row per FILLED image slot. The case document declares which slots exist;
    // this says which have been supplied — the difference is the shot list.
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

    // Must come AFTER the CREATE above. It used to sit before it, so on a fresh
    // database the ALTER hit a table that did not exist yet, threw, and aborted
    // the rest of this method — leaving osce_media and osce_progress uncreated
    // while the server booted and served OSCE routes against missing tables.
    await this.ensureColumn(connection, 'osce_media', 'source', "ENUM('upload','ai') NOT NULL DEFAULT 'upload' AFTER mime");
    // A slot can hold a link to a video hosted elsewhere (YouTube, Vimeo,
    // Drive) instead of a file we store. Same reason lessons take a link:
    // clips are what got the hosting account flagged, and a link costs us no
    // disk and no bandwidth. When this is set, storage_key is empty and the
    // client is handed the external URL as-is.
    await this.ensureColumn(connection, 'osce_media', 'external_url', 'VARCHAR(500) NULL AFTER storage_key');
    // storage_key is NOT NULL from the original schema, and a linked slot has
    // no stored file — so it has to accept ''.
    await connection.query(
      "ALTER TABLE osce_media MODIFY COLUMN storage_key VARCHAR(255) NOT NULL DEFAULT ''"
    ).catch(() => undefined);

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

    // CREATE TABLE IF NOT EXISTS won't add a column to a table that already
    // exists, so favourites need this for any install created before them.
    // Every case-list query selects this column, so a failure here takes out
    // the whole OSCE section rather than just favourites — it must be loud.
    await this.ensureColumn(
      connection, 'osce_progress', 'is_favourite',
      'TINYINT(1) NOT NULL DEFAULT 0 AFTER seen_json');

    await connection.execute('DROP TABLE IF EXISTS osce_systems').catch(() => undefined);
  }

  private async ensureSystemSettingsTable(connection: PoolConnection) {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS system_settings (
        setting_key VARCHAR(120) NOT NULL PRIMARY KEY,
        setting_value TEXT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  }

  private async ensureEcgTables(connection: PoolConnection) {
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
    // ecg.service.ts reads t.category on every topic list/detail call — added
    // after the table above shipped, so existing installs need the migration
    // too, not just the CREATE TABLE.
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
    // Same gap as above: ecg.service.ts's getTopicWithCards() selects both of
    // these on every card fetch. Nothing currently WRITES them (no admin
    // authoring UI yet — annotations_json is a future interactive-strip
    // feature), so they'll just be NULL for now; the student-facing
    // EcgInteractiveStrip component already handles that by falling back to
    // the plain image. Without these columns the query 500s outright.
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

  private async ensureAuscultationTables(connection: PoolConnection) {
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

  private async ensureAiProviderConfigsTable(connection: PoolConnection) {
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

  private async ensureLessonFlashcardsTable(connection: PoolConnection) {
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


  private async ensureSubscriptionFeaturesTables(connection: PoolConnection) {
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

  private async ensureSubscriptionRequestTables(connection: PoolConnection) {
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

  /**
   * OPTIMIZE 10.28: a student's progress has ONE home — this row. Every
   * student starts fresh; the old per-student tables (activity log, daily
   * rows, per-quiz / per-lesson rows, topic stats, XP log) are not created.
   */
  private async ensureStudyStatsTables(connection: PoolConnection) {
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

  private async backfillAccessExpiresAt(connection: PoolConnection) {
    try {
      await connection.execute(
        `UPDATE user_subscriptions us
         JOIN (
           SELECT original_transaction_id, MAX(expires_date) AS expires_date
           FROM iap_transactions
           WHERE platform = 'apple' AND expires_date IS NOT NULL
           GROUP BY original_transaction_id
         ) t ON t.original_transaction_id = us.payment_reference
         SET us.access_expires_at = t.expires_date
         WHERE us.payment_method = 'apple_iap' AND us.access_expires_at IS NULL`
      );
    } catch (error) {
      // iap_transactions may not exist yet on a fresh database; the live flow
      // populates the column from then on, so this is not worth failing boot.
      this.logger.warn(`Skipped access_expires_at backfill: ${(error as Error).message}`);
    }
  }

  private async backfillPlanSubscriptionColumns(connection: PoolConnection) {
    const [planRows] = await connection.execute<RowDataPacket[]>(
      'SELECT id, name, price, regular_price, slug, sort_order FROM plans ORDER BY id ASC'
    );

    for (const [index, row] of planRows.entries()) {
      const slug = String(row.slug || '').trim() || this.slugify(String(row.name || `plan-${row.id}`));
      const regularPrice = row.regular_price === null || row.regular_price === undefined
        ? Number(row.price || 0)
        : Number(row.regular_price || 0);
      const sortOrder = Number(row.sort_order || 0) > 0 ? Number(row.sort_order) : index + 1;

      await connection.execute(
        'UPDATE plans SET slug = ?, regular_price = ?, sort_order = ? WHERE id = ?',
        [slug, regularPrice, sortOrder, Number(row.id)]
      );
    }
  }

  private async seedSubscriptionFeatureCatalog(connection: PoolConnection) {
    for (const feature of DEFAULT_SUBSCRIPTION_FEATURES) {
      await connection.execute(
        `
          INSERT INTO subscription_features (feature_name, feature_key, description, category, status)
          VALUES (?, ?, ?, ?, 'active')
          ON DUPLICATE KEY UPDATE
            feature_name = VALUES(feature_name),
            description = VALUES(description),
            category = VALUES(category)
        `,
        [feature.featureName, feature.featureKey, feature.description, feature.category]
      );
    }
  }

  private async seedDefaultPlans(connection: PoolConnection) {
    // Plans belong to the admin panel. The blueprint only gives a FRESH database
    // its starting set: once any plan row exists, nothing is re-created, so a plan
    // deleted in the panel stays deleted and a custom plan is never removed.
    const [planCountRows] = await connection.execute<RowDataPacket[]>('SELECT COUNT(*) AS total FROM plans');
    if (Number(planCountRows[0]?.total || 0) > 0) {
      return;
    }

    for (const plan of DEFAULT_PLAN_BLUEPRINTS) {
      const featureNames = DEFAULT_SUBSCRIPTION_FEATURES
        .filter((feature) => (plan.featureKeys as readonly string[]).includes(feature.featureKey))
        .map((feature) => feature.featureName);

      const [existingRows] = await connection.execute<RowDataPacket[]>(
        'SELECT id FROM plans WHERE slug = ? LIMIT 1',
        [plan.slug]
      );
      if (existingRows[0]) {
        // SEED, not sync: an existing plan is left exactly as it is.
        //
        // This used to UPDATE name, description, price, duration_days, status,
        // sort_order and recommended from the blueprint on every boot where
        // schema sync runs. That silently undid admin edits — renaming a plan
        // in the panel appeared to work and then reverted, and a duration
        // changed by hand (Master Prep to 365 days) would snap back to the
        // hardcoded value, quietly shortening what students had paid for.
        //
        // The admin panel is the source of truth for plan content. The
        // blueprint only decides what a FRESH database starts with. Changing a
        // price here therefore no longer propagates to an existing install —
        // edit it in the panel, which is where it is edited anyway.
        //
        // Feature maps are still backfilled: they are keyed data the panel
        // cannot invent, and the helper only adds missing rows.
        await this.syncDefaultPlanFeatureMap(connection, Number(existingRows[0].id), [...plan.featureKeys]);
        continue;
      }

      const [result] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO plans (
            name, slug, description, price, regular_price, offer_price, offer_enabled, currency, billing_period,
            duration_days, features_json, status, sort_order, recommended
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'month', ?, ?, ?, ?, ?)
        `,
        [
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
        ]
      );
      await this.syncDefaultPlanFeatureMap(connection, Number(result.insertId || 0), [...plan.featureKeys]);
    }
  }

  private async syncDefaultPlanFeatureMap(connection: PoolConnection, planId: number, featureKeys: string[]) {
    if (!planId) {
      return;
    }

    const [featureRows] = await connection.execute<RowDataPacket[]>(
      `SELECT id, feature_key FROM subscription_features`
    );
    const selectedFeatureIds = featureRows
      .filter((feature) => featureKeys.includes(String(feature.feature_key)))
      .map((feature) => Number(feature.id))
      .filter((id) => id > 0);

    await connection.execute('DELETE FROM subscription_plan_features WHERE plan_id = ?', [planId]);

    for (const featureId of selectedFeatureIds) {
      await connection.execute(
        'INSERT IGNORE INTO subscription_plan_features (plan_id, feature_id, is_enabled) VALUES (?, ?, 1)',
        [planId, featureId]
      );
    }
  }

  private async backfillPlanFeatureMaps(connection: PoolConnection) {
    const [featureRows] = await connection.execute<RowDataPacket[]>(
      'SELECT id, feature_name, feature_key, category FROM subscription_features'
    );
    const featureIdByKey = new Map(featureRows.map((row) => [String(row.feature_key), Number(row.id)]));
    const featureIdByName = new Map(featureRows.map((row) => [String(row.feature_name).trim().toLowerCase(), Number(row.id)]));

    const [planRows] = await connection.execute<RowDataPacket[]>(
      'SELECT id, slug, name, features_json FROM plans ORDER BY sort_order ASC, id ASC'
    );

    for (const planRow of planRows) {
      const planId = Number(planRow.id);
      const [mappingRows] = await connection.execute<RowDataPacket[]>(
        'SELECT id FROM subscription_plan_features WHERE plan_id = ? LIMIT 1',
        [planId]
      );
      if (mappingRows.length > 0) {
        continue;
      }

      const defaultBlueprint = DEFAULT_PLAN_BLUEPRINTS.find((plan) => plan.slug === String(planRow.slug || '').trim().toLowerCase());
      const legacyFeatures = this.parseFeatureArray(String(planRow.features_json || ''));
      const featureIds = new Set<number>();

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
          await connection.execute(
            `
              INSERT INTO subscription_features (feature_name, feature_key, description, category, status)
              VALUES (?, ?, ?, 'Support / Extras', 'active')
              ON DUPLICATE KEY UPDATE feature_name = VALUES(feature_name)
            `,
            [featureName, featureKey, 'Imported from a legacy plan feature list.']
          );
          const [newFeatureRows] = await connection.execute<RowDataPacket[]>(
            'SELECT id, feature_name FROM subscription_features WHERE feature_key = ? LIMIT 1',
            [featureKey]
          );
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
        await connection.execute(
          'INSERT IGNORE INTO subscription_plan_features (plan_id, feature_id, is_enabled) VALUES (?, ?, 1)',
          [planId, featureId]
        );
      }
    }
  }

  private parseFeatureArray(raw: string) {
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed.map((value) => String(value || '').trim()).filter(Boolean)
        : [];
    } catch {
      return [];
    }
  }

  private slugify(value: string) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'item';
  }

  private async ensureColumn(connection: PoolConnection, tableName: string, columnName: string, definition: string): Promise<boolean> {
    const table = sqlIdentifier(tableName, undefined, 'schema table');
    const column = sqlIdentifier(columnName, undefined, 'schema column');
    const [rows] = await connection.execute<RowDataPacket[]>(
      `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
        LIMIT 1
      `,
      [tableName, columnName]
    );

    if (rows.length > 0) {
      return false;
    }

    await connection.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    this.logger.log(`Added ${tableName}.${columnName}`);
    return true;
  }

  /** One-time: seed lessons.sort_order from the alphabetical order students were
   * already seeing (title ASC), scoped per topic/subtopic, so existing lessons
   * keep their current position the moment ordering becomes admin-editable. */
  private async backfillLessonSortOrder(connection: PoolConnection) {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT id, topic_id, subtopic_id FROM lessons ORDER BY topic_id ASC, subtopic_id ASC, lesson_title ASC, id ASC`
    );
    const counters = new Map<string, number>();
    for (const row of rows as { id: number; topic_id: number | null; subtopic_id: number | null }[]) {
      const key = `${row.topic_id ?? 0}|${row.subtopic_id ?? 0}`;
      const next = (counters.get(key) ?? 0) + 10;
      counters.set(key, next);
      await connection.execute(`UPDATE lessons SET sort_order = ? WHERE id = ?`, [next, row.id]);
    }
    if (rows.length) this.logger.log(`Backfilled sort_order for ${rows.length} lesson(s)`);
  }

  /** One-time: seed <table>.sort_order from the alphabetical order students were
   * already seeing (<nameColumn> ASC), scoped per <scopeColumn> — same idea as
   * backfillLessonSortOrder, generalized for topics (Subjects) and subtopics
   * (Topics), which only have a single scope column instead of two. */
  private async backfillSortOrder(connection: PoolConnection, table: string, nameColumn: string, scopeColumn: string) {
    const tableIdent = sqlIdentifier(table, undefined, 'schema table');
    const nameIdent = sqlIdentifier(nameColumn, undefined, 'schema column');
    const scopeIdent = sqlIdentifier(scopeColumn, undefined, 'schema column');
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT id, ${scopeIdent} AS scope_value FROM ${tableIdent} ORDER BY ${scopeIdent} ASC, ${nameIdent} ASC, id ASC`
    );
    const counters = new Map<string, number>();
    for (const row of rows as { id: number; scope_value: number | null }[]) {
      const key = String(row.scope_value ?? 0);
      const next = (counters.get(key) ?? 0) + 10;
      counters.set(key, next);
      await connection.execute(`UPDATE ${tableIdent} SET sort_order = ? WHERE id = ?`, [next, row.id]);
    }
    if (rows.length) this.logger.log(`Backfilled sort_order for ${rows.length} row(s) in ${table}`);
  }

  private async ensureFreePlanPaymentStatus(connection: PoolConnection) {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `
        SELECT COLUMN_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_subscriptions' AND COLUMN_NAME = 'payment_status'
        LIMIT 1
      `
    );
    const columnType = String(rows[0]?.COLUMN_TYPE || '');
    if (columnType.includes("'free_plan'") && !columnType.includes("'waived'")) {
      return;
    }

    await connection.execute(
      "ALTER TABLE user_subscriptions MODIFY payment_status ENUM('manual','paid','unpaid','waived','free_plan') NOT NULL DEFAULT 'manual'"
    );
    await connection.execute("UPDATE user_subscriptions SET payment_status = 'free_plan' WHERE payment_status = 'waived'");
    await connection.execute(
      "ALTER TABLE user_subscriptions MODIFY payment_status ENUM('manual','paid','unpaid','free_plan') NOT NULL DEFAULT 'manual'"
    );
    this.logger.log('Renamed user_subscriptions.payment_status waived to free_plan');
  }

  private async ensureUnlimitedFreePlanDates(connection: PoolConnection) {
    await connection.execute(
      `UPDATE user_subscriptions us
       INNER JOIN plans p ON p.id = us.plan_id
       SET us.end_date = '9999-12-31'
       WHERE us.payment_status = 'free_plan'
          OR (p.slug = 'free' AND p.price = 0)`
    );
  }

  private async ensureIndex(connection: PoolConnection, tableName: string, indexName: string, columnNames: string) {
    const table = sqlIdentifier(tableName, undefined, 'schema table');
    const index = sqlIdentifier(indexName, undefined, 'schema index');
    const columns = columnNames
      .split(',')
      .map((columnName) => sqlIdentifier(columnName.trim(), undefined, 'schema column'))
      .join(', ');
    const [rows] = await connection.execute<RowDataPacket[]>(
      `
        SELECT INDEX_NAME
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?
        LIMIT 1
      `,
      [tableName, indexName]
    );

    if (rows.length > 0) {
      return;
    }

    await connection.execute(`ALTER TABLE ${table} ADD INDEX ${index} (${columns})`);
    this.logger.log(`Added index ${indexName} on ${tableName}.${columnNames}`);
  }

  private async ensureFulltextIndex(connection: PoolConnection, tableName: string, indexName: string, columnNames: string) {
    const table = sqlIdentifier(tableName, undefined, 'schema table');
    const index = sqlIdentifier(indexName, undefined, 'schema index');
    const columns = columnNames.split(',').map((c) => sqlIdentifier(c.trim(), undefined, 'schema column')).join(', ');
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
      [tableName, indexName]
    );
    if (rows.length > 0) return;
    await connection.execute(`ALTER TABLE ${table} ADD FULLTEXT ${index} (${columns})`);
    this.logger.log(`Added FULLTEXT index ${indexName} on ${tableName}.${columnNames}`);
  }

  private async ensureUniqueIndex(connection: PoolConnection, tableName: string, indexName: string, columnNames: string) {
    const table = sqlIdentifier(tableName, undefined, 'schema table');
    const index = sqlIdentifier(indexName, undefined, 'schema index');
    const columns = columnNames
      .split(',')
      .map((columnName) => sqlIdentifier(columnName.trim(), undefined, 'schema column'))
      .join(', ');
    const [rows] = await connection.execute<RowDataPacket[]>(
      `
        SELECT INDEX_NAME
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?
        LIMIT 1
      `,
      [tableName, indexName]
    );

    if (rows.length > 0) {
      return;
    }

    // Duplicate existing values would make this fail; log and continue rather
    // than aborting the whole boot-time sync.
    try {
      await connection.execute(`ALTER TABLE ${table} ADD UNIQUE INDEX ${index} (${columns})`);
      this.logger.log(`Added unique index ${indexName} on ${tableName}.${columnNames}`);
    } catch (error) {
      this.logger.error(
        `Could not add unique index ${indexName} on ${tableName}.${columnNames} — resolve duplicates first`,
        error as Error
      );
    }
  }
}
