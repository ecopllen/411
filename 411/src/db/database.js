import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let instance = null;

export function initDatabase(dbPath = config.dbPath) {
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');

  // Run schema
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);

  // Auto-migrate schema updates for existing databases
  try {
    const cols = db.prepare('PRAGMA table_info(invitation_settings)').all().map(c => c.name);
    if (!cols.includes('letter_badge')) {
      db.exec("ALTER TABLE invitation_settings ADD COLUMN letter_badge TEXT DEFAULT 'Bảng Kế Hoạch Triển Khai 💌';");
    }
    if (!cols.includes('cta_button_text')) {
      db.exec("ALTER TABLE invitation_settings ADD COLUMN cta_button_text TEXT DEFAULT 'Khám phá chuỗi dự án';");
    }
    if (!cols.includes('teaser_cards_json')) {
      db.exec("ALTER TABLE invitation_settings ADD COLUMN teaser_cards_json TEXT;");
    }
    if (!cols.includes('step_titles_json')) {
      db.exec("ALTER TABLE invitation_settings ADD COLUMN step_titles_json TEXT;");
    }
  } catch (err) {
    // ignore if table not yet created or columns already exist
  }

  return db;
}

export function getDb() {
  if (!instance) {
    instance = initDatabase();
  }
  return instance;
}

export function setDb(db) {
  instance = db;
}

export function closeDb() {
  if (instance) {
    try {
      instance.close();
    } catch {
      // ignore if already closed
    }
    instance = null;
  }
}
