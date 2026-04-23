import db from './db';
import { seedResources } from '../data/seed';
import { logger } from '../utils/logger';

const migrations = [
  // Version 1: Initial schema
  `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT UNIQUE NOT NULL,
      username TEXT,
      full_name TEXT,
      target_score REAL DEFAULT 7.0,
      target_date TEXT,
      current_phase INTEGER DEFAULT 1,
      estimated_band REAL,
      language TEXT DEFAULT 'vi',
      notion_connected BOOLEAN DEFAULT FALSE,
      google_tokens TEXT,
      google_connected BOOLEAN DEFAULT FALSE,
      daily_reminder_time TEXT DEFAULT '08:00',
      reminder_enabled BOOLEAN DEFAULT TRUE,
      study_streak INTEGER DEFAULT 0,
      last_study_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS test_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      test_date TEXT NOT NULL,
      test_type TEXT NOT NULL DEFAULT 'practice',
      listening REAL,
      reading REAL,
      writing REAL,
      speaking REAL,
      overall REAL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS study_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      log_date TEXT NOT NULL,
      skill TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      activity TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skill TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'website',
      name TEXT NOT NULL,
      url TEXT,
      description TEXT,
      description_vi TEXT,
      difficulty TEXT DEFAULT 'intermediate',
      is_free BOOLEAN DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS scheduled_tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      test_date TEXT NOT NULL,
      test_type TEXT DEFAULT 'monthly',
      notion_page_id TEXT,
      google_event_id TEXT,
      status TEXT DEFAULT 'scheduled',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS placement_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      test_date TEXT NOT NULL,
      total_questions INTEGER NOT NULL,
      correct_answers INTEGER NOT NULL,
      estimated_band REAL NOT NULL,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS question_bank (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      level TEXT NOT NULL,
      question TEXT NOT NULL,
      question_vi TEXT,
      options TEXT,
      answer TEXT,
      band REAL NOT NULL,
      explanation TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS learned_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL, 
      word TEXT NOT NULL,
      meaning TEXT,
      example TEXT,
      learned_date TEXT NOT NULL,
      review_count INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `,
  // Version 2: SRS + Writing Practice
  `
    ALTER TABLE learned_items ADD COLUMN next_review_date TEXT;
    ALTER TABLE learned_items ADD COLUMN mastery_level INTEGER DEFAULT 0;

    CREATE TABLE IF NOT EXISTS writing_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      task_type TEXT NOT NULL DEFAULT 'task2',
      topic TEXT NOT NULL,
      essay TEXT NOT NULL,
      band_score REAL,
      feedback TEXT,
      ta_score REAL,
      cc_score REAL,
      lr_score REAL,
      gra_score REAL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `
];

export function initializeDatabase(): void {
  try {
    const { user_version } = db.pragma('user_version', { simple: true }) as any;
    let currentVersion = user_version || 0;

    logger.info(`Current database version: ${currentVersion}`);

    for (let i = currentVersion; i < migrations.length; i++) {
      const runMigration = db.transaction(() => {
        db.exec(migrations[i]);
        db.pragma(`user_version = ${i + 1}`);
      });

      runMigration();
      currentVersion = i + 1;
      logger.info(`Successfully migrated database to version ${currentVersion}`);
    }

    // Seed resources if empty
    const count = db.prepare('SELECT COUNT(*) as cnt FROM resources').get() as any;
    if (count.cnt === 0) {
      seedResources();
      logger.info('Seeded resources successfully');
    }

    // Always refresh question bank to pick up data fixes
    const { seedQuestions } = require('../data/seed');
    db.prepare('DELETE FROM question_bank').run();
    seedQuestions();
    logger.info('Refreshed question bank successfully');

    logger.info('✅ Database initialized successfully');
  } catch (error) {
    logger.error('❌ Database migration failed:', error);
    // Exit process if DB migration fails to prevent data corruption
    process.exit(1);
  }
}
