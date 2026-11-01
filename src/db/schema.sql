-- ====================================================================
-- LOCAL SQLITE DATABASE SCHEMA (Node 24 Native node:sqlite Engine)
-- Dreamy Ocean Birthday Date Planner (November 4, 2026 / Dự Án 411)
-- ====================================================================

PRAGMA foreign_keys = ON;

-- 1. ADMIN USERS
CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    display_name TEXT,
    created_at TEXT NOT NULL
);

-- 2. SESSIONS (Secure token storage)
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE
);

-- 3. INVITATION SETTINGS
CREATE TABLE IF NOT EXISTS invitation_settings (
    id TEXT PRIMARY KEY,
    invitation_slug TEXT UNIQUE NOT NULL,
    is_published INTEGER NOT NULL DEFAULT 1,
    birthday_date TEXT NOT NULL DEFAULT '04.11.2026',
    recipient_name TEXT NOT NULL DEFAULT 'Cậu',
    hero_title TEXT NOT NULL DEFAULT 'A Little Birthday Adventure',
    hero_subtitle TEXT NOT NULL DEFAULT 'Bảng kế hoạch triển khai dự án 411',
    letter_badge TEXT DEFAULT 'Bảng Kế Hoạch Triển Khai 💌',
    personal_message TEXT,
    cta_button_text TEXT DEFAULT 'Khám phá chuỗi dự án',
    teaser_cards_json TEXT,
    step_titles_json TEXT,
    allow_flexible_date INTEGER NOT NULL DEFAULT 1,
    max_preferred_dates INTEGER NOT NULL DEFAULT 2,
    updated_at TEXT NOT NULL
);

-- 4. FOOD CATEGORIES
CREATE TABLE IF NOT EXISTS food_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '🍜',
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
);

-- 5. DISHES
CREATE TABLE IF NOT EXISTS dishes (
    id TEXT PRIMARY KEY,
    food_category_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (food_category_id) REFERENCES food_categories(id) ON DELETE CASCADE
);

-- 6. RESTAURANTS
CREATE TABLE IF NOT EXISTS restaurants (
    id TEXT PRIMARY KEY,
    dish_id TEXT NOT NULL,
    name TEXT NOT NULL,
    image_url TEXT,
    address TEXT,
    price_range TEXT,
    description TEXT,
    maps_url TEXT,
    menu_url TEXT,
    personal_note TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE CASCADE
);

-- 7. DRINK STYLES
CREATE TABLE IF NOT EXISTS drink_styles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '☕',
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
);

-- 8. CAFES
CREATE TABLE IF NOT EXISTS cafes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    image_url TEXT,
    address TEXT,
    price_range TEXT,
    description TEXT,
    maps_url TEXT,
    opening_hours TEXT,
    personal_note TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
);

-- 9. CAFE STYLE LINKS
CREATE TABLE IF NOT EXISTS cafe_style_links (
    id TEXT PRIMARY KEY,
    cafe_id TEXT NOT NULL,
    drink_style_id TEXT NOT NULL,
    FOREIGN KEY (cafe_id) REFERENCES cafes(id) ON DELETE CASCADE,
    FOREIGN KEY (drink_style_id) REFERENCES drink_styles(id) ON DELETE CASCADE,
    UNIQUE(cafe_id, drink_style_id)
);

-- 10. WORKSHOP CATEGORIES
CREATE TABLE IF NOT EXISTS workshop_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '🎨',
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
);

-- 11. WORKSHOPS
CREATE TABLE IF NOT EXISTS workshops (
    id TEXT PRIMARY KEY,
    workshop_category_id TEXT NOT NULL,
    name TEXT NOT NULL,
    image_url TEXT,
    venue_name TEXT,
    address TEXT,
    duration TEXT,
    price_per_person TEXT,
    booking_url TEXT,
    booking_notes TEXT,
    available_sessions TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    FOREIGN KEY (workshop_category_id) REFERENCES workshop_categories(id) ON DELETE CASCADE
);

-- 12. PHOTOBOOTHS
CREATE TABLE IF NOT EXISTS photobooths (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    image_url TEXT,
    brand_name TEXT,
    address TEXT,
    price TEXT,
    review_url TEXT,
    notes TEXT,
    frame_types TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
);

-- 12B. MOVIES (Backwards-compatibility)
CREATE TABLE IF NOT EXISTS movies (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    poster_url TEXT,
    genre TEXT,
    synopsis TEXT,
    duration TEXT,
    preferred_cinema TEXT,
    notes TEXT,
    external_link TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
);

-- 13. AVAILABLE DATES
CREATE TABLE IF NOT EXISTS available_dates (
    id TEXT PRIMARY KEY,
    date_str TEXT NOT NULL,
    display_label TEXT NOT NULL,
    is_available INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
);

-- 14. TIME SLOTS
CREATE TABLE IF NOT EXISTS time_slots (
    id TEXT PRIMARY KEY,
    date_id TEXT NOT NULL,
    slot_time TEXT NOT NULL,
    period_label TEXT NOT NULL,
    is_available INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (date_id) REFERENCES available_dates(id) ON DELETE CASCADE
);

-- 15. SUBMISSIONS (Immutable durable snapshots)
CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    invitation_id TEXT NOT NULL DEFAULT 'default',
    status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'reviewed', 'confirmed', 'completed')),
    food_status TEXT NOT NULL CHECK(food_status IN ('selected', 'skipped')),
    drink_status TEXT NOT NULL CHECK(drink_status IN ('selected', 'skipped')),
    workshop_status TEXT NOT NULL CHECK(workshop_status IN ('selected', 'skipped')),
    movie_status TEXT NOT NULL CHECK(movie_status IN ('selected', 'skipped')),
    food_selection TEXT,
    drink_selection TEXT,
    workshop_selection TEXT,
    movie_selection TEXT,
    date_selection TEXT NOT NULL,
    additional_note TEXT,
    client_ip TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
