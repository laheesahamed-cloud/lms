import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import * as bcrypt from 'bcryptjs';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { sqlIdentifier, sqlPlaceholders } from '../../database/sql-safety';
import { DEFAULT_PLAN_BLUEPRINTS, DEFAULT_SUBSCRIPTION_FEATURES } from '../plans/subscription-catalog';

@Injectable()
export class SchemaSyncService implements OnModuleInit {
  private readonly logger = new Logger(SchemaSyncService.name);

  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Pool) {}

  async onModuleInit() {
    let connection: PoolConnection | null = null;

    try {
      connection = await this.db.getConnection();
      await this.ensurePlansTable(connection);
      await this.ensureUserSubscriptionsTable(connection);
      await this.ensureSubscriptionCouponsTable(connection);
      await this.ensurePaymentTransactionsTable(connection);
      await this.ensureStudyBookmarksTable(connection);
      await this.ensureStudyActivityEventsTable(connection);
      await this.ensurePapersTable(connection);
      await this.ensureQuestionReportsTable(connection);
      await this.ensureExamSessionsTable(connection);
      await this.ensureLessonAnnotationsTable(connection);
      await this.ensureStudentLessonProgressTable(connection);
      await this.ensureAnnouncementsTable(connection);
      await this.ensurePushSubscriptionsTable(connection);
      await this.ensureNativePushTokensTable(connection);
      await this.ensureStudyPlannerTasksTable(connection);
      await this.ensureSystemSettingsTable(connection);
      await this.ensureAiProviderConfigsTable(connection);
      await this.ensureSmartNotesTable(connection);
      await this.ensureAiIllustratedNotesTable(connection);
      await this.ensureLessonFlashcardsTable(connection);
      await this.ensureQuestionKeywordsTables(connection);
      await this.ensureSubscriptionFeaturesTables(connection);
      await this.ensureSubscriptionRequestTables(connection);
      await this.ensureQuestionTheoryRecapsTable(connection);
      await this.ensureContentGovernanceTables(connection);
      await this.ensureAdminAuditEventsTable(connection);
      await this.ensureUserRoleColumnSupportsStaff(connection);
      await this.ensureStudyActivityEventTypes(connection);
      await this.ensureColumn(connection, 'users', 'avatar_key', "VARCHAR(64) NULL AFTER status");
      await this.ensureColumn(connection, 'users', 'session_expires_at', 'DATETIME NULL AFTER session_token');
      await this.ensureColumn(connection, 'users', 'password_reset_token', 'VARCHAR(128) NULL AFTER session_expires_at');
      await this.ensureColumn(connection, 'users', 'password_reset_expires_at', 'DATETIME NULL AFTER password_reset_token');
      await this.ensureColumn(connection, 'study_planner_tasks', 'category', "ENUM('general','lesson','quiz','exam','review','flashcards') NOT NULL DEFAULT 'general' AFTER status");
      await this.ensureColumn(connection, 'study_planner_tasks', 'priority', "ENUM('low','medium','high') NOT NULL DEFAULT 'medium' AFTER category");
      await this.ensureColumn(connection, 'study_planner_tasks', 'estimated_minutes', 'INT NULL AFTER priority');
      await this.ensureColumn(connection, 'ai_illustrated_notes', 'is_public',   "TINYINT NOT NULL DEFAULT 1");
      await this.ensureColumn(connection, 'ai_illustrated_notes', 'course_id',   'INT NULL');
      await this.ensureColumn(connection, 'ai_illustrated_notes', 'topic_id',    'INT NULL');
      await this.ensureColumn(connection, 'ai_illustrated_notes', 'subtopic_id', 'INT NULL');
      await this.ensureColumn(connection, 'ai_illustrated_notes', 'status',      "ENUM('active','inactive') NOT NULL DEFAULT 'active'");
      await this.ensureColumn(connection, 'ai_illustrated_notes', 'lesson_id',   'INT NULL');
      await this.ensureColumn(connection, 'ai_illustrated_notes', 'engine_key',  "VARCHAR(32) NOT NULL DEFAULT 'gemini' AFTER raw_text");
      await this.ensureColumn(connection, 'ai_illustrated_notes', 'video_url',   'VARCHAR(1000) NULL AFTER lesson_id');
      await this.ensureColumn(connection, 'lesson_flashcards', 'image_url', 'LONGTEXT NULL AFTER source_hint');
      await this.ensureColumn(connection, 'lesson_flashcards', 'image_fit', "ENUM('contain','cover') NOT NULL DEFAULT 'contain' AFTER image_url");
      await this.ensureColumn(connection, 'questions', 'subtopic_id', 'INT NULL AFTER topic_id');
      await this.ensureColumn(connection, 'questions', 'lesson_id', 'INT NULL AFTER subtopic_id');
      await this.ensureColumn(connection, 'questions', 'paper_id', 'INT NULL AFTER lesson_id');
      await this.ensureColumn(connection, 'questions', 'keywords_text', 'TEXT NULL AFTER question_text');
      await this.ensureColumn(connection, 'questions', 'question_category', "VARCHAR(20) NULL AFTER category");
      await this.ensureQuestionCategoryColumns(connection);
      await this.ensureColumn(connection, 'question_options', 'why_incorrect', 'TEXT NULL AFTER is_correct');
      await this.ensureColumn(connection, 'courses', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');
      await this.ensureColumn(connection, 'topics', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');
      await this.ensureColumn(connection, 'lessons', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');
      await this.ensureColumn(connection, 'papers', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');
      await this.ensureColumn(connection, 'questions', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');
      await this.ensureColumn(connection, 'quizzes', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');
      await this.ensureColumn(connection, 'quizzes', 'subtopic_id', 'INT NULL AFTER topic_id');
      await this.ensureColumn(connection, 'quizzes', 'lesson_id', 'INT NULL AFTER subtopic_id');
      await this.ensureColumn(connection, 'quizzes', 'paper_id', 'INT NULL AFTER lesson_id');
      await this.ensureColumn(connection, 'quizzes', 'category', 'VARCHAR(120) NULL AFTER paper_id');
      await this.ensureColumn(connection, 'quizzes', 'collection_tags', 'TEXT NULL AFTER category');
      await this.ensureColumn(connection, 'quizzes', 'is_free', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER collection_tags');
      await this.ensureColumn(connection, 'quizzes', 'admin_name', 'VARCHAR(255) NULL AFTER exam_mode_only');
      await this.ensureColumn(connection, 'quizzes', 'student_title', 'VARCHAR(255) NULL AFTER admin_name');
      await this.ensureColumn(connection, 'quizzes', 'display_title_mode', "VARCHAR(20) NOT NULL DEFAULT 'number' AFTER student_title");
      await this.ensureColumn(connection, 'quizzes', 'blueprint_json', 'LONGTEXT NULL AFTER quiz_description');
      await this.ensureColumn(connection, 'quizzes', 'randomization_mode', "VARCHAR(20) NOT NULL DEFAULT 'static' AFTER blueprint_json");
      await this.ensureColumn(connection, 'lessons', 'is_free', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER video_url');
      await this.ensureColumn(connection, 'ai_illustrated_notes', 'is_free', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER is_public');
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
      await this.ensureColumn(connection, 'practice_sessions', 'revealed_question_ids_json', 'TEXT NULL AFTER last_question_index');
      await this.ensureColumn(connection, 'practice_sessions', 'question_ids_json', 'LONGTEXT NULL AFTER quiz_id');
      await this.ensureColumn(connection, 'exam_sessions', 'question_ids_json', 'LONGTEXT NULL AFTER quiz_id');
      await this.ensureColumn(connection, 'quiz_attempts', 'question_ids_json', 'LONGTEXT NULL AFTER quiz_id');
      await this.ensureColumn(connection, 'quiz_attempts', 'reviewed_at', 'DATETIME NULL AFTER submitted_at');
      await this.ensureColumn(connection, 'quizzes', 'show_theory_recap_in_practice', 'TINYINT(1) NOT NULL DEFAULT 1');
      await this.ensureColumn(connection, 'quizzes', 'show_theory_recap_in_exam', 'TINYINT(1) NOT NULL DEFAULT 0');
      await this.ensureColumn(connection, 'quizzes', 'show_theory_recap_in_review', 'TINYINT(1) NOT NULL DEFAULT 1');
      await this.ensureIndex(connection, 'questions', 'idx_questions_subtopic_id', 'subtopic_id');
      await this.ensureIndex(connection, 'questions', 'idx_questions_lesson_id', 'lesson_id');
      await this.ensureIndex(connection, 'questions', 'idx_questions_paper_id', 'paper_id');
      await this.ensureIndex(connection, 'quizzes', 'idx_quizzes_subtopic_id', 'subtopic_id');
      await this.ensureIndex(connection, 'quizzes', 'idx_quizzes_lesson_id', 'lesson_id');
      await this.ensureIndex(connection, 'quizzes', 'idx_quizzes_paper_id', 'paper_id');
      await this.ensureIndex(connection, 'plans', 'idx_plans_slug', 'slug');
      await this.ensureIndex(connection, 'users', 'idx_users_password_reset_token', 'password_reset_token');
      await this.ensureIndex(connection, 'users', 'idx_users_session_token_expires', 'session_token, session_expires_at');
      await this.ensureIndex(connection, 'plans', 'idx_plans_sort_order', 'sort_order');
      await this.ensureIndex(connection, 'question_quizzes', 'idx_question_quizzes_quiz_sort', 'quiz_id, sort_order');
      await this.ensureIndex(connection, 'question_quizzes', 'idx_question_quizzes_question_quiz', 'question_id, quiz_id');
      await this.ensureIndex(connection, 'question_options', 'idx_question_options_question_label', 'question_id, option_label');
      await this.ensureIndex(connection, 'questions', 'idx_questions_status_type_id', 'status, question_type, id');
      await this.ensureIndex(connection, 'quizzes', 'idx_quizzes_status_course_id', 'status, course_id, id');
      await this.ensureIndex(connection, 'quiz_attempts', 'idx_quiz_attempts_user_status_dates', 'user_id, status, submitted_at, created_at');
      await this.ensureIndex(connection, 'quiz_attempts', 'idx_quiz_attempts_quiz_user_dates', 'quiz_id, user_id, submitted_at, created_at');
      await this.ensureIndex(connection, 'practice_sessions', 'idx_practice_sessions_quiz_user_status', 'quiz_id, user_id, status');
      await this.ensureIndex(connection, 'practice_answers', 'idx_practice_answers_session_question', 'practice_session_id, question_id');
      await this.ensureIndex(connection, 'student_answers', 'idx_student_answers_attempt_question', 'attempt_id, question_id');
      await this.ensureIndex(connection, 'student_answers', 'idx_student_answers_question_option', 'question_id, option_id');
      await this.ensureIndex(connection, 'question_keyword_map', 'idx_question_keyword_map_keyword_id', 'keyword_id');
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
      await this.ensureIndex(connection, 'announcements', 'idx_announcements_status_target', 'status, target_role');
      await this.ensureIndex(connection, 'announcement_reads', 'idx_announcement_reads_user', 'user_id');
      await this.ensureIndex(connection, 'push_subscriptions', 'idx_push_subscriptions_user', 'user_id');
      await this.ensureIndex(connection, 'push_subscriptions', 'idx_push_subscriptions_enabled', 'enabled');
      await this.ensureIndex(connection, 'native_push_tokens', 'idx_native_push_tokens_user', 'user_id');
      await this.ensureIndex(connection, 'native_push_tokens', 'idx_native_push_tokens_enabled', 'enabled');
      await this.ensureIndex(connection, 'study_planner_tasks', 'idx_study_planner_user_due', 'user_id, due_date');
      await this.ensureIndex(connection, 'study_activity_events', 'idx_study_activity_user_type_created', 'user_id, activity_type, created_at');
      await this.ensureIndex(connection, 'smart_notes', 'idx_smart_notes_user_updated', 'user_id, updated_at');
      await this.ensureIndex(connection, 'ai_illustrated_notes', 'idx_ai_notes_public_status_course', 'is_public, status, course_id, topic_id');
      await this.ensureIndex(connection, 'question_review_items', 'idx_question_review_items_status', 'status');
      await this.ensureIndex(connection, 'lesson_flashcards', 'idx_lesson_flashcards_note_status', 'note_id, status');
      await this.ensureIndex(connection, 'lesson_flashcards', 'idx_lesson_flashcards_lesson_status', 'lesson_id, status');
      await this.ensureIndex(connection, 'content_audit_events', 'idx_content_audit_entity', 'entity_type, entity_id');
      await this.ensureIndex(connection, 'content_versions', 'idx_content_versions_entity', 'entity_type, entity_id');
      await this.backfillPlanSubscriptionColumns(connection);
      await this.seedSubscriptionFeatureCatalog(connection);
      await this.seedDefaultPlans(connection);
      await this.backfillPlanFeatureMaps(connection);
      await this.backfillQuestionKeywordMaps(connection);
      await this.backfillQuizTitles(connection);
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

  private async backfillQuizTitles(connection: PoolConnection) {
    await connection.execute(`
      UPDATE quizzes
      SET
        admin_name = COALESCE(NULLIF(TRIM(admin_name), ''), quiz_title),
        student_title = COALESCE(NULLIF(TRIM(student_title), ''), quiz_title),
        quiz_title = COALESCE(NULLIF(TRIM(student_title), ''), NULLIF(TRIM(quiz_title), ''), NULLIF(TRIM(admin_name), ''))
    `);
    await connection.execute(
      "ALTER TABLE study_bookmarks MODIFY item_type ENUM('quiz', 'ai_note', 'question') NOT NULL"
    ).catch(() => undefined);
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

  private async ensureStudyBookmarksTable(connection: PoolConnection) {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS study_bookmarks (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        item_type ENUM('quiz', 'ai_note') NOT NULL,
        item_id INT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_study_bookmark (user_id, item_type, item_id),
        INDEX idx_study_bookmarks_user (user_id),
        INDEX idx_study_bookmarks_item (item_type, item_id)
      )
    `);
  }

  private async ensureStudyActivityEventsTable(connection: PoolConnection) {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS study_activity_events (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        activity_type VARCHAR(80) NOT NULL,
        item_id INT NULL,
        event_type VARCHAR(80) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_study_activity_user (user_id),
        INDEX idx_study_activity_type (activity_type),
        INDEX idx_study_activity_created (created_at)
      )
    `);
  }

  private async ensureStudyActivityEventTypes(connection: PoolConnection) {
    await connection.execute(
      "ALTER TABLE study_activity_events MODIFY activity_type VARCHAR(80) NOT NULL"
    ).catch(() => undefined);
    await this.ensureColumn(connection, 'study_activity_events', 'event_type', 'VARCHAR(80) NULL AFTER item_id');
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

  private async ensureExamSessionsTable(connection: PoolConnection) {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS exam_sessions (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        quiz_id INT NOT NULL,
        status ENUM('in_progress','submitted','expired') NOT NULL DEFAULT 'in_progress',
        started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deadline_at DATETIME NULL,
        last_question_index INT NOT NULL DEFAULT 0,
        answers_json LONGTEXT NULL,
        flagged_question_ids_json TEXT NULL,
        submitted_attempt_id INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_exam_sessions_user_quiz_status (user_id, quiz_id, status),
        INDEX idx_exam_sessions_deadline (deadline_at)
      )
    `);
  }

  private async ensureLessonAnnotationsTable(connection: PoolConnection) {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS lesson_annotations (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        lesson_id INT NOT NULL,
        user_id INT NOT NULL,
        type ENUM('highlight', 'note') NOT NULL,
        selected_text TEXT NOT NULL,
        start_offset INT NOT NULL,
        end_offset INT NOT NULL,
        color VARCHAR(32) NULL,
        note_text TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_lesson_annotations_lesson_user (lesson_id, user_id),
        INDEX idx_lesson_annotations_user (user_id)
      )
    `);
  }

  private async ensureStudentLessonProgressTable(connection: PoolConnection) {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS student_lesson_progress (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        course_id INT NOT NULL,
        subject_id INT NOT NULL,
        topic_id INT NULL,
        lesson_id INT NOT NULL,
        status ENUM('not_started', 'in_progress', 'completed') NOT NULL DEFAULT 'not_started',
        progress_percent INT NOT NULL DEFAULT 0,
        started_at TIMESTAMP NULL DEFAULT NULL,
        completed_at TIMESTAMP NULL DEFAULT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_student_lesson_progress (user_id, lesson_id),
        INDEX idx_student_lesson_progress_user_course (user_id, course_id),
        INDEX idx_student_lesson_progress_user_subject (user_id, subject_id),
        INDEX idx_student_lesson_progress_user_topic (user_id, topic_id),
        INDEX idx_student_lesson_progress_status (status)
      )
    `);
  }

  private async ensureAnnouncementsTable(connection: PoolConnection) {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS announcements (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(180) NOT NULL,
        body TEXT NOT NULL,
        target_role ENUM('all','student','admin') NOT NULL DEFAULT 'student',
        status ENUM('draft','published','archived') NOT NULL DEFAULT 'published',
        publish_at DATETIME NULL,
        created_by INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_announcements_status_target (status, target_role),
        INDEX idx_announcements_publish_at (publish_at)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS announcement_reads (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        announcement_id INT NOT NULL,
        user_id INT NOT NULL,
        read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_announcement_read (announcement_id, user_id),
        INDEX idx_announcement_reads_user (user_id)
      )
    `);
  }

  private async ensurePushSubscriptionsTable(connection: PoolConnection) {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        endpoint_hash CHAR(64) NOT NULL,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        user_agent VARCHAR(500) NULL,
        delivery_mode ENUM('inside','outside','both') NOT NULL DEFAULT 'outside',
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        last_error VARCHAR(500) NULL,
        failed_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_push_endpoint_hash (endpoint_hash),
        INDEX idx_push_subscriptions_user (user_id),
        INDEX idx_push_subscriptions_enabled (enabled)
      )
    `);
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

  private async ensureContentGovernanceTables(connection: PoolConnection) {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS content_audit_events (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        entity_type VARCHAR(40) NOT NULL,
        entity_id INT NOT NULL,
        action VARCHAR(60) NOT NULL,
        actor_id INT NULL,
        summary VARCHAR(255) NOT NULL,
        before_json JSON NULL,
        after_json JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_content_audit_created (created_at)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS content_versions (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        entity_type VARCHAR(40) NOT NULL,
        entity_id INT NOT NULL,
        version_number INT NOT NULL,
        snapshot_json JSON NOT NULL,
        created_by INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_content_versions_entity_version (entity_type, entity_id, version_number)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS content_workflow_states (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        entity_type VARCHAR(40) NOT NULL,
        entity_id INT NOT NULL,
        workflow_state ENUM('draft','in_review','published','archived') NOT NULL DEFAULT 'draft',
        updated_by INT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_content_workflow_entity (entity_type, entity_id),
        INDEX idx_content_workflow_state (workflow_state)
      )
    `);
  }

  private async ensureAdminAuditEventsTable(connection: PoolConnection) {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS admin_audit_events (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        event_type VARCHAR(80) NOT NULL,
        actor_id INT NULL,
        target_type VARCHAR(80) NULL,
        target_id INT NULL,
        summary VARCHAR(255) NOT NULL,
        metadata_json JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_admin_audit_actor (actor_id),
        INDEX idx_admin_audit_event_type (event_type),
        INDEX idx_admin_audit_created (created_at)
      )
    `);
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

  private async ensureSmartNotesTable(connection: PoolConnection) {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS smart_notes (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL DEFAULT 'Untitled Note',
        raw_text LONGTEXT NULL,
        processed_qa JSON NULL,
        infographic_elements JSON NULL,
        representative_image_data LONGTEXT NULL,
        representative_image_prompt TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_smart_notes_user (user_id)
      )
    `);

    await this.ensureColumn(connection, 'smart_notes', 'representative_image_data', 'LONGTEXT NULL AFTER infographic_elements');
    await this.ensureColumn(connection, 'smart_notes', 'representative_image_prompt', 'TEXT NULL AFTER representative_image_data');
  }

  private async ensureAiIllustratedNotesTable(connection: PoolConnection) {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS ai_illustrated_notes (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL DEFAULT 'Untitled Note',
        raw_text LONGTEXT NULL,
        engine_key VARCHAR(32) NOT NULL DEFAULT 'gemini',
        note_data LONGTEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ai_illustrated_notes_user (user_id)
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

  private async ensureQuestionTheoryRecapsTable(connection: PoolConnection) {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS question_theory_recaps (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        question_id INT NOT NULL,
        concept_name VARCHAR(255) NULL,
        hierarchy_course VARCHAR(255) NULL,
        hierarchy_subject VARCHAR(255) NULL,
        hierarchy_topic VARCHAR(255) NULL,
        hierarchy_lesson VARCHAR(255) NULL,
        etiology JSON NULL,
        pathophysiology JSON NULL,
        clinical_features JSON NULL,
        investigations JSON NULL,
        treatment JSON NULL,
        key_points JSON NULL,
        mnemonic TEXT NULL,
        generated_by ENUM('ai', 'manual') NOT NULL DEFAULT 'ai',
        reviewed_status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_question_theory_recaps_question_id (question_id),
        INDEX idx_question_theory_recaps_reviewed_status (reviewed_status)
      )
    `);
  }

  private async ensureQuestionKeywordsTables(connection: PoolConnection) {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS question_keywords (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        keyword_name VARCHAR(191) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_question_keywords_keyword_name (keyword_name)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS question_keyword_map (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        question_id INT NOT NULL,
        keyword_id INT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_question_keyword_map_question_keyword (question_id, keyword_id),
        INDEX idx_question_keyword_map_question_id (question_id)
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
    for (const plan of DEFAULT_PLAN_BLUEPRINTS) {
      const featureNames = DEFAULT_SUBSCRIPTION_FEATURES
        .filter((feature) => (plan.featureKeys as readonly string[]).includes(feature.featureKey))
        .map((feature) => feature.featureName);

      const [existingRows] = await connection.execute<RowDataPacket[]>(
        'SELECT id FROM plans WHERE slug = ? LIMIT 1',
        [plan.slug]
      );
      if (existingRows[0]) {
        await connection.execute(
          `
            UPDATE plans
            SET
              name = ?,
              description = ?,
              price = ?,
              regular_price = ?,
              offer_price = ?,
              offer_enabled = ?,
              currency = ?,
              billing_period = 'month',
              duration_days = ?,
              features_json = ?,
              status = ?,
              sort_order = ?,
              recommended = ?
            WHERE id = ?
          `,
          [
            plan.name,
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
            Number(existingRows[0].id),
          ]
        );
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

    await this.removeNonDefaultPlans(connection);
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

  private async removeNonDefaultPlans(connection: PoolConnection) {
    const defaultSlugs = DEFAULT_PLAN_BLUEPRINTS.map((plan) => plan.slug);
    const placeholders = sqlPlaceholders(defaultSlugs);

    const [oldPlanRows] = await connection.execute<RowDataPacket[]>(
      `SELECT id FROM plans WHERE slug IS NULL OR slug NOT IN (${placeholders})`,
      defaultSlugs
    );
    const oldPlanIds = oldPlanRows.map((row) => Number(row.id)).filter((id) => id > 0);
    if (oldPlanIds.length === 0) {
      return;
    }

    const oldPlanPlaceholders = sqlPlaceholders(oldPlanIds);
    await connection.execute(
      `DELETE FROM user_subscriptions WHERE plan_id IN (${oldPlanPlaceholders})`,
      oldPlanIds
    );

    await connection.execute(
      `DELETE FROM subscription_plan_features WHERE plan_id IN (${oldPlanPlaceholders})`,
      oldPlanIds
    );
    await connection.execute(
      `DELETE FROM plans WHERE id IN (${oldPlanPlaceholders})`,
      oldPlanIds
    );
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

  private async backfillQuestionKeywordMaps(connection: PoolConnection) {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `
        SELECT id, keywords_text
        FROM questions
        WHERE keywords_text IS NOT NULL AND TRIM(keywords_text) <> ''
      `
    );

    for (const row of rows) {
      const keywords = this.parseKeywordList(String(row.keywords_text || ''));
      if (keywords.length === 0) {
        continue;
      }

      for (const keyword of keywords) {
        await connection.execute(
          'INSERT IGNORE INTO question_keywords (keyword_name) VALUES (?)',
          [keyword]
        );

        const [keywordRows] = await connection.execute<RowDataPacket[]>(
          'SELECT id FROM question_keywords WHERE keyword_name = ? LIMIT 1',
          [keyword]
        );

        if (!keywordRows[0]) {
          continue;
        }

        await connection.execute(
          'INSERT IGNORE INTO question_keyword_map (question_id, keyword_id) VALUES (?, ?)',
          [Number(row.id), Number(keywordRows[0].id)]
        );
      }
    }
  }

  private parseKeywordList(raw: string) {
    return Array.from(
      new Set(
        raw
          .split(',')
          .map((keyword) => keyword.trim())
          .filter(Boolean)
      )
    );
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

  private async ensureColumn(connection: PoolConnection, tableName: string, columnName: string, definition: string) {
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
      return;
    }

    await connection.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    this.logger.log(`Added ${tableName}.${columnName}`);
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
}
