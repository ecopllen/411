import { getDb } from '../db/database.js';

export const DEFAULT_TEASER_CARDS = [
  {
    id: 'food',
    title: 'Đồ ăn',
    caption: 'Đồ ăn',
    image_url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&auto=format&fit=crop&q=80'
  },
  {
    id: 'drinks',
    title: 'Cafe',
    caption: 'Cafe',
    image_url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=500&auto=format&fit=crop&q=80'
  },
  {
    id: 'workshops',
    title: 'Workshop',
    caption: 'Workshop',
    image_url: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=500&auto=format&fit=crop&q=80'
  },
  {
    id: 'photobooths',
    title: 'Photobooth',
    caption: 'Photobooth',
    image_url: 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=500&auto=format&fit=crop&q=80'
  }
];

export const DEFAULT_STEP_TITLES = {
  food_title: 'Hôm đó cậu muốn ăn gì nè? 🍜',
  food_desc: 'Cậu có muốn chọn trước một món ăn hoặc quán thật ngon cùng tớ không?',
  drinks_title: 'Sau khi ăn, mình có muốn đi uống nước không? ☕',
  drinks_desc: 'Ghé một tiệm cafe thật xinh xắn để cùng chuyện trò và chụp ảnh lưu niệm nhé!',
  workshops_title: 'Hay mình cùng làm một thứ gì đó thật xinh? 🎨',
  workshops_desc: 'Tự tay làm vòng tay, nến thơm, xoay gốm hoặc tô tượng mang về làm kỷ niệm.',
  photobooths_title: 'Đi chụp Photobooth lấy liền cùng nhau nha? 📸',
  photobooths_desc: 'Đội nón cute, đeo kính hài hước rồi in dải ảnh lưu giữ kỷ niệm tuổi mới thật vui!',
  movies_title: 'Đi chụp Photobooth lấy liền cùng nhau nha? 📸',
  movies_desc: 'Đội nón cute, đeo kính hài hước rồi in dải ảnh lưu giữ kỷ niệm tuổi mới thật vui!',
  dates_title: 'Chọn ngày mình cùng nhau đi chơi nhé! 🗓️',
  dates_desc: 'Sinh nhật là ngày 04/11/2026, nhưng tụi mình có thể chọn ngày thuận tiện nhất cho cậu nè!',
  success_title: 'Yayyy! Tớ nhận được lựa chọn của cậu rồi! 🎉',
  success_desc: 'Tớ đã ghi lại toàn bộ những địa điểm cậu thích. Bây giờ để tớ chuẩn bị thật chu đáo nhé!'
};

export function getInvitationSettings(includeUnpublished = false) {
  const db = getDb();
  let query = 'SELECT * FROM invitation_settings LIMIT 1';
  const row = db.prepare(query).get();
  if (!row) {
    return null;
  }

  if (!includeUnpublished && row.is_published === 0) {
    return {
      is_published: 0,
      invitation_slug: row.invitation_slug,
      message: 'Thiệp mời này hiện đang tạm đóng hoặc chưa được công khai.'
    };
  }

  let teaserCards = DEFAULT_TEASER_CARDS;
  if (row.teaser_cards_json) {
    try {
      const parsed = JSON.parse(row.teaser_cards_json);
      if (Array.isArray(parsed) && parsed.length > 0) {
        teaserCards = parsed.map((card, idx) => {
          let id = card.id;
          let title = card.title;
          let caption = card.caption;
          if (id === 'food') {
            if (title === 'Ẩm Thực' || !title) title = 'Đồ ăn';
            if (caption === 'Ẩm Thực' || !caption) caption = 'Đồ ăn';
          }
          if (id === 'drinks') {
            if (title === 'Cafe & Trà' || !title) title = 'Cafe';
            if (caption === 'Cafe & Trà' || !caption) caption = 'Cafe';
          }
          if (id === 'movies') {
            id = 'photobooths';
            if (title === 'Phim' || !title) title = 'Photobooth';
            if (caption === 'Phim' || !caption) caption = 'Photobooth';
          }
          return {
            ...card,
            id,
            caption: caption || title || DEFAULT_TEASER_CARDS[idx]?.caption || `Hạng mục 0${idx+1}`,
            title: title || caption || DEFAULT_TEASER_CARDS[idx]?.title || `Hạng mục 0${idx+1}`,
            image_url: (card.image_url && card.image_url.trim() !== '') ? card.image_url : (DEFAULT_TEASER_CARDS[idx]?.image_url || DEFAULT_TEASER_CARDS[0].image_url)
          };
        });
      }
    } catch {
      teaserCards = DEFAULT_TEASER_CARDS;
    }
  }

  let stepTitles = DEFAULT_STEP_TITLES;
  if (row.step_titles_json) {
    try {
      const parsed = JSON.parse(row.step_titles_json);
      if (parsed.movies_title && !parsed.photobooths_title) {
        parsed.photobooths_title = parsed.movies_title === 'Xem Phim' ? 'Photobooth' : parsed.movies_title;
        parsed.photobooths_desc = parsed.movies_desc || 'Chụp hình kỷ niệm';
      }
      stepTitles = { ...DEFAULT_STEP_TITLES, ...parsed };
    } catch {
      stepTitles = DEFAULT_STEP_TITLES;
    }
  }

  return {
    id: row.id,
    invitation_slug: row.invitation_slug,
    is_published: row.is_published === 1,
    birthday_date: row.birthday_date || '04.11.2026',
    recipient_name: row.recipient_name || 'Cậu',
    hero_title: row.hero_title || 'Dự Án 411 - A Little Adventure',
    hero_subtitle: row.hero_subtitle || 'Bảng kế hoạch triển khai dự án 411',
    letter_badge: row.letter_badge || 'Bảng Kế Hoạch Triển Khai 💌',
    personal_message: (row.personal_message && row.personal_message.trim() !== '') ? row.personal_message : 'Dưới đây là các đề xuất về những hướng phát triển tiềm năng cho dự án, chúng tôi đánh giá nếu bảng kế hoạch hoàn thiện, đây sẽ là một chuỗi các hoạt động mang tầm ảnh hưởng tới thị trường.',
    cta_button_text: row.cta_button_text || 'Khám phá chuỗi dự án',
    teaser_cards: teaserCards,
    step_titles: stepTitles,
    allow_flexible_date: row.allow_flexible_date === 1,
    max_preferred_dates: row.max_preferred_dates || 2,
    updated_at: row.updated_at
  };
}

export function updateInvitationSettings(updates) {
  const db = getDb();
  const current = db.prepare('SELECT id FROM invitation_settings LIMIT 1').get();
  const now = new Date().toISOString();

  const teaserCardsJson = updates.teaser_cards ? JSON.stringify(updates.teaser_cards) : (updates.teaser_cards_json ?? null);
  const stepTitlesJson = updates.step_titles ? JSON.stringify(updates.step_titles) : (updates.step_titles_json ?? null);

  if (!current) {
    const id = 'default';
    db.prepare(`
      INSERT INTO invitation_settings (
        id, invitation_slug, is_published, birthday_date, recipient_name,
        hero_title, hero_subtitle, letter_badge, personal_message, cta_button_text,
        teaser_cards_json, step_titles_json, allow_flexible_date, max_preferred_dates, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      updates.invitation_slug || 'bestie-2026',
      updates.is_published !== undefined ? (updates.is_published ? 1 : 0) : 1,
      updates.birthday_date || '04.11.2026',
      updates.recipient_name || 'Cậu',
      updates.hero_title || 'Dự Án 411 - A Little Adventure',
      updates.hero_subtitle || 'Bảng kế hoạch triển khai dự án 411',
      updates.letter_badge || 'Bảng Kế Hoạch Triển Khai 💌',
      updates.personal_message || 'Dưới đây là các đề xuất về những hướng phát triển tiềm năng cho dự án, chúng tôi đánh giá nếu bảng kế hoạch hoàn thiện, đây sẽ là một chuỗi các hoạt động mang tầm ảnh hưởng tới thị trường.',
      updates.cta_button_text || 'Khám phá chuỗi dự án',
      teaserCardsJson || JSON.stringify(DEFAULT_TEASER_CARDS),
      stepTitlesJson || JSON.stringify(DEFAULT_STEP_TITLES),
      updates.allow_flexible_date !== undefined ? (updates.allow_flexible_date ? 1 : 0) : 1,
      updates.max_preferred_dates || 2,
      now
    );
  } else {
    db.prepare(`
      UPDATE invitation_settings
      SET
        invitation_slug = COALESCE(?, invitation_slug),
        is_published = COALESCE(?, is_published),
        birthday_date = COALESCE(?, birthday_date),
        recipient_name = COALESCE(?, recipient_name),
        hero_title = COALESCE(?, hero_title),
        hero_subtitle = COALESCE(?, hero_subtitle),
        letter_badge = COALESCE(?, letter_badge),
        personal_message = COALESCE(?, personal_message),
        cta_button_text = COALESCE(?, cta_button_text),
        teaser_cards_json = COALESCE(?, teaser_cards_json),
        step_titles_json = COALESCE(?, step_titles_json),
        allow_flexible_date = COALESCE(?, allow_flexible_date),
        max_preferred_dates = COALESCE(?, max_preferred_dates),
        updated_at = ?
      WHERE id = ?
    `).run(
      updates.invitation_slug ?? null,
      updates.is_published !== undefined ? (updates.is_published ? 1 : 0) : null,
      updates.birthday_date ?? null,
      updates.recipient_name ?? null,
      updates.hero_title ?? null,
      updates.hero_subtitle ?? null,
      updates.letter_badge ?? null,
      updates.personal_message ?? null,
      updates.cta_button_text ?? null,
      teaserCardsJson,
      stepTitlesJson,
      updates.allow_flexible_date !== undefined ? (updates.allow_flexible_date ? 1 : 0) : null,
      updates.max_preferred_dates ?? null,
      now,
      current.id
    );
  }

  return getInvitationSettings(true);
}
