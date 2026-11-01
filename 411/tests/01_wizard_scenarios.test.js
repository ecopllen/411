import test from 'node:test';
import assert from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setDb } from '../src/db/database.js';
import { runSeed } from '../src/db/seed.js';
import { createSubmission, getSubmissionById } from '../src/services/submissionService.js';
import { getAvailableDatesWithSlots } from '../src/services/scheduleService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.beforeEach(() => {
  // Use in-memory SQLite for isolated test runs
  const memDb = new DatabaseSync(':memory:');
  memDb.exec('PRAGMA foreign_keys = ON;');
  const schemaSql = fs.readFileSync(path.join(__dirname, '../src/db/schema.sql'), 'utf8');
  memDb.exec(schemaSql);
  setDb(memDb);
  runSeed();
});

test('Scenario 1: Visitor selects all four activity categories', () => {
  const dates = getAvailableDatesWithSlots(true);
  assert.ok(dates.length > 0, 'Dates must be configured');
  const targetDate = dates[0];
  const targetSlot = targetDate.slots[0];

  const payload = {
    food_status: 'selected',
    food_selection: {
      category_name: 'Món Nước Ấm Bụng',
      dish_name: 'Mì Cay Hàn Quốc Sasin',
      restaurant_id: 'rest-1',
      restaurant_name: 'Mì Cay Sasin Chi Nhánh Q1',
      address: '122 Nguyễn Thị Minh Khai',
      price: '60.000đ'
    },
    drink_status: 'selected',
    drink_selection: {
      style_name: 'Cafe Phong Cách Hàn Quốc',
      cafe_id: 'cafe-1',
      cafe_name: 'Tiệm Cà Phê Mùa Hè',
      address: '115 Hai Bà Trưng, Q1'
    },
    workshop_status: 'selected',
    workshop_selection: {
      category_name: 'Làm Nến Thơm',
      workshop_id: 'ws-1',
      workshop_name: 'Workshop Pha Nến Tinh Dầu',
      venue_name: 'Aroma Studio'
    },
    movie_status: 'selected',
    movie_selection: {
      movie_id: 'mov-1',
      movie_title: 'Hàng Xóm Của Tôi Là Totoro',
      preferred_cinema: 'CGV Thảo Điền'
    },
    date_selection: {
      is_flexible: false,
      date_id: targetDate.id,
      date_str: targetDate.date_str,
      display_label: targetDate.display_label,
      slot_id: targetSlot.id,
      slot_time: targetSlot.slot_time,
      period_label: targetSlot.period_label
    },
    additional_note: 'Tụi mình đón nhau lúc 2h nhé!'
  };

  const submission = createSubmission(payload, '192.168.1.10');
  assert.ok(submission.id, 'Submission should have an ID');
  assert.strictEqual(submission.status, 'new');
  assert.strictEqual(submission.food_status, 'selected');
  assert.strictEqual(submission.drink_status, 'selected');
  assert.strictEqual(submission.workshop_status, 'selected');
  assert.strictEqual(submission.movie_status, 'selected');
  assert.strictEqual(submission.food_selection.restaurant_name, 'Mì Cay Sasin Chi Nhánh Q1');
  assert.strictEqual(submission.drink_selection.cafe_name, 'Tiệm Cà Phê Mùa Hè');
  assert.strictEqual(submission.workshop_selection.workshop_name, 'Workshop Pha Nến Tinh Dầu');
  assert.strictEqual(submission.movie_selection.movie_title, 'Hàng Xóm Của Tôi Là Totoro');
  assert.strictEqual(submission.additional_note, 'Tụi mình đón nhau lúc 2h nhé!');
});

test('Scenario 2: Visitor skips all four activity categories', () => {
  const payload = {
    food_status: 'skipped',
    food_selection: null,
    drink_status: 'skipped',
    drink_selection: null,
    workshop_status: 'skipped',
    workshop_selection: null,
    movie_status: 'skipped',
    movie_selection: null,
    date_selection: {
      is_flexible: true,
      display_label: 'Thời gian linh hoạt theo cậu'
    },
    additional_note: 'Hôm đó chỉ cần đi dạo phố ngắm hoàng hôn thôi cũng vui rồi!'
  };

  const submission = createSubmission(payload, '192.168.1.11');
  assert.ok(submission.id);
  assert.strictEqual(submission.food_status, 'skipped');
  assert.strictEqual(submission.drink_status, 'skipped');
  assert.strictEqual(submission.workshop_status, 'skipped');
  assert.strictEqual(submission.movie_status, 'skipped');
  assert.strictEqual(submission.food_selection.skipped, true);
  assert.strictEqual(submission.drink_selection.skipped, true);
  assert.strictEqual(submission.workshop_selection.skipped, true);
  assert.strictEqual(submission.movie_selection.skipped, true);
  assert.strictEqual(submission.date_selection.is_flexible, true);
});

test('Scenario 3: Visitor selects food and drinks but skips workshop and movie', () => {
  const dates = getAvailableDatesWithSlots(true);
  const targetDate = dates[0];

  const payload = {
    food_status: 'selected',
    food_selection: {
      category_name: 'Lẩu & Nướng Vui Vẻ',
      dish_name: 'Lẩu Haidilao',
      restaurant_id: 'rest-hdl',
      restaurant_name: 'Haidilao Vincom Đồng Khởi'
    },
    drink_status: 'selected',
    drink_selection: {
      style_name: 'Cafe Sân Vườn',
      cafe_id: 'cafe-gio',
      cafe_name: 'Nhà Của Gió Garden Lounge'
    },
    workshop_status: 'skipped',
    workshop_selection: null,
    movie_status: 'skipped',
    movie_selection: null,
    date_selection: {
      is_flexible: false,
      date_id: targetDate.id,
      date_str: targetDate.date_str,
      display_label: targetDate.display_label
    },
    additional_note: 'Ăn no rồi đi cafe tâm sự'
  };

  const submission = createSubmission(payload, '192.168.1.12');
  assert.strictEqual(submission.food_status, 'selected');
  assert.strictEqual(submission.drink_status, 'selected');
  assert.strictEqual(submission.workshop_status, 'skipped');
  assert.strictEqual(submission.movie_status, 'skipped');
  assert.strictEqual(submission.food_selection.restaurant_name, 'Haidilao Vincom Đồng Khởi');
  assert.strictEqual(submission.drink_selection.cafe_name, 'Nhà Của Gió Garden Lounge');
  assert.strictEqual(submission.workshop_selection.skipped, true);
  assert.strictEqual(submission.movie_selection.skipped, true);
});

test('Scenario 4 & 5: Visitor navigates backward, changes answer and submits valid plan', () => {
  // Visitor initially drafted food option A
  const draft = {
    food_status: 'selected',
    food_selection: {
      restaurant_id: 'rest-A',
      restaurant_name: 'Quán A'
    },
    drink_status: 'selected',
    drink_selection: {
      cafe_id: 'cafe-A',
      cafe_name: 'Cafe A'
    }
  };

  // Visitor navigates backward and updates food selection to Quán B
  draft.food_selection = {
    restaurant_id: 'rest-B',
    restaurant_name: 'Quán B Mì Ý Sốt Cua'
  };

  // Completes rest of the steps
  draft.workshop_status = 'skipped';
  draft.movie_status = 'skipped';
  draft.date_selection = {
    is_flexible: true,
    display_label: 'Linh hoạt'
  };
  draft.additional_note = 'Đổi quán rồi nha';

  const sub = createSubmission(draft, '192.168.1.13');
  assert.strictEqual(sub.food_selection.restaurant_name, 'Quán B Mì Ý Sốt Cua');
  assert.strictEqual(sub.additional_note, 'Đổi quán rồi nha');

  // Verify retrieval
  const retrieved = getSubmissionById(sub.id);
  assert.deepStrictEqual(retrieved.food_selection, sub.food_selection);
});
