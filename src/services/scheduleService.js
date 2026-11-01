import crypto from 'node:crypto';
import { getDb } from '../db/database.js';

export function getAvailableDatesWithSlots(activeOnly = true) {
  const db = getDb();
  const dateCond = activeOnly ? 'WHERE is_available = 1' : '';
  const dates = db.prepare(`SELECT * FROM available_dates ${dateCond} ORDER BY date_str ASC, sort_order ASC`).all();

  const slotCond = activeOnly ? 'WHERE is_available = 1' : '';
  const slots = db.prepare(`SELECT * FROM time_slots ${slotCond} ORDER BY sort_order ASC, slot_time ASC`).all();

  const slotsByDate = {};
  for (const slot of slots) {
    if (!slotsByDate[slot.date_id]) {
      slotsByDate[slot.date_id] = [];
    }
    slotsByDate[slot.date_id].push(slot);
  }

  return dates.map(d => ({
    ...d,
    slots: slotsByDate[d.id] || []
  }));
}

export function createAvailableDate(data) {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO available_dates (id, date_str, display_label, is_available, sort_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    id, data.date_str, data.display_label || data.date_str,
    data.is_available !== undefined ? (data.is_available ? 1 : 0) : 1,
    data.sort_order || 0, now
  );

  // If time slots are provided as array of { slot_time, period_label }
  if (Array.isArray(data.slots)) {
    for (const slot of data.slots) {
      createTimeSlot({
        date_id: id,
        slot_time: slot.slot_time,
        period_label: slot.period_label || 'Buổi sáng',
        is_available: slot.is_available !== undefined ? slot.is_available : 1,
        sort_order: slot.sort_order || 0
      });
    }
  }

  return { id, ...data };
}

export function updateAvailableDate(id, data) {
  const db = getDb();
  db.prepare(`
    UPDATE available_dates
    SET
      date_str = COALESCE(?, date_str),
      display_label = COALESCE(?, display_label),
      is_available = COALESCE(?, is_available),
      sort_order = COALESCE(?, sort_order)
    WHERE id = ?
  `).run(
    data.date_str ?? null, data.display_label ?? null,
    data.is_available !== undefined ? (data.is_available ? 1 : 0) : null,
    data.sort_order ?? null, id
  );
  return db.prepare('SELECT * FROM available_dates WHERE id = ?').get(id);
}

export function deleteAvailableDate(id) {
  const db = getDb();
  db.prepare('DELETE FROM available_dates WHERE id = ?').run(id);
  return { success: true };
}

export function createTimeSlot(data) {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO time_slots (id, date_id, slot_time, period_label, is_available, sort_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.date_id, data.slot_time, data.period_label || 'Buổi chiều',
    data.is_available !== undefined ? (data.is_available ? 1 : 0) : 1,
    data.sort_order || 0, now
  );
  return { id, ...data };
}

export function updateTimeSlot(id, data) {
  const db = getDb();
  db.prepare(`
    UPDATE time_slots
    SET
      slot_time = COALESCE(?, slot_time),
      period_label = COALESCE(?, period_label),
      is_available = COALESCE(?, is_available),
      sort_order = COALESCE(?, sort_order)
    WHERE id = ?
  `).run(
    data.slot_time ?? null, data.period_label ?? null,
    data.is_available !== undefined ? (data.is_available ? 1 : 0) : null,
    data.sort_order ?? null, id
  );
  return db.prepare('SELECT * FROM time_slots WHERE id = ?').get(id);
}

export function deleteTimeSlot(id) {
  const db = getDb();
  db.prepare('DELETE FROM time_slots WHERE id = ?').run(id);
  return { success: true };
}

export function validateDateSelection(dateSelection, allowFlexible = true) {
  if (!dateSelection) {
    return { valid: false, message: 'Vui lòng chọn thời gian hoặc đánh dấu linh hoạt.' };
  }

  if (dateSelection.is_flexible) {
    if (!allowFlexible) {
      return { valid: false, message: 'Tùy chọn thời gian linh hoạt hiện không được bật.' };
    }
    return { valid: true };
  }

  if (!dateSelection.date_id) {
    return { valid: false, message: 'Vui lòng chọn ngày đi chơi.' };
  }

  const db = getDb();
  const dateRecord = db.prepare('SELECT * FROM available_dates WHERE id = ? AND is_available = 1').get(dateSelection.date_id);
  if (!dateRecord) {
    return { valid: false, message: 'Ngày bạn chọn không khả dụng hoặc đã bị thay đổi.' };
  }

  if (dateSelection.slot_id) {
    const slotRecord = db.prepare('SELECT * FROM time_slots WHERE id = ? AND date_id = ? AND is_available = 1').get(
      dateSelection.slot_id,
      dateSelection.date_id
    );
    if (!slotRecord) {
      return { valid: false, message: 'Khung giờ bạn chọn không khả dụng cho ngày này.' };
    }
  }

  return { valid: true };
}
