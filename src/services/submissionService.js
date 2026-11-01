import crypto from 'node:crypto';
import { getDb } from '../db/database.js';
import { validateDateSelection } from './scheduleService.js';
import { getInvitationSettings } from './invitationService.js';

// In-memory idempotency cache for duplicate click protection (cleans after 60 seconds)
const recentSubmissions = new Map();

function cleanOldRecentSubmissions() {
  const now = Date.now();
  for (const [key, timestamp] of recentSubmissions.entries()) {
    if (now - timestamp > 60000) {
      recentSubmissions.delete(key);
    }
  }
}

export function createSubmission(payload, clientIp = '127.0.0.1') {
  cleanOldRecentSubmissions();

  // 1. Validate required participation status for every activity
  const validStatuses = ['selected', 'skipped'];
  const { food_status, drink_status, workshop_status, date_selection, additional_note } = payload;
  const movie_status = payload.photobooth_status || payload.movie_status;
  const movie_selection = payload.photobooth_selection || payload.movie_selection;

  if (!validStatuses.includes(food_status)) {
    throw new Error('Trạng thái lựa chọn món ăn không hợp lệ (cần chọn hoặc bỏ qua).');
  }
  if (!validStatuses.includes(drink_status)) {
    throw new Error('Trạng thái lựa chọn đồ uống không hợp lệ (cần chọn hoặc bỏ qua).');
  }
  if (!validStatuses.includes(workshop_status)) {
    throw new Error('Trạng thái lựa chọn workshop không hợp lệ (cần chọn hoặc bỏ qua).');
  }
  if (!validStatuses.includes(movie_status)) {
    throw new Error('Trạng thái lựa chọn photobooth không hợp lệ (cần chọn hoặc bỏ qua).');
  }

  // If status is 'selected', verify that an item was actually chosen
  if (food_status === 'selected' && (!payload.food_selection || !payload.food_selection.restaurant_name)) {
    throw new Error('Bạn đã chọn tham gia ăn uống nhưng chưa chọn quán ăn.');
  }
  if (drink_status === 'selected' && (!payload.drink_selection || !payload.drink_selection.cafe_name)) {
    throw new Error('Bạn đã chọn đi cafe nhưng chưa chọn quán.');
  }
  if (workshop_status === 'selected' && (!payload.workshop_selection || !payload.workshop_selection.workshop_name)) {
    throw new Error('Bạn đã chọn tham gia workshop nhưng chưa chọn hoạt động.');
  }
  if (movie_status === 'selected' && (!movie_selection || (!movie_selection.name && !movie_selection.photobooth_name && !movie_selection.movie_title))) {
    throw new Error('Bạn đã chọn chụp photobooth nhưng chưa chọn tiệm.');
  }

  // 2. Validate date and time selection
  const settings = getInvitationSettings(true);
  const allowFlexible = settings ? settings.allow_flexible_date : true;
  const dateValidation = validateDateSelection(date_selection, allowFlexible);
  if (!dateValidation.valid) {
    throw new Error(dateValidation.message);
  }

  // 3. Duplicate submission check (idempotency by content hash + client IP within 10s)
  const contentHash = crypto.createHash('sha256').update(
    JSON.stringify({ clientIp, food_status, drink_status, workshop_status, movie_status, date_selection, note: additional_note || '' })
  ).digest('hex');

  const nowMs = Date.now();
  if (recentSubmissions.has(contentHash)) {
    const elapsed = nowMs - recentSubmissions.get(contentHash);
    if (elapsed < 10000) {
      throw new Error('Yêu cầu đang được xử lý hoặc bạn vừa gửi lựa chọn này. Vui lòng không nhấn liên tục.');
    }
  }
  recentSubmissions.set(contentHash, nowMs);

  // 4. Create immutable snapshot
  const db = getDb();
  const id = 'plan_' + crypto.randomBytes(6).toString('hex');
  const nowIso = new Date().toISOString();

  const foodJson = food_status === 'selected' ? JSON.stringify(payload.food_selection) : JSON.stringify({ skipped: true, label: 'Bỏ qua ăn uống' });
  const drinkJson = drink_status === 'selected' ? JSON.stringify(payload.drink_selection) : JSON.stringify({ skipped: true, label: 'Bỏ qua cafe' });
  const workshopJson = workshop_status === 'selected' ? JSON.stringify(payload.workshop_selection) : JSON.stringify({ skipped: true, label: 'Bỏ qua workshop' });
  const movieJson = movie_status === 'selected' ? JSON.stringify(movie_selection) : JSON.stringify({ skipped: true, label: 'Bỏ qua photobooth' });
  const dateJson = JSON.stringify(date_selection);

  db.prepare(`
    INSERT INTO submissions (
      id, invitation_id, status, food_status, drink_status, workshop_status, movie_status,
      food_selection, drink_selection, workshop_selection, movie_selection, date_selection,
      additional_note, client_ip, created_at, updated_at
    ) VALUES (?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    payload.invitation_id || 'default',
    food_status,
    drink_status,
    workshop_status,
    movie_status,
    foodJson,
    drinkJson,
    workshopJson,
    movieJson,
    dateJson,
    additional_note || '',
    clientIp,
    nowIso,
    nowIso
  );

  return getSubmissionById(id);
}

export function getSubmissionById(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM submissions WHERE id = ?').get(id);
  if (!row) return null;

  return parseSubmissionRow(row);
}

export function listSubmissions(filter = {}) {
  const db = getDb();
  let query = 'SELECT * FROM submissions';
  const params = [];
  const clauses = [];

  if (filter.status && filter.status !== 'all') {
    clauses.push('status = ?');
    params.push(filter.status);
  }

  if (filter.search) {
    clauses.push('(id LIKE ? OR additional_note LIKE ? OR food_selection LIKE ? OR drink_selection LIKE ?)');
    const term = `%${filter.search}%`;
    params.push(term, term, term, term);
  }

  if (clauses.length > 0) {
    query += ' WHERE ' + clauses.join(' AND ');
  }

  query += ' ORDER BY created_at DESC';

  const rows = db.prepare(query).all(...params);
  return rows.map(parseSubmissionRow);
}

export function updateSubmissionStatus(id, newStatus) {
  const validStatuses = ['new', 'reviewed', 'confirmed', 'completed'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error('Trạng thái không hợp lệ');
  }

  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE submissions
    SET status = ?, updated_at = ?
    WHERE id = ?
  `).run(newStatus, now, id);

  return getSubmissionById(id);
}

export function deleteSubmission(id) {
  const db = getDb();
  db.prepare('DELETE FROM submissions WHERE id = ?').run(id);
  return { success: true };
}

export function deleteAllSubmissions() {
  const db = getDb();
  db.prepare('DELETE FROM submissions').run();
  return { success: true };
}

export function getSubmissionMetrics() {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) as count FROM submissions').get().count;
  const newCount = db.prepare("SELECT COUNT(*) as count FROM submissions WHERE status = 'new'").get().count;
  const reviewed = db.prepare("SELECT COUNT(*) as count FROM submissions WHERE status = 'reviewed'").get().count;
  const confirmed = db.prepare("SELECT COUNT(*) as count FROM submissions WHERE status = 'confirmed'").get().count;
  const completed = db.prepare("SELECT COUNT(*) as count FROM submissions WHERE status = 'completed'").get().count;

  return { total, new: newCount, reviewed, confirmed, completed };
}

function parseSubmissionRow(row) {
  const parsedMovie = row.movie_selection ? JSON.parse(row.movie_selection) : null;
  return {
    ...row,
    food_selection: row.food_selection ? JSON.parse(row.food_selection) : null,
    drink_selection: row.drink_selection ? JSON.parse(row.drink_selection) : null,
    workshop_selection: row.workshop_selection ? JSON.parse(row.workshop_selection) : null,
    movie_selection: parsedMovie,
    photobooth_selection: parsedMovie,
    photobooth_status: row.movie_status,
    date_selection: row.date_selection ? JSON.parse(row.date_selection) : null,
    formatted_created_at: formatVietnamTime(row.created_at)
  };
}

export function formatVietnamTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function formatSubmissionForSharing(sub) {
  const parts = [];
  parts.push(`✨ KẾ HOẠCH SINH NHẬT: ${sub.id} ✨`);
  parts.push(`⏰ Thời gian gửi: ${sub.formatted_created_at}`);
  parts.push(`📌 Trạng thái: ${sub.status.toUpperCase()}`);
  parts.push('----------------------------------------');

  // Food
  if (sub.food_status === 'skipped') {
    parts.push('🍜 Món ăn: Bỏ qua lần này');
  } else if (sub.food_selection) {
    parts.push(`🍜 Món ăn: ${sub.food_selection.category_name || ''} ➔ ${sub.food_selection.dish_name || ''}`);
    parts.push(`   Quán: ${sub.food_selection.restaurant_name || ''}`);
    if (sub.food_selection.address) parts.push(`   Địa chỉ: ${sub.food_selection.address}`);
    if (sub.food_selection.maps_url) parts.push(`   Maps: ${sub.food_selection.maps_url}`);
  }

  // Drinks
  if (sub.drink_status === 'skipped') {
    parts.push('☕ Cafe/Đồ uống: Bỏ qua lần này');
  } else if (sub.drink_selection) {
    parts.push(`☕ Cafe: ${sub.drink_selection.style_name || ''} ➔ ${sub.drink_selection.cafe_name || ''}`);
    if (sub.drink_selection.address) parts.push(`   Địa chỉ: ${sub.drink_selection.address}`);
    if (sub.drink_selection.maps_url) parts.push(`   Maps: ${sub.drink_selection.maps_url}`);
  }

  // Workshop
  if (sub.workshop_status === 'skipped') {
    parts.push('🎨 Workshop: Bỏ qua lần này');
  } else if (sub.workshop_selection) {
    parts.push(`🎨 Workshop: ${sub.workshop_selection.category_name || ''} ➔ ${sub.workshop_selection.workshop_name || ''}`);
    if (sub.workshop_selection.venue_name) parts.push(`   Địa điểm: ${sub.workshop_selection.venue_name}`);
    if (sub.workshop_selection.address) parts.push(`   Địa chỉ: ${sub.workshop_selection.address}`);
    if (sub.workshop_selection.duration) parts.push(`   Thời lượng: ${sub.workshop_selection.duration}`);
  }

  // Photobooth
  const pb = sub.photobooth_selection || sub.movie_selection;
  if (sub.photobooth_status === 'skipped' || sub.movie_status === 'skipped') {
    parts.push('📸 Photobooth: Bỏ qua lần này');
  } else if (pb) {
    const pbTitle = pb.name || pb.photobooth_name || pb.movie_title || '';
    parts.push(`📸 Photobooth: ${pbTitle}`);
    if (pb.brand_name) parts.push(`   Tiệm: ${pb.brand_name}`);
    if (pb.address) parts.push(`   Địa chỉ: ${pb.address}`);
    if (pb.price) parts.push(`   Giá: ${pb.price}`);
  }

  // Date and Time
  parts.push('----------------------------------------');
  if (sub.date_selection) {
    if (sub.date_selection.is_flexible) {
      parts.push('🗓️ Thời gian: Linh hoạt theo sắp xếp của bạn!');
    } else {
      parts.push(`🗓️ Ngày chọn: ${sub.date_selection.display_label || sub.date_selection.date_str || ''}`);
      if (sub.date_selection.slot_time) {
        parts.push(`🕒 Khung giờ: ${sub.date_selection.slot_time} (${sub.date_selection.period_label || ''})`);
      }
    }
  }

  if (sub.additional_note) {
    parts.push(`💬 Lời nhắn thêm: "${sub.additional_note}"`);
  }

  return parts.join('\n');
}

export function exportSubmissionsToCSV(submissions) {
  // UTF-8 BOM so Excel opens Vietnamese characters without broken accents
  const BOM = '\uFEFF';
  const headers = [
    'Mã đơn',
    'Thời gian tạo (VN)',
    'Trạng thái',
    'Ăn uống',
    'Chi tiết ăn uống',
    'Cafe',
    'Chi tiết cafe',
    'Workshop',
    'Chi tiết workshop',
    'Photobooth',
    'Chi tiết photobooth',
    'Ngày mong muốn',
    'Khung giờ',
    'Lời nhắn thêm'
  ];

  const rows = submissions.map(s => {
    const foodDetail = s.food_status === 'selected' && s.food_selection
      ? `${s.food_selection.restaurant_name} (${s.food_selection.dish_name})`
      : 'Bỏ qua';
    const drinkDetail = s.drink_status === 'selected' && s.drink_selection
      ? `${s.drink_selection.cafe_name} (${s.drink_selection.style_name})`
      : 'Bỏ qua';
    const wsDetail = s.workshop_status === 'selected' && s.workshop_selection
      ? `${s.workshop_selection.workshop_name} (${s.workshop_selection.category_name})`
      : 'Bỏ qua';
    const pb = s.photobooth_selection || s.movie_selection;
    const movieDetail = (s.photobooth_status === 'selected' || s.movie_status === 'selected') && pb
      ? (pb.name || pb.photobooth_name || pb.movie_title || 'Đã chọn')
      : 'Bỏ qua';
    const dateDetail = s.date_selection?.is_flexible
      ? 'Thời gian linh hoạt'
      : (s.date_selection?.display_label || s.date_selection?.date_str || '');
    const slotDetail = s.date_selection?.slot_time ? `${s.date_selection.slot_time} (${s.date_selection.period_label})` : '';

    return [
      s.id,
      s.formatted_created_at,
      s.status,
      s.food_status,
      foodDetail,
      s.drink_status,
      drinkDetail,
      s.workshop_status,
      wsDetail,
      s.movie_status,
      movieDetail,
      dateDetail,
      slotDetail,
      (s.additional_note || '').replace(/"/g, '""')
    ].map(val => `"${val}"`).join(',');
  });

  return BOM + [headers.join(','), ...rows].join('\r\n');
}
