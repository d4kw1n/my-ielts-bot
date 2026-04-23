import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config';

// Ensure data directory exists
const dataDir = path.dirname(config.dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(config.dbPath);

// Set journal mode to DELETE to disable WAL and fix Windows bind mount errors
db.pragma('journal_mode = DELETE');
db.pragma('foreign_keys = ON');

export default db;
