import { initDatabase, getDb, closeDb } from './database.js';
import { createAdminUser, upsertAdminUser } from '../services/authService.js';
import { config } from '../config.js';

export function runCreateAdmin() {
  initDatabase();
  const db = getDb();

  // Always ensure 'kieutram' user exists with updated credentials
  upsertAdminUser('kieutram', '123456789', 'Kiều Trâm 🩵');
  console.log(`Admin user 'kieutram' verified/updated.`);

  // Maintain test admin if configured differently or keep 'admin' for automated test suites
  const existingAdmin = db.prepare('SELECT id FROM admin_users WHERE username = ?').get('admin');
  if (!existingAdmin) {
    upsertAdminUser('admin', 'DreamyBestie2026!', 'Host Sinh Nhật 🩵');
    console.log(`Admin user 'admin' created for test compatibility.`);
  }

  const primary = db.prepare('SELECT * FROM admin_users WHERE username = ?').get('kieutram');
  return primary;
}

if (process.argv[1]?.endsWith('create_admin.js')) {
  try {
    runCreateAdmin();
  } catch (err) {
    console.error('Error creating admin:', err.message);
  } finally {
    closeDb();
  }
}
