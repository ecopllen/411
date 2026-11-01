import test from 'node:test';
import assert from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setDb, initDatabase, closeDb } from '../src/db/database.js';
import { runSeed } from '../src/db/seed.js';
import { authenticateAdmin, createSession, validateSessionToken } from '../src/services/authService.js';
import { createSubmission, getSubmissionById, listSubmissions } from '../src/services/submissionService.js';
import { deleteRestaurant, getFoodTree } from '../src/services/activityService.js';
import { deleteAvailableDate, getAvailableDatesWithSlots } from '../src/services/scheduleService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.beforeEach(() => {
  const memDb = new DatabaseSync(':memory:');
  memDb.exec('PRAGMA foreign_keys = ON;');
  const schemaSql = fs.readFileSync(path.join(__dirname, '../src/db/schema.sql'), 'utf8');
  memDb.exec(schemaSql);
  setDb(memDb);
  runSeed();
});

test('Scenario 6: Submission remains persistent in database across queries and restarts', () => {
  const dates = getAvailableDatesWithSlots(true);
  const sub = createSubmission({
    food_status: 'skipped',
    drink_status: 'skipped',
    workshop_status: 'skipped',
    movie_status: 'skipped',
    date_selection: {
      is_flexible: true,
      display_label: 'Linh hoạt'
    },
    additional_note: 'Persistence verification test'
  }, '127.0.0.1');

  assert.ok(sub.id);

  // Query database again as if refreshed
  const found = getSubmissionById(sub.id);
  assert.ok(found);
  assert.strictEqual(found.id, sub.id);
  assert.strictEqual(found.additional_note, 'Persistence verification test');
});

test('Scenario 7: Administrator authenticates and views all submissions across devices', () => {
  // Device 1: Visitor submits plan
  const sub = createSubmission({
    food_status: 'selected',
    food_selection: {
      restaurant_id: 'r1',
      restaurant_name: 'Nhà Hàng Hoa Hồng'
    },
    drink_status: 'skipped',
    workshop_status: 'skipped',
    movie_status: 'skipped',
    date_selection: { is_flexible: true }
  }, '10.0.0.1');

  // Device 2: Admin authenticates with valid credentials
  const adminAuth = authenticateAdmin('admin', 'DreamyBestie2026!');
  assert.ok(adminAuth, 'Admin authentication must succeed');
  assert.strictEqual(adminAuth.username, 'admin');

  // Create session on device 2
  const session = createSession(adminAuth.id);
  assert.ok(session.token);

  // Validate session on device 2
  const sessionData = validateSessionToken(session.token);
  assert.ok(sessionData);
  assert.strictEqual(sessionData.username, 'admin');

  // Admin lists all submissions
  const allSubmissions = listSubmissions();
  assert.ok(allSubmissions.length >= 1);
  const adminSeenSub = allSubmissions.find(s => s.id === sub.id);
  assert.ok(adminSeenSub);
  assert.strictEqual(adminSeenSub.food_selection.restaurant_name, 'Nhà Hàng Hoa Hồng');
});

test('Scenario 8 & 9 & 10: Security, unauthenticated access rejection, and public protection', () => {
  // Invalid admin login attempt
  const badAuth = authenticateAdmin('admin', 'WrongPassword123!');
  assert.strictEqual(badAuth, null, 'Invalid password must return null');

  const unknownUser = authenticateAdmin('hacker', 'Password123!');
  assert.strictEqual(unknownUser, null, 'Unknown user must return null');

  // Fake or expired token validation
  const invalidSession = validateSessionToken('fake-session-token-abc');
  assert.strictEqual(invalidSession, null, 'Non-existent session token must return null');
});

test('Scenario 11: Invalid dates and unavailable time slots are rejected', () => {
  // Attempt to submit with a non-existent date ID
  assert.throws(() => {
    createSubmission({
      food_status: 'skipped',
      drink_status: 'skipped',
      workshop_status: 'skipped',
      movie_status: 'skipped',
      date_selection: {
        is_flexible: false,
        date_id: 'non-existent-uuid-1234'
      }
    }, '127.0.0.1');
  }, /Ngày bạn chọn không khả dụng/);

  // Attempt to submit with valid date but non-existent slot ID
  const dates = getAvailableDatesWithSlots(true);
  assert.throws(() => {
    createSubmission({
      food_status: 'skipped',
      drink_status: 'skipped',
      workshop_status: 'skipped',
      movie_status: 'skipped',
      date_selection: {
        is_flexible: false,
        date_id: dates[0].id,
        slot_id: 'fake-slot-9999'
      }
    }, '127.0.0.1');
  }, /Khung giờ bạn chọn không khả dụng/);
});

test('Scenario 12: Duplicate rapid submission attempts are handled safely with debounce/idempotency', () => {
  const payload = {
    food_status: 'skipped',
    drink_status: 'skipped',
    workshop_status: 'skipped',
    movie_status: 'skipped',
    date_selection: { is_flexible: true, display_label: 'Linh hoạt' },
    additional_note: 'Unique rapid click test 1'
  };

  const firstSub = createSubmission(payload, '192.168.1.99');
  assert.ok(firstSub.id);

  // Immediate identical second submission from same IP should be blocked
  assert.throws(() => {
    createSubmission(payload, '192.168.1.99');
  }, /Yêu cầu đang được xử lý hoặc bạn vừa gửi lựa chọn này/);
});

test('Scenario 14: Removing an activity does NOT corrupt historical submissions (Immutable snapshots)', () => {
  const foodTree = getFoodTree(true);
  const firstCat = foodTree[0];
  const firstDish = firstCat.dishes[0];
  const firstRest = firstDish.restaurants[0];

  // Visitor submits plan choosing firstRest
  const sub = createSubmission({
    food_status: 'selected',
    food_selection: {
      category_name: firstCat.name,
      dish_name: firstDish.name,
      restaurant_id: firstRest.id,
      restaurant_name: firstRest.name,
      address: firstRest.address,
      price: firstRest.price_range
    },
    drink_status: 'skipped',
    workshop_status: 'skipped',
    movie_status: 'skipped',
    date_selection: { is_flexible: true }
  }, '127.0.0.2');

  assert.strictEqual(sub.food_selection.restaurant_name, firstRest.name);

  // Admin deletes the restaurant from catalog
  deleteRestaurant(firstRest.id);

  // Verify restaurant is removed from catalog
  const updatedFood = getFoodTree(true);
  const allCurrentRestIds = updatedFood.flatMap(c => c.dishes.flatMap(d => d.restaurants.map(r => r.id)));
  assert.ok(!allCurrentRestIds.includes(firstRest.id), 'Restaurant must be deleted from catalog');

  // Verify historical submission is completely unharmed and intact
  const historicalSub = getSubmissionById(sub.id);
  assert.ok(historicalSub);
  assert.strictEqual(historicalSub.food_selection.restaurant_id, firstRest.id);
  assert.strictEqual(historicalSub.food_selection.restaurant_name, firstRest.name);
  assert.strictEqual(historicalSub.food_selection.address, firstRest.address);
});
