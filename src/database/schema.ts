import db from './db';
import { seedResources } from '../data/seed';

export function initializeDatabase(): void {
  // Users table
  db.exec(`
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
  `);

  // Test scores
  db.exec(`
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
  `);

  // Daily study logs
  db.exec(`
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
  `);

  // Study resources
  db.exec(`
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
  `);

  // Scheduled tests
  db.exec(`
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
  `);

  // Placement test answers
  db.exec(`
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
  `);

  // Question Bank
  db.exec(`
    CREATE TABLE IF NOT EXISTS question_bank (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      level TEXT NOT NULL,
      question TEXT NOT NULL,
      question_vi TEXT,
      options TEXT,
      answer TEXT,
      band REAL NOT NULL,
      created_by TEXT DEFAULT 'system',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Seed resources if empty
  const count = db.prepare('SELECT COUNT(*) as cnt FROM resources').get() as any;
  if (count.cnt === 0) {
    seedResources();
  }

  // Seed question bank if empty
  const qCount = db.prepare('SELECT COUNT(*) as cnt FROM question_bank').get() as any;
  if (qCount.cnt === 0) {
    const { seedQuestions } = require('../data/seed');
    seedQuestions();
  }

  console.log('✅ Database initialized successfully');
}
