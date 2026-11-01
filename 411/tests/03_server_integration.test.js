import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { startServer, stopServer } from '../src/server.js';
import { getAvailableDatesWithSlots } from '../src/services/scheduleService.js';

const TEST_PORT = 3188;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

test.before(async () => {
  await startServer(TEST_PORT);
});

test.after(async () => {
  await stopServer();
});

test('HTTP Public API: GET /api/public/invitation returns published invitation', async () => {
  const res = await fetch(`${BASE_URL}/api/public/invitation`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.is_published, true);
  assert.strictEqual(data.birthday_date, '04.11.2026');
  assert.ok(data.hero_title.length > 0);
  assert.ok(data.hero_subtitle.includes('411'));
});

test('HTTP Public API: GET /api/public/activities returns catalog hierarchy', async () => {
  const res = await fetch(`${BASE_URL}/api/public/activities`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.food));
  assert.ok(Array.isArray(data.drinks));
  assert.ok(Array.isArray(data.workshops));
  assert.ok(Array.isArray(data.movies));
  assert.ok(Array.isArray(data.dates));
  assert.ok(data.food.length > 0);
  assert.ok(Array.isArray(data.drinks));
});

test('HTTP Public API: POST /api/public/submit accepts valid plan and returns 201', async () => {
  const dates = getAvailableDatesWithSlots(true);
  const payload = {
    food_status: 'skipped',
    drink_status: 'skipped',
    workshop_status: 'skipped',
    movie_status: 'skipped',
    date_selection: {
      is_flexible: true,
      display_label: 'Linh hoạt theo thỏa thuận'
    },
    additional_note: 'Test qua HTTP server'
  };

  const res = await fetch(`${BASE_URL}/api/public/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  assert.strictEqual(res.status, 201);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.ok(data.submission.id);
  assert.strictEqual(data.submission.food_status, 'skipped');
  assert.strictEqual(data.submission.additional_note, 'Test qua HTTP server');
});

test('HTTP Security: Unauthenticated request to /api/admin/submissions is rejected with 401', async () => {
  const res = await fetch(`${BASE_URL}/api/admin/submissions`);
  assert.strictEqual(res.status, 401);
  const data = await res.json();
  assert.ok(data.error.includes('Unauthorized'));
});

test('HTTP Admin Login: kieutram logs in with 123456789 successfully', async () => {
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'kieutram',
      password: '123456789'
    })
  });
  assert.strictEqual(loginRes.status, 200);
  const data = await loginRes.json();
  assert.ok(data.token);
  assert.strictEqual(data.user.username, 'kieutram');
  assert.strictEqual(data.user.displayName, 'Kiều Trâm 🩵');
});

test('HTTP Admin Workflow: Login, access submissions, update status, and export CSV', async () => {
  // 1. Login with admin credentials
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      password: 'DreamyBestie2026!'
    })
  });

  assert.strictEqual(loginRes.status, 200);
  const loginData = await loginRes.json();
  assert.ok(loginData.token);
  const token = loginData.token;

  // 2. Access admin metrics with Bearer token
  const metricsRes = await fetch(`${BASE_URL}/api/admin/metrics`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  assert.strictEqual(metricsRes.status, 200);
  const metrics = await metricsRes.json();
  assert.ok(typeof metrics.total === 'number');

  // 3. Access admin submissions list
  const listRes = await fetch(`${BASE_URL}/api/admin/submissions`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  assert.strictEqual(listRes.status, 200);
  const list = await listRes.json();
  assert.ok(Array.isArray(list));
  assert.ok(list.length > 0);

  const testSub = list[0];

  // 4. Update submission status to 'confirmed'
  const patchRes = await fetch(`${BASE_URL}/api/admin/submissions/${testSub.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ status: 'confirmed' })
  });
  assert.strictEqual(patchRes.status, 200);
  const patchedSub = await patchRes.json();
  assert.strictEqual(patchedSub.status, 'confirmed');

  // 6. Test Image Upload from computer
  const sample1x1Png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const uploadRes = await fetch(`${BASE_URL}/api/admin/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ dataUrl: sample1x1Png, filename: 'test_dot.png' })
  });
  assert.strictEqual(uploadRes.status, 200);
  const uploadData = await uploadRes.json();
  assert.ok(uploadData.success);
  assert.ok(uploadData.url.startsWith('/uploads/photo_'));

  // 7. Verify static serving of uploaded image
  const staticImgRes = await fetch(`${BASE_URL}${uploadData.url}`);
  assert.strictEqual(staticImgRes.status, 200);
  assert.strictEqual(staticImgRes.headers.get('content-type'), 'image/png');

  // 8. Test Delete single submission
  const deleteOneRes = await fetch(`${BASE_URL}/api/admin/submissions/${testSub.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  assert.strictEqual(deleteOneRes.status, 200);

  // 9. Test Delete all submissions
  const deleteAllRes = await fetch(`${BASE_URL}/api/admin/submissions`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  assert.strictEqual(deleteAllRes.status, 200);
});

test('Scenario 15: Responsive layout and CSS mobile verification', async () => {
  const indexHtml = await (await fetch(`${BASE_URL}/`)).text();
  assert.ok(indexHtml.includes('name="viewport"'), 'HTML must include mobile viewport meta tag');
  assert.ok(indexHtml.includes('content="width=device-width, initial-scale=1.0"'));

  const cssRes = await fetch(`${BASE_URL}/css/style.css`);
  assert.strictEqual(cssRes.status, 200);
  const cssText = await cssRes.text();
  assert.ok(cssText.includes('@media (max-width: 640px)'), 'CSS must include mobile media queries');
  assert.ok(cssText.includes('cards-grid'));
  assert.ok(cssText.includes('grid-template-columns: 1fr;'));
});

test('Scenario 16: Admin content and activity modifications synchronize immediately to public API', async () => {
  // 1. Login as Admin
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'DreamyBestie2026!' })
  });
  assert.strictEqual(loginRes.status, 200);
  const { token } = await loginRes.json();

  // 2. Admin updates settings (hero_title, cta_button_text, teaser cards with one blank image)
  const updateSettingsRes = await fetch(`${BASE_URL}/api/admin/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      hero_title: 'Dự Án 411 - Chuyến Đi Mùa Thu',
      hero_subtitle: 'Bảng kế hoạch triển khai dự án 411',
      letter_badge: 'Nho nhỏ 💌',
      cta_button_text: 'Khám phá ngay',
      teaser_cards: [
        { id: 'food', title: 'Ẩm Thực', caption: 'Ẩm Thực', image_url: '' },
        { id: 'drinks', title: 'Cafe', caption: 'Cafe', image_url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24' },
        { id: 'workshops', title: 'Workshop', caption: 'Workshop', image_url: '' },
        { id: 'movies', title: 'Phim', caption: 'Phim', image_url: '' }
      ]
    })
  });
  assert.strictEqual(updateSettingsRes.status, 200);

  // 3. Immediately verify public invitation reflects update and applies fallback images
  const pubInvRes = await fetch(`${BASE_URL}/api/public/invitation`);
  assert.strictEqual(pubInvRes.status, 200);
  const pubInv = await pubInvRes.json();
  assert.strictEqual(pubInv.hero_title, 'Dự Án 411 - Chuyến Đi Mùa Thu');
  assert.strictEqual(pubInv.cta_button_text, 'Khám phá ngay');
  assert.strictEqual(pubInv.teaser_cards.length, 4);
  assert.ok(pubInv.teaser_cards[0].image_url.startsWith('http'), 'Blank teaser image must fall back to valid URL');

  // 4. Admin adds a new dish
  const catRes = await fetch(`${BASE_URL}/api/public/activities`);
  const catData = await catRes.json();
  const firstCatId = catData.food[0].id;

  const addDishRes = await fetch(`${BASE_URL}/api/admin/dishes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      food_category_id: firstCatId,
      name: 'Mì Ramen Thượng Hạng Test Sync',
      description: 'Mì thơm ngon'
    })
  });
  assert.strictEqual(addDishRes.status, 201);
  const newDish = await addDishRes.json();

  // 5. Immediately verify public activities reflects the new dish
  const updatedCatRes = await fetch(`${BASE_URL}/api/public/activities`);
  const updatedCat = await updatedCatRes.json();
  const foundDish = updatedCat.food
    .flatMap(c => c.dishes)
    .find(d => d.name === 'Mì Ramen Thượng Hạng Test Sync');
  assert.ok(foundDish, 'Newly added dish must immediately appear in public activities');

  // Clean up test dish and restore original title
  await fetch(`${BASE_URL}/api/admin/dishes/${newDish.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  await fetch(`${BASE_URL}/api/admin/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      hero_title: 'Dự Án 411 - A Little Advanture',
      cta_button_text: 'Go gooo 🩵'
    })
  });
});

test('Scenario 17: Admin creates and updates workshop with TikTok review link', async () => {
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'kieutram', password: '123456789' })
  });
  const { token } = await loginRes.json();

  const catRes = await fetch(`${BASE_URL}/api/public/activities`);
  const catData = await catRes.json();
  const firstWsCat = catData.workshops[0];
  assert.ok(firstWsCat, 'Must have at least one workshop category');

  // 1. Create workshop with TikTok review link
  const createWsRes = await fetch(`${BASE_URL}/api/admin/workshops`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      workshop_category_id: firstWsCat.id,
      name: 'Workshop Gốm TikTok Test',
      venue_name: 'Studio Gốm',
      booking_url: 'https://www.tiktok.com/@ceramic_review/video/123456'
    })
  });
  assert.strictEqual(createWsRes.status, 201);
  const createdWs = await createWsRes.json();
  assert.strictEqual(createdWs.booking_url, 'https://www.tiktok.com/@ceramic_review/video/123456');

  // 2. Update workshop with new TikTok review link
  const updateWsRes = await fetch(`${BASE_URL}/api/admin/workshops/${createdWs.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      booking_url: 'https://vt.tiktok.com/ZS999999/'
    })
  });
  assert.strictEqual(updateWsRes.status, 200);
  const updatedWs = await updateWsRes.json();
  assert.strictEqual(updatedWs.booking_url, 'https://vt.tiktok.com/ZS999999/');

  // 3. Verify public API returns the updated booking_url
  const verifyRes = await fetch(`${BASE_URL}/api/public/activities`);
  const verifyData = await verifyRes.json();
  const foundWs = verifyData.workshops
    .flatMap(c => c.workshops)
    .find(w => w.id === createdWs.id);
  assert.ok(foundWs, 'Created workshop must appear in public activities');
  assert.strictEqual(foundWs.booking_url, 'https://vt.tiktok.com/ZS999999/');

  // Clean up
  await fetch(`${BASE_URL}/api/admin/workshops/${createdWs.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
});

test('Scenario 18: Admin creates and updates photobooth with TikTok review link', async () => {
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'kieutram', password: '123456789' })
  });
  const { token } = await loginRes.json();

  // 1. Create Photobooth
  const createPbRes = await fetch(`${BASE_URL}/api/admin/photobooths`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'Life Four Cuts - Chi Nhánh Lê Duẩn',
      brand_name: 'Life Four Cuts',
      address: '102 Lê Duẩn, Đà Nẵng',
      price: '70.000đ / 2 dải',
      review_url: 'https://www.tiktok.com/@photobooth_danang/video/777',
      notes: 'Rất nhiều mũ thú xinh'
    })
  });
  assert.strictEqual(createPbRes.status, 201);
  const createdPb = await createPbRes.json();
  assert.strictEqual(createdPb.name, 'Life Four Cuts - Chi Nhánh Lê Duẩn');
  assert.strictEqual(createdPb.review_url, 'https://www.tiktok.com/@photobooth_danang/video/777');

  // 2. Update Photobooth
  const updatePbRes = await fetch(`${BASE_URL}/api/admin/photobooths/${createdPb.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      price: '80.000đ / 2 dải',
      review_url: 'https://vt.tiktok.com/ZS888888/'
    })
  });
  assert.strictEqual(updatePbRes.status, 200);
  const updatedPb = await updatePbRes.json();
  assert.strictEqual(updatedPb.price, '80.000đ / 2 dải');
  assert.strictEqual(updatedPb.review_url, 'https://vt.tiktok.com/ZS888888/');

  // 3. Verify in public activities
  const actRes = await fetch(`${BASE_URL}/api/public/activities`);
  const actData = await actRes.json();
  assert.ok(Array.isArray(actData.photobooths));
  const found = actData.photobooths.find(p => p.id === createdPb.id);
  assert.ok(found, 'Created photobooth must appear in public activities');
  assert.strictEqual(found.price, '80.000đ / 2 dải');

  // Clean up
  await fetch(`${BASE_URL}/api/admin/photobooths/${createdPb.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
});
