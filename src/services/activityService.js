import crypto from 'node:crypto';
import { getDb } from '../db/database.js';

// ==========================================
// 1. FOOD SERVICE (Category -> Dish -> Restaurant)
// ==========================================

export function getFoodTree(activeOnly = true) {
  const db = getDb();
  const catCondition = activeOnly ? 'WHERE is_active = 1' : '';
  const categories = db.prepare(`SELECT * FROM food_categories ${catCondition} ORDER BY sort_order ASC, name ASC`).all();

  const dishes = db.prepare(`SELECT * FROM dishes ORDER BY sort_order ASC, name ASC`).all();

  const restCondition = activeOnly ? 'WHERE is_active = 1' : '';
  const restaurants = db.prepare(`SELECT * FROM restaurants ${restCondition} ORDER BY sort_order ASC, name ASC`).all();

  // Nest restaurants under dishes, and dishes under categories
  const dishesByCat = {};
  for (const dish of dishes) {
    if (!dishesByCat[dish.food_category_id]) {
      dishesByCat[dish.food_category_id] = [];
    }
    const matchingRest = restaurants.filter(r => r.dish_id === dish.id);
    dishesByCat[dish.food_category_id].push({
      ...dish,
      restaurants: matchingRest
    });
  }

  return categories.map(cat => ({
    ...cat,
    dishes: dishesByCat[cat.id] || []
  }));
}

export function createFoodCategory(data) {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO food_categories (id, name, icon, sort_order, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, data.name, data.icon || '🍜', data.sort_order || 0, data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1, now);
  return { id, ...data };
}

export function updateFoodCategory(id, data) {
  const db = getDb();
  db.prepare(`
    UPDATE food_categories
    SET
      name = COALESCE(?, name),
      icon = COALESCE(?, icon),
      sort_order = COALESCE(?, sort_order),
      is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(
    data.name ?? null,
    data.icon ?? null,
    data.sort_order ?? null,
    data.is_active !== undefined ? (data.is_active ? 1 : 0) : null,
    id
  );
  return db.prepare('SELECT * FROM food_categories WHERE id = ?').get(id);
}

export function deleteFoodCategory(id) {
  const db = getDb();
  db.prepare('DELETE FROM food_categories WHERE id = ?').run(id);
  return { success: true };
}

export function createDish(data) {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO dishes (id, food_category_id, name, description, sort_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, data.food_category_id, data.name, data.description || '', data.sort_order || 0, now);
  return { id, ...data };
}

export function updateDish(id, data) {
  const db = getDb();
  db.prepare(`
    UPDATE dishes
    SET
      food_category_id = COALESCE(?, food_category_id),
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      sort_order = COALESCE(?, sort_order)
    WHERE id = ?
  `).run(data.food_category_id ?? null, data.name ?? null, data.description ?? null, data.sort_order ?? null, id);
  return db.prepare('SELECT * FROM dishes WHERE id = ?').get(id);
}

export function deleteDish(id) {
  const db = getDb();
  db.prepare('DELETE FROM dishes WHERE id = ?').run(id);
  return { success: true };
}

export function createRestaurant(data) {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO restaurants (id, dish_id, name, image_url, address, price_range, description, maps_url, menu_url, personal_note, sort_order, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.dish_id, data.name, data.image_url || '', data.address || '',
    data.price_range || '', data.description || '', data.maps_url || '',
    data.menu_url || '', data.personal_note || '', data.sort_order || 0,
    data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1, now
  );
  return { id, ...data };
}

export function updateRestaurant(id, data) {
  const db = getDb();
  db.prepare(`
    UPDATE restaurants
    SET
      dish_id = COALESCE(?, dish_id),
      name = COALESCE(?, name),
      image_url = COALESCE(?, image_url),
      address = COALESCE(?, address),
      price_range = COALESCE(?, price_range),
      description = COALESCE(?, description),
      maps_url = COALESCE(?, maps_url),
      menu_url = COALESCE(?, menu_url),
      personal_note = COALESCE(?, personal_note),
      sort_order = COALESCE(?, sort_order),
      is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(
    data.dish_id ?? null, data.name ?? null, data.image_url ?? null, data.address ?? null,
    data.price_range ?? null, data.description ?? null, data.maps_url ?? null,
    data.menu_url ?? null, data.personal_note ?? null, data.sort_order ?? null,
    data.is_active !== undefined ? (data.is_active ? 1 : 0) : null, id
  );
  return db.prepare('SELECT * FROM restaurants WHERE id = ?').get(id);
}

export function deleteRestaurant(id) {
  const db = getDb();
  db.prepare('DELETE FROM restaurants WHERE id = ?').run(id);
  return { success: true };
}

// ==========================================
// 2. DRINKS & CAFES (Styles -> Cafes with Many-to-Many links)
// ==========================================

export function getDrinksTree(activeOnly = true) {
  const db = getDb();
  const styleCond = activeOnly ? 'WHERE is_active = 1' : '';
  const styles = db.prepare(`SELECT * FROM drink_styles ${styleCond} ORDER BY sort_order ASC, name ASC`).all();

  const cafeCond = activeOnly ? 'WHERE is_active = 1' : '';
  const cafes = db.prepare(`SELECT * FROM cafes ${cafeCond} ORDER BY sort_order ASC, name ASC`).all();

  const links = db.prepare(`SELECT * FROM cafe_style_links`).all();

  const cafesByStyle = {};
  for (const style of styles) {
    const styleLinks = links.filter(l => l.drink_style_id === style.id).map(l => l.cafe_id);
    cafesByStyle[style.id] = cafes.filter(c => styleLinks.includes(c.id));
  }

  return styles.map(style => ({
    ...style,
    cafes: cafesByStyle[style.id] || []
  }));
}

export function getAllCafes() {
  const db = getDb();
  const cafes = db.prepare('SELECT * FROM cafes ORDER BY sort_order ASC, name ASC').all();
  const links = db.prepare('SELECT * FROM cafe_style_links').all();
  return cafes.map(c => ({
    ...c,
    style_ids: links.filter(l => l.cafe_id === c.id).map(l => l.drink_style_id)
  }));
}

export function createDrinkStyle(data) {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO drink_styles (id, name, icon, sort_order, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, data.name, data.icon || '☕', data.sort_order || 0, data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1, now);
  return { id, ...data };
}

export function updateDrinkStyle(id, data) {
  const db = getDb();
  db.prepare(`
    UPDATE drink_styles
    SET
      name = COALESCE(?, name),
      icon = COALESCE(?, icon),
      sort_order = COALESCE(?, sort_order),
      is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(
    data.name ?? null, data.icon ?? null, data.sort_order ?? null,
    data.is_active !== undefined ? (data.is_active ? 1 : 0) : null, id
  );
  return db.prepare('SELECT * FROM drink_styles WHERE id = ?').get(id);
}

export function deleteDrinkStyle(id) {
  const db = getDb();
  db.prepare('DELETE FROM drink_styles WHERE id = ?').run(id);
  return { success: true };
}

export function createCafe(data) {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO cafes (id, name, image_url, address, price_range, description, maps_url, opening_hours, personal_note, sort_order, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.name, data.image_url || '', data.address || '',
    data.price_range || '', data.description || '', data.maps_url || '',
    data.opening_hours || '', data.personal_note || '', data.sort_order || 0,
    data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1, now
  );

  if (Array.isArray(data.style_ids)) {
    for (const styleId of data.style_ids) {
      db.prepare(`
        INSERT INTO cafe_style_links (id, cafe_id, drink_style_id)
        VALUES (?, ?, ?)
      `).run(crypto.randomUUID(), id, styleId);
    }
  }

  return { id, ...data };
}

export function updateCafe(id, data) {
  const db = getDb();
  db.prepare(`
    UPDATE cafes
    SET
      name = COALESCE(?, name),
      image_url = COALESCE(?, image_url),
      address = COALESCE(?, address),
      price_range = COALESCE(?, price_range),
      description = COALESCE(?, description),
      maps_url = COALESCE(?, maps_url),
      opening_hours = COALESCE(?, opening_hours),
      personal_note = COALESCE(?, personal_note),
      sort_order = COALESCE(?, sort_order),
      is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(
    data.name ?? null, data.image_url ?? null, data.address ?? null,
    data.price_range ?? null, data.description ?? null, data.maps_url ?? null,
    data.opening_hours ?? null, data.personal_note ?? null, data.sort_order ?? null,
    data.is_active !== undefined ? (data.is_active ? 1 : 0) : null, id
  );

  if (Array.isArray(data.style_ids)) {
    db.prepare('DELETE FROM cafe_style_links WHERE cafe_id = ?').run(id);
    for (const styleId of data.style_ids) {
      db.prepare(`
        INSERT INTO cafe_style_links (id, cafe_id, drink_style_id)
        VALUES (?, ?, ?)
      `).run(crypto.randomUUID(), id, styleId);
    }
  }

  return db.prepare('SELECT * FROM cafes WHERE id = ?').get(id);
}

export function deleteCafe(id) {
  const db = getDb();
  db.prepare('DELETE FROM cafes WHERE id = ?').run(id);
  return { success: true };
}

// ==========================================
// 3. WORKSHOPS (Category -> Workshop)
// ==========================================

export function getWorkshopTree(activeOnly = true) {
  const db = getDb();
  const catCond = activeOnly ? 'WHERE is_active = 1' : '';
  const categories = db.prepare(`SELECT * FROM workshop_categories ${catCond} ORDER BY sort_order ASC, name ASC`).all();

  const wsCond = activeOnly ? 'WHERE is_active = 1' : '';
  const workshops = db.prepare(`SELECT * FROM workshops ${wsCond} ORDER BY sort_order ASC, name ASC`).all();

  const wsByCat = {};
  for (const ws of workshops) {
    if (!wsByCat[ws.workshop_category_id]) {
      wsByCat[ws.workshop_category_id] = [];
    }
    wsByCat[ws.workshop_category_id].push(ws);
  }

  return categories.map(cat => ({
    ...cat,
    workshops: wsByCat[cat.id] || []
  }));
}

export function createWorkshopCategory(data) {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO workshop_categories (id, name, icon, sort_order, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, data.name, data.icon || '🎨', data.sort_order || 0, data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1, now);
  return { id, ...data };
}

export function updateWorkshopCategory(id, data) {
  const db = getDb();
  db.prepare(`
    UPDATE workshop_categories
    SET
      name = COALESCE(?, name),
      icon = COALESCE(?, icon),
      sort_order = COALESCE(?, sort_order),
      is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(
    data.name ?? null, data.icon ?? null, data.sort_order ?? null,
    data.is_active !== undefined ? (data.is_active ? 1 : 0) : null, id
  );
  return db.prepare('SELECT * FROM workshop_categories WHERE id = ?').get(id);
}

export function deleteWorkshopCategory(id) {
  const db = getDb();
  db.prepare('DELETE FROM workshop_categories WHERE id = ?').run(id);
  return { success: true };
}

export function createWorkshop(data) {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const bookingUrl = data.booking_url ?? data.tiktok_url ?? data.review_url ?? '';
  db.prepare(`
    INSERT INTO workshops (id, workshop_category_id, name, image_url, venue_name, address, duration, price_per_person, booking_url, booking_notes, available_sessions, sort_order, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.workshop_category_id, data.name, data.image_url || '', data.venue_name || '',
    data.address || '', data.duration || '', data.price_per_person || '',
    bookingUrl, data.booking_notes || '', data.available_sessions || '',
    data.sort_order || 0, data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1, now
  );
  return { id, ...data, booking_url: bookingUrl };
}

export function updateWorkshop(id, data) {
  const db = getDb();
  const bookingUrl = data.booking_url ?? data.tiktok_url ?? data.review_url ?? null;
  db.prepare(`
    UPDATE workshops
    SET
      workshop_category_id = COALESCE(?, workshop_category_id),
      name = COALESCE(?, name),
      image_url = COALESCE(?, image_url),
      venue_name = COALESCE(?, venue_name),
      address = COALESCE(?, address),
      duration = COALESCE(?, duration),
      price_per_person = COALESCE(?, price_per_person),
      booking_url = COALESCE(?, booking_url),
      booking_notes = COALESCE(?, booking_notes),
      available_sessions = COALESCE(?, available_sessions),
      sort_order = COALESCE(?, sort_order),
      is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(
    data.workshop_category_id ?? null, data.name ?? null, data.image_url ?? null,
    data.venue_name ?? null, data.address ?? null, data.duration ?? null,
    data.price_per_person ?? null, bookingUrl, data.booking_notes ?? null,
    data.available_sessions ?? null, data.sort_order ?? null,
    data.is_active !== undefined ? (data.is_active ? 1 : 0) : null, id
  );
  return db.prepare('SELECT * FROM workshops WHERE id = ?').get(id);
}

export function deleteWorkshop(id) {
  const db = getDb();
  db.prepare('DELETE FROM workshops WHERE id = ?').run(id);
  return { success: true };
}

// ==========================================
// 4. PHOTOBOOTHS
// ==========================================

export function getPhotobooths(activeOnly = true) {
  const db = getDb();
  const cond = activeOnly ? 'WHERE is_active = 1' : '';
  return db.prepare(`SELECT * FROM photobooths ${cond} ORDER BY sort_order ASC, name ASC`).all();
}

export function createPhotobooth(data) {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const reviewUrl = data.review_url ?? data.tiktok_url ?? data.booking_url ?? '';
  db.prepare(`
    INSERT INTO photobooths (id, name, image_url, brand_name, address, price, review_url, notes, frame_types, sort_order, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.name, data.image_url || '', data.brand_name || '', data.address || '',
    data.price || '', reviewUrl, data.notes || '', data.frame_types || '',
    data.sort_order || 0, data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1, now
  );
  return { id, ...data, review_url: reviewUrl };
}

export function updatePhotobooth(id, data) {
  const db = getDb();
  const reviewUrl = data.review_url ?? data.tiktok_url ?? data.booking_url ?? null;
  db.prepare(`
    UPDATE photobooths
    SET
      name = COALESCE(?, name),
      image_url = COALESCE(?, image_url),
      brand_name = COALESCE(?, brand_name),
      address = COALESCE(?, address),
      price = COALESCE(?, price),
      review_url = COALESCE(?, review_url),
      notes = COALESCE(?, notes),
      frame_types = COALESCE(?, frame_types),
      sort_order = COALESCE(?, sort_order),
      is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(
    data.name ?? null, data.image_url ?? null, data.brand_name ?? null,
    data.address ?? null, data.price ?? null, reviewUrl,
    data.notes ?? null, data.frame_types ?? null, data.sort_order ?? null,
    data.is_active !== undefined ? (data.is_active ? 1 : 0) : null, id
  );
  return db.prepare('SELECT * FROM photobooths WHERE id = ?').get(id);
}

export function deletePhotobooth(id) {
  const db = getDb();
  db.prepare('DELETE FROM photobooths WHERE id = ?').run(id);
  return { success: true };
}

// ==========================================
// 4B. MOVIES (Backwards-compatibility)
// ==========================================

export function getMovies(activeOnly = true) {
  const db = getDb();
  const cond = activeOnly ? 'WHERE is_active = 1' : '';
  return db.prepare(`SELECT * FROM movies ${cond} ORDER BY sort_order ASC, title ASC`).all();
}

export function createMovie(data) {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO movies (id, title, poster_url, genre, synopsis, duration, preferred_cinema, notes, external_link, sort_order, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.title, data.poster_url || '', data.genre || '', data.synopsis || '',
    data.duration || '', data.preferred_cinema || '', data.notes || '',
    data.external_link || '', data.sort_order || 0,
    data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1, now
  );
  return { id, ...data };
}

export function updateMovie(id, data) {
  const db = getDb();
  db.prepare(`
    UPDATE movies
    SET
      title = COALESCE(?, title),
      poster_url = COALESCE(?, poster_url),
      genre = COALESCE(?, genre),
      synopsis = COALESCE(?, synopsis),
      duration = COALESCE(?, duration),
      preferred_cinema = COALESCE(?, preferred_cinema),
      notes = COALESCE(?, notes),
      external_link = COALESCE(?, external_link),
      sort_order = COALESCE(?, sort_order),
      is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(
    data.title ?? null, data.poster_url ?? null, data.genre ?? null,
    data.synopsis ?? null, data.duration ?? null, data.preferred_cinema ?? null,
    data.notes ?? null, data.external_link ?? null, data.sort_order ?? null,
    data.is_active !== undefined ? (data.is_active ? 1 : 0) : null, id
  );
  return db.prepare('SELECT * FROM movies WHERE id = ?').get(id);
}

export function deleteMovie(id) {
  const db = getDb();
  db.prepare('DELETE FROM movies WHERE id = ?').run(id);
  return { success: true };
}
