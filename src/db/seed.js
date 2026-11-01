import { initDatabase, getDb, closeDb } from './database.js';
import { runCreateAdmin } from './create_admin.js';
import { updateInvitationSettings, DEFAULT_TEASER_CARDS, DEFAULT_STEP_TITLES } from '../services/invitationService.js';
import {
  createFoodCategory, createDish, createRestaurant,
  createDrinkStyle, createCafe,
  createWorkshopCategory, createWorkshop,
  createPhotobooth,
  createMovie
} from '../services/activityService.js';
import { createAvailableDate } from '../services/scheduleService.js';

export function runSeed() {
  console.log('Seeding database with dreamy ocean birthday data...');
  initDatabase();
  const db = getDb();

  // Create default admin user
  runCreateAdmin();

  // 1. Invitation Settings with user-requested texts
  updateInvitationSettings({
    invitation_slug: 'bestie-2026',
    is_published: true,
    birthday_date: '04.11.2026',
    recipient_name: 'Cậu',
    hero_title: 'Dự Án 411 - A Little Adventure',
    hero_subtitle: 'Bảng kế hoạch triển khai dự án 411',
    letter_badge: 'Bảng Kế Hoạch Triển Khai 💌',
    personal_message: 'Dưới đây là các đề xuất về những hướng phát triển tiềm năng cho dự án, chúng tôi đánh giá nếu bảng kế hoạch hoàn thiện, đây sẽ là một chuỗi các hoạt động mang tầm ảnh hưởng tới thị trường.',
    cta_button_text: 'Khám phá chuỗi dự án',
    teaser_cards: DEFAULT_TEASER_CARDS,
    step_titles: DEFAULT_STEP_TITLES,
    allow_flexible_date: true,
    max_preferred_dates: 2
  });

  // Clear existing catalog items for clean seed
  db.exec('DELETE FROM cafe_style_links');
  db.exec('DELETE FROM restaurants');
  db.exec('DELETE FROM dishes');
  db.exec('DELETE FROM food_categories');
  db.exec('DELETE FROM cafes');
  db.exec('DELETE FROM drink_styles');
  db.exec('DELETE FROM workshops');
  db.exec('DELETE FROM workshop_categories');
  db.exec('DELETE FROM photobooths');
  db.exec('DELETE FROM movies');
  db.exec('DELETE FROM time_slots');
  db.exec('DELETE FROM available_dates');

  // 2. FOOD DATA
  const catNuoc = createFoodCategory({ name: 'Món Nước Ấm Bụng', icon: '🍜', sort_order: 1 });
  const dishMiCay = createDish({ food_category_id: catNuoc.id, name: 'Mì Cay Hàn Quốc Sasin', description: 'Mì cay kim chi bò Mỹ cay nồng đậm vị, topping đầy đặn', sort_order: 1 });
  createRestaurant({
    dish_id: dishMiCay.id,
    name: 'Mì Cay Sasin - Chi nhánh Trung Tâm',
    image_url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&auto=format&fit=crop&q=80',
    address: '122 Nguyễn Thị Minh Khai, Quận 1',
    price_range: '50.000đ - 90.000đ',
    description: 'Quán có view ngắm phố xá mát mẻ, điều hòa mát lạnh, mì chua cay đúng gu của cậu!',
    maps_url: 'https://maps.google.com/?q=Sasin+Nguyen+Thi+Minh+Khai',
    menu_url: 'https://example.com/menu/sasin',
    personal_note: 'Tớ nhớ cậu thích ăn cấp độ 2 nhiều nấm kim châm đúng hông nè?',
    sort_order: 1
  });
  createRestaurant({
    dish_id: dishMiCay.id,
    name: 'Mì Cay Koreno House',
    image_url: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=600&auto=format&fit=crop&q=80',
    address: '45 Lê Duẩn, Quận 1',
    price_range: '55.000đ - 85.000đ',
    description: 'Nước dùng ninh xương đậm đà, không gian ấm cúng, nhạc K-pop chill.',
    maps_url: 'https://maps.google.com/?q=Koreno+House',
    menu_url: 'https://example.com/menu/koreno',
    personal_note: 'Ở đây có nước đào lắc hạt chia siêu ngon uống kèm mì!',
    sort_order: 2
  });

  const dishRamen = createDish({ food_category_id: catNuoc.id, name: 'Ramen Tonkotsu Nhật Bản', description: 'Nước hầm xương heo sánh mịn 18 tiếng, sợi mì dai giòn thơm phức', sort_order: 2 });
  createRestaurant({
    dish_id: dishRamen.id,
    name: 'Ippudo Ramen Bar',
    image_url: 'https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=600&auto=format&fit=crop&q=80',
    address: '31 Lê Thánh Tôn, Bến Nghé, Quận 1',
    price_range: '120.000đ - 180.000đ',
    description: 'Thương hiệu ramen chuẩn vị Hakata, trứng lòng đào Ajitama béo ngậy.',
    maps_url: 'https://maps.google.com/?q=Ippudo+Le+Thanh+Ton',
    menu_url: 'https://example.com/menu/ippudo',
    personal_note: 'Cực kỳ hợp đi vào ngày mưa mát mẻ hoặc xế chiều.',
    sort_order: 1
  });

  const catLau = createFoodCategory({ name: 'Lẩu & Nướng Vui Vẻ', icon: '🍲', sort_order: 2 });
  const dishHaidilao = createDish({ food_category_id: catLau.id, name: 'Lẩu Haidilao Hotpot', description: 'Nước lẩu cà chua & thảo mộc, dịch vụ tận tâm có múa mì và quà sinh nhật', sort_order: 1 });
  createRestaurant({
    dish_id: dishHaidilao.id,
    name: 'Haidilao Vincom Center Đồng Khởi',
    image_url: 'https://images.unsplash.com/photo-1547928576-965beec56133?w=600&auto=format&fit=crop&q=80',
    address: 'Tầng 3, 72 Lê Thánh Tôn, Quận 1',
    price_range: '250.000đ - 350.000đ/người',
    description: 'Có làm nail miễn phí, nhân viên nhiệt tình hát chúc mừng sinh nhật siêu dễ thương!',
    maps_url: 'https://maps.google.com/?q=Haidilao+Vincom+Dong+Khoi',
    menu_url: 'https://example.com/menu/haidilao',
    personal_note: 'Tớ sẽ dặn nhân viên chuẩn bị bảng đèn led tên cậu để chụp hình kỷ niệm nha!',
    sort_order: 1
  });

  const dishBBQ = createDish({ food_category_id: catLau.id, name: 'Nướng Than Hoa Thịt Bò Mỹ', description: 'Thịt bò tẩm sốt ướp mật ong nướng than hoa thơm lừng kèm panchan bất tận', sort_order: 2 });
  createRestaurant({
    dish_id: dishBBQ.id,
    name: 'Meat & Meet BBQ Garden',
    image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80',
    address: '8 Lê Lai, Phường Bến Thành, Quận 1',
    price_range: '199.000đ - 299.000đ/người',
    description: 'Không gian container hiện đại, thịt tươi rói, phô mai bắp kéo sợi siêu cuốn.',
    maps_url: 'https://maps.google.com/?q=Meat+Meet+Le+Lai',
    menu_url: 'https://example.com/menu/meatandmeet',
    personal_note: 'Ăn no nê xả stress sau những ngày bận rộn nè!',
    sort_order: 1
  });

  const catAu = createFoodCategory({ name: 'Món Âu & Pizza Xinh Xắn', icon: '🍕', sort_order: 3 });
  const dishPizza = createDish({ food_category_id: catAu.id, name: "Pizza 4P's Phô Mai Tươi", description: 'Pizza 4 loại phô mai chan mật ong & mì Ý cua sốt kem cà chua', sort_order: 1 });
  createRestaurant({
    dish_id: dishPizza.id,
    name: "Pizza 4P's Hai Bà Trưng",
    image_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80',
    address: '151 Hai Bà Trưng, Phường 6, Quận 3',
    price_range: '200.000đ - 300.000đ/người',
    description: 'Không gian ấm cúng, thiết kế gạch đất nung nghệ thuật, tráng miệng bánh pudding siêu đỉnh.',
    maps_url: 'https://maps.google.com/?q=Pizza+4Ps+Hai+Ba+Trung',
    menu_url: 'https://example.com/menu/pizza4ps',
    personal_note: 'Quán này không gian chụp hình sinh nhật siêu thơ và sang trọng!',
    sort_order: 1
  });

  // 3. DRINKS & CAFES DATA
  const styleKorea = createDrinkStyle({ name: 'Cafe Phong Cách Hàn Quốc (Tone Trắng Kem)', icon: '🫧', sort_order: 1 });
  const styleGarden = createDrinkStyle({ name: 'Cafe Sân Vườn Xanh Mát & Ngập Nắng', icon: '🌿', sort_order: 2 });
  const styleSunset = createDrinkStyle({ name: 'Cafe Ngắm Hoàng Hôn & Tầng Thượng Chill', icon: '🌅', sort_order: 3 });
  const styleCat = createDrinkStyle({ name: 'Cafe Mèo & Thú Cưng Đáng Yêu', icon: '🐱', sort_order: 4 });
  const styleTea = createDrinkStyle({ name: 'Tiệm Trà & Bánh Ngọt Xinh Xắn', icon: '🍰', sort_order: 5 });

  createCafe({
    name: 'Tiệm Cà Phê Mùa Hè (Summer Bloom)',
    image_url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600&auto=format&fit=crop&q=80',
    address: '115 Hai Bà Trưng, Phường Bến Nghé, Quận 1',
    price_range: '45.000đ - 70.000đ',
    description: 'Tone trắng kem pastel, ngập hoa tươi tulip, ánh sáng tự nhiên chụp ảnh siêu xinh.',
    maps_url: 'https://maps.google.com/?q=Summer+Bloom+Cafe',
    opening_hours: '08:00 - 22:00',
    personal_note: 'Bánh croissant hạnh nhân và trà dâu ổi hồng ở đây là best seller đó!',
    sort_order: 1,
    style_ids: [styleKorea.id, styleTea.id]
  });

  createCafe({
    name: 'Nhà Của Gió Garden Lounge',
    image_url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600&auto=format&fit=crop&q=80',
    address: '28 Thảo Điền, Phường Thảo Điền, Quận 2',
    price_range: '55.000đ - 85.000đ',
    description: 'Vườn nhiệt đới rợp bóng cây, tiếng nước róc rách, có hồ cá koi và xích đu gỗ.',
    maps_url: 'https://maps.google.com/?q=Nha+Cua+Gio+Garden',
    opening_hours: '07:30 - 22:30',
    personal_note: 'Ngồi đây tâm sự chuyện trò không bị ồn ào tí nào!',
    sort_order: 2,
    style_ids: [styleGarden.id]
  });

  createCafe({
    name: 'The Twilight Sunset Rooftop',
    image_url: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=600&auto=format&fit=crop&q=80',
    address: 'Tầng 8, 40 Bùi Viện, Quận 1',
    price_range: '65.000đ - 95.000đ',
    description: 'View panorama nhìn trọn hoàng hôn buông xuống thành phố, gió mát lồng lộng.',
    maps_url: 'https://maps.google.com/?q=Twilight+Rooftop',
    opening_hours: '16:00 - 23:30',
    personal_note: 'Canh tầm 17:15 lên ngắm bầu trời chuyển sang màu hồng cam lãng mạn cực!',
    sort_order: 3,
    style_ids: [styleSunset.id]
  });

  createCafe({
    name: 'Little Paw Cat Cafe & Bakery',
    image_url: 'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=600&auto=format&fit=crop&q=80',
    address: '18bis/22 Nguyễn Thị Minh Khai, Quận 1',
    price_range: '50.000đ - 80.000đ',
    description: 'Hơn 20 bé mèo Anh lông ngắn và Ragdoll siêu ngoan, được vuốt ve và chụp hình thỏa thích.',
    maps_url: 'https://maps.google.com/?q=Little+Paw+Cat+Cafe',
    opening_hours: '09:00 - 21:30',
    personal_note: 'Cậu mê mèo thế nào cũng không nỡ về cho xem!',
    sort_order: 4,
    style_ids: [styleCat.id]
  });

  // 4. WORKSHOPS DATA
  const wsCatHandmade = createWorkshopCategory({ name: 'Làm Vòng Tay & Phụ Kiện Xinh', icon: '📿', sort_order: 1 });
  const wsCatCandle = createWorkshopCategory({ name: 'Làm Nến Thơm Tinh Dầu', icon: '🕯️', sort_order: 2 });
  const wsCatPottery = createWorkshopCategory({ name: 'Xoay Gốm Thủ Công', icon: '🏺', sort_order: 3 });
  const wsCatPainting = createWorkshopCategory({ name: 'Tô Tượng & Vẽ Tranh Canvas', icon: '🎨', sort_order: 4 });

  createWorkshop({
    workshop_category_id: wsCatHandmade.id,
    name: 'Workshop Tự Tay Làm Vòng Tay Hạt Đá & Bạc Lưu Niệm',
    image_url: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600&auto=format&fit=crop&q=80',
    venue_name: 'Tiệm Vòng Xinh Studio',
    address: '42 Tôn Thất Thiệp, Bến Nghé, Quận 1',
    duration: '1.5 - 2 giờ',
    price_per_person: '150.000đ / người',
    booking_url: 'https://example.com/workshop/bracelet',
    booking_notes: 'Bao gồm toàn bộ hạt cườm, charm hoa, dây chuyền và hộp quà xinh.',
    available_sessions: '10:00, 14:00, 16:30 (Mỗi ca tối đa 8 người)',
    sort_order: 1
  });

  createWorkshop({
    workshop_category_id: wsCatCandle.id,
    name: 'Workshop Pha Nến Thơm Tinh Dầu Hoa Cỏ Khô',
    image_url: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=600&auto=format&fit=crop&q=80',
    venue_name: 'Aroma Dream Studio',
    address: '88 Nguyễn Đình Chiểu, Đa Kao, Quận 1',
    duration: '2 - 2.5 giờ',
    price_per_person: '240.000đ / người',
    booking_url: 'https://example.com/workshop/candle',
    booking_notes: 'Tự chọn tầng hương cam bergamot, gỗ tuyết tùng hoặc lavender, mang nến thành phẩm về ngay!',
    available_sessions: '09:30, 14:30, 18:00',
    sort_order: 1
  });

  createWorkshop({
    workshop_category_id: wsCatPottery.id,
    name: 'Workshop Vuốt Gốm Bàn Xoay & Khắc Tên',
    image_url: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=600&auto=format&fit=crop&q=80',
    venue_name: 'Gốm Sài Gòn Lành Craft',
    address: '15 Đường Số 9, Thảo Điền, Quận 2',
    duration: '2.5 giờ',
    price_per_person: '280.000đ / người',
    booking_url: 'https://example.com/workshop/pottery',
    booking_notes: 'Tự tay làm ly hoặc đĩa gốm mộc mạc, được nung men màu và gửi về tận nhà.',
    available_sessions: '10:00, 15:00',
    sort_order: 1
  });

  createWorkshop({
    workshop_category_id: wsCatPainting.id,
    name: 'Tô Tượng Thỏ Cinnamoroll & Tranh Vẽ Acrylic',
    image_url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=600&auto=format&fit=crop&q=80',
    venue_name: 'Art & Chill Space',
    address: '260 Pasteur, Võ Thị Sáu, Quận 3',
    duration: 'Không giới hạn thời gian',
    price_per_person: '120.000đ / người',
    booking_url: 'https://example.com/workshop/painting',
    booking_notes: 'Có nước uống miễn phí, nhiều mẫu tượng pastel cực kỳ đáng yêu!',
    available_sessions: 'Mở cửa tự do từ 09:00 - 21:00',
    sort_order: 1
  });

  // 5. PHOTOBOOTHS DATA
  createPhotobooth({
    name: 'Life Four Cuts - Chi Nhánh Lê Duẩn',
    brand_name: 'Life Four Cuts',
    address: '102 Lê Duẩn, Đà Nẵng',
    price: '70.000đ / 2 dải',
    image_url: 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=600&auto=format&fit=crop&q=80',
    notes: 'Có sẵn nhiều nón thú cute, kính hài hước, in ảnh lấy ngay sau 30 giây.',
    review_url: 'https://www.tiktok.com/@lifefourcuts',
    sort_order: 1
  });

  createPhotobooth({
    name: 'Photoism Studio',
    brand_name: 'Photoism',
    address: 'Đà Nẵng',
    price: '80.000đ / 2 dải',
    image_url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&auto=format&fit=crop&q=80',
    notes: 'Tone màu film Hàn Quốc chuẩn chỉnh, ánh sáng chụp da cực mịn màng.',
    review_url: 'https://www.tiktok.com/@photoism_vn',
    sort_order: 2
  });

  // 5B. MOVIES DATA (Backwards-compatibility)
  createMovie({
    title: 'Hàng Xóm Của Tôi Là Totoro (My Neighbor Totoro)',
    poster_url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&auto=format&fit=crop&q=80',
    genre: 'Hoạt hình / Chữa lành / Tuổi thơ',
    synopsis: 'Hai chị em Satsuki và Mei chuyển về vùng nông thôn yên bình và kết bạn với thần rừng Totoro khổng lồ ấm áp.',
    duration: '86 phút',
    preferred_cinema: 'CGV Thảo Điền Pearl hoặc Lotte Cinema Nowzone',
    notes: 'Phim nhẹ nhàng, nhạc của Joe Hisaishi nghe xúc động và êm ái cực kỳ.',
    external_link: 'https://www.imdb.com/title/tt0096283/',
    sort_order: 1
  });

  createMovie({
    title: 'Kimi no Na wa (Your Name)',
    poster_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    genre: 'Anime / Lãng mạn / Kỳ ảo',
    synopsis: 'Câu chuyện hoán đổi thân xác kỳ diệu giữa Mitsuha ở làng quê vùng núi và Taki - cậu học sinh Tokyo giữa cơn mưa sao băng ngàn năm.',
    duration: '107 phút',
    preferred_cinema: 'BHD Star Bitexco hoặc Galaxy Nguyễn Du',
    notes: 'Hình ảnh bầu trời sao băng tuyệt mỹ, siêu hợp không khí kỷ niệm sinh nhật!',
    external_link: 'https://www.imdb.com/title/tt5311514/',
    sort_order: 2
  });

  createMovie({
    title: 'La La Land (Những Kẻ Khờ Mộng Mơ)',
    poster_url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop&q=80',
    genre: 'Nhạc kịch / Lãng mạn / Nghệ thuật',
    synopsis: 'Bản tình ca say đắm giữa chàng nhạc công piano Sebastian và cô diễn viên trẻ Mia dưới bầu trời hoàng hôn tím biếc của Los Angeles.',
    duration: '128 phút',
    preferred_cinema: 'CGV Crescent Mall hoặc Cinestar Quốc Thanh',
    notes: 'Giai điệu "City of Stars" bất hủ, tone màu tím - xanh mộng mơ chuẩn style!',
    external_link: 'https://www.imdb.com/title/tt3783958/',
    sort_order: 3
  });

  // 6. AVAILABLE DATES & TIME SLOTS
  createAvailableDate({
    date_str: '2026-11-04',
    display_label: 'Thứ Tư, 04/11/2026 (Chính ngày mốc dự án 411 ✨)',
    is_available: 1,
    sort_order: 1,
    slots: [
      { slot_time: '09:30 - 12:30', period_label: 'Buổi sáng' },
      { slot_time: '14:00 - 17:30', period_label: 'Buổi chiều hoàng hôn' },
      { slot_time: '18:30 - 22:00', period_label: 'Buổi tối lung linh' }
    ]
  });

  createAvailableDate({
    date_str: '2026-11-07',
    display_label: 'Thứ Bảy, 07/11/2026 (Cuối tuần thong thả 🎈)',
    is_available: 1,
    sort_order: 2,
    slots: [
      { slot_time: '10:00 - 14:00', period_label: 'Buổi trưa' },
      { slot_time: '15:00 - 18:30', period_label: 'Buổi chiều hoàng hôn' },
      { slot_time: '19:00 - 22:30', period_label: 'Buổi tối rực rỡ' }
    ]
  });

  createAvailableDate({
    date_str: '2026-11-08',
    display_label: 'Chủ Nhật, 08/11/2026 (Ngày nghỉ trọn vẹn ☁️)',
    is_available: 1,
    sort_order: 3,
    slots: [
      { slot_time: '09:00 - 12:30', period_label: 'Buổi sáng trong lành' },
      { slot_time: '14:30 - 18:00', period_label: 'Buổi chiều thư giãn' },
      { slot_time: '18:30 - 21:30', period_label: 'Buổi tối êm đềm' }
    ]
  });

  console.log('Seeding completed successfully with project 411 dreamy ocean theme!');
}

if (process.argv[1]?.endsWith('seed.js')) {
  try {
    runSeed();
  } catch (err) {
    console.error('Error during seed:', err);
  } finally {
    closeDb();
  }
}
