import { icons } from './icons.js';
import { loadDashboard } from './admin.js';

// Application State
const state = {
  settings: null,
  catalog: {
    food: [],
    drinks: [],
    workshops: [],
    photobooths: [],
    movies: [],
    dates: []
  },
  currentStep: 1,
  totalSteps: 6,
  draft: {
    food_status: 'unanswered', // unanswered | selected | skipped
    food_selection: null,
    drink_status: 'unanswered',
    drink_selection: null,
    workshop_status: 'unanswered',
    workshop_selection: null,
    photobooth_status: 'unanswered',
    photobooth_selection: null,
    movie_status: 'unanswered',
    movie_selection: null,
    date_selection: null,
    additional_note: ''
  },
  activeCategory: {
    food: null,
    drinks: null,
    workshops: null
  },
  isSubmitting: false
};

const DRAFT_STORAGE_KEY = 'dreamy_birthday_planner_draft_v2';

// Save/Load Draft from LocalStorage
function saveDraft() {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(state.draft));
  } catch {
    // Ignore storage errors
  }
}

function loadDraft() {
  try {
    const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      state.draft = { ...state.draft, ...parsed };
      if (parsed.movie_status && !parsed.photobooth_status) {
        state.draft.photobooth_status = parsed.movie_status;
        state.draft.photobooth_selection = parsed.movie_selection;
      }
      if (parsed.photobooth_status && !parsed.movie_status) {
        state.draft.movie_status = parsed.photobooth_status;
        state.draft.movie_selection = parsed.photobooth_selection;
      }
    }
  } catch {
    // Ignore
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

// Toast notification helper
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'success' ? 'toast-success' : ''}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Switch between SPA views
export function switchView(viewId) {
  const views = document.querySelectorAll('.app-view');
  views.forEach(v => v.style.display = 'none');
  const target = document.getElementById(viewId);
  if (target) {
    target.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Auto-refresh data whenever entering landing page or wizard
  if (viewId === 'view-landing' || viewId === 'view-wizard') {
    refreshPublicData();
  }
}

// ==========================================
// 1. DYNAMIC DATA REFRESH & SYNCHRONIZATION
// ==========================================
export async function refreshPublicData() {
  try {
    const [invRes, catRes] = await Promise.all([
      fetch('/api/public/invitation'),
      fetch('/api/public/activities')
    ]);

    let settings = null;
    if (invRes.ok) {
      settings = await invRes.json();
      state.settings = settings;
      if (settings && settings.is_published === 0) {
        renderUnpublishedScreen(settings.message);
        return;
      }
    }

    if (catRes.ok) {
      const catalog = await catRes.json();
      state.catalog = catalog;
      if (!state.activeCategory.food && catalog.food?.length) state.activeCategory.food = catalog.food[0].id;
      if (!state.activeCategory.drinks && catalog.drinks?.length) state.activeCategory.drinks = catalog.drinks[0].id;
      if (!state.activeCategory.workshops && catalog.workshops?.length) state.activeCategory.workshops = catalog.workshops[0].id;
    }

    if (state.settings) {
      renderLandingContent(state.settings, state.catalog);
    }

    const wizardView = document.getElementById('view-wizard');
    if (wizardView && wizardView.style.display !== 'none' && state.currentStep) {
      renderCurrentStep();
    }
  } catch (err) {
    console.error('Failed to refresh public data:', err);
  }
}
window.refreshPublicData = refreshPublicData;

// ==========================================
// 2. INITIALIZATION & DATA LOADING
// ==========================================
export async function initApp() {
  loadDraft();

  try {
    await refreshPublicData();
  } catch (err) {
    console.error('Failed to load application data:', err);
    showToast('Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại.', 'error');
  }

  setupEventListeners();
}

function renderUnpublishedScreen(msg) {
  const container = document.getElementById('view-landing');
  if (container) {
    container.innerHTML = `
      <div class="hero-scrapbook" style="max-width: 520px; margin: 3rem auto;">
        <div class="crystal-ribbon"></div>
        <div style="font-size: 3rem; margin-bottom: 1rem;">🌊</div>
        <h2 class="hero-title" style="font-size: 1.8rem;">Thiệp Mời Tạm Đóng</h2>
        <p style="color: var(--muted-blue); margin-bottom: 1.5rem;">${msg || 'Thiệp mời này hiện đang được chỉnh sửa hoặc chưa sẵn sàng. Bạn vui lòng quay lại sau nhé!'}</p>
        <button class="btn btn-secondary" onclick="location.reload()">Tải lại trang</button>
      </div>
    `;
  }
}

export function renderLandingContent(settings, catalog = state.catalog) {
  if (!settings) return;
  
  const birthdayTag = document.getElementById('landing-birthday-display');
  if (birthdayTag) birthdayTag.textContent = settings.birthday_date || '04.11.2026';

  const bannerDate = document.getElementById('banner-date-display');
  if (bannerDate) bannerDate.textContent = settings.birthday_date || '04.11.2026';

  const title = document.getElementById('landing-hero-title');
  if (title) title.textContent = settings.hero_title || 'Dự Án 411 - A Little Adventure';

  const sub = document.getElementById('landing-hero-subtitle');
  if (sub) sub.textContent = settings.hero_subtitle || 'Bảng kế hoạch triển khai dự án 411';

  const letterBadge = document.getElementById('landing-letter-badge');
  if (letterBadge) letterBadge.textContent = settings.letter_badge || 'Bảng Kế Hoạch Triển Khai 💌';

  const msg = document.getElementById('landing-personal-message');
  const defaultPersonalMsg = 'Dưới đây là các đề xuất về những hướng phát triển tiềm năng cho dự án, chúng tôi đánh giá nếu bảng kế hoạch hoàn thiện, đây sẽ là một chuỗi các hoạt động mang tầm ảnh hưởng tới thị trường.';
  if (msg) {
    msg.textContent = (settings.personal_message && settings.personal_message.trim() !== '') ? settings.personal_message : defaultPersonalMsg;
  }

  const ctaBtn = document.getElementById('landing-cta-btn-text');
  if (ctaBtn) {
    const rawText = settings.cta_button_text || 'Khám phá chuỗi dự án';
    ctaBtn.textContent = rawText.replace(/[🩵💙]/g, '').trim();
  }

  // Fallback sample photos if empty - Permanent fixed assets
  const fallbackImgs = [
    '/assets/teaser_food.jpg',
    '/assets/teaser_cafe.jpg',
    '/assets/teaser_workshop.jpg',
    '/assets/teaser_photobooth.jpg'
  ];

  // Render 4 Teaser Cards dynamically (Mondstadt Travel Guide Style)
  const teaserGrid = document.getElementById('landing-teaser-grid');
  if (teaserGrid && Array.isArray(settings.teaser_cards)) {
    const defaultTags = ['01 · ĐỒ ĂN', '02 · CAFE', '03 · WORKSHOP', '04 · PHOTOBOOTH'];
    teaserGrid.innerHTML = settings.teaser_cards.map((card, idx) => {
      let imgSrc = (card.image_url && card.image_url.trim() !== '') ? card.image_url : (fallbackImgs[idx] || fallbackImgs[0]);
      if (!imgSrc || imgSrc.includes('unsplash.com')) {
        imgSrc = fallbackImgs[idx] || fallbackImgs[0];
      }
      let cardTitle = card.caption || card.title || `Hạng mục 0${idx+1}`;
      if (idx === 0 && (cardTitle === 'Ẩm Thực' || cardTitle === 'Ẩm thực')) cardTitle = 'Đồ ăn';
      if (idx === 1 && (cardTitle === 'Cafe Chill' || cardTitle === 'Cafe & Trà')) cardTitle = 'Cafe';
      if (idx === 3 && (cardTitle === 'Phim' || cardTitle === 'Phim Rạp')) cardTitle = 'Photobooth';
      return `
        <div class="travel-card-item">
          <div class="travel-card-media">
            <img src="${imgSrc}" alt="${cardTitle}" loading="lazy" onerror="this.src='${fallbackImgs[idx] || fallbackImgs[0]}'">
            <span class="travel-card-badge">${defaultTags[idx] || `0${idx+1} · HOẠT ĐỘNG`}</span>
          </div>
          <div class="travel-card-info">
            <h4 class="travel-card-title">${cardTitle}</h4>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render Live Activities Showcase (Shows real dishes, cafes, workshops, movies added by Admin)
  renderLandingActivityShowcase(catalog);
}

// Render dynamic activity showcase on landing page
export function renderLandingActivityShowcase(catalog) {
  const container = document.getElementById('landing-activity-showcase');
  if (!container) return;

  if (!catalog) {
    container.innerHTML = '';
    return;
  }

  const allDishes = [];
  (catalog.food || []).forEach(cat => {
    (cat.dishes || []).forEach(dish => {
      allDishes.push({ name: dish.name, catName: cat.name });
    });
  });

  const allCafes = [];
  (catalog.drinks || []).forEach(style => {
    (style.cafes || []).forEach(cafe => {
      allCafes.push({ name: cafe.name, styleName: style.name });
    });
  });

  const allWorkshops = [];
  (catalog.workshops || []).forEach(cat => {
    (cat.workshops || []).forEach(ws => {
      allWorkshops.push({ name: ws.name, catName: cat.name });
    });
  });

  const allPhotobooths = catalog.photobooths?.length ? catalog.photobooths : (catalog.movies || []);

  const totalItems = allDishes.length + allCafes.length + allWorkshops.length + allPhotobooths.length;
  if (totalItems === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="activity-showcase-box">
      <div class="showcase-header">
        <span class="showcase-sparkle">✦</span>
        <h3 class="showcase-title">Các Lựa Chọn Đã Chuẩn Bị Cho Dự Án</h3>
        <span class="showcase-sparkle">✦</span>
      </div>
      <p class="showcase-desc">
        Dưới đây là các món ăn, tiệm cafe, workshop và photobooth ngư đã soạn ra. Cạp và xem và bấm go goo và để biết thêm chi tiết và tham khảo và chọn nhóe
      </p>

      <div class="showcase-grid">
        <!-- Đồ ăn -->
        <div class="showcase-col">
          <div class="showcase-col-title">
            <span class="col-icon">🍜</span>
            <span class="col-heading">Đồ ăn (${allDishes.length})</span>
          </div>
          <div class="showcase-tags">
            ${allDishes.length > 0 
              ? allDishes.map(d => `<span class="activity-chip chip-food" title="${d.name}">${d.name}</span>`).join('')
              : '<span class="empty-chip-note">Chưa thêm món</span>'}
          </div>
        </div>

        <!-- Cafe -->
        <div class="showcase-col">
          <div class="showcase-col-title">
            <span class="col-icon">☕</span>
            <span class="col-heading">Cafe (${allCafes.length})</span>
          </div>
          <div class="showcase-tags">
            ${allCafes.length > 0 
              ? allCafes.map(c => `<span class="activity-chip chip-drink" title="${c.name}">${c.name}</span>`).join('')
              : '<span class="empty-chip-note">Chưa thêm quán</span>'}
          </div>
        </div>

        <!-- Workshop -->
        <div class="showcase-col">
          <div class="showcase-col-title">
            <span class="col-icon">🎨</span>
            <span class="col-heading">Workshop (${allWorkshops.length})</span>
          </div>
          <div class="showcase-tags">
            ${allWorkshops.length > 0 
              ? allWorkshops.map(w => `<span class="activity-chip chip-workshop" title="${w.name}">${w.name}</span>`).join('')
              : '<span class="empty-chip-note">Chưa thêm workshop</span>'}
          </div>
        </div>

        <!-- Photobooth -->
        <div class="showcase-col">
          <div class="showcase-col-title">
            <span class="col-icon">📸</span>
            <span class="col-heading">Photobooth (${allPhotobooths.length})</span>
          </div>
          <div class="showcase-tags">
            ${allPhotobooths.length > 0 
              ? allPhotobooths.map(p => `<span class="activity-chip chip-photobooth" title="${p.name || p.title}">${p.name || p.title}</span>`).join('')
              : '<span class="empty-chip-note">Chưa thêm tiệm</span>'}
          </div>
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// 2. WIZARD STEP RENDERING
// ==========================================
function updateStarProgress() {
  const nodes = document.querySelectorAll('.itinerary-node');
  nodes.forEach((node, idx) => {
    const stepNum = idx + 1;
    node.classList.remove('active', 'completed', 'skipped');

    if (stepNum === state.currentStep) {
      node.classList.add('active');
    } else if (stepNum < state.currentStep) {
      if (stepNum === 1 && state.draft.food_status === 'skipped') node.classList.add('skipped');
      else if (stepNum === 2 && state.draft.drink_status === 'skipped') node.classList.add('skipped');
      else if (stepNum === 3 && state.draft.workshop_status === 'skipped') node.classList.add('skipped');
      else if (stepNum === 4 && (state.draft.photobooth_status === 'skipped' || state.draft.movie_status === 'skipped')) node.classList.add('skipped');
      else node.classList.add('completed');
    }
  });

  const fill = document.getElementById('itinerary-fill');
  if (fill) {
    const progressPercent = ((state.currentStep - 1) / (state.totalSteps - 1)) * 100;
    fill.style.width = `${progressPercent}%`;
  }

  const stepInfo = document.getElementById('wizard-step-info');
  if (stepInfo) stepInfo.textContent = `Giai đoạn ${state.currentStep} / ${state.totalSteps}`;

  const btnPrev = document.getElementById('btn-wizard-prev');
  if (btnPrev) {
    btnPrev.style.visibility = state.currentStep === 1 ? 'hidden' : 'visible';
  }

  const btnNext = document.getElementById('btn-wizard-next');
  if (btnNext) {
    if (state.currentStep === 6) {
      btnNext.innerHTML = `<span>Gửi kế hoạch dự án</span>`;
      btnNext.className = 'btn btn-pill-sunlit btn-lg';
    } else {
      btnNext.innerHTML = `<span>Tiếp tục →</span>`;
      btnNext.className = 'btn btn-pill-sunlit';
    }
  }
}

function renderCurrentStep() {
  const container = document.getElementById('wizard-step-container');
  if (!container) return;
  updateStarProgress();

  switch (state.currentStep) {
    case 1:
      renderFoodStep(container);
      break;
    case 2:
      renderDrinksStep(container);
      break;
    case 3:
      renderWorkshopsStep(container);
      break;
    case 4:
      renderPhotoboothStep(container);
      break;
    case 5:
      renderDateStep(container);
      break;
    case 6:
      renderReviewStep(container);
      break;
    default:
      break;
  }
}

// ------------------------------------------
// STEP 1: FOOD
// ------------------------------------------
function renderFoodStep(container) {
  const isSkipped = state.draft.food_status === 'skipped';
  const isSelected = state.draft.food_status === 'selected';
  const titles = state.settings?.step_titles || {};

  let html = `
    <div class="participation-banner">
      <div class="crystal-ribbon"></div>
      <h2 class="participation-title">${titles.food_title || 'Hôm đó cậu muốn ăn gì nè? 🍜'}</h2>
      <p class="participation-desc">${titles.food_desc || 'Cậu có muốn chọn trước một món ăn hoặc quán thật ngon cùng tớ không?'}</p>
      <div class="participation-actions">
        <button class="btn ${isSelected ? 'btn-primary' : 'btn-secondary'}" id="btn-participate-food">
          <span>Có chứ! Chọn thôi</span>
        </button>
        <button class="btn ${isSkipped ? 'btn-skip active' : 'btn-skip'}" id="btn-skip-food">
          <span>Bỏ qua lần này →</span>
        </button>
      </div>
      ${isSkipped ? '<div class="decision-badge-container"><span class="badge badge-purple">Đã chọn: Bỏ qua lần này. Đi qua hoạt động khác thoi.</span></div>' : ''}
    </div>
  `;

  if (!isSkipped) {
    const categories = state.catalog.food || [];
    const activeCat = categories.find(c => c.id === state.activeCategory.food) || categories[0];

    html += `
      <div class="pills-container">
        ${categories.map(cat => `
          <button class="pill-item ${cat.id === activeCat?.id ? 'active' : ''}" data-cat-id="${cat.id}">
            <span>${cat.icon || '🍜'}</span>
            <span>${cat.name}</span>
          </button>
        `).join('')}
      </div>
    `;

    // Flatten all restaurants across all dishes in activeCat into a single horizontal cards grid
    const allRestaurants = [];
    (activeCat?.dishes || []).forEach(dish => {
      (dish.restaurants || []).forEach(rest => {
        allRestaurants.push({
          ...rest,
          dishId: dish.id,
          dishName: dish.name,
          dishDesc: dish.description
        });
      });
    });

    if (allRestaurants.length > 0) {
      html += `
        <div class="cards-grid">
          ${allRestaurants.map(rest => {
            const isCardSelected = state.draft.food_selection?.restaurant_id === rest.id;
            const showDishBadge = rest.dishName && rest.dishName.trim().toLowerCase() !== rest.name.trim().toLowerCase();
            const isTikTok = rest.maps_url && rest.maps_url.includes('tiktok.com');
            const linkText = isTikTok ? 'Xem Review TikTok 🎵' : (rest.maps_url && (rest.maps_url.includes('google') || rest.maps_url.includes('maps')) ? 'Xem Google Maps 📍' : 'Xem Chi Tiết 🔗');

            return `
              <div class="selection-card ${isCardSelected ? 'selected' : ''}" data-rest-id="${rest.id}">
                ${isCardSelected ? `<div class="card-selected-check">${icons.check}</div>` : ''}
                <div class="polaroid-image-wrapper">
                  <img src="${rest.image_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500'}" alt="${rest.name}" loading="lazy">
                  ${showDishBadge ? `<span class="card-dish-badge">🍜 ${rest.dishName}</span>` : ''}
                </div>
                <div class="polaroid-caption">
                  <h4 class="polaroid-title">${rest.name}</h4>
                  <div class="card-meta-list">
                    ${rest.address ? `<div class="card-meta-item">${icons.mapPin} <span>${rest.address}</span></div>` : ''}
                    ${rest.price_range ? `<div class="card-meta-item">${icons.price} <span>${rest.price_range}</span></div>` : ''}
                  </div>
                  ${rest.description ? `<p style="font-size: 0.86rem; color: #64748B; margin-bottom: 0.5rem;">${rest.description}</p>` : (rest.dishDesc ? `<p style="font-size: 0.86rem; color: #64748B; margin-bottom: 0.5rem;">${rest.dishDesc}</p>` : '')}
                  ${rest.personal_note ? `<div class="personal-note-box">" ${rest.personal_note} "</div>` : ''}
                  ${rest.maps_url ? `
                    <div style="margin-top: 0.6rem;">
                      <a href="${rest.maps_url}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline" style="padding: 0.28rem 0.75rem; font-size: 0.8rem;" onclick="event.stopPropagation()">
                        <span>${linkText}</span> ${icons.externalLink}
                      </a>
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else {
      html += `<div style="text-align: center; padding: 2.5rem 1rem; color: #E0F2FE; background: rgba(255,255,255,0.08); border-radius: var(--radius-md); backdrop-filter: blur(8px); margin: 1.5rem 0;">Chưa có quán ăn nào trong danh mục này. Bạn có thể thêm quán ăn trong phần Quản Trị nhé!</div>`;
    }
  }

  container.innerHTML = html;

  // Event handlers
  document.getElementById('btn-participate-food')?.addEventListener('click', () => {
    state.draft.food_status = 'selected';
    saveDraft();
    renderFoodStep(container);
  });

  document.getElementById('btn-skip-food')?.addEventListener('click', () => {
    state.draft.food_status = 'skipped';
    state.draft.food_selection = null;
    saveDraft();
    renderFoodStep(container);
  });

  container.querySelectorAll('.pill-item').forEach(pill => {
    pill.addEventListener('click', () => {
      state.activeCategory.food = pill.dataset.catId;
      renderFoodStep(container);
    });
  });

  container.querySelectorAll('.selection-card').forEach(card => {
    card.addEventListener('click', () => {
      const restId = card.dataset.restId;
      const categories = state.catalog.food || [];
      let foundRest = null;
      let foundDish = null;
      let foundCat = null;

      for (const cat of categories) {
        for (const dish of cat.dishes || []) {
          const r = (dish.restaurants || []).find(x => x.id === restId);
          if (r) {
            foundRest = r;
            foundDish = dish;
            foundCat = cat;
            break;
          }
        }
      }

      if (foundRest) {
        state.draft.food_status = 'selected';
        state.draft.food_selection = {
          category_name: foundCat.name,
          dish_name: foundDish.name,
          restaurant_id: foundRest.id,
          restaurant_name: foundRest.name,
          address: foundRest.address,
          price: foundRest.price_range,
          maps_url: foundRest.maps_url,
          image_url: foundRest.image_url
        };
        saveDraft();
        renderFoodStep(container);
      }
    });
  });
}

// ------------------------------------------
// STEP 2: DRINKS & CAFES
// ------------------------------------------
function renderDrinksStep(container) {
  const isSkipped = state.draft.drink_status === 'skipped';
  const isSelected = state.draft.drink_status === 'selected';
  const titles = state.settings?.step_titles || {};

  let html = `
    <div class="participation-banner">
      <div class="crystal-ribbon"></div>
      <h2 class="participation-title">${titles.drinks_title || 'Sau khi ăn, mình có muốn đi uống nước không? ☕'}</h2>
      <p class="participation-desc">${titles.drinks_desc || 'Ghé một tiệm cafe thật xinh xắn để cùng chuyện trò và chụp ảnh lưu niệm nhé!'}</p>
      <div class="participation-actions">
        <button class="btn ${isSelected ? 'btn-primary' : 'btn-secondary'}" id="btn-participate-drinks">
          <span>Có chứ! Chọn thôi</span>
        </button>
        <button class="btn ${isSkipped ? 'btn-skip active' : 'btn-skip'}" id="btn-skip-drinks">
          <span>Bỏ qua lần này →</span>
        </button>
      </div>
      ${isSkipped ? '<div class="decision-badge-container"><span class="badge badge-purple">Đã chọn: Bỏ qua lần này. Đi qua hoạt động khác thoi.</span></div>' : ''}
    </div>
  `;

  if (!isSkipped) {
    const styles = state.catalog.drinks || [];
    const activeStyle = styles.find(s => s.id === state.activeCategory.drinks) || styles[0];

    html += `
      <div class="pills-container">
        ${styles.map(style => `
          <button class="pill-item ${style.id === activeStyle?.id ? 'active' : ''}" data-style-id="${style.id}">
            <span>${style.icon || '☕'}</span>
            <span>${style.name}</span>
          </button>
        `).join('')}
      </div>
    `;

    if (activeStyle && activeStyle.cafes?.length) {
      html += `
        <div class="cards-grid">
          ${activeStyle.cafes.map(cafe => {
            const isCardSelected = state.draft.drink_selection?.cafe_id === cafe.id;
            const isTikTok = cafe.maps_url && (cafe.maps_url.includes('tiktok.com') || cafe.maps_url.includes('douyin'));
            const linkText = isTikTok ? 'Xem Review TikTok 🎵' : (cafe.maps_url && (cafe.maps_url.includes('google') || cafe.maps_url.includes('maps')) ? 'Xem Google Maps 📍' : 'Xem Chi Tiết 🔗');
            return `
              <div class="selection-card ${isCardSelected ? 'selected' : ''}" data-cafe-id="${cafe.id}">
                ${isCardSelected ? `<div class="card-selected-check">${icons.check}</div>` : ''}
                <div class="polaroid-image-wrapper">
                  <img src="${cafe.image_url || 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=500'}" alt="${cafe.name}" loading="lazy">
                </div>
                <div class="polaroid-caption">
                  <h4 class="polaroid-title">${cafe.name}</h4>
                  <div class="card-meta-list">
                    ${cafe.address ? `<div class="card-meta-item">${icons.mapPin} <span>${cafe.address}</span></div>` : ''}
                    ${cafe.opening_hours ? `<div class="card-meta-item">${icons.clock} <span>${cafe.opening_hours}</span></div>` : ''}
                    ${cafe.price_range ? `<div class="card-meta-item">${icons.price} <span>${cafe.price_range}</span></div>` : ''}
                  </div>
                  ${cafe.description ? `<p style="font-size: 0.86rem; color: #64748B; margin-bottom: 0.5rem;">${cafe.description}</p>` : ''}
                  ${cafe.personal_note ? `<div class="personal-note-box">" ${cafe.personal_note} "</div>` : ''}
                  ${cafe.maps_url ? `
                    <div style="margin-top: 0.6rem;">
                      <a href="${cafe.maps_url}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline" style="padding: 0.25rem 0.6rem; font-size: 0.78rem;" onclick="event.stopPropagation()">
                        <span>${linkText}</span> ${icons.externalLink}
                      </a>
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else {
      html += `<div style="text-align: center; padding: 2rem; color: #BAE6FD;">Chưa có quán cafe nào trong phong cách này.</div>`;
    }
  }

  container.innerHTML = html;

  document.getElementById('btn-participate-drinks')?.addEventListener('click', () => {
    state.draft.drink_status = 'selected';
    saveDraft();
    renderDrinksStep(container);
  });

  document.getElementById('btn-skip-drinks')?.addEventListener('click', () => {
    state.draft.drink_status = 'skipped';
    state.draft.drink_selection = null;
    saveDraft();
    renderDrinksStep(container);
  });

  container.querySelectorAll('.pill-item').forEach(pill => {
    pill.addEventListener('click', () => {
      state.activeCategory.drinks = pill.dataset.styleId;
      renderDrinksStep(container);
    });
  });

  container.querySelectorAll('.selection-card').forEach(card => {
    card.addEventListener('click', () => {
      const cafeId = card.dataset.cafeId;
      const styles = state.catalog.drinks || [];
      let foundCafe = null;
      let foundStyle = null;

      for (const st of styles) {
        const c = (st.cafes || []).find(x => x.id === cafeId);
        if (c) {
          foundCafe = c;
          foundStyle = st;
          break;
        }
      }

      if (foundCafe) {
        state.draft.drink_status = 'selected';
        state.draft.drink_selection = {
          style_name: foundStyle.name,
          cafe_id: foundCafe.id,
          cafe_name: foundCafe.name,
          address: foundCafe.address,
          opening_hours: foundCafe.opening_hours,
          price: foundCafe.price_range,
          maps_url: foundCafe.maps_url,
          image_url: foundCafe.image_url
        };
        saveDraft();
        renderDrinksStep(container);
      }
    });
  });
}

// ------------------------------------------
// STEP 3: WORKSHOPS
// ------------------------------------------
function renderWorkshopsStep(container) {
  const isSkipped = state.draft.workshop_status === 'skipped';
  const isSelected = state.draft.workshop_status === 'selected';
  const titles = state.settings?.step_titles || {};

  let html = `
    <div class="participation-banner">
      <div class="crystal-ribbon"></div>
      <h2 class="participation-title">${titles.workshops_title || 'Hay mình cùng làm một thứ gì đó thật xinh? 🎨'}</h2>
      <p class="participation-desc">${titles.workshops_desc || 'Tự tay làm vòng tay, nến thơm, xoay gốm hoặc tô tượng mang về làm kỷ niệm.'}</p>
      <div class="participation-actions">
        <button class="btn ${isSelected ? 'btn-primary' : 'btn-secondary'}" id="btn-participate-workshop">
          <span>Có chứ! Chọn thôi</span>
        </button>
        <button class="btn ${isSkipped ? 'btn-skip active' : 'btn-skip'}" id="btn-skip-workshop">
          <span>Bỏ qua lần này →</span>
        </button>
      </div>
      ${isSkipped ? '<div class="decision-badge-container"><span class="badge badge-purple">Đã chọn: Bỏ qua lần này. Đi qua hoạt động khác thoi.</span></div>' : ''}
    </div>
  `;

  if (!isSkipped) {
    const categories = state.catalog.workshops || [];
    const activeCat = categories.find(c => c.id === state.activeCategory.workshops) || categories[0];

    html += `
      <div class="pills-container">
        ${categories.map(cat => `
          <button class="pill-item ${cat.id === activeCat?.id ? 'active' : ''}" data-cat-id="${cat.id}">
            <span>${cat.icon || '🎨'}</span>
            <span>${cat.name}</span>
          </button>
        `).join('')}
      </div>
    `;

    if (activeCat && activeCat.workshops?.length) {
      html += `
        <div class="cards-grid">
          ${activeCat.workshops.map(ws => {
            const isCardSelected = state.draft.workshop_selection?.workshop_id === ws.id;
            const isTikTok = ws.booking_url && (ws.booking_url.includes('tiktok.com') || ws.booking_url.includes('douyin'));
            const linkText = isTikTok ? 'Xem Review TikTok 🎵' : (ws.booking_url && (ws.booking_url.includes('google') || ws.booking_url.includes('maps')) ? 'Xem Google Maps 📍' : 'Xem Chi Tiết / Review 🔗');
            return `
              <div class="selection-card ${isCardSelected ? 'selected' : ''}" data-ws-id="${ws.id}">
                ${isCardSelected ? `<div class="card-selected-check">${icons.check}</div>` : ''}
                <div class="polaroid-image-wrapper">
                  <img src="${ws.image_url || 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=500'}" alt="${ws.name}" loading="lazy">
                </div>
                <div class="polaroid-caption">
                  <h4 class="polaroid-title">${ws.name}</h4>
                  <div class="card-meta-list">
                    ${ws.venue_name ? `<div class="card-meta-item"><strong>Studio:</strong> <span>${ws.venue_name}</span></div>` : ''}
                    ${ws.address ? `<div class="card-meta-item">${icons.mapPin} <span>${ws.address}</span></div>` : ''}
                    ${ws.duration ? `<div class="card-meta-item">${icons.clock} <span>Thời lượng: ${ws.duration}</span></div>` : ''}
                    ${ws.price_per_person ? `<div class="card-meta-item">${icons.price} <span>${ws.price_per_person}</span></div>` : ''}
                  </div>
                  ${ws.booking_notes ? `<p style="font-size: 0.86rem; color: #64748B; margin-bottom: 0.5rem;">${ws.booking_notes}</p>` : ''}
                  ${ws.available_sessions ? `<div class="personal-note-box" style="background:#F0FDF4; border-color:#22C55E; color:#15803D;">Ca hoạt động: ${ws.available_sessions}</div>` : ''}
                  ${ws.booking_url ? `
                    <div style="margin-top: 0.65rem;">
                      <a href="${ws.booking_url}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline" style="padding: 0.28rem 0.75rem; font-size: 0.8rem;" onclick="event.stopPropagation()">
                        <span>${linkText}</span> ${icons.externalLink}
                      </a>
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else {
      html += `<div style="text-align: center; padding: 2rem; color: #BAE6FD;">Chưa có workshop nào trong danh mục này.</div>`;
    }
  }

  container.innerHTML = html;

  document.getElementById('btn-participate-workshop')?.addEventListener('click', () => {
    state.draft.workshop_status = 'selected';
    saveDraft();
    renderWorkshopsStep(container);
  });

  document.getElementById('btn-skip-workshop')?.addEventListener('click', () => {
    state.draft.workshop_status = 'skipped';
    state.draft.workshop_selection = null;
    saveDraft();
    renderWorkshopsStep(container);
  });

  container.querySelectorAll('.pill-item').forEach(pill => {
    pill.addEventListener('click', () => {
      state.activeCategory.workshops = pill.dataset.catId;
      renderWorkshopsStep(container);
    });
  });

  container.querySelectorAll('.selection-card').forEach(card => {
    card.addEventListener('click', () => {
      const wsId = card.dataset.wsId;
      const categories = state.catalog.workshops || [];
      let foundWs = null;
      let foundCat = null;

      for (const cat of categories) {
        const w = (cat.workshops || []).find(x => x.id === wsId);
        if (w) {
          foundWs = w;
          foundCat = cat;
          break;
        }
      }

      if (foundWs) {
        state.draft.workshop_status = 'selected';
        state.draft.workshop_selection = {
          category_name: foundCat.name,
          workshop_id: foundWs.id,
          workshop_name: foundWs.name,
          venue_name: foundWs.venue_name,
          address: foundWs.address,
          duration: foundWs.duration,
          price: foundWs.price_per_person,
          image_url: foundWs.image_url,
          booking_url: foundWs.booking_url
        };
        saveDraft();
        renderWorkshopsStep(container);
      }
    });
  });
}

// ------------------------------------------
// STEP 4: PHOTOBOOTHS
// ------------------------------------------
function renderPhotoboothStep(container) {
  const isSkipped = state.draft.photobooth_status === 'skipped' || state.draft.movie_status === 'skipped';
  const isSelected = state.draft.photobooth_status === 'selected' || state.draft.movie_status === 'selected';
  const titles = state.settings?.step_titles || {};

  let html = `
    <div class="participation-banner">
      <div class="crystal-ribbon"></div>
      <h2 class="participation-title">${titles.photobooths_title || titles.movies_title || 'Đi chụp Photobooth cùng nhau nha? 📸'}</h2>
      <p class="participation-desc">${titles.photobooths_desc || titles.movies_desc || 'Đội nón cute, đeo kính hài hước rồi in dải ảnh lưu giữ kỷ niệm tuổi mới thật vui!'}</p>
      <div class="participation-actions">
        <button class="btn ${isSelected ? 'btn-primary' : 'btn-secondary'}" id="btn-participate-photobooth">
          <span>Có chứ! Chọn tiệm chụp ngay</span>
        </button>
        <button class="btn ${isSkipped ? 'btn-skip active' : 'btn-skip'}" id="btn-skip-photobooth">
          <span>Bỏ qua lần này →</span>
        </button>
      </div>
      ${isSkipped ? '<div class="decision-badge-container"><span class="badge badge-purple">Đã chọn: Bỏ qua lần này. Đi qua hoạt động khác thoi.</span></div>' : ''}
    </div>
  `;

  if (!isSkipped) {
    const photobooths = state.catalog.photobooths?.length ? state.catalog.photobooths : (state.catalog.movies || []);

    if (photobooths.length) {
      html += `
        <div class="cards-grid">
          ${photobooths.map(pb => {
            const currentSelId = state.draft.photobooth_selection?.id || state.draft.photobooth_selection?.photobooth_id || state.draft.movie_selection?.movie_id;
            const isCardSelected = currentSelId === pb.id;
            const isTikTok = pb.review_url && (pb.review_url.includes('tiktok.com') || pb.review_url.includes('douyin'));
            const linkText = isTikTok ? 'Xem Review TikTok 🎵' : (pb.review_url && (pb.review_url.includes('google') || pb.review_url.includes('maps')) ? 'Xem Google Maps 📍' : 'Xem Chi Tiết / Review 🔗');

            return `
              <div class="selection-card ${isCardSelected ? 'selected' : ''}" data-pb-id="${pb.id}">
                ${isCardSelected ? `<div class="card-selected-check">${icons.check}</div>` : ''}
                <div class="polaroid-image-wrapper" style="aspect-ratio: 4 / 5;">
                  <img src="${pb.image_url || pb.poster_url || 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=500'}" alt="${pb.name || pb.title}" loading="lazy">
                </div>
                <div class="polaroid-caption">
                  <h4 class="polaroid-title">${pb.name || pb.title}</h4>
                  <div class="card-meta-list">
                    ${pb.brand_name ? `<div class="card-meta-item"><span class="badge badge-purple">${pb.brand_name}</span></div>` : ''}
                    ${pb.address ? `<div class="card-meta-item">${icons.mapPin} <span>${pb.address}</span></div>` : ''}
                    ${pb.price ? `<div class="card-meta-item">${icons.price} <span>${pb.price}</span></div>` : ''}
                  </div>
                  ${pb.notes ? `<p style="font-size: 0.86rem; color: #64748B; margin-top: 0.35rem; margin-bottom: 0.35rem;">${pb.notes}</p>` : (pb.synopsis ? `<p style="font-size: 0.86rem; color: #64748B;">${pb.synopsis}</p>` : '')}
                  ${pb.review_url ? `
                    <div style="margin-top: 0.65rem;">
                      <a href="${pb.review_url}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline" style="padding: 0.28rem 0.75rem; font-size: 0.8rem;" onclick="event.stopPropagation()">
                        <span>${linkText}</span> ${icons.externalLink}
                      </a>
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else {
      html += `<div style="text-align: center; padding: 2.5rem 1rem; color: #E0F2FE; background: rgba(255,255,255,0.08); border-radius: var(--radius-md); backdrop-filter: blur(8px); margin: 1.5rem 0;">Chưa có tiệm Photobooth nào. Bạn có thể thêm các tiệm photobooth trong phần Quản Trị nhé!</div>`;
    }
  }

  container.innerHTML = html;

  document.getElementById('btn-participate-photobooth')?.addEventListener('click', () => {
    state.draft.photobooth_status = 'selected';
    state.draft.movie_status = 'selected';
    saveDraft();
    renderPhotoboothStep(container);
  });

  document.getElementById('btn-skip-photobooth')?.addEventListener('click', () => {
    state.draft.photobooth_status = 'skipped';
    state.draft.photobooth_selection = null;
    state.draft.movie_status = 'skipped';
    state.draft.movie_selection = null;
    saveDraft();
    renderPhotoboothStep(container);
  });

  container.querySelectorAll('.selection-card').forEach(card => {
    card.addEventListener('click', () => {
      const pbId = card.dataset.pbId;
      const photobooths = state.catalog.photobooths?.length ? state.catalog.photobooths : (state.catalog.movies || []);
      const pb = photobooths.find(p => p.id === pbId);
      if (pb) {
        state.draft.photobooth_status = 'selected';
        state.draft.photobooth_selection = {
          id: pb.id,
          name: pb.name || pb.title,
          brand_name: pb.brand_name || '',
          address: pb.address || '',
          price: pb.price || '',
          image_url: pb.image_url || pb.poster_url || '',
          review_url: pb.review_url || ''
        };
        state.draft.movie_status = 'selected';
        state.draft.movie_selection = {
          movie_id: pb.id,
          movie_title: pb.name || pb.title,
          genre: pb.brand_name || '',
          preferred_cinema: pb.address || '',
          duration: pb.price || '',
          image_url: pb.image_url || pb.poster_url || ''
        };
        saveDraft();
        renderPhotoboothStep(container);
      }
    });
  });
}

// ------------------------------------------
// STEP 5: DATE & TIME SCHEDULING
// ------------------------------------------
function renderDateStep(container) {
  const dates = state.catalog.dates || [];
  const allowFlexible = state.settings?.allow_flexible_date ?? true;
  const selectedDate = state.draft.date_selection;
  const titles = state.settings?.step_titles || {};

  let html = `
    <div class="hero-scrapbook" style="margin-top: 0; padding: 2.25rem 1.75rem; text-align: left;">
      <div class="crystal-ribbon"></div>
      <h2 class="hero-title" style="font-size: 1.75rem; margin-bottom: 0.4rem;">${titles.dates_title || 'Chọn ngày mình cùng nhau đi chơi nhé! 🗓️'}</h2>
      <p style="color: var(--muted-blue); margin-bottom: 1.5rem; font-size: 0.98rem;">
        ${titles.dates_desc || 'Sinh nhật là ngày 04/11/2026, nhưng tụi mình có thể chọn ngày thuận tiện nhất cho cậu nè!'}
      </p>

      ${dates.length === 0 ? `
        <div style="text-align: center; padding: 2.5rem 1rem; background: #F8FAFC; border-radius: var(--radius-md); border: 1px dashed #CBD5E1;">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🗓️</div>
          <p style="color: #64748B; font-weight: 600;">Hiện chưa có ngày cụ thể nào được mở trong lịch.</p>
          <p style="font-size: 0.88rem; color: #94A3B8;">Cậu có thể chọn "Thời gian linh hoạt" bên dưới để tụi mình hẹn nhau sau nhé!</p>
        </div>
      ` : `
        <div class="date-cards-grid">
          ${dates.map(d => {
            const isDateSelected = !selectedDate?.is_flexible && selectedDate?.date_id === d.id;
            const isBirthday = d.date_str === '2026-11-04';
            return `
              <div class="date-option-card ${isDateSelected ? 'selected' : ''}" data-date-id="${d.id}">
                ${isBirthday ? `<span class="badge badge-yellow" style="margin-bottom: 0.5rem;">Chính Ngày Mốc 411 ✨</span>` : ''}
                <h4 style="font-size: 1.15rem; font-weight: 700; color: var(--ocean-deep); font-family: var(--font-display);">${d.display_label || d.date_str}</h4>
                <div style="font-size: 0.86rem; color: var(--muted-blue); margin-top: 0.25rem;">${(d.slots || []).length} khung giờ khả dụng</div>
              </div>
            `;
          }).join('')}
        </div>
      `}

      <!-- Time Slots Container for selected date -->
      ${(!selectedDate?.is_flexible && selectedDate?.date_id) ? `
        <div style="margin-top: 1.75rem; padding-top: 1.25rem; border-top: 1.5px dashed #BAE6FD;">
          <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--ocean-deep); font-family: var(--font-display); margin-bottom: 0.5rem;">Khung giờ mong muốn:</h3>
          <div class="time-slots-grid">
            ${(() => {
              const currentDateObj = dates.find(d => d.id === selectedDate.date_id);
              if (!currentDateObj || !currentDateObj.slots?.length) {
                return `<p style="font-size: 0.95rem; color: #0284C7; font-weight: 600; padding: 0.25rem 0;">Không có khung giời giới hạn</p>`;
              }
              return currentDateObj.slots.map(slot => {
                const isSlotSelected = selectedDate.slot_id === slot.id;
                return `
                  <button class="slot-chip ${isSlotSelected ? 'selected' : ''}" data-slot-id="${slot.id}" data-slot-time="${slot.slot_time}" data-slot-period="${slot.period_label}">
                    <span>${slot.slot_time}</span>
                    <span style="font-size: 0.78rem; opacity: 0.85;">(${slot.period_label})</span>
                  </button>
                `;
              }).join('');
            })()}
          </div>
        </div>
      ` : ''}

      <!-- Flexible option -->
      ${allowFlexible ? `
        <div class="flexible-date-card" id="card-flexible-date">
          <input type="checkbox" id="check-flexible" ${selectedDate?.is_flexible ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: #0284C7; cursor: pointer;">
          <div>
            <div style="font-weight: 700; color: #0369A1; font-size: 1.05rem; font-family: var(--font-display);">Thời gian linh hoạt theo thỏa thuận 🌊</div>
            <div style="font-size: 0.88rem; color: #0284C7;">Ib thầm kín để chốt giờ đi nhó</div>
          </div>
        </div>
      ` : ''}

      <!-- Additional Note -->
      <div style="margin-top: 1.75rem;">
        <label class="form-label" for="input-schedule-note">Lời nhắn gửi thêm hoặc lưu ý về lịch của bạn (tùy chọn):</label>
        <textarea id="input-schedule-note" class="form-textarea" placeholder="Ví dụ: buổi tối có ghé qua chỗ A">${state.draft.additional_note || ''}</textarea>
      </div>
    </div>
  `;

  container.innerHTML = html;

  container.querySelectorAll('.date-option-card').forEach(card => {
    card.addEventListener('click', () => {
      const dateId = card.dataset.dateId;
      const foundDate = dates.find(d => d.id === dateId);
      if (foundDate) {
        state.draft.date_selection = {
          is_flexible: false,
          date_id: foundDate.id,
          date_str: foundDate.date_str,
          display_label: foundDate.display_label,
          slot_id: foundDate.slots?.[0]?.id || null,
          slot_time: foundDate.slots?.[0]?.slot_time || '',
          period_label: foundDate.slots?.[0]?.period_label || ''
        };
        saveDraft();
        renderDateStep(container);
      }
    });
  });

  container.querySelectorAll('.slot-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      if (state.draft.date_selection) {
        state.draft.date_selection.slot_id = chip.dataset.slotId;
        state.draft.date_selection.slot_time = chip.dataset.slotTime;
        state.draft.date_selection.period_label = chip.dataset.slotPeriod;
        saveDraft();
        renderDateStep(container);
      }
    });
  });

  const cardFlexible = document.getElementById('card-flexible-date');
  if (cardFlexible) {
    cardFlexible.addEventListener('click', (e) => {
      const checkbox = document.getElementById('check-flexible');
      if (e.target !== checkbox) checkbox.checked = !checkbox.checked;

      if (checkbox.checked) {
        state.draft.date_selection = {
          is_flexible: true,
          display_label: 'Thời gian linh hoạt theo thỏa thuận'
        };
      } else {
        state.draft.date_selection = null;
      }
      saveDraft();
      renderDateStep(container);
    });
  }

  const noteInput = document.getElementById('input-schedule-note');
  if (noteInput) {
    noteInput.addEventListener('input', () => {
      state.draft.additional_note = noteInput.value;
      saveDraft();
    });
  }
}

// ------------------------------------------
// STEP 6: FINAL REVIEW & SUBMIT
// ------------------------------------------
function renderReviewStep(container) {
  const d = state.draft;

  let html = `
    <div class="review-plan-card">
      <div class="crystal-ribbon"></div>
      <div class="review-plan-header">
        <span class="badge badge-blue" style="margin-bottom: 0.5rem;">Bản Tóm Tắt Dự Án 411</span>
        <h2 class="hero-title" style="font-size: 2rem; margin-bottom: 0.3rem;">Kế Hoạch Triển Khai Hoàn Hảo</h2>
        <p class="hero-subtitle" style="font-size: 1rem; margin-bottom: 0;">Kiểm tra lại toàn bộ hướng đi đã chọn trước khi xác nhận gửi nhé!</p>
      </div>

      <!-- Food Row -->
      <div class="review-activity-row">
        <div class="review-activity-left">
          <div class="review-activity-icon">🍜</div>
          <div>
            <div class="review-activity-title">Đồ ăn nhom nhom</div>
            <div class="review-activity-detail">
              ${d.food_status === 'skipped' ? `
                <span class="skipped-tag">Bỏ qua lần này</span>
              ` : d.food_selection ? `
                <strong>${d.food_selection.restaurant_name}</strong> (${d.food_selection.dish_name})
                ${d.food_selection.address ? `<div style="font-size: 0.85rem; color: #64748B;">📍 ${d.food_selection.address}</div>` : ''}
              ` : `<span style="color: #EF4444;">Chưa chọn quán ăn</span>`}
            </div>
          </div>
        </div>
        <button class="btn btn-sm btn-outline btn-edit-step" data-target-step="1">Sửa</button>
      </div>

      <!-- Drinks Row -->
      <div class="review-activity-row">
        <div class="review-activity-left">
          <div class="review-activity-icon">☕</div>
          <div>
            <div class="review-activity-title">Cafe & Trò chuyện</div>
            <div class="review-activity-detail">
              ${d.drink_status === 'skipped' ? `
                <span class="skipped-tag">Bỏ qua lần này</span>
              ` : d.drink_selection ? `
                <strong>${d.drink_selection.cafe_name}</strong> (${d.drink_selection.style_name})
                ${d.drink_selection.address ? `<div style="font-size: 0.85rem; color: #64748B;">📍 ${d.drink_selection.address}</div>` : ''}
              ` : `<span style="color: #EF4444;">Chưa chọn quán cafe</span>`}
            </div>
          </div>
        </div>
        <button class="btn btn-sm btn-outline btn-edit-step" data-target-step="2">Sửa</button>
      </div>

      <!-- Workshop Row -->
      <div class="review-activity-row">
        <div class="review-activity-left">
          <div class="review-activity-icon">🎨</div>
          <div>
            <div class="review-activity-title">Workshop thủ công</div>
            <div class="review-activity-detail">
              ${d.workshop_status === 'skipped' ? `
                <span class="skipped-tag">Bỏ qua lần này</span>
              ` : d.workshop_selection ? `
                <strong>${d.workshop_selection.workshop_name}</strong>
                ${d.workshop_selection.venue_name ? `<div style="font-size: 0.85rem; color: #64748B;">Studio: ${d.workshop_selection.venue_name} - ${d.workshop_selection.duration || ''}</div>` : ''}
                ${d.workshop_selection.booking_url ? `<div style="font-size: 0.82rem; margin-top: 3px;"><a href="${d.workshop_selection.booking_url}" target="_blank" rel="noopener noreferrer" style="color: #0284C7; text-decoration: underline;">${d.workshop_selection.booking_url.includes('tiktok.com') ? '🎵 Xem Review TikTok' : '🔗 Link xem chi tiết'}</a></div>` : ''}
              ` : `<span style="color: #EF4444;">Chưa chọn workshop</span>`}
            </div>
          </div>
        </div>
        <button class="btn btn-sm btn-outline btn-edit-step" data-target-step="3">Sửa</button>
      </div>

      <!-- Photobooth Row -->
      <div class="review-activity-row">
        <div class="review-activity-left">
          <div class="review-activity-icon">📸</div>
          <div>
            <div class="review-activity-title">Chụp ảnh Photobooth</div>
            <div class="review-activity-detail">
              ${(d.photobooth_status === 'skipped' || d.movie_status === 'skipped') ? `
                <span class="skipped-tag">Bỏ qua lần này</span>
              ` : (d.photobooth_selection || d.movie_selection) ? `
                <strong>${(d.photobooth_selection || d.movie_selection)?.name || (d.photobooth_selection || d.movie_selection)?.photobooth_name || (d.photobooth_selection || d.movie_selection)?.movie_title}</strong>
                ${(d.photobooth_selection?.brand_name || d.photobooth_selection?.address) ? `<div style="font-size: 0.85rem; color: #64748B;">${[d.photobooth_selection.brand_name, d.photobooth_selection.address].filter(Boolean).join(' - ')}</div>` : ''}
                ${(d.photobooth_selection?.review_url) ? `<div style="font-size: 0.82rem; margin-top: 3px;"><a href="${d.photobooth_selection.review_url}" target="_blank" rel="noopener noreferrer" style="color: #0284C7; text-decoration: underline;">${d.photobooth_selection.review_url.includes('tiktok.com') ? '🎵 Xem Review TikTok' : '🔗 Link xem chi tiết'}</a></div>` : ''}
              ` : `<span style="color: #EF4444;">Chưa chọn tiệm photobooth</span>`}
            </div>
          </div>
        </div>
        <button class="btn btn-sm btn-outline btn-edit-step" data-target-step="4">Sửa</button>
      </div>

      <!-- Date & Time Row -->
      <div class="review-activity-row">
        <div class="review-activity-left">
          <div class="review-activity-icon">🗓️</div>
          <div>
            <div class="review-activity-title">Ngày đi chơi</div>
            <div class="review-activity-detail">
              ${d.date_selection ? `
                ${d.date_selection.is_flexible ? `
                  <span class="badge badge-blue">Thời gian linh hoạt theo bạn!</span>
                ` : `
                  <strong>${d.date_selection.display_label || d.date_selection.date_str}</strong>
                  ${d.date_selection.slot_time ? `<div>🕒 ${d.date_selection.slot_time} (${d.date_selection.period_label || ''})</div>` : ''}
                `}
              ` : `<span style="color: #EF4444;">Chưa chọn ngày đi chơi</span>`}
            </div>
          </div>
        </div>
        <button class="btn btn-sm btn-outline btn-edit-step" data-target-step="5">Sửa</button>
      </div>

      <!-- Note Row (if any) -->
      ${d.additional_note ? `
        <div class="review-activity-row" style="background: #FDFEFE; border-radius: var(--radius-sm); padding: 0.85rem;">
          <div class="review-activity-left">
            <div class="review-activity-icon" style="background: #FEF3C7; color: #92400E;">💬</div>
            <div>
              <div class="review-activity-title">Lời nhắn thêm:</div>
              <p style="font-style: italic; color: #475569; font-size: 0.95rem;">"${d.additional_note}"</p>
            </div>
          </div>
        </div>
      ` : ''}

    </div>
  `;

  container.innerHTML = html;

  container.querySelectorAll('.btn-edit-step').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentStep = parseInt(btn.dataset.targetStep, 10);
      renderCurrentStep();
    });
  });
}

// ==========================================
// 3. WIZARD NAVIGATION & SUBMISSION
// ==========================================
function validateStepBeforeProceeding(step) {
  if (step === 1) {
    if (state.draft.food_status === 'unanswered') {
      showToast('Vui lòng chọn xem bạn muốn ăn món gì hay bỏ qua nhé!', 'error');
      return false;
    }
    if (state.draft.food_status === 'selected' && !state.draft.food_selection) {
      showToast('Bạn đã chọn ăn uống nhưng chưa bấm chọn quán ăn nè.', 'error');
      return false;
    }
  } else if (step === 2) {
    if (state.draft.drink_status === 'unanswered') {
      showToast('Vui lòng chọn xem bạn muốn đi cafe hay bỏ qua nhé!', 'error');
      return false;
    }
    if (state.draft.drink_status === 'selected' && !state.draft.drink_selection) {
      showToast('Bạn đã chọn đi cafe nhưng chưa bấm chọn quán nè.', 'error');
      return false;
    }
  } else if (step === 3) {
    if (state.draft.workshop_status === 'unanswered') {
      showToast('Vui lòng chọn xem bạn muốn tham gia workshop hay bỏ qua nhé!', 'error');
      return false;
    }
    if (state.draft.workshop_status === 'selected' && !state.draft.workshop_selection) {
      showToast('Bạn đã chọn workshop nhưng chưa bấm chọn hoạt động nè.', 'error');
      return false;
    }
  } else if (step === 4) {
    const pbStatus = state.draft.photobooth_status || state.draft.movie_status;
    const pbSel = state.draft.photobooth_selection || state.draft.movie_selection;
    if (pbStatus === 'unanswered') {
      showToast('Vui lòng chọn xem bạn muốn chụp photobooth hay bỏ qua nhé!', 'error');
      return false;
    }
    if (pbStatus === 'selected' && !pbSel) {
      showToast('Bạn đã chọn chụp photobooth nhưng chưa bấm chọn tiệm nè.', 'error');
      return false;
    }
  } else if (step === 5) {
    if (!state.draft.date_selection) {
      showToast('Vui lòng chọn ngày đi chơi hoặc chọn thời gian linh hoạt nhé!', 'error');
      return false;
    }
  }
  return true;
}

async function handleFinalSubmit() {
  if (state.isSubmitting) return;

  for (let s = 1; s <= 5; s++) {
    if (!validateStepBeforeProceeding(s)) {
      state.currentStep = s;
      renderCurrentStep();
      return;
    }
  }

  const btnNext = document.getElementById('btn-wizard-next');
  state.isSubmitting = true;
  if (btnNext) {
    btnNext.disabled = true;
    btnNext.innerHTML = `<span>Đang ghi nhận kế hoạch... ⏳</span>`;
  }

  try {
    const payload = {
      invitation_id: state.settings?.id || 'default',
      food_status: state.draft.food_status,
      food_selection: state.draft.food_selection,
      drink_status: state.draft.drink_status,
      drink_selection: state.draft.drink_selection,
      workshop_status: state.draft.workshop_status,
      workshop_selection: state.draft.workshop_selection,
      photobooth_status: state.draft.photobooth_status || state.draft.movie_status,
      photobooth_selection: state.draft.photobooth_selection || state.draft.movie_selection,
      movie_status: state.draft.photobooth_status || state.draft.movie_status,
      movie_selection: state.draft.photobooth_selection || state.draft.movie_selection,
      date_selection: state.draft.date_selection,
      additional_note: state.draft.additional_note
    };

    const res = await fetch('/api/public/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Có lỗi xảy ra khi lưu lựa chọn.');
    }

    clearDraft();
    renderSuccessScreen(data.submission);
    switchView('view-success');
    showToast('Kế hoạch của bạn đã được ghi nhận thành công!', 'success');

  } catch (err) {
    console.error('Submission failed:', err);
    showToast(err.message || 'Gửi thất bại. Bản nháp của bạn vẫn được lưu an toàn!', 'error');
  } finally {
    state.isSubmitting = false;
    if (btnNext) {
      btnNext.disabled = false;
      btnNext.innerHTML = `<span>Gửi kế hoạch dự án</span>`;
    }
  }
}

function renderSuccessScreen(submission) {
  const container = document.getElementById('success-plan-summary');
  if (!container || !submission) return;

  const titles = state.settings?.step_titles || {};
  const successTitleEl = document.getElementById('success-screen-title');
  if (successTitleEl) successTitleEl.textContent = titles.success_title || 'Yayyy! Tớ nhận được lựa chọn của cậu rồi! 🎉';

  const successDescEl = document.getElementById('success-screen-desc');
  if (successDescEl) successDescEl.textContent = titles.success_desc || 'Tớ đã ghi lại toàn bộ những địa điểm cậu thích. Bây giờ để tớ chuẩn bị thật chu đáo nhé!';

  const dateText = submission.date_selection?.is_flexible
    ? 'Thời gian linh hoạt theo thỏa thuận'
    : `${submission.date_selection?.display_label || submission.date_selection?.date_str || ''} ${submission.date_selection?.slot_time ? `(${submission.date_selection.slot_time})` : ''}`;

  container.innerHTML = `
    <div style="margin-bottom: 1rem; border-bottom: 1px dashed #BAE6FD; padding-bottom: 0.75rem;">
      <div style="font-size: 0.85rem; color: var(--muted-blue);">Mã kế hoạch: <strong>${submission.id}</strong></div>
      <div style="font-size: 0.85rem; color: var(--muted-blue);">Thời gian gửi: <strong>${submission.formatted_created_at || 'Vừa xong'}</strong></div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 0.85rem; font-size: 0.95rem;">
      <div>🍜 <strong>Đồ ăn nhom nhom:</strong> ${submission.food_status === 'skipped' ? '<span class="skipped-tag">Bỏ qua</span>' : (submission.food_selection?.restaurant_name || 'Đã chọn')}</div>
      <div>☕ <strong>Cafe:</strong> ${submission.drink_status === 'skipped' ? '<span class="skipped-tag">Bỏ qua</span>' : (submission.drink_selection?.cafe_name || 'Đã chọn')}</div>
      <div>🎨 <strong>Workshop:</strong> ${submission.workshop_status === 'skipped' ? '<span class="skipped-tag">Bỏ qua</span>' : (submission.workshop_selection?.workshop_name || 'Đã chọn')}</div>
      <div>📸 <strong>Photobooth:</strong> ${(submission.photobooth_status === 'skipped' || submission.movie_status === 'skipped') ? '<span class="skipped-tag">Bỏ qua</span>' : (submission.photobooth_selection?.name || submission.movie_selection?.movie_title || 'Đã chọn')}</div>
      <div>🗓️ <strong>Ngày đi chơi:</strong> ${dateText}</div>
      ${submission.additional_note ? `<div>💬 <strong>Lời nhắn:</strong> <em>"${submission.additional_note}"</em></div>` : ''}
    </div>
  `;

  const btnCopy = document.getElementById('btn-copy-plan-text');
  if (btnCopy) {
    btnCopy.onclick = () => {
      const textToCopy = `✨ Kế hoạch dự án 411 (${submission.id}) ✨\n` +
        `- Đồ ăn nhom nhom: ${submission.food_status === 'skipped' ? 'Bỏ qua' : submission.food_selection?.restaurant_name}\n` +
        `- Cafe: ${submission.drink_status === 'skipped' ? 'Bỏ qua' : submission.drink_selection?.cafe_name}\n` +
        `- Workshop: ${submission.workshop_status === 'skipped' ? 'Bỏ qua' : submission.workshop_selection?.workshop_name}\n` +
        `- Photobooth: ${(submission.photobooth_status === 'skipped' || submission.movie_status === 'skipped') ? 'Bỏ qua' : (submission.photobooth_selection?.name || submission.movie_selection?.movie_title || 'Đã chọn')}\n` +
        `- Thời gian: ${dateText}\n` +
        (submission.additional_note ? `- Lời nhắn: "${submission.additional_note}"\n` : '');

      navigator.clipboard.writeText(textToCopy).then(() => {
        showToast('Đã sao chép kế hoạch vào bộ nhớ tạm!', 'success');
      });
    };
  }
}

// ==========================================
// 4. EVENT LISTENERS SETUP
// ==========================================
function setupEventListeners() {
  document.getElementById('nav-brand')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('view-landing');
  });

  document.getElementById('btn-start-wizard')?.addEventListener('click', () => {
    state.currentStep = 1;
    switchView('view-wizard');
    renderCurrentStep();
  });

  document.getElementById('btn-return-home')?.addEventListener('click', () => {
    switchView('view-landing');
  });

  document.getElementById('btn-wizard-prev')?.addEventListener('click', () => {
    if (state.currentStep > 1) {
      state.currentStep--;
      renderCurrentStep();
    }
  });

  document.getElementById('btn-wizard-next')?.addEventListener('click', () => {
    if (state.currentStep === state.totalSteps) {
      handleFinalSubmit();
    } else {
      if (validateStepBeforeProceeding(state.currentStep)) {
        state.currentStep++;
        renderCurrentStep();
      }
    }
  });

  document.querySelectorAll('.itinerary-node').forEach((node, idx) => {
    node.addEventListener('click', () => {
      const targetStep = idx + 1;
      if (targetStep < state.currentStep || validateStepBeforeProceeding(state.currentStep)) {
        state.currentStep = targetStep;
        renderCurrentStep();
      }
    });
  });

  document.getElementById('btn-toggle-admin-link')?.addEventListener('click', async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch('/api/auth/me', { headers, credentials: 'same-origin' });
      if (res.ok) {
        switchView('view-admin-dashboard');
        loadDashboard();
      } else {
        switchView('view-admin-login');
      }
    } catch {
      switchView('view-admin-login');
    }
  });

  document.getElementById('link-back-to-invite')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('view-landing');
  });
}

window.addEventListener('DOMContentLoaded', initApp);
