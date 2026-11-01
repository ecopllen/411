import crypto from 'node:crypto';
import { getDb } from '../db/database.js';
import { config } from '../config.js';

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, hash, salt) {
  const computed = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(computed, 'utf8'), Buffer.from(hash, 'utf8'));
}

export function createAdminUser(username, password, displayName = 'Admin Host') {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM admin_users WHERE username = ?').get(username);
  if (existing) {
    throw new Error('Admin username already exists');
  }

  const id = crypto.randomUUID();
  const { hash, salt } = hashPassword(password);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO admin_users (id, username, password_hash, salt, display_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, username, hash, salt, displayName, now);

  return { id, username, displayName };
}

export function upsertAdminUser(username, password, displayName = 'Host Sinh Nhật 🩵') {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM admin_users WHERE username = ?').get(username);
  const { hash, salt } = hashPassword(password);
  const now = new Date().toISOString();

  if (existing) {
    db.prepare(`
      UPDATE admin_users
      SET password_hash = ?, salt = ?, display_name = ?
      WHERE username = ?
    `).run(hash, salt, displayName, username);
    return { id: existing.id, username, displayName };
  } else {
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO admin_users (id, username, password_hash, salt, display_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, username, hash, salt, displayName, now);
    return { id, username, displayName };
  }
}

export function authenticateAdmin(username, password) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
  if (!user) {
    return null;
  }

  const isValid = verifyPassword(password, user.password_hash, user.salt);
  if (!isValid) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name
  };
}

export function createSession(adminId) {
  const db = getDb();
  const id = crypto.randomUUID();
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.sessionMaxAgeHours * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO sessions (id, admin_id, token, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, adminId, token, expiresAt, now.toISOString());

  return { token, expiresAt };
}

export function validateSessionToken(token) {
  if (!token) return null;
  const db = getDb();
  const now = new Date().toISOString();

  const session = db.prepare(`
    SELECT s.id as session_id, s.expires_at, u.id as admin_id, u.username, u.display_name
    FROM sessions s
    JOIN admin_users u ON s.admin_id = u.id
    WHERE s.token = ? AND s.expires_at > ?
  `).get(token, now);

  if (!session) return null;

  return {
    adminId: session.admin_id,
    username: session.username,
    displayName: session.display_name,
    expiresAt: session.expires_at
  };
}

export function destroySession(token) {
  if (!token) return;
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function cleanExpiredSessions() {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
}
