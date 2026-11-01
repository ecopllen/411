import { icons } from './icons.js';
import { showToast, switchView } from './app.js';

const adminState = {
  activeTab: 'submissions',
  metrics: { total: 0, new: 0, reviewed: 0, confirmed: 0, completed: 0 },
  submissions: [],
  settings: null,
  filter: {
    status: 'all',
    search: ''
  }
};

// ==========================================
// 1. AUTHENTICATED FETCH HELPER
// ==========================================
export async function authFetch(url, options = {}) {
  const token = localStorage.getItem('admin_token');
  const headers = {
    ...(options.headers || {})
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers
  });

  if (res.status === 401 && !url.includes('/api/auth/login')) {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    switchView('view-admin-login');
  }

  return res;
}

// ==========================================
// 2. IMAGE UPLOAD HELPER (From Local Computer)
// ==========================================
export async function uploadImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      showToast('Vui lòng chọn một tệp hình ảnh (.jpg, .png, .webp...).', 'error');
      return reject(new Error('Tệp không phải là hình ảnh hợp lệ.'));
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      try {
        showToast('Đang tải ảnh từ máy tính lên...', 'info');
        const res = await authFetch('/api/admin/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl, filename: file.name })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Tải ảnh lên thất bại');
        }
        showToast('Tải ảnh từ máy tính thành công! 🎉', 'success');
        resolve(data.url);
      } catch (err) {
        showToast(err.message, 'error');
        reject(err);
      }
    };
    reader.onerror = () => {
      showToast('Lỗi khi đọc file từ máy tính', 'error');
      reject(new Error('Lỗi khi đọc file từ máy tính'));
    };
    reader.readAsDataURL(file);
  });
}

export function attachImageUploader({ btnId, inputId, previewImgId }) {
  const btn = document.getElementById(btnId);
  const input = document.getElementById(inputId);
  const preview = previewImgId ? document.getElementById(previewImgId) : null;
  if (!btn || !input) return;

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    fileInput.click();
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (file) {
      try {
        const url = await uploadImageFile(file);
        input.value = url;
        if (preview) {
          preview.src = url;
          preview.style.display = 'block';
        }
      } catch (err) {
        console.error(err);
      } finally {
        fileInput.value = '';
      }
    }
  });

  input.addEventListener('input', () => {
    if (preview && input.value) {
      preview.src = input.value;
      preview.style.display = 'block';
    }
  });
}

// ==========================================
// 3. MODAL POPUP HELPERS
// ==========================================
export function openModal(htmlContent) {
  const modal = document.getElementById('app-modal');
  const body = document.getElementById('modal-body');
  if (modal && body) {
    body.innerHTML = htmlContent;
    modal.classList.add('active', 'open');
  }
}

export function closeModal() {
  const modal = document.getElementById('app-modal');
  if (modal) {
    modal.classList.remove('active', 'open');
  }
}

// ==========================================
// 4. DASHBOARD DATA LOADER
// ==========================================
export async function loadDashboard() {
  const savedUser = localStorage.getItem('admin_user');
  if (savedUser) {
    try {
      const u = JSON.parse(savedUser);
      const nameEl = document.getElementById('admin-display-name');
      if (nameEl) nameEl.textContent = u.displayName || u.username || 'Host';
    } catch {}
  }
  await loadMetrics();
  await loadSettings();
  renderActiveTab();
}

export async function loadMetrics() {
  try {
    const res = await authFetch('/api/admin/metrics');
    if (res.ok) {
      const data = await res.json();
      adminState.metrics = data;
      const elTotal = document.getElementById('stat-total');
      if (elTotal) elTotal.textContent = data.total ?? 0;
      const elNew = document.getElementById('stat-new');
      if (elNew) elNew.textContent = data.new ?? 0;
      const elRev = document.getElementById('stat-reviewed');
      if (elRev) elRev.textContent = data.reviewed ?? 0;
      const elConf = document.getElementById('stat-confirmed');
      if (elConf) elConf.textContent = data.confirmed ?? 0;
      const elComp = document.getElementById('stat-completed');
      if (elComp) elComp.textContent = data.completed ?? 0;
    }
  } catch (err) {
    console.error('Failed to load metrics:', err);
  }
}

export async function loadSettings() {
  try {
    const res = await authFetch('/api/admin/settings');
    if (res.ok) {
      adminState.settings = await res.json();
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

export function renderActiveTab() {
  const container = document.getElementById('admin-tab-content');
  if (!container) return;

  switch (adminState.activeTab) {
    case 'submissions':
      renderSubmissionsTab(container);
      break;
    case 'content_editor':
      renderContentEditorTab(container);
      break;
    case 'food':
      renderFoodManagementTab(container);
      break;
    case 'drinks':
      renderDrinksManagementTab(container);
      break;
    case 'workshops':
      renderWorkshopsManagementTab(container);
      break;
    case 'photobooths':
    case 'movies':
      renderPhotoboothsManagementTab(container);
      break;
    case 'dates':
      renderDatesManagementTab(container);
      break;
    case 'settings':
      renderSettingsTab(container);
      break;
    default:
      renderSubmissionsTab(container);
      break;
  }
}

// ==========================================
// 5. TAB: SUBMISSIONS MANAGEMENT (With Delete Option)
// ==========================================
async function renderSubmissionsTab(container) {
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
      <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center;">
        <input type="text" id="sub-search-input" class="form-input" style="width: 220px;" placeholder="Tìm theo mã hoặc ghi chú..." value="${adminState.filter.search}">
        <select id="sub-status-filter" class="form-select" style="width: 170px;">
          <option value="all" ${adminState.filter.status === 'all' ? 'selected' : ''}>Tất cả trạng thái</option>
          <option value="new" ${adminState.filter.status === 'new' ? 'selected' : ''}>Mới gửi (New)</option>
          <option value="reviewed" ${adminState.filter.status === 'reviewed' ? 'selected' : ''}>Đã xem (Reviewed)</option>
          <option value="confirmed" ${adminState.filter.status === 'confirmed' ? 'selected' : ''}>Đã chốt (Confirmed)</option>
          <option value="completed" ${adminState.filter.status === 'completed' ? 'selected' : ''}>Hoàn thành (Done)</option>
        </select>
      </div>
      <div style="display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap;">
        <a href="/api/admin/submissions/export/csv?status=${adminState.filter.status}&search=${encodeURIComponent(adminState.filter.search)}" class="btn btn-sm btn-ocean-glass" target="_blank" download="birthday_plans.csv">
          ${icons.download} <span>Xuất CSV (Excel)</span>
        </a>
        <button class="btn btn-sm btn-danger" id="btn-clear-all-subs">
          ${icons.trash} <span>Xóa tất cả kế hoạch</span>
        </button>
      </div>
    </div>

    <div class="data-table-wrapper" style="background: rgba(255, 255, 255, 0.95); border-radius: var(--radius-md); overflow: hidden; border: 1.5px solid #BAE6FD; box-shadow: 0 4px 16px rgba(14, 116, 144, 0.06);">
      <table class="data-table" style="width: 100%; border-collapse: collapse; text-align: left;">
        <thead>
          <tr style="background: #F0F9FF; border-bottom: 2px solid #BAE6FD;">
            <th style="padding: 0.85rem 1rem;">Mã đơn</th>
            <th style="padding: 0.85rem 1rem;">Thời gian gửi (VN)</th>
            <th style="padding: 0.85rem 1rem;">Món ăn</th>
            <th style="padding: 0.85rem 1rem;">Cafe</th>
            <th style="padding: 0.85rem 1rem;">Workshop</th>
            <th style="padding: 0.85rem 1rem;">Photobooth</th>
            <th style="padding: 0.85rem 1rem;">Ngày & Giờ</th>
            <th style="padding: 0.85rem 1rem;">Trạng thái</th>
            <th style="padding: 0.85rem 1rem; text-align: center;">Thao tác</th>
          </tr>
        </thead>
        <tbody id="submissions-tbody">
          <tr><td colspan="9" style="text-align: center; padding: 2rem;">Đang tải dữ liệu kế hoạch...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  try {
    const res = await authFetch(`/api/admin/submissions?status=${adminState.filter.status}&search=${encodeURIComponent(adminState.filter.search)}`);
    if (!res.ok) {
      if (res.status === 401) {
        switchView('view-admin-login');
        return;
      }
      throw new Error('Lỗi khi tải danh sách kế hoạch.');
    }
    const list = await res.json();
    if (!Array.isArray(list)) {
      throw new Error('Dữ liệu kế hoạch không hợp lệ.');
    }
    adminState.submissions = list;
    const tbody = document.getElementById('submissions-tbody');

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2.5rem; color: #64748B;">Chưa có kế hoạch nào được gửi hoặc đã xóa hết.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(sub => {
      const foodText = sub.food_status === 'skipped' ? '<span class="skipped-tag">Bỏ qua</span>' : (sub.food_selection?.restaurant_name || 'Đã chọn');
      const drinkText = sub.drink_status === 'skipped' ? '<span class="skipped-tag">Bỏ qua</span>' : (sub.drink_selection?.cafe_name || 'Đã chọn');
      const wsText = sub.workshop_status === 'skipped' ? '<span class="skipped-tag">Bỏ qua</span>' : (sub.workshop_selection?.workshop_name || 'Đã chọn');
      const pb = sub.photobooth_selection || sub.movie_selection;
      const pbStatus = sub.photobooth_status || sub.movie_status;
      const movieText = pbStatus === 'skipped' ? '<span class="skipped-tag">Bỏ qua</span>' : (pb?.name || pb?.photobooth_name || pb?.movie_title || 'Đã chọn');
      const dateText = sub.date_selection?.is_flexible ? 'Linh hoạt' : (sub.date_selection?.display_label || sub.date_selection?.date_str || '');

      let statusBadge = `<span class="badge badge-blue">New</span>`;
      if (sub.status === 'reviewed') statusBadge = `<span class="badge badge-yellow">Reviewed</span>`;
      if (sub.status === 'confirmed') statusBadge = `<span class="badge badge-green">Confirmed</span>`;
      if (sub.status === 'completed') statusBadge = `<span class="badge badge-purple">Completed</span>`;

      return `
        <tr style="border-bottom: 1px solid #F1F5F9;">
          <td style="padding: 0.75rem 1rem;"><strong style="color: #0284C7;">${sub.id}</strong></td>
          <td style="padding: 0.75rem 1rem; font-size: 0.84rem; color: #64748B;">${sub.formatted_created_at}</td>
          <td style="padding: 0.75rem 1rem;">${foodText}</td>
          <td style="padding: 0.75rem 1rem;">${drinkText}</td>
          <td style="padding: 0.75rem 1rem;">${wsText}</td>
          <td style="padding: 0.75rem 1rem;">${movieText}</td>
          <td style="padding: 0.75rem 1rem; font-size: 0.85rem;">${dateText}</td>
          <td style="padding: 0.75rem 1rem;">${statusBadge}</td>
          <td style="padding: 0.75rem 1rem; text-align: center;">
            <div style="display: flex; gap: 0.35rem; justify-content: center;">
              <button class="btn btn-sm btn-outline btn-view-sub" data-sub-id="${sub.id}" title="Xem chi tiết">Xem</button>
              <button class="btn btn-sm btn-outline btn-copy-summary" data-sub-id="${sub.id}" title="Sao chép tóm tắt cho Zalo">${icons.copy}</button>
              <button class="btn btn-sm btn-danger btn-delete-sub-row" data-sub-id="${sub.id}" title="Xóa kế hoạch này">${icons.trash} Xóa</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-view-sub').forEach(btn => {
      btn.addEventListener('click', () => openSubmissionDetailsModal(btn.dataset.subId));
    });

    tbody.querySelectorAll('.btn-copy-summary').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.subId;
        const res = await authFetch(`/api/admin/submissions/${id}`);
        const data = await res.json();
        if (data.shareText) {
          navigator.clipboard.writeText(data.shareText).then(() => {
            showToast('Đã sao chép kế hoạch gửi Zalo/tin nhắn!', 'success');
          });
        }
      });
    });

    // Delete single submission row
    tbody.querySelectorAll('.btn-delete-sub-row').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.subId;
        if (confirm(`Bạn có chắc chắn muốn xóa kế hoạch ${id} khỏi cơ sở dữ liệu?`)) {
          try {
            const res = await authFetch(`/api/admin/submissions/${id}`, { method: 'DELETE' });
            if (res.ok) {
              showToast(`Đã xóa kế hoạch ${id} thành công!`, 'success');
              loadMetrics();
              renderSubmissionsTab(container);
            } else {
              showToast('Lỗi khi xóa kế hoạch.', 'error');
            }
          } catch (err) {
            showToast('Lỗi khi xóa: ' + err.message, 'error');
          }
        }
      });
    });

    // Delete all submissions
    document.getElementById('btn-clear-all-subs')?.addEventListener('click', async () => {
      if (confirm('CẢNH BÁO: Bạn có chắc chắn muốn xóa TOÀN BỘ các kế hoạch đã lưu? Hành động này không thể hoàn tác!')) {
        try {
          const res = await authFetch('/api/admin/submissions', { method: 'DELETE' });
          if (res.ok) {
            showToast('Đã xóa toàn bộ kế hoạch đã lưu!', 'success');
            loadMetrics();
            renderSubmissionsTab(container);
          } else {
            showToast('Lỗi khi xóa toàn bộ kế hoạch.', 'error');
          }
        } catch (err) {
          showToast('Lỗi khi xóa: ' + err.message, 'error');
        }
      }
    });

  } catch (err) {
    console.error('Failed to load submissions:', err);
    const tbody = document.getElementById('submissions-tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2rem; color: #DC2626;">Lỗi tải dữ liệu. Vui lòng thử đăng nhập lại.</td></tr>`;
    }
  }

  document.getElementById('sub-search-input')?.addEventListener('input', (e) => {
    adminState.filter.search = e.target.value;
    renderSubmissionsTab(container);
  });

  document.getElementById('sub-status-filter')?.addEventListener('change', (e) => {
    adminState.filter.status = e.target.value;
    renderSubmissionsTab(container);
  });
}

async function openSubmissionDetailsModal(id) {
  try {
    const res = await authFetch(`/api/admin/submissions/${id}`);
    const sub = await res.json();
    if (!res.ok) throw new Error(sub.error || 'Không tìm thấy kế hoạch');

    const html = `
      <div style="margin-bottom: 1.25rem;">
        <span class="badge badge-blue">Chi Tiết Kế Hoạch Sinh Nhật</span>
        <h3 style="font-size: 1.45rem; font-weight: 700; margin-top: 0.4rem; color: var(--ocean-deep); font-family: var(--font-display);">Mã đơn: ${sub.id}</h3>
        <div style="font-size: 0.85rem; color: #64748B;">Thời gian tạo: ${sub.formatted_created_at} | IP: ${sub.client_ip || 'N/A'}</div>
      </div>

      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: var(--radius-sm); padding: 0.85rem; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between;">
        <label style="font-weight: 700; font-size: 0.9rem;">Cập nhật trạng thái:</label>
        <select id="modal-sub-status-select" class="form-select" style="width: 180px;">
          <option value="new" ${sub.status === 'new' ? 'selected' : ''}>Mới gửi (New)</option>
          <option value="reviewed" ${sub.status === 'reviewed' ? 'selected' : ''}>Đã xem (Reviewed)</option>
          <option value="confirmed" ${sub.status === 'confirmed' ? 'selected' : ''}>Đã chốt (Confirmed)</option>
          <option value="completed" ${sub.status === 'completed' ? 'selected' : ''}>Hoàn thành (Done)</option>
        </select>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.85rem; margin-bottom: 1.5rem; font-size: 0.92rem;">
        <div style="border-bottom: 1px solid #F1F5F9; padding-bottom: 0.5rem;">
          <strong>🍜 Ăn uống:</strong> ${sub.food_status === 'skipped' ? '<span class="skipped-tag">Bỏ qua</span>' : `
            <strong>${sub.food_selection?.restaurant_name}</strong> - Món: ${sub.food_selection?.dish_name} (${sub.food_selection?.price || ''})
            <div style="color: #64748B; font-size: 0.84rem;">📍 ${sub.food_selection?.address || ''}</div>
          `}
        </div>
        <div style="border-bottom: 1px solid #F1F5F9; padding-bottom: 0.5rem;">
          <strong>☕ Cafe/Nước:</strong> ${sub.drink_status === 'skipped' ? '<span class="skipped-tag">Bỏ qua</span>' : `
            <strong>${sub.drink_selection?.cafe_name}</strong> - Phong cách: ${sub.drink_selection?.style_name}
            <div style="color: #64748B; font-size: 0.84rem;">📍 ${sub.drink_selection?.address || ''} (${sub.drink_selection?.opening_hours || ''})</div>
          `}
        </div>
        <div style="border-bottom: 1px solid #F1F5F9; padding-bottom: 0.5rem;">
          <strong>🎨 Workshop:</strong> ${sub.workshop_status === 'skipped' ? '<span class="skipped-tag">Bỏ qua</span>' : `
            <strong>${sub.workshop_selection?.workshop_name}</strong>
            <div style="color: #64748B; font-size: 0.84rem;">Studio: ${sub.workshop_selection?.venue_name || ''} - ${sub.workshop_selection?.duration || ''} (${sub.workshop_selection?.price || ''})</div>
          `}
        </div>
        <div style="border-bottom: 1px solid #F1F5F9; padding-bottom: 0.5rem;">
          <strong>📸 Photobooth:</strong> ${(sub.photobooth_status || sub.movie_status) === 'skipped' ? '<span class="skipped-tag">Bỏ qua</span>' : `
            <strong>${(sub.photobooth_selection || sub.movie_selection)?.name || (sub.photobooth_selection || sub.movie_selection)?.photobooth_name || (sub.photobooth_selection || sub.movie_selection)?.movie_title || 'Đã chọn'}</strong>
            ${(sub.photobooth_selection || sub.movie_selection)?.brand_name ? `<div style="color: #64748B; font-size: 0.84rem;">Tiệm: ${(sub.photobooth_selection || sub.movie_selection)?.brand_name}</div>` : ''}
            ${(sub.photobooth_selection || sub.movie_selection)?.address ? `<div style="color: #64748B; font-size: 0.84rem;">Địa chỉ: ${(sub.photobooth_selection || sub.movie_selection)?.address}</div>` : ''}
            ${(sub.photobooth_selection || sub.movie_selection)?.price ? `<div style="color: #64748B; font-size: 0.84rem;">Giá: ${(sub.photobooth_selection || sub.movie_selection)?.price}</div>` : ''}
          `}
        </div>
        <div style="border-bottom: 1px solid #F1F5F9; padding-bottom: 0.5rem;">
          <strong>🗓️ Ngày & Giờ:</strong> ${sub.date_selection?.is_flexible ? 'Thời gian linh hoạt theo bạn thân' : `
            ${sub.date_selection?.display_label || sub.date_selection?.date_str || ''} ${sub.date_selection?.slot_time ? `➔ ${sub.date_selection.slot_time} (${sub.date_selection.period_label || ''})` : ''}
          `}
        </div>
        ${sub.additional_note ? `
          <div style="background: #FEF9C3; border-left: 3px solid #EAB308; padding: 0.6rem; border-radius: 4px;">
            <strong>💬 Lời nhắn thêm:</strong> "${sub.additional_note}"
          </div>
        ` : ''}
      </div>

      <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
        <button class="btn btn-secondary" id="btn-modal-copy-summary">${icons.copy} Sao chép tin nhắn</button>
        <button class="btn btn-danger" id="btn-modal-delete-sub">${icons.trash} Xóa kế hoạch</button>
      </div>
    `;

    openModal(html);

    document.getElementById('modal-sub-status-select')?.addEventListener('change', async (e) => {
      const newStatus = e.target.value;
      await authFetch(`/api/admin/submissions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      showToast('Đã cập nhật trạng thái đơn!', 'success');
      loadMetrics();
      renderActiveTab();
    });

    document.getElementById('btn-modal-copy-summary')?.addEventListener('click', () => {
      if (sub.shareText) {
        navigator.clipboard.writeText(sub.shareText).then(() => {
          showToast('Đã sao chép tóm tắt gửi Zalo/tin nhắn!', 'success');
        });
      }
    });

    document.getElementById('btn-modal-delete-sub')?.addEventListener('click', async () => {
      if (confirm(`Bạn có chắc chắn muốn xóa kế hoạch ${id}?`)) {
        await authFetch(`/api/admin/submissions/${id}`, { method: 'DELETE' });
        showToast('Đã xóa kế hoạch thành công.', 'info');
        closeModal();
        loadMetrics();
        renderActiveTab();
      }
    });

  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================
// 6. TAB: CONTENT & IMAGE EDITOR (With Computer Upload)
// ==========================================
function renderContentEditorTab(container) {
  const s = adminState.settings || {};
  const teasers = s.teaser_cards || [];
  const steps = s.step_titles || {};

  const defaultMsg = 'Dưới đây là các đề xuất về những hướng phát triển tiềm năng cho dự án, chúng tôi đánh giá nếu bảng kế hoạch hoàn thiện, đây sẽ là một chuỗi các hoạt động mang tầm ảnh hưởng tới thị trường.';
  const defaultTeaserImgs = [
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop&q=80'
  ];
  const defaultTeaserTitles = [
    'Đồ ăn',
    'Cafe',
    'Workshop',
    'Photobooth'
  ];

  container.innerHTML = `
    <div style="background: var(--glass-card-bg, #FFFFFF); border: 1.5px solid var(--glass-border, #BAE6FD); border-radius: var(--radius-md); padding: 2.25rem; box-shadow: 0 12px 32px rgba(14, 116, 144, 0.08); max-width: 820px; margin: 0 auto; backdrop-filter: blur(16px);">
      <h3 style="font-size: 1.45rem; font-weight: 700; color: var(--ocean-deep); font-family: var(--font-display); margin-bottom: 0.4rem;">
        Chỉnh Sửa Toàn Bộ Chữ & Hình Ảnh Website 🎨
      </h3>
      <p style="color: var(--text-sub); font-size: 0.95rem; margin-bottom: 2rem;">
        Thay đổi bất kỳ văn bản, tiêu đề, bức thư, câu hỏi từng bước hoặc tải ảnh trực tiếp từ máy tính lên trang web.
      </p>

      <form id="form-full-content-editor">
        
        <!-- PHẦN 1: TRANG CHỦ & HERO -->
        <div style="margin-bottom: 2.25rem; border-bottom: 1.5px dashed #BAE6FD; padding-bottom: 1.75rem;">
          <h4 style="font-size: 1.15rem; color: #0284C7; font-family: var(--font-display); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
            <span>1. Trang Chủ & Lời Nhắn Mở Đầu</span> <span>✨</span>
          </h4>

          <div class="form-group">
            <label class="form-label">Ngày mốc hiển thị (Badge ngày sinh nhật / dự án):</label>
            <input type="text" id="edit-birthday-date" class="form-input" value="${s.birthday_date || '04.11.2026'}" required>
          </div>

          <div class="form-group">
            <label class="form-label">Tiêu đề lớn (Hero Title):</label>
            <input type="text" id="edit-hero-title" class="form-input" value="${s.hero_title || 'Dự Án 411 - A Little Adventure'}" required>
          </div>

          <div class="form-group">
            <label class="form-label">Tiêu đề phụ (Hero Subtitle):</label>
            <input type="text" id="edit-hero-subtitle" class="form-input" value="${s.hero_subtitle || 'Bảng kế hoạch triển khai dự án 411'}" required>
          </div>

          <div class="form-group">
            <label class="form-label">Huy hiệu trên góc bức thư (Letter Badge):</label>
            <input type="text" id="edit-letter-badge" class="form-input" value="${s.letter_badge || 'Bảng Kế Hoạch Triển Khai 💌'}" required>
          </div>

          <div class="form-group">
            <label class="form-label">Nội dung bức thư / Thông điệp kế hoạch:</label>
            <textarea id="edit-personal-message" class="form-textarea" rows="4">${(s.personal_message && s.personal_message.trim() !== '') ? s.personal_message : defaultMsg}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Chữ trên nút khám phá chính:</label>
            <input type="text" id="edit-cta-btn-text" class="form-input" value="${s.cta_button_text || 'Khám phá chuỗi dự án'}" required>
          </div>
        </div>

        <!-- PHẦN 2: 4 THẺ ẢNH POLAROID TRANG CHỦ -->
        <div style="margin-bottom: 2.25rem; border-bottom: 1.5px dashed #BAE6FD; padding-bottom: 1.75rem;">
          <h4 style="font-size: 1.15rem; color: #0284C7; font-family: var(--font-display); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
            <span>2. Hình Ảnh 4 Thẻ Cẩm Nang Trang Chủ</span> <span>🖼️</span>
          </h4>
          <p style="font-size: 0.88rem; color: #64748B; margin-bottom: 1.25rem;">
            Bạn có thể <strong>tải ảnh trực tiếp từ máy tính</strong> hoặc dán link ảnh trực tuyến (Unsplash, Imgur, v.v.).
          </p>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.25rem;">
            ${[0, 1, 2, 3].map(i => {
              const card = teasers[i] || {};
              const cTitle = card.title || card.caption || defaultTeaserTitles[i];
              const cImg = (card.image_url && card.image_url.trim() !== '') ? card.image_url : defaultTeaserImgs[i];
              return `
                <div style="background: #F8FAFC; border: 1.5px solid #BAE6FD; border-radius: var(--radius-sm); padding: 1.1rem;">
                  <strong style="color: var(--ocean-deep); font-size: 0.95rem; display: block; margin-bottom: 0.5rem;">Thẻ ${i+1}:</strong>
                  <div class="form-group" style="margin-bottom: 0.5rem;">
                    <label style="font-size: 0.82rem; color: #64748B;">Tiêu đề hiển thị:</label>
                    <input type="text" id="teaser-title-${i}" class="form-input" value="${cTitle}" style="padding: 0.45rem 0.75rem; font-size: 0.88rem;">
                  </div>
                  <div class="form-group" style="margin-bottom: 0.5rem;">
                    <label style="font-size: 0.82rem; color: #64748B;">Link ảnh hoặc tải từ máy tính:</label>
                    <div style="display: flex; gap: 0.4rem;">
                      <input type="text" id="teaser-img-${i}" class="form-input" value="${cImg}" style="padding: 0.45rem 0.75rem; font-size: 0.88rem;">
                      <button type="button" class="btn btn-sm btn-ocean-glass" id="btn-upload-teaser-${i}" title="Tải ảnh từ máy tính">📁 Tải ảnh</button>
                    </div>
                  </div>
                  <div class="upload-preview-box" style="height: 100px;">
                    <img id="preview-teaser-${i}" src="${cImg}" alt="preview" onerror="this.src='${defaultTeaserImgs[i]}'">
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- PHẦN 3: TIÊU ĐỀ & CÂU HỎI TỪNG BƯỚC KHẢO SÁT -->
        <div style="margin-bottom: 2rem;">
          <h4 style="font-size: 1.15rem; color: #0284C7; font-family: var(--font-display); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
            <span>3. Tiêu Đề & Câu Hỏi Từng Bước Khảo Sát</span> <span>📝</span>
          </h4>

          <!-- Step 1: Food -->
          <div style="background: #F0F9FF; border: 1px solid #BAE6FD; border-radius: var(--radius-sm); padding: 1rem; margin-bottom: 1rem;">
            <strong style="color: #0369A1;">🍜 Bước 1: Khảo Sát Món Ăn</strong>
            <div class="form-group" style="margin-top: 0.5rem;">
              <label style="font-size: 0.85rem; font-weight: 600;">Câu hỏi:</label>
              <input type="text" id="step-food-title" class="form-input" value="${steps.food_title || 'Hôm đó cậu muốn ăn gì nè? 🍜'}">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label style="font-size: 0.85rem; font-weight: 600;">Mô tả:</label>
              <input type="text" id="step-food-desc" class="form-input" value="${steps.food_desc || 'Cậu có muốn chọn trước một món ăn hoặc quán thật ngon cùng tớ không?'}">
            </div>
          </div>

          <!-- Step 2: Drinks -->
          <div style="background: #F0F9FF; border: 1px solid #BAE6FD; border-radius: var(--radius-sm); padding: 1rem; margin-bottom: 1rem;">
            <strong style="color: #0369A1;">☕ Bước 2: Khảo Sát Cafe & Đồ Uống</strong>
            <div class="form-group" style="margin-top: 0.5rem;">
              <label style="font-size: 0.85rem; font-weight: 600;">Câu hỏi:</label>
              <input type="text" id="step-drinks-title" class="form-input" value="${steps.drinks_title || 'Sau khi ăn, mình có muốn đi uống nước không? ☕'}">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label style="font-size: 0.85rem; font-weight: 600;">Mô tả:</label>
              <input type="text" id="step-drinks-desc" class="form-input" value="${steps.drinks_desc || 'Ghé một tiệm cafe thật xinh xắn để cùng chuyện trò và chụp ảnh lưu niệm nhé!'}">
            </div>
          </div>

          <!-- Step 3: Workshops -->
          <div style="background: #F0F9FF; border: 1px solid #BAE6FD; border-radius: var(--radius-sm); padding: 1rem; margin-bottom: 1rem;">
            <strong style="color: #0369A1;">🎨 Bước 3: Khảo Sát Workshop Thủ Công</strong>
            <div class="form-group" style="margin-top: 0.5rem;">
              <label style="font-size: 0.85rem; font-weight: 600;">Câu hỏi:</label>
              <input type="text" id="step-workshops-title" class="form-input" value="${steps.workshops_title || 'Hay mình cùng làm một thứ gì đó thật xinh? 🎨'}">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label style="font-size: 0.85rem; font-weight: 600;">Mô tả:</label>
              <input type="text" id="step-workshops-desc" class="form-input" value="${steps.workshops_desc || 'Tự tay làm vòng tay, nến thơm, xoay gốm hoặc tô tượng mang về làm kỷ niệm.'}">
            </div>
          </div>

          <!-- Step 4: Photobooth -->
          <div style="background: #F0F9FF; border: 1px solid #BAE6FD; border-radius: var(--radius-sm); padding: 1rem; margin-bottom: 1rem;">
            <strong style="color: #0369A1;">📸 Bước 4: Khảo Sát Photobooth</strong>
            <div class="form-group" style="margin-top: 0.5rem;">
              <label style="font-size: 0.85rem; font-weight: 600;">Câu hỏi:</label>
              <input type="text" id="step-movies-title" class="form-input" value="${steps.photobooths_title || steps.movies_title || 'Đi chụp Photobooth cùng nhau nha? 📸'}">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label style="font-size: 0.85rem; font-weight: 600;">Mô tả:</label>
              <input type="text" id="step-movies-desc" class="form-input" value="${steps.photobooths_desc || steps.movies_desc || 'Đội nón cute, đeo kính hài hước rồi in dải ảnh lưu giữ kỷ niệm tuổi mới thật vui!'}">
            </div>
          </div>

          <!-- Step 5: Dates -->
          <div style="background: #F0F9FF; border: 1px solid #BAE6FD; border-radius: var(--radius-sm); padding: 1rem; margin-bottom: 1rem;">
            <strong style="color: #0369A1;">🗓️ Bước 5: Chọn Lịch Ngày & Giờ</strong>
            <div class="form-group" style="margin-top: 0.5rem;">
              <label style="font-size: 0.85rem; font-weight: 600;">Tiêu đề:</label>
              <input type="text" id="step-dates-title" class="form-input" value="${steps.dates_title || 'Chọn ngày mình cùng nhau đi chơi nhé! 🗓️'}">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label style="font-size: 0.85rem; font-weight: 600;">Mô tả:</label>
              <input type="text" id="step-dates-desc" class="form-input" value="${steps.dates_desc || 'Sinh nhật là ngày 04/11/2026, nhưng tụi mình có thể chọn ngày thuận tiện nhất cho cậu nè!'}">
            </div>
          </div>

          <!-- Step 6: Success screen -->
          <div style="background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: var(--radius-sm); padding: 1rem;">
            <strong style="color: #065F46;">🎉 Màn Hình Chúc Mừng Sau Khi Gửi Đơn</strong>
            <div class="form-group" style="margin-top: 0.5rem;">
              <label style="font-size: 0.85rem; font-weight: 600;">Tiêu đề chúc mừng:</label>
              <input type="text" id="step-success-title" class="form-input" value="${steps.success_title || 'Yayyy! Tớ nhận được lựa chọn của cậu rồi! 🎉'}">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label style="font-size: 0.85rem; font-weight: 600;">Lời nhắn cảm ơn:</label>
              <input type="text" id="step-success-desc" class="form-input" value="${steps.success_desc || 'Tớ đã ghi lại toàn bộ những địa điểm cậu thích. Bây giờ để tớ chuẩn bị thật chu đáo nhé!'}">
            </div>
          </div>
        </div>

        <button type="submit" class="btn btn-pill-sunlit btn-lg" style="width: 100%;">Lưu Toàn Bộ Chữ & Hình Ảnh Website 💾</button>
      </form>
    </div>
  `;

  // Attach upload handlers for all 4 teaser cards
  [0, 1, 2, 3].forEach(i => {
    attachImageUploader({
      btnId: `btn-upload-teaser-${i}`,
      inputId: `teaser-img-${i}`,
      previewImgId: `preview-teaser-${i}`
    });
  });

  document.getElementById('form-full-content-editor')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const updatedTeasers = [0, 1, 2, 3].map(i => {
      const titleVal = document.getElementById(`teaser-title-${i}`)?.value?.trim() || defaultTeaserTitles[i];
      const imgVal = document.getElementById(`teaser-img-${i}`)?.value?.trim() || defaultTeaserImgs[i];
      return {
        id: ['food', 'drinks', 'workshops', 'movies'][i],
        title: titleVal,
        caption: titleVal,
        image_url: imgVal
      };
    });

    const updatedSteps = {
      food_title: document.getElementById('step-food-title').value,
      food_desc: document.getElementById('step-food-desc').value,
      drinks_title: document.getElementById('step-drinks-title').value,
      drinks_desc: document.getElementById('step-drinks-desc').value,
      workshops_title: document.getElementById('step-workshops-title').value,
      workshops_desc: document.getElementById('step-workshops-desc').value,
      photobooths_title: document.getElementById('step-movies-title').value,
      photobooths_desc: document.getElementById('step-movies-desc').value,
      movies_title: document.getElementById('step-movies-title').value,
      movies_desc: document.getElementById('step-movies-desc').value,
      dates_title: document.getElementById('step-dates-title').value,
      dates_desc: document.getElementById('step-dates-desc').value,
      success_title: document.getElementById('step-success-title').value,
      success_desc: document.getElementById('step-success-desc').value
    };

    const payload = {
      birthday_date: document.getElementById('edit-birthday-date').value,
      hero_title: document.getElementById('edit-hero-title').value,
      hero_subtitle: document.getElementById('edit-hero-subtitle').value,
      letter_badge: document.getElementById('edit-letter-badge').value,
      personal_message: document.getElementById('edit-personal-message').value,
      cta_button_text: document.getElementById('edit-cta-btn-text').value,
      teaser_cards: updatedTeasers,
      step_titles: updatedSteps
    };

    try {
      const res = await authFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      adminState.settings = data;
      showToast('Đã lưu toàn bộ chữ và hình ảnh website thành công!', 'success');
      if (window.refreshPublicData) window.refreshPublicData();
      renderContentEditorTab(container);
    } catch (err) {
      showToast('Lỗi khi lưu: ' + err.message, 'error');
    }
  });
}

// ==========================================
// 7. TAB: FOOD MANAGEMENT
// ==========================================
async function renderFoodManagementTab(container) {
  const res = await fetch('/api/public/activities');
  const catalog = await res.json();
  const categories = catalog.food || [];
  const foodTree = categories;

  let html = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
      <h3 style="font-size: 1.35rem; font-weight: 700; color: #0C4A6E; font-family: var(--font-display);">Quản Lý Thực Đơn & Nhà Hàng 🍜</h3>
      <button class="btn btn-sm btn-pill-sunlit" id="btn-add-food-cat">${icons.plus} Thêm danh mục món</button>
    </div>
  `;

  if (!foodTree.length) {
    html += `<div style="text-align: center; padding: 2rem; color: #0369A1;">Chưa có danh mục món ăn nào. Bấm nút Thêm danh mục ở trên để tạo nhé!</div>`;
  } else {
    for (const cat of foodTree) {
      html += `
        <div style="background: rgba(255, 255, 255, 0.95); border: 1.5px solid #BAE6FD; border-radius: var(--radius-md); padding: 1.35rem; margin-bottom: 1.5rem; box-shadow: 0 4px 16px rgba(14, 116, 144, 0.06);">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #F1F5F9; padding-bottom: 0.75rem; margin-bottom: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.4rem;">${cat.icon || '🍜'}</span>
              <h4 style="font-size: 1.15rem; font-weight: 700; color: var(--ocean-deep); font-family: var(--font-display);">${cat.name}</h4>
            </div>
            <div style="display: flex; gap: 0.4rem;">
              <button class="btn btn-sm btn-secondary btn-add-dish" data-cat-id="${cat.id}">${icons.plus} Thêm món</button>
              <button class="btn btn-sm btn-ocean-glass btn-edit-food-cat" data-cat-id="${cat.id}" style="padding: 0.25rem 0.6rem;">✏️ Sửa</button>
              <button class="btn btn-sm btn-danger btn-delete-cat" data-cat-id="${cat.id}">${icons.trash}</button>
            </div>
          </div>

          <div>
            ${(cat.dishes || []).map(dish => `
              <div style="margin-bottom: 1rem; padding-left: 0.75rem; border-left: 3px solid #38BDF8;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <strong style="color: var(--ocean-deep); font-size: 0.98rem;">${dish.name}</strong>
                  <div style="display: flex; gap: 0.4rem;">
                    <button class="btn btn-sm btn-outline btn-add-restaurant" data-dish-id="${dish.id}">${icons.plus} Thêm quán</button>
                    <button class="btn btn-sm btn-ocean-glass btn-edit-dish" data-dish-id="${dish.id}" data-cat-id="${cat.id}" style="padding: 0.25rem 0.6rem;">✏️ Sửa</button>
                    <button class="btn btn-sm btn-outline btn-delete-dish" data-dish-id="${dish.id}">${icons.trash}</button>
                  </div>
                </div>
                <div style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.4rem;">
                  ${(dish.restaurants || []).map(r => `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: #F0F9FF; padding: 0.5rem 0.85rem; border-radius: var(--radius-sm); font-size: 0.88rem; gap: 0.5rem; flex-wrap: wrap;">
                      <div style="flex: 1; min-width: 220px;">
                        <strong>${r.name}</strong> - <span>${r.address || 'Chưa có địa chỉ'}</span> (${r.price_range || ''})
                        ${r.menu_url ? `<div style="font-size: 0.8rem; margin-top: 3px;"><a href="${r.menu_url}" target="_blank" rel="noopener noreferrer" style="color: #0284C7; text-decoration: underline;">🎵 Link Review / Menu</a></div>` : ''}
                      </div>
                      <div style="display: flex; gap: 0.35rem; align-items: center;">
                        <button class="btn btn-sm btn-ocean-glass btn-edit-restaurant" data-rest-id="${r.id}" data-dish-id="${dish.id}" data-cat-id="${cat.id}" style="padding: 0.25rem 0.6rem;">✏️ Sửa</button>
                        <button class="btn btn-sm btn-outline btn-delete-restaurant" data-rest-id="${r.id}" style="padding: 0.2rem 0.5rem;">${icons.trash}</button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  }

  container.innerHTML = html;

  // Add Category Handler
  document.getElementById('btn-add-food-cat')?.addEventListener('click', () => {
    openModal(`
      <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem; color: var(--ocean-deep); font-family: var(--font-display);">Thêm Danh Mục Món Ăn</h3>
      <form id="form-add-cat">
        <div class="form-group">
          <label class="form-label">Tên danh mục (ví dụ: Món Nướng, Món Nhật, Lẩu, Đồ Hàn, v.v.):</label>
          <input type="text" id="cat-name-input" class="form-input" required placeholder="Món Nướng Sài Gòn">
        </div>
        <div class="form-group">
          <label class="form-label">Icon / Emoji:</label>
          <input type="text" id="cat-icon-input" class="form-input" value="🍜" style="width: 100px;">
        </div>
        <button type="submit" class="btn btn-pill-sunlit" style="width: 100%;">Tạo danh mục</button>
      </form>
    `);

    document.getElementById('form-add-cat')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await authFetch('/api/admin/food-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: document.getElementById('cat-name-input').value,
          icon: document.getElementById('cat-icon-input').value
        })
      });
      closeModal();
      showToast('Đã thêm danh mục mới thành công!', 'success');
      if (window.refreshPublicData) window.refreshPublicData();
      renderFoodManagementTab(container);
    });
  });

  // Delete Category
  container.querySelectorAll('.btn-delete-cat').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Xóa danh mục này sẽ xóa toàn bộ món và quán bên trong?')) {
        await authFetch(`/api/admin/food-categories/${btn.dataset.catId}`, { method: 'DELETE' });
        showToast('Đã xóa danh mục.');
        if (window.refreshPublicData) window.refreshPublicData();
        renderFoodManagementTab(container);
      }
    });
  });

  // Add Dish
  container.querySelectorAll('.btn-add-dish').forEach(btn => {
    btn.addEventListener('click', () => {
      const catId = btn.dataset.catId;
      openModal(`
        <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem; color: var(--ocean-deep); font-family: var(--font-display);">Thêm Món Ăn Thuộc Danh Mục</h3>
        <form id="form-add-dish">
          <div class="form-group">
            <label class="form-label">Tên món ăn (ví dụ: Mì Cay Kim Chi Bò, Pizza 4 Phô Mai, v.v.):</label>
            <input type="text" id="dish-name-input" class="form-input" required placeholder="Mì Cay Sasin">
          </div>
          <div class="form-group">
            <label class="form-label">Mô tả ngắn:</label>
            <input type="text" id="dish-desc-input" class="form-input" placeholder="Mì chua cay đậm đà, cấp độ 2">
          </div>
          <button type="submit" class="btn btn-pill-sunlit" style="width: 100%;">Lưu món ăn</button>
        </form>
      `);

      document.getElementById('form-add-dish')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await authFetch('/api/admin/dishes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            food_category_id: catId,
            name: document.getElementById('dish-name-input').value,
            description: document.getElementById('dish-desc-input').value
          })
        });
        closeModal();
        showToast('Đã thêm món ăn mới!', 'success');
        if (window.refreshPublicData) window.refreshPublicData();
        renderFoodManagementTab(container);
      });
    });
  });

  // Delete Dish
  container.querySelectorAll('.btn-delete-dish').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Xóa món này?')) {
        await authFetch(`/api/admin/dishes/${btn.dataset.dishId}`, { method: 'DELETE' });
        showToast('Đã xóa món.');
        if (window.refreshPublicData) window.refreshPublicData();
        renderFoodManagementTab(container);
      }
    });
  });

  // Add Restaurant with File Upload from computer
  container.querySelectorAll('.btn-add-restaurant').forEach(btn => {
    btn.addEventListener('click', () => {
      const dishId = btn.dataset.dishId;
      openModal(`
        <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem; color: var(--ocean-deep); font-family: var(--font-display);">Thêm Quán Ăn / Nhà Hàng</h3>
        <form id="form-add-rest">
          <div class="form-group">
            <label class="form-label">Tên quán ăn / Nhà hàng:</label>
            <input type="text" id="rest-name-input" class="form-input" required placeholder="Mì Cay Sasin Chi Nhánh Q1">
          </div>
          <div class="form-group">
            <label class="form-label">Địa chỉ:</label>
            <input type="text" id="rest-address-input" class="form-input" placeholder="122 Nguyễn Thị Minh Khai, Q1">
          </div>
          <div class="form-group">
            <label class="form-label">Ảnh quán ăn (URL hoặc Tải từ máy tính):</label>
            <div style="display: flex; gap: 0.4rem;">
              <input type="text" id="rest-image-input" class="form-input" placeholder="https://images.unsplash.com/... hoặc bấm tải lên">
              <button type="button" class="btn btn-sm btn-ocean-glass" id="btn-upload-rest-img">📁 Tải ảnh</button>
            </div>
            <div class="upload-preview-box">
              <img id="preview-rest-img" src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500" alt="preview">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Khoảng giá:</label>
            <input type="text" id="rest-price-input" class="form-input" placeholder="60.000đ - 90.000đ">
          </div>
          <div class="form-group">
            <label class="form-label">Link Google Maps:</label>
            <input type="url" id="rest-maps-input" class="form-input" placeholder="https://maps.google.com/?q=...">
          </div>
          <div class="form-group">
            <label class="form-label">Lời nhắn riêng:</label>
            <input type="text" id="rest-note-input" class="form-input" placeholder="Quán này view đẹp và hợp ý cậu nè!">
          </div>
          <button type="submit" class="btn btn-pill-sunlit" style="width: 100%;">Tạo quán ăn</button>
        </form>
      `);

      attachImageUploader({
        btnId: 'btn-upload-rest-img',
        inputId: 'rest-image-input',
        previewImgId: 'preview-rest-img'
      });

      document.getElementById('form-add-rest')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          dish_id: dishId,
          name: document.getElementById('rest-name-input').value,
          address: document.getElementById('rest-address-input').value,
          image_url: document.getElementById('rest-image-input').value || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500',
          price_range: document.getElementById('rest-price-input').value,
          maps_url: document.getElementById('rest-maps-input').value,
          personal_note: document.getElementById('rest-note-input').value
        };
        await authFetch('/api/admin/restaurants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        closeModal();
        showToast('Đã thêm quán ăn mới thành công!', 'success');
        if (window.refreshPublicData) window.refreshPublicData();
        renderFoodManagementTab(container);
      });
    });
  });

  // Edit Food Category
  container.querySelectorAll('.btn-edit-food-cat').forEach(btn => {
    btn.addEventListener('click', () => {
      const catId = btn.dataset.catId;
      const cat = categories.find(c => c.id === catId);
      if (!cat) return;
      openModal(`
        <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem; color: var(--ocean-deep); font-family: var(--font-display);">Chỉnh Sửa Danh Mục Món Ăn</h3>
        <form id="form-edit-cat">
          <div class="form-group">
            <label class="form-label">Tên danh mục:</label>
            <input type="text" id="edit-cat-name-input" class="form-input" required value="${cat.name ? cat.name.replace(/"/g, '&quot;') : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Icon / Emoji:</label>
            <input type="text" id="edit-cat-icon-input" class="form-input" value="${cat.icon || '🍜'}" style="width: 100px;">
          </div>
          <button type="submit" class="btn btn-pill-sunlit" style="width: 100%;">Lưu thay đổi</button>
        </form>
      `);

      document.getElementById('form-edit-cat')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await authFetch(`/api/admin/food-categories/${cat.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: document.getElementById('edit-cat-name-input').value,
            icon: document.getElementById('edit-cat-icon-input').value
          })
        });
        closeModal();
        showToast('Đã cập nhật danh mục thành công!', 'success');
        if (window.refreshPublicData) window.refreshPublicData();
        renderFoodManagementTab(container);
      });
    });
  });

  // Edit Dish
  container.querySelectorAll('.btn-edit-dish').forEach(btn => {
    btn.addEventListener('click', () => {
      const dishId = btn.dataset.dishId;
      const catId = btn.dataset.catId;
      let cat = categories.find(c => c.id === catId);
      let dish = (cat?.dishes || []).find(d => d.id === dishId);
      if (!dish) {
        for (const c of categories) {
          const found = (c.dishes || []).find(d => d.id === dishId);
          if (found) {
            cat = c;
            dish = found;
            break;
          }
        }
      }
      if (!dish) return;

      openModal(`
        <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem; color: var(--ocean-deep); font-family: var(--font-display);">Chỉnh Sửa Món Ăn</h3>
        <form id="form-edit-dish">
          <div class="form-group">
            <label class="form-label">Tên món ăn:</label>
            <input type="text" id="edit-dish-name-input" class="form-input" required value="${dish.name ? dish.name.replace(/"/g, '&quot;') : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Mô tả ngắn:</label>
            <input type="text" id="edit-dish-desc-input" class="form-input" value="${dish.description ? dish.description.replace(/"/g, '&quot;') : ''}">
          </div>
          <button type="submit" class="btn btn-pill-sunlit" style="width: 100%;">Lưu thay đổi</button>
        </form>
      `);

      document.getElementById('form-edit-dish')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await authFetch(`/api/admin/dishes/${dish.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: document.getElementById('edit-dish-name-input').value,
            description: document.getElementById('edit-dish-desc-input').value
          })
        });
        closeModal();
        showToast('Đã cập nhật món ăn!', 'success');
        if (window.refreshPublicData) window.refreshPublicData();
        renderFoodManagementTab(container);
      });
    });
  });

  // Edit Restaurant with File Upload & TikTok/Menu URL
  container.querySelectorAll('.btn-edit-restaurant').forEach(btn => {
    btn.addEventListener('click', () => {
      const restId = btn.dataset.restId;
      const dishId = btn.dataset.dishId;
      const catId = btn.dataset.catId;
      let cat = categories.find(c => c.id === catId);
      let dish = (cat?.dishes || []).find(d => d.id === dishId);
      let rest = (dish?.restaurants || []).find(r => r.id === restId);
      if (!rest) {
        for (const c of categories) {
          for (const d of (c.dishes || [])) {
            const found = (d.restaurants || []).find(r => r.id === restId);
            if (found) {
              cat = c;
              dish = d;
              rest = found;
              break;
            }
          }
          if (rest) break;
        }
      }
      if (!rest) return;

      openModal(`
        <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem; color: var(--ocean-deep); font-family: var(--font-display);">Chỉnh Sửa Quán Ăn / Nhà Hàng</h3>
        <form id="form-edit-rest">
          <div class="form-group">
            <label class="form-label">Tên quán ăn / Nhà hàng:</label>
            <input type="text" id="edit-rest-name-input" class="form-input" required value="${rest.name ? rest.name.replace(/"/g, '&quot;') : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Địa chỉ:</label>
            <input type="text" id="edit-rest-address-input" class="form-input" value="${rest.address ? rest.address.replace(/"/g, '&quot;') : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Ảnh quán ăn (URL hoặc Tải từ máy tính):</label>
            <div style="display: flex; gap: 0.4rem;">
              <input type="text" id="edit-rest-image-input" class="form-input" value="${rest.image_url ? rest.image_url.replace(/"/g, '&quot;') : ''}">
              <button type="button" class="btn btn-sm btn-ocean-glass" id="btn-upload-edit-rest-img">📁 Tải ảnh</button>
            </div>
            <div class="upload-preview-box">
              <img id="preview-edit-rest-img" src="${rest.image_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500'}" alt="preview">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Khoảng giá:</label>
            <input type="text" id="edit-rest-price-input" class="form-input" value="${rest.price_range ? rest.price_range.replace(/"/g, '&quot;') : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Link Review TikTok / Menu:</label>
            <input type="text" id="edit-rest-menu-input" class="form-input" value="${rest.menu_url ? rest.menu_url.replace(/"/g, '&quot;') : ''}" placeholder="https://www.tiktok.com/@... hoặc link review">
          </div>
          <div class="form-group">
            <label class="form-label">Link Google Maps:</label>
            <input type="url" id="edit-rest-maps-input" class="form-input" value="${rest.maps_url ? rest.maps_url.replace(/"/g, '&quot;') : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Lời nhắn riêng:</label>
            <input type="text" id="edit-rest-note-input" class="form-input" value="${rest.personal_note ? rest.personal_note.replace(/"/g, '&quot;') : ''}">
          </div>
          <button type="submit" class="btn btn-pill-sunlit" style="width: 100%;">Lưu thay đổi</button>
        </form>
      `);

      attachImageUploader({
        btnId: 'btn-upload-edit-rest-img',
        inputId: 'edit-rest-image-input',
        previewImgId: 'preview-edit-rest-img'
      });

      document.getElementById('form-edit-rest')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          name: document.getElementById('edit-rest-name-input').value,
          address: document.getElementById('edit-rest-address-input').value,
          image_url: document.getElementById('edit-rest-image-input').value,
          price_range: document.getElementById('edit-rest-price-input').value,
          menu_url: document.getElementById('edit-rest-menu-input').value.trim(),
          maps_url: document.getElementById('edit-rest-maps-input').value,
          personal_note: document.getElementById('edit-rest-note-input').value
        };
        await authFetch(`/api/admin/restaurants/${rest.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        closeModal();
        showToast('Đã cập nhật quán ăn thành công!', 'success');
        if (window.refreshPublicData) window.refreshPublicData();
        renderFoodManagementTab(container);
      });
    });
  });

  // Delete Restaurant
  container.querySelectorAll('.btn-delete-restaurant').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Xóa quán ăn này?')) {
        await authFetch(`/api/admin/restaurants/${btn.dataset.restId}`, { method: 'DELETE' });
        showToast('Đã xóa quán ăn.');
        if (window.refreshPublicData) window.refreshPublicData();
        renderFoodManagementTab(container);
      }
    });
  });
}

// ==========================================
// 8. TAB: DRINKS & CAFES MANAGEMENT
// ==========================================
async function renderDrinksManagementTab(container) {
  const res = await fetch('/api/public/activities');
  const catalog = await res.json();
  const styles = catalog.drinks || [];

  let html = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
      <h3 style="font-size: 1.35rem; font-weight: 700; color: #0C4A6E; font-family: var(--font-display);">Quản Lý Phong Cách Cafe & Quán Nước ☕</h3>
      <button class="btn btn-sm btn-pill-sunlit" id="btn-add-drink-style">${icons.plus} Thêm phong cách cafe</button>
    </div>
  `;

  if (!styles.length) {
    html += `<div style="text-align: center; padding: 2rem; color: #0369A1;">Chưa có phong cách cafe nào. Bấm nút Thêm ở trên để tạo nhé!</div>`;
  } else {
    for (const st of styles) {
      html += `
        <div style="background: rgba(255, 255, 255, 0.95); border: 1.5px solid #BAE6FD; border-radius: var(--radius-md); padding: 1.35rem; margin-bottom: 1.5rem; box-shadow: 0 4px 16px rgba(14, 116, 144, 0.06);">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #F1F5F9; padding-bottom: 0.75rem; margin-bottom: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.4rem;">${st.icon || '☕'}</span>
              <h4 style="font-size: 1.15rem; font-weight: 700; color: var(--ocean-deep); font-family: var(--font-display);">${st.name}</h4>
            </div>
            <div style="display: flex; gap: 0.4rem;">
              <button class="btn btn-sm btn-secondary btn-add-cafe" data-style-id="${st.id}">${icons.plus} Thêm quán cafe</button>
              <button class="btn btn-sm btn-ocean-glass btn-edit-drink-style" data-style-id="${st.id}" style="padding: 0.25rem 0.6rem;">✏️ Sửa</button>
              <button class="btn btn-sm btn-danger btn-delete-drink-style" data-style-id="${st.id}">${icons.trash}</button>
            </div>
          </div>
          <div>
            ${(st.cafes || []).map(c => `
              <div style="display: flex; justify-content: space-between; align-items: center; background: #F0F9FF; padding: 0.5rem 0.85rem; border-radius: var(--radius-sm); margin-bottom: 0.4rem; font-size: 0.88rem; gap: 0.5rem; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 220px;">
                  <strong>${c.name}</strong> - <span>${c.address || ''}</span>
                  ${c.opening_hours ? `<span style="color: #64748B;"> (${c.opening_hours})</span>` : ''}
                  ${c.maps_url ? `<div style="font-size: 0.8rem; margin-top: 3px;"><a href="${c.maps_url}" target="_blank" rel="noopener noreferrer" style="color: #0284C7; text-decoration: underline;">🎵 Link Review TikTok / Maps</a></div>` : ''}
                </div>
                <div style="display: flex; gap: 0.35rem; align-items: center;">
                  <button class="btn btn-sm btn-ocean-glass btn-edit-cafe" data-cafe-id="${c.id}" data-style-id="${st.id}" style="padding: 0.25rem 0.6rem;">✏️ Sửa</button>
                  <button class="btn btn-sm btn-outline btn-delete-cafe" data-cafe-id="${c.id}" style="padding: 0.2rem 0.5rem;">${icons.trash}</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  }

  container.innerHTML = html;

  // Add Style
  document.getElementById('btn-add-drink-style')?.addEventListener('click', () => {
    openModal(`
      <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem; color: var(--ocean-deep); font-family: var(--font-display);">Thêm Phong Cách Cafe</h3>
      <form id="form-add-style">
        <div class="form-group">
          <label class="form-label">Tên phong cách (ví dụ: Cafe Hàn Quốc, Cafe Rooftop Hoàng Hôn, v.v.):</label>
          <input type="text" id="style-name-input" class="form-input" required placeholder="Cafe Mèo Đáng Yêu">
        </div>
        <div class="form-group">
          <label class="form-label">Emoji / Icon:</label>
          <input type="text" id="style-icon-input" class="form-input" value="☕" style="width: 100px;">
        </div>
        <button type="submit" class="btn btn-pill-sunlit" style="width: 100%;">Tạo phong cách</button>
      </form>
    `);

    document.getElementById('form-add-style')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await authFetch('/api/admin/drink-styles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: document.getElementById('style-name-input').value,
          icon: document.getElementById('style-icon-input').value
        })
      });
      closeModal();
      showToast('Đã thêm phong cách cafe!', 'success');
      if (window.refreshPublicData) window.refreshPublicData();
      renderDrinksManagementTab(container);
    });
  });

  // Delete Style
  container.querySelectorAll('.btn-delete-drink-style').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Xóa phong cách này?')) {
        await authFetch(`/api/admin/drink-styles/${btn.dataset.styleId}`, { method: 'DELETE' });
        showToast('Đã xóa phong cách.');
        if (window.refreshPublicData) window.refreshPublicData();
        renderDrinksManagementTab(container);
      }
    });
  });

  // Add Cafe with Computer Upload
  container.querySelectorAll('.btn-add-cafe').forEach(btn => {
    btn.addEventListener('click', () => {
      const styleId = btn.dataset.styleId;
      openModal(`
        <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem; color: var(--ocean-deep); font-family: var(--font-display);">Thêm Quán Cafe</h3>
        <form id="form-add-cafe">
          <div class="form-group">
            <label class="form-label">Tên quán cafe:</label>
            <input type="text" id="cafe-name-input" class="form-input" required placeholder="Tiệm Cà Phê Mùa Hè">
          </div>
          <div class="form-group">
            <label class="form-label">Địa chỉ:</label>
            <input type="text" id="cafe-address-input" class="form-input" placeholder="115 Hai Bà Trưng, Q1">
          </div>
          <div class="form-group">
            <label class="form-label">Giờ mở cửa:</label>
            <input type="text" id="cafe-hours-input" class="form-input" placeholder="08:00 - 22:30">
          </div>
          <div class="form-group">
            <label class="form-label">Khoảng giá:</label>
            <input type="text" id="cafe-price-input" class="form-input" placeholder="45.000đ - 75.000đ">
          </div>
          <div class="form-group">
            <label class="form-label">Ảnh quán cafe (URL hoặc Tải từ máy tính):</label>
            <div style="display: flex; gap: 0.4rem;">
              <input type="text" id="cafe-image-input" class="form-input" placeholder="https://images.unsplash.com/... hoặc tải lên">
              <button type="button" class="btn btn-sm btn-ocean-glass" id="btn-upload-cafe-img">📁 Tải ảnh</button>
            </div>
            <div class="upload-preview-box">
              <img id="preview-cafe-img" src="https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=500" alt="preview">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Link Google Maps:</label>
            <input type="url" id="cafe-maps-input" class="form-input" placeholder="https://maps.google.com/?q=...">
          </div>
          <div class="form-group">
            <label class="form-label">Lời nhắn riêng:</label>
            <input type="text" id="cafe-note-input" class="form-input" placeholder="Bánh ngọt ở đây siêu ngon nè!">
          </div>
          <button type="submit" class="btn btn-pill-sunlit" style="width: 100%;">Tạo quán cafe</button>
        </form>
      `);

      attachImageUploader({
        btnId: 'btn-upload-cafe-img',
        inputId: 'cafe-image-input',
        previewImgId: 'preview-cafe-img'
      });

      document.getElementById('form-add-cafe')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          name: document.getElementById('cafe-name-input').value,
          address: document.getElementById('cafe-address-input').value,
          opening_hours: document.getElementById('cafe-hours-input').value,
          price_range: document.getElementById('cafe-price-input').value,
          image_url: document.getElementById('cafe-image-input').value || 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=500',
          maps_url: document.getElementById('cafe-maps-input').value,
          personal_note: document.getElementById('cafe-note-input').value,
          style_ids: [styleId]
        };
        await authFetch('/api/admin/cafes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        closeModal();
        showToast('Đã thêm quán cafe mới!', 'success');
        if (window.refreshPublicData) window.refreshPublicData();
        renderDrinksManagementTab(container);
      });
    });
  });

  // Edit Style
  container.querySelectorAll('.btn-edit-drink-style').forEach(btn => {
    btn.addEventListener('click', () => {
      const styleId = btn.dataset.styleId;
      const st = styles.find(s => s.id === styleId);
      if (!st) return;

      openModal(`
        <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem; color: var(--ocean-deep); font-family: var(--font-display);">Chỉnh Sửa Phong Cách Cafe</h3>
        <form id="form-edit-style">
          <div class="form-group">
            <label class="form-label">Tên phong cách:</label>
            <input type="text" id="edit-style-name-input" class="form-input" required value="${st.name ? st.name.replace(/"/g, '&quot;') : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Emoji / Icon:</label>
            <input type="text" id="edit-style-icon-input" class="form-input" value="${st.icon || '☕'}" style="width: 100px;">
          </div>
          <button type="submit" class="btn btn-pill-sunlit" style="width: 100%;">Lưu thay đổi</button>
        </form>
      `);

      document.getElementById('form-edit-style')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await authFetch(`/api/admin/drink-styles/${st.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: document.getElementById('edit-style-name-input').value,
            icon: document.getElementById('edit-style-icon-input').value
          })
        });
        closeModal();
        showToast('Đã cập nhật phong cách cafe!', 'success');
        if (window.refreshPublicData) window.refreshPublicData();
        renderDrinksManagementTab(container);
      });
    });
  });

  // Edit Cafe with Computer Upload & Maps/Review link
  container.querySelectorAll('.btn-edit-cafe').forEach(btn => {
    btn.addEventListener('click', () => {
      const cafeId = btn.dataset.cafeId;
      const styleId = btn.dataset.styleId;
      let st = styles.find(s => s.id === styleId);
      let c = (st?.cafes || []).find(cafe => cafe.id === cafeId);
      if (!c) {
        for (const s of styles) {
          const found = (s.cafes || []).find(cafe => cafe.id === cafeId);
          if (found) {
            st = s;
            c = found;
            break;
          }
        }
      }
      if (!c) return;

      openModal(`
        <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem; color: var(--ocean-deep); font-family: var(--font-display);">Chỉnh Sửa Quán Cafe</h3>
        <form id="form-edit-cafe">
          <div class="form-group">
            <label class="form-label">Tên quán cafe:</label>
            <input type="text" id="edit-cafe-name-input" class="form-input" required value="${c.name ? c.name.replace(/"/g, '&quot;') : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Địa chỉ:</label>
            <input type="text" id="edit-cafe-address-input" class="form-input" value="${c.address ? c.address.replace(/"/g, '&quot;') : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Giờ mở cửa:</label>
            <input type="text" id="edit-cafe-hours-input" class="form-input" value="${c.opening_hours ? c.opening_hours.replace(/"/g, '&quot;') : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Khoảng giá:</label>
            <input type="text" id="edit-cafe-price-input" class="form-input" value="${c.price_range ? c.price_range.replace(/"/g, '&quot;') : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Ảnh quán cafe (URL hoặc Tải từ máy tính):</label>
            <div style="display: flex; gap: 0.4rem;">
              <input type="text" id="edit-cafe-image-input" class="form-input" value="${c.image_url ? c.image_url.replace(/"/g, '&quot;') : ''}">
              <button type="button" class="btn btn-sm btn-ocean-glass" id="btn-upload-edit-cafe-img">📁 Tải ảnh</button>
            </div>
            <div class="upload-preview-box">
              <img id="preview-edit-cafe-img" src="${c.image_url || 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=500'}" alt="preview">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Link Review TikTok / Google Maps:</label>
            <input type="text" id="edit-cafe-maps-input" class="form-input" value="${c.maps_url ? c.maps_url.replace(/"/g, '&quot;') : ''}" placeholder="https://www.tiktok.com/@... hoặc link maps">
          </div>
          <div class="form-group">
            <label class="form-label">Lời nhắn riêng:</label>
            <input type="text" id="edit-cafe-note-input" class="form-input" value="${c.personal_note ? c.personal_note.replace(/"/g, '&quot;') : ''}">
          </div>
          <button type="submit" class="btn btn-pill-sunlit" style="width: 100%;">Lưu thay đổi</button>
        </form>
      `);

      attachImageUploader({
        btnId: 'btn-upload-edit-cafe-img',
        inputId: 'edit-cafe-image-input',
        previewImgId: 'preview-edit-cafe-img'
      });

      document.getElementById('form-edit-cafe')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          name: document.getElementById('edit-cafe-name-input').value,
          address: document.getElementById('edit-cafe-address-input').value,
          opening_hours: document.getElementById('edit-cafe-hours-input').value,
          price_range: document.getElementById('edit-cafe-price-input').value,
          image_url: document.getElementById('edit-cafe-image-input').value,
          maps_url: document.getElementById('edit-cafe-maps-input').value.trim(),
          personal_note: document.getElementById('edit-cafe-note-input').value
        };
        await authFetch(`/api/admin/cafes/${c.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        closeModal();
        showToast('Đã cập nhật quán cafe thành công!', 'success');
        if (window.refreshPublicData) window.refreshPublicData();
        renderDrinksManagementTab(container);
      });
    });
  });

  // Delete Cafe
  container.querySelectorAll('.btn-delete-cafe').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Xóa quán cafe này?')) {
        await authFetch(`/api/admin/cafes/${btn.dataset.cafeId}`, { method: 'DELETE' });
        showToast('Đã xóa quán cafe.');
        if (window.refreshPublicData) window.refreshPublicData();
        renderDrinksManagementTab(container);
      }
    });
  });
}

// ==========================================
// 9. TAB: WORKSHOPS MANAGEMENT
// ==========================================
async function renderWorkshopsManagementTab(container) {
  const res = await fetch('/api/public/activities');
  const catalog = await res.json();
  const categories = catalog.workshops || [];

  let html = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
      <h3 style="font-size: 1.35rem; font-weight: 700; color: #0C4A6E; font-family: var(--font-display);">Quản Lý Hoạt Động Workshop 🎨</h3>
      <button class="btn btn-sm btn-pill-sunlit" id="btn-add-ws-cat">${icons.plus} Thêm danh mục workshop</button>
    </div>
  `;

  if (!categories.length) {
    html += `<div style="text-align: center; padding: 2rem; color: #0369A1;">Chưa có workshop nào. Bấm nút Thêm ở trên để tạo nhé!</div>`;
  } else {
    for (const cat of categories) {
      html += `
        <div style="background: rgba(255, 255, 255, 0.95); border: 1.5px solid #BAE6FD; border-radius: var(--radius-md); padding: 1.35rem; margin-bottom: 1.5rem; box-shadow: 0 4px 16px rgba(14, 116, 144, 0.06);">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #F1F5F9; padding-bottom: 0.75rem; margin-bottom: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.4rem;">${cat.icon || '🎨'}</span>
              <h4 style="font-size: 1.15rem; font-weight: 700; color: var(--ocean-deep); font-family: var(--font-display);">${cat.name}</h4>
            </div>
            <div style="display: flex; gap: 0.4rem;">
              <button class="btn btn-sm btn-secondary btn-add-workshop" data-cat-id="${cat.id}">${icons.plus} Thêm workshop</button>
              <button class="btn btn-sm btn-ocean-glass btn-edit-ws-cat" data-cat-id="${cat.id}" style="padding: 0.25rem 0.6rem;">✏️ Sửa</button>
              <button class="btn btn-sm btn-danger btn-delete-ws-cat" data-cat-id="${cat.id}">${icons.trash}</button>
            </div>
          </div>
          <div>
            ${(cat.workshops || []).map(w => `
              <div style="display: flex; justify-content: space-between; align-items: center; background: #F0F9FF; padding: 0.65rem 0.85rem; border-radius: var(--radius-sm); margin-bottom: 0.45rem; font-size: 0.88rem; gap: 0.5rem; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 220px;">
                  <strong>${w.name}</strong> - <span>${w.venue_name || ''}</span> (${w.duration || ''} | ${w.price_per_person || ''})
                  ${w.booking_url ? `
                    <div style="font-size: 0.8rem; margin-top: 4px;">
                      <a href="${w.booking_url}" target="_blank" rel="noopener noreferrer" style="color: #0284C7; text-decoration: underline; display: inline-flex; align-items: center; gap: 4px;">
                        <span>🎵 Link Review TikTok / Web:</span> <span style="max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block; vertical-align: bottom;">${w.booking_url}</span>
                      </a>
                    </div>
                  ` : '<div style="font-size: 0.78rem; color: #94A3B8; margin-top: 3px;">(Chưa có link review TikTok)</div>'}
                </div>
                <div style="display: flex; gap: 0.4rem; align-items: center;">
                  <button class="btn btn-sm btn-ocean-glass btn-edit-workshop" data-ws-id="${w.id}" data-cat-id="${cat.id}" style="padding: 0.25rem 0.6rem;">✏️ Sửa</button>
                  <button class="btn btn-sm btn-outline btn-delete-workshop" data-ws-id="${w.id}" style="padding: 0.25rem 0.5rem;">${icons.trash}</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  }

  container.innerHTML = html;

  // Add Workshop Category
  document.getElementById('btn-add-ws-cat')?.addEventListener('click', () => {
    openModal(`
      <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem; color: var(--ocean-deep); font-family: var(--font-display);">Thêm Danh Mục Workshop</h3>
      <form id="form-add-ws-cat">
        <div class="form-group">
          <label class="form-label">Tên danh mục (ví dụ: Làm Nến Thơm, Làm Vòng Tay, Tô Tượng, v.v.):</label>
          <input type="text" id="ws-cat-name-input" class="form-input" required placeholder="Làm Hoa Kẽm Nhung">
        </div>
        <div class="form-group">
          <label class="form-label">Emoji / Icon:</label>
          <input type="text" id="ws-cat-icon-input" class="form-input" value="🎨" style="width: 100px;">
        </div>
        <button type="submit" class="btn btn-pill-sunlit" style="width: 100%;">Tạo danh mục</button>
      </form>
    `);

    document.getElementById('form-add-ws-cat')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await authFetch('/api/admin/workshop-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: document.getElementById('ws-cat-name-input').value,
          icon: document.getElementById('ws-cat-icon-input').value
        })
      });
      closeModal();
      showToast('Đã thêm danh mục workshop!', 'success');
      if (window.refreshPublicData) window.refreshPublicData();
      renderWorkshopsManagementTab(container);
    });
  });

  // Delete Workshop Category
  container.querySelectorAll('.btn-delete-ws-cat').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Xóa danh mục workshop này?')) {
        await authFetch(`/api/admin/workshop-categories/${btn.dataset.catId}`, { method: 'DELETE' });
        showToast('Đã xóa danh mục.');
        if (window.refreshPublicData) window.refreshPublicData();
        renderWorkshopsManagementTab(container);
      }
    });
  });

  // Edit Workshop Category
  container.querySelectorAll('.btn-edit-ws-cat').forEach(btn => {
    btn.addEventListener('click', () => {
      const catId = btn.dataset.catId;
      const cat = categories.find(c => c.id === catId);
      if (!cat) return;

      openModal(`
        <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem; color: var(--ocean-deep); font-family: var(--font-display);">Chỉnh Sửa Danh Mục Workshop</h3>
        <form id="form-edit-ws-cat">
          <div class="form-group">
            <label class="form-label">Tên danh mục:</label>
            <input type="text" id="edit-ws-cat-name-input" class="form-input" required value="${cat.name ? cat.name.replace(/"/g, '&quot;') : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Emoji / Icon:</label>
            <input type="text" id="edit-ws-cat-icon-input" class="form-input" value="${cat.icon || '🎨'}" style="width: 100px;">
          </div>
          <button type="submit" class="btn btn-pill-sunlit" style="width: 100%;">Lưu thay đổi</button>
        </form>
      `);

      document.getElementById('form-edit-ws-cat')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await authFetch(`/api/admin/workshop-categories/${cat.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: document.getElementById('edit-ws-cat-name-input').value,
            icon: document.getElementById('edit-ws-cat-icon-input').value
          })
        });
        closeModal();
        showToast('Đã cập nhật danh mục workshop!', 'success');
        if (window.refreshPublicData) window.refreshPublicData();
        renderWorkshopsManagementTab(container);
      });
    });
  });

  // Add Workshop with Computer Upload
  container.querySelectorAll('.btn-add-workshop').forEach(btn => {
    btn.addEventListener('click', () => {
      const catId = btn.dataset.catId;
      openModal(`
        <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem; color: var(--ocean-deep); font-family: var(--font-display);">Thêm Workshop Mới</h3>
        <form id="form-add-ws">
          <div class="form-group">
            <label class="form-label">Tên workshop:</label>
            <input type="text" id="ws-name-input" class="form-input" required placeholder="Workshop Tự Tay Làm Nến Thơm">
          </div>
          <div class="form-group">
            <label class="form-label">Tên Studio / Địa điểm:</label>
            <input type="text" id="ws-venue-input" class="form-input" placeholder="Aroma Dream Studio">
          </div>
          <div class="form-group">
            <label class="form-label">Địa chỉ:</label>
            <input type="text" id="ws-address-input" class="form-input" placeholder="88 Nguyễn Đình Chiểu, Q1">
          </div>
          <div class="form-group">
            <label class="form-label">Thời lượng:</label>
            <input type="text" id="ws-duration-input" class="form-input" placeholder="2 giờ">
          </div>
          <div class="form-group">
            <label class="form-label">Giá / người:</label>
            <input type="text" id="ws-price-input" class="form-input" placeholder="240.000đ / người">
          </div>
          <div class="form-group">
            <label class="form-label">Ảnh workshop (URL hoặc Tải từ máy tính):</label>
            <div style="display: flex; gap: 0.4rem;">
              <input type="text" id="ws-image-input" class="form-input" placeholder="https://images.unsplash.com/... hoặc tải lên">
              <button type="button" class="btn btn-sm btn-ocean-glass" id="btn-upload-ws-img">📁 Tải ảnh</button>
            </div>
            <div class="upload-preview-box">
              <img id="preview-ws-img" src="https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=500" alt="preview">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Link Review TikTok (hoặc link xem trước / Google Maps):</label>
            <input type="text" id="ws-tiktok-input" class="form-input" placeholder="https://www.tiktok.com/@... hoặc dán link review">
          </div>
          <div class="form-group">
            <label class="form-label">Ca hoạt động (sessions):</label>
            <input type="text" id="ws-sessions-input" class="form-input" placeholder="10:00, 14:30, 18:00">
          </div>
          <button type="submit" class="btn btn-pill-sunlit" style="width: 100%;">Tạo workshop</button>
        </form>
      `);

      attachImageUploader({
        btnId: 'btn-upload-ws-img',
        inputId: 'ws-image-input',
        previewImgId: 'preview-ws-img'
      });

      document.getElementById('form-add-ws')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          workshop_category_id: catId,
          name: document.getElementById('ws-name-input').value,
          venue_name: document.getElementById('ws-venue-input').value,
          address: document.getElementById('ws-address-input').value,
          duration: document.getElementById('ws-duration-input').value,
          price_per_person: document.getElementById('ws-price-input').value,
          image_url: document.getElementById('ws-image-input').value || 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=500',
          booking_url: document.getElementById('ws-tiktok-input')?.value?.trim() || '',
          available_sessions: document.getElementById('ws-sessions-input').value
        };
        await authFetch('/api/admin/workshops', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        closeModal();
        showToast('Đã thêm workshop mới!', 'success');
        if (window.refreshPublicData) window.refreshPublicData();
        renderWorkshopsManagementTab(container);
      });
    });
  });

  // Edit Workshop
  container.querySelectorAll('.btn-edit-workshop').forEach(btn => {
    btn.addEventListener('click', () => {
      const wsId = btn.dataset.wsId;
      const catId = btn.dataset.catId;
      let cat = categories.find(c => c.id === catId);
      let ws = (cat?.workshops || []).find(w => w.id === wsId);
      if (!ws) {
        for (const c of categories) {
          const found = (c.workshops || []).find(w => w.id === wsId);
          if (found) {
            cat = c;
            ws = found;
            break;
          }
        }
      }
      if (!ws) return;

      openModal(`
        <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem; color: var(--ocean-deep); font-family: var(--font-display);">Chỉnh Sửa Workshop</h3>
        <form id="form-edit-ws">
          <div class="form-group">
            <label class="form-label">Tên workshop:</label>
            <input type="text" id="edit-ws-name" class="form-input" required value="${ws.name ? ws.name.replace(/"/g, '&quot;') : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Tên Studio / Địa điểm:</label>
            <input type="text" id="edit-ws-venue" class="form-input" value="${ws.venue_name ? ws.venue_name.replace(/"/g, '&quot;') : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Địa chỉ:</label>
            <input type="text" id="edit-ws-address" class="form-input" value="${ws.address ? ws.address.replace(/"/g, '&quot;') : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Thời lượng:</label>
            <input type="text" id="edit-ws-duration" class="form-input" value="${ws.duration ? ws.duration.replace(/"/g, '&quot;') : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Giá / người:</label>
            <input type="text" id="edit-ws-price" class="form-input" value="${ws.price_per_person ? ws.price_per_person.replace(/"/g, '&quot;') : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Ảnh workshop (URL hoặc Tải từ máy tính):</label>
            <div style="display: flex; gap: 0.4rem;">
              <input type="text" id="edit-ws-image" class="form-input" value="${ws.image_url ? ws.image_url.replace(/"/g, '&quot;') : ''}">
              <button type="button" class="btn btn-sm btn-ocean-glass" id="btn-upload-edit-ws-img">📁 Tải ảnh</button>
            </div>
            <div class="upload-preview-box">
              <img id="preview-edit-ws-img" src="${ws.image_url || 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=500'}" alt="preview">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Link Review TikTok (hoặc link xem trước / Google Maps):</label>
            <input type="text" id="edit-ws-tiktok" class="form-input" value="${ws.booking_url ? ws.booking_url.replace(/"/g, '&quot;') : ''}" placeholder="https://www.tiktok.com/@... hoặc dán link review">
          </div>
          <div class="form-group">
            <label class="form-label">Ca hoạt động (sessions):</label>
            <input type="text" id="edit-ws-sessions" class="form-input" value="${ws.available_sessions ? ws.available_sessions.replace(/"/g, '&quot;') : ''}">
          </div>
          <button type="submit" class="btn btn-pill-sunlit" style="width: 100%;">Lưu thay đổi</button>
        </form>
      `);

      attachImageUploader({
        btnId: 'btn-upload-edit-ws-img',
        inputId: 'edit-ws-image',
        previewImgId: 'preview-edit-ws-img'
      });

      document.getElementById('form-edit-ws')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          name: document.getElementById('edit-ws-name').value,
          venue_name: document.getElementById('edit-ws-venue').value,
          address: document.getElementById('edit-ws-address').value,
          duration: document.getElementById('edit-ws-duration').value,
          price_per_person: document.getElementById('edit-ws-price').value,
          image_url: document.getElementById('edit-ws-image').value,
          booking_url: document.getElementById('edit-ws-tiktok').value.trim(),
          available_sessions: document.getElementById('edit-ws-sessions').value
        };
        await authFetch(`/api/admin/workshops/${ws.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        closeModal();
        showToast('Đã cập nhật workshop thành công!', 'success');
        if (window.refreshPublicData) window.refreshPublicData();
        renderWorkshopsManagementTab(container);
      });
    });
  });

  // Delete Workshop
  container.querySelectorAll('.btn-delete-workshop').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Xóa workshop này?')) {
        await authFetch(`/api/admin/workshops/${btn.dataset.wsId}`, { method: 'DELETE' });
        showToast('Đã xóa workshop.');
        if (window.refreshPublicData) window.refreshPublicData();
        renderWorkshopsManagementTab(container);
      }
    });
  });
}

// ==========================================
// 10. TAB: PHOTOBOOTHS MANAGEMENT
// ==========================================
async function renderPhotoboothsManagementTab(container) {
  let photobooths = [];
  try {
    const res = await authFetch('/api/admin/photobooths');
    if (res.ok) {
      photobooths = await res.json();
    }
  } catch (err) {
    console.error('Failed to load photobooths:', err);
  }
  if (!Array.isArray(photobooths)) photobooths = [];

  let html = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
      <h3 style="font-size: 1.35rem; font-weight: 700; color: #0C4A6E; font-family: var(--font-display);">Quản Lý Danh Sách Photobooth 📸</h3>
      <button class="btn btn-sm btn-pill-sunlit" id="btn-add-photobooth">${icons.plus} Thêm tiệm photobooth</button>
    </div>
  `;

  if (!photobooths.length) {
    html += `<div style="text-align: center; padding: 2rem; color: #0369A1;">Chưa có tiệm photobooth nào. Bấm nút Thêm ở trên để tạo nhé!</div>`;
  } else {
    html += `
      <div class="cards-grid">
        ${photobooths.map(p => `
          <div class="selection-card" style="cursor: default;">
            <div class="polaroid-image-wrapper" style="aspect-ratio: 4 / 5;">
              <img src="${p.image_url || 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=500'}" alt="${p.name}" loading="lazy">
            </div>
            <div class="polaroid-caption">
              <h4 class="polaroid-title">${p.name}</h4>
              <div class="card-meta-list">
                ${p.brand_name ? `<div><span class="badge badge-purple">${p.brand_name}</span></div>` : ''}
                ${p.address ? `<div>${icons.mapPin} <span>${p.address}</span></div>` : ''}
                ${p.price ? `<div>${icons.price} <span>${p.price}</span></div>` : ''}
              </div>
              ${p.notes ? `<p style="font-size: 0.86rem; color: #64748B; margin-top: 0.4rem; margin-bottom: 0.4rem;">${p.notes}</p>` : ''}
              ${p.review_url ? `
                <div style="font-size: 0.8rem; margin-top: 4px;">
                  <a href="${p.review_url}" target="_blank" rel="noopener noreferrer" style="color: #0284C7; text-decoration: underline; display: inline-flex; align-items: center; gap: 4px;">
                    <span>🎵 Link Review TikTok / Web:</span> <span style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block; vertical-align: bottom;">${p.review_url}</span>
                  </a>
                </div>
              ` : '<div style="font-size: 0.78rem; color: #94A3B8; margin-top: 2px;">(Chưa có link review TikTok)</div>'}
              <div style="margin-top: 0.85rem; display: flex; gap: 0.4rem; justify-content: flex-end;">
                <button class="btn btn-sm btn-ocean-glass btn-edit-photobooth" data-pb-id="${p.id}" style="padding: 0.25rem 0.6rem;">✏️ Sửa</button>
                <button class="btn btn-sm btn-danger btn-delete-photobooth" data-pb-id="${p.id}">${icons.trash} Xóa</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  container.innerHTML = html;

  // Add Photobooth
  document.getElementById('btn-add-photobooth')?.addEventListener('click', () => {
    openModal(`
      <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem; color: var(--ocean-deep); font-family: var(--font-display);">Thêm Tiệm Photobooth Mới 📸</h3>
      <form id="form-add-photobooth">
        <div class="form-group">
          <label class="form-label">Tên phòng / Chi nhánh:</label>
          <input type="text" id="pb-name-input" class="form-input" required placeholder="Life Four Cuts - Lê Duẩn">
        </div>
        <div class="form-group">
          <label class="form-label">Thương hiệu / Studio:</label>
          <input type="text" id="pb-brand-input" class="form-input" placeholder="Life Four Cuts, Haru Film, Photoism, Photobooth Box...">
        </div>
        <div class="form-group">
          <label class="form-label">Địa chỉ:</label>
          <input type="text" id="pb-address-input" class="form-input" placeholder="102 Lê Duẩn, Đà Nẵng">
        </div>
        <div class="form-group">
          <label class="form-label">Giá chụp / dải ảnh:</label>
          <input type="text" id="pb-price-input" class="form-input" placeholder="70.000đ - 100.000đ / 2 dải">
        </div>
        <div class="form-group">
          <label class="form-label">Ảnh tiệm / dải ảnh mẫu (URL hoặc Tải từ máy tính):</label>
          <div style="display: flex; gap: 0.4rem;">
            <input type="text" id="pb-image-input" class="form-input" placeholder="https://images.unsplash.com/... hoặc tải lên">
            <button type="button" class="btn btn-sm btn-ocean-glass" id="btn-upload-pb-image">📁 Tải ảnh</button>
          </div>
          <div class="upload-preview-box">
            <img id="preview-pb-image" src="https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=500" alt="preview">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Link Review TikTok (hoặc Google Maps):</label>
          <input type="text" id="pb-review-input" class="form-input" placeholder="https://www.tiktok.com/@... hoặc link review">
        </div>
        <div class="form-group">
          <label class="form-label">Phụ kiện & Ghi chú riêng:</label>
          <textarea id="pb-notes-input" class="form-textarea" placeholder="Nhiều nón thỏ, kính mắt hề hước, tone màu ấm áp xinh xắn..."></textarea>
        </div>
        <button type="submit" class="btn btn-pill-sunlit" style="width: 100%;">Tạo Photobooth</button>
      </form>
    `);

    attachImageUploader({
      btnId: 'btn-upload-pb-image',
      inputId: 'pb-image-input',
      previewImgId: 'preview-pb-image'
    });

    document.getElementById('form-add-photobooth')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: document.getElementById('pb-name-input').value,
        brand_name: document.getElementById('pb-brand-input').value,
        address: document.getElementById('pb-address-input').value,
        price: document.getElementById('pb-price-input').value,
        image_url: document.getElementById('pb-image-input').value || 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=500',
        review_url: document.getElementById('pb-review-input').value.trim(),
        notes: document.getElementById('pb-notes-input').value
      };
      await authFetch('/api/admin/photobooths', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      closeModal();
      showToast('Đã thêm tiệm Photobooth mới!', 'success');
      if (window.refreshPublicData) window.refreshPublicData();
      renderPhotoboothsManagementTab(container);
    });
  });

  // Edit Photobooth
  container.querySelectorAll('.btn-edit-photobooth').forEach(btn => {
    btn.addEventListener('click', () => {
      const pbId = btn.dataset.pbId;
      const pb = photobooths.find(p => p.id === pbId);
      if (!pb) return;

      openModal(`
        <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem; color: var(--ocean-deep); font-family: var(--font-display);">Chỉnh Sửa Tiệm Photobooth 📸</h3>
        <form id="form-edit-photobooth">
          <div class="form-group">
            <label class="form-label">Tên phòng / Chi nhánh:</label>
            <input type="text" id="edit-pb-name" class="form-input" required value="${pb.name ? pb.name.replace(/"/g, '&quot;') : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Thương hiệu / Studio:</label>
            <input type="text" id="edit-pb-brand" class="form-input" value="${pb.brand_name ? pb.brand_name.replace(/"/g, '&quot;') : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Địa chỉ:</label>
            <input type="text" id="edit-pb-address" class="form-input" value="${pb.address ? pb.address.replace(/"/g, '&quot;') : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Giá chụp / dải ảnh:</label>
            <input type="text" id="edit-pb-price" class="form-input" value="${pb.price ? pb.price.replace(/"/g, '&quot;') : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Ảnh tiệm / dải ảnh mẫu (URL hoặc Tải từ máy tính):</label>
            <div style="display: flex; gap: 0.4rem;">
              <input type="text" id="edit-pb-image" class="form-input" value="${pb.image_url ? pb.image_url.replace(/"/g, '&quot;') : ''}">
              <button type="button" class="btn btn-sm btn-ocean-glass" id="btn-upload-edit-pb-img">📁 Tải ảnh</button>
            </div>
            <div class="upload-preview-box">
              <img id="preview-edit-pb-img" src="${pb.image_url || 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=500'}" alt="preview">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Link Review TikTok (hoặc Google Maps):</label>
            <input type="text" id="edit-pb-review" class="form-input" value="${pb.review_url ? pb.review_url.replace(/"/g, '&quot;') : ''}" placeholder="https://www.tiktok.com/@... hoặc dán link review">
          </div>
          <div class="form-group">
            <label class="form-label">Phụ kiện & Ghi chú riêng:</label>
            <textarea id="edit-pb-notes" class="form-textarea">${pb.notes || ''}</textarea>
          </div>
          <button type="submit" class="btn btn-pill-sunlit" style="width: 100%;">Lưu thay đổi</button>
        </form>
      `);

      attachImageUploader({
        btnId: 'btn-upload-edit-pb-img',
        inputId: 'edit-pb-image',
        previewImgId: 'preview-edit-pb-img'
      });

      document.getElementById('form-edit-photobooth')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          name: document.getElementById('edit-pb-name').value,
          brand_name: document.getElementById('edit-pb-brand').value,
          address: document.getElementById('edit-pb-address').value,
          price: document.getElementById('edit-pb-price').value,
          image_url: document.getElementById('edit-pb-image').value,
          review_url: document.getElementById('edit-pb-review').value.trim(),
          notes: document.getElementById('edit-pb-notes').value
        };
        await authFetch(`/api/admin/photobooths/${pb.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        closeModal();
        showToast('Đã cập nhật tiệm Photobooth thành công!', 'success');
        if (window.refreshPublicData) window.refreshPublicData();
        renderPhotoboothsManagementTab(container);
      });
    });
  });

  // Delete Photobooth
  container.querySelectorAll('.btn-delete-photobooth').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Xóa tiệm photobooth này?')) {
        await authFetch(`/api/admin/photobooths/${btn.dataset.pbId}`, { method: 'DELETE' });
        showToast('Đã xóa tiệm photobooth.');
        if (window.refreshPublicData) window.refreshPublicData();
        renderPhotoboothsManagementTab(container);
      }
    });
  });
}

// ==========================================
// 11. TAB: DATES & SLOTS MANAGEMENT
// ==========================================
async function renderDatesManagementTab(container) {
  let dates = [];
  try {
    const res = await authFetch('/api/admin/available-dates');
    if (res.ok) {
      dates = await res.json();
    }
  } catch (err) {
    console.error('Failed to load dates:', err);
  }
  if (!Array.isArray(dates)) dates = [];

  let html = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
      <div>
        <h3 style="font-size: 1.35rem; font-weight: 700; color: #0C4A6E; font-family: var(--font-display);">Lịch Ngày & Khung Giờ Khả Dụng 🗓️</h3>
        <p style="font-size: 0.88rem; color: #0369A1;">Bạn có thể mở thêm nhiều ngày khác nhau để bạn thân chọn lựa.</p>
      </div>
      <button class="btn btn-sm btn-pill-sunlit" id="btn-add-date">${icons.plus} Thêm ngày mới</button>
    </div>
  `;

  if (!dates.length) {
    html += `<div style="text-align: center; padding: 2rem; color: #0369A1;">Chưa có ngày nào được mở. Bấm nút Thêm ngày mới để tạo nhé!</div>`;
  } else {
    for (const d of dates) {
      html += `
        <div style="background: rgba(255, 255, 255, 0.95); border: 1.5px solid #BAE6FD; border-radius: var(--radius-md); padding: 1.35rem; margin-bottom: 1.5rem; box-shadow: 0 4px 16px rgba(14, 116, 144, 0.06);">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #F1F5F9; padding-bottom: 0.75rem; margin-bottom: 1rem;">
            <div>
              <h4 style="font-size: 1.15rem; font-weight: 700; color: var(--ocean-deep); font-family: var(--font-display);">${d.display_label || d.date_str}</h4>
              <span style="font-size: 0.84rem; color: #64748B;">Mã ngày: ${d.date_str}</span>
            </div>
            <div style="display: flex; gap: 0.4rem;">
              <button class="btn btn-sm btn-secondary btn-add-slot" data-date-id="${d.id}">${icons.plus} Thêm giờ</button>
              <button class="btn btn-sm btn-danger btn-delete-date" data-date-id="${d.id}">${icons.trash}</button>
            </div>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
            ${(d.slots || []).map(s => `
              <div style="display: inline-flex; align-items: center; gap: 0.4rem; background: #F0F9FF; border: 1px solid #BAE6FD; padding: 0.45rem 0.85rem; border-radius: var(--radius-full); font-size: 0.88rem;">
                <span style="color: #0369A1; font-weight: 600;">${s.slot_time} (${s.period_label})</span>
                <button class="btn-delete-slot" data-slot-id="${s.id}" style="background:none; border:none; color:#EF4444; cursor:pointer; font-weight:bold; font-size: 1rem;">&times;</button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  }

  container.innerHTML = html;

  // Add Date
  document.getElementById('btn-add-date')?.addEventListener('click', () => {
    openModal(`
      <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem; color: var(--ocean-deep); font-family: var(--font-display);">Thêm Ngày Đi Chơi Mới</h3>
      <form id="form-add-date">
        <div class="form-group">
          <label class="form-label">Ngày (YYYY-MM-DD):</label>
          <input type="date" id="date-val-input" class="form-input" required value="2026-11-04">
        </div>
        <div class="form-group">
          <label class="form-label">Tên hiển thị:</label>
          <input type="text" id="date-label-input" class="form-input" required placeholder="Thứ Tư, 04/11/2026 (Chính ngày mốc dự án 411 ✨)">
        </div>
        <button type="submit" class="btn btn-pill-sunlit" style="width: 100%;">Tạo ngày</button>
      </form>
    `);

    document.getElementById('form-add-date')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await authFetch('/api/admin/available-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date_str: document.getElementById('date-val-input').value,
          display_label: document.getElementById('date-label-input').value
        })
      });
      closeModal();
      showToast('Đã thêm ngày mới!', 'success');
      if (window.refreshPublicData) window.refreshPublicData();
      renderDatesManagementTab(container);
    });
  });

  // Delete Date
  container.querySelectorAll('.btn-delete-date').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Xóa ngày này? (Các đơn đã gửi trước đó vẫn giữ nguyên snapshot)')) {
        await authFetch(`/api/admin/available-dates/${btn.dataset.dateId}`, { method: 'DELETE' });
        showToast('Đã xóa ngày.');
        if (window.refreshPublicData) window.refreshPublicData();
        renderDatesManagementTab(container);
      }
    });
  });

  // Add Time Slot
  container.querySelectorAll('.btn-add-slot').forEach(btn => {
    btn.addEventListener('click', () => {
      const dateId = btn.dataset.dateId;
      openModal(`
        <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem; color: var(--ocean-deep); font-family: var(--font-display);">Thêm Khung Giờ</h3>
        <form id="form-add-slot">
          <div class="form-group">
            <label class="form-label">Khung giờ (ví dụ: 14:00 - 17:30):</label>
            <input type="text" id="slot-time-input" class="form-input" required placeholder="14:00 - 17:30">
          </div>
          <div class="form-group">
            <label class="form-label">Buổi:</label>
            <select id="slot-period-input" class="form-select">
              <option value="Buổi sáng">Buổi sáng</option>
              <option value="Buổi chiều">Buổi chiều</option>
              <option value="Buổi tối">Buổi tối</option>
            </select>
          </div>
          <button type="submit" class="btn btn-pill-sunlit" style="width: 100%;">Tạo khung giờ</button>
        </form>
      `);

      document.getElementById('form-add-slot')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await authFetch('/api/admin/time-slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date_id: dateId,
            slot_time: document.getElementById('slot-time-input').value,
            period_label: document.getElementById('slot-period-input').value
          })
        });
        closeModal();
        showToast('Đã thêm khung giờ!', 'success');
        if (window.refreshPublicData) window.refreshPublicData();
        renderDatesManagementTab(container);
      });
    });
  });

  // Delete Slot
  container.querySelectorAll('.btn-delete-slot').forEach(btn => {
    btn.addEventListener('click', async () => {
      await authFetch(`/api/admin/time-slots/${btn.dataset.slotId}`, { method: 'DELETE' });
      showToast('Đã xóa khung giờ.');
      if (window.refreshPublicData) window.refreshPublicData();
      renderDatesManagementTab(container);
    });
  });
}

// ==========================================
// 12. TAB: INVITATION SETTINGS & SHARING LINK
// ==========================================
function renderSettingsTab(container) {
  const s = adminState.settings || {};
  const currentOrigin = window.location.origin;
  const shareUrl = `${currentOrigin}/#invite`;

  container.innerHTML = `
    <div style="background: rgba(255, 255, 255, 0.95); border: 1.5px solid #BAE6FD; border-radius: var(--radius-md); padding: 2rem; box-shadow: 0 12px 32px rgba(14, 116, 144, 0.08); max-width: 750px; margin: 0 auto; backdrop-filter: blur(16px);">
      <h3 style="font-size: 1.35rem; font-weight: 700; color: var(--ocean-deep); font-family: var(--font-display); margin-bottom: 0.5rem;">Cài Đặt Thiệp Mời & Link Chia Sẻ ⚙️</h3>
      <p style="color: var(--text-sub); font-size: 0.92rem; margin-bottom: 1.5rem;">Quản lý quyền công khai thiệp và sao chép link gửi cho bạn thân.</p>

      <div style="margin-bottom: 1.5rem; background: #F0F9FF; border: 1px solid #BAE6FD; border-radius: var(--radius-sm); padding: 1.25rem;">
        <label class="form-label">Link mời bạn thân tham gia lựa chọn:</label>
        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
          <input type="text" id="share-link-input" class="form-input" readonly value="${shareUrl}" style="background: #FFFFFF;">
          <button class="btn btn-secondary" id="btn-copy-invite-link">${icons.copy} Sao chép</button>
        </div>
      </div>

      <form id="form-update-settings">
        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 0.6rem; cursor: pointer;">
            <input type="checkbox" id="setting-is-published" ${s.is_published ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: #0284C7;">
            <span style="font-weight: 700; color: var(--ocean-deep);">Công khai thiệp mời (Cho phép bạn thân truy cập)</span>
          </label>
        </div>
        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 0.6rem; cursor: pointer;">
            <input type="checkbox" id="setting-allow-flexible" ${s.allow_flexible_date ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: #0284C7;">
            <span style="font-weight: 700; color: var(--ocean-deep);">Cho phép tùy chọn "Thời gian linh hoạt theo thỏa thuận"</span>
          </label>
        </div>
        <button type="submit" class="btn btn-pill-sunlit" style="margin-top: 1rem;">Lưu cài đặt</button>
      </form>
    </div>
  `;

  document.getElementById('btn-copy-invite-link')?.addEventListener('click', () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      showToast('Đã sao chép link mời vào bộ nhớ tạm!', 'success');
    });
  });

  document.getElementById('form-update-settings')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      is_published: document.getElementById('setting-is-published').checked,
      allow_flexible_date: document.getElementById('setting-allow-flexible').checked
    };
    const res = await authFetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    adminState.settings = await res.json();
    showToast('Đã cập nhật cài đặt thiệp thành công!', 'success');
    if (window.refreshPublicData) window.refreshPublicData();
  });
}

// ==========================================
// 13. INITIALIZATION & AUTH EVENT LISTENERS
// ==========================================
export function initAdmin() {
  const loginForm = document.getElementById('admin-login-form');
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error-msg');
    if (errorEl) errorEl.style.display = 'none';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Đăng nhập không thành công');
      }

      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_user', JSON.stringify(data.user));

      showToast('Đăng nhập quản trị thành công!', 'success');
      const nameEl = document.getElementById('admin-display-name');
      if (nameEl) nameEl.textContent = data.user.displayName || data.user.username;

      switchView('view-admin-dashboard');
      loadDashboard();
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
      } else {
        showToast(err.message, 'error');
      }
    }
  });

  document.getElementById('btn-admin-logout')?.addEventListener('click', async () => {
    try {
      await authFetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    showToast('Đã đăng xuất khỏi tài khoản quản trị.');
    if (window.refreshPublicData) window.refreshPublicData();
    switchView('view-landing');
  });

  // Tab switching
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      adminState.activeTab = btn.dataset.tab;
      renderActiveTab();
    });
  });

  // Modal close handlers
  document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
  document.getElementById('app-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'app-modal') closeModal();
  });

  window.addEventListener('admin:open_dashboard', loadDashboard);

  document.getElementById('btn-admin-preview-invite')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (window.refreshPublicData) window.refreshPublicData();
    switchView('view-landing');
  });
}

// Ensure initAdmin is called automatically
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdmin);
} else {
  initAdmin();
}
