import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { initDatabase } from './db/database.js';
import { runCreateAdmin } from './db/create_admin.js';
import { requireAdminAuth, rateLimit } from './middleware/security.js';
import { authenticateAdmin, createSession, destroySession } from './services/authService.js';
import { getInvitationSettings, updateInvitationSettings } from './services/invitationService.js';
import {
  getFoodTree, createFoodCategory, updateFoodCategory, deleteFoodCategory,
  createDish, updateDish, deleteDish,
  createRestaurant, updateRestaurant, deleteRestaurant,
  getDrinksTree, getAllCafes, createDrinkStyle, updateDrinkStyle, deleteDrinkStyle,
  createCafe, updateCafe, deleteCafe,
  getWorkshopTree, createWorkshopCategory, updateWorkshopCategory, deleteWorkshopCategory,
  createWorkshop, updateWorkshop, deleteWorkshop,
  getPhotobooths, createPhotobooth, updatePhotobooth, deletePhotobooth,
  getMovies, createMovie, updateMovie, deleteMovie
} from './services/activityService.js';
import {
  getAvailableDatesWithSlots, createAvailableDate, updateAvailableDate, deleteAvailableDate,
  createTimeSlot, updateTimeSlot, deleteTimeSlot
} from './services/scheduleService.js';
import {
  createSubmission, getSubmissionById, listSubmissions, updateSubmissionStatus,
  deleteSubmission, deleteAllSubmissions, getSubmissionMetrics, exportSubmissionsToCSV, formatSubmissionForSharing
} from './services/submissionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB and ensure bootstrap admin
initDatabase();
runCreateAdmin();

const publicRateLimiter = rateLimit(15, 60000);

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req, maxLimit = 2e7) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > maxLimit) {
        req.socket.destroy();
        reject(new Error('Request entity too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff'
      });
      res.end(data);
    }
  });
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;
  const method = req.method;

  // Add CORS headers for development/testing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // ==========================================
    // 1. PUBLIC APIS
    // ==========================================
    if (pathname === '/api/public/invitation' && method === 'GET') {
      const settings = getInvitationSettings(false);
      return sendJson(res, 200, settings);
    }

    if (pathname === '/api/public/activities' && method === 'GET') {
      const food = getFoodTree(true);
      const drinks = getDrinksTree(true);
      const workshops = getWorkshopTree(true);
      const photobooths = getPhotobooths(true);
      const movies = getMovies(true);
      const dates = getAvailableDatesWithSlots(true);

      return sendJson(res, 200, {
        food,
        drinks,
        workshops,
        photobooths,
        movies: photobooths.length > 0 ? photobooths : movies,
        dates
      });
    }

    if (pathname === '/api/public/submit' && method === 'POST') {
      if (!publicRateLimiter(req, res)) return;
      const body = await parseJsonBody(req);
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

      try {
        const submission = createSubmission(body, ip);
        return sendJson(res, 201, { success: true, submission });
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }

    if (pathname.startsWith('/api/public/submission/') && method === 'GET') {
      const id = pathname.replace('/api/public/submission/', '');
      const sub = getSubmissionById(id);
      if (!sub) {
        return sendJson(res, 404, { error: 'Không tìm thấy kế hoạch này.' });
      }
      return sendJson(res, 200, sub);
    }

    // ==========================================
    // 2. AUTH APIS
    // ==========================================
    if (pathname === '/api/auth/login' && method === 'POST') {
      const body = await parseJsonBody(req);
      const user = authenticateAdmin(body.username, body.password);
      if (!user) {
        return sendJson(res, 401, { error: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
      }

      const { token, expiresAt } = createSession(user.id);
      res.setHeader('Set-Cookie', `session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${config.sessionMaxAgeHours * 3600}`);
      return sendJson(res, 200, { success: true, user, token, expiresAt });
    }

    if (pathname === '/api/auth/logout' && method === 'POST') {
      const cookieHeader = req.headers.cookie;
      let token = null;
      if (cookieHeader) {
        const match = cookieHeader.match(/session_token=([^;]+)/);
        if (match) token = match[1];
      }
      if (token) destroySession(token);
      res.setHeader('Set-Cookie', 'session_token=; Path=/; HttpOnly; Max-Age=0');
      return sendJson(res, 200, { success: true });
    }

    if (pathname === '/api/auth/me' && method === 'GET') {
      const admin = requireAdminAuth(req, res);
      if (!admin) return;
      return sendJson(res, 200, { user: admin });
    }

    // ==========================================
    // 3. ADMIN PROTECTED APIS
    // ==========================================
    if (pathname.startsWith('/api/admin/')) {
      const admin = requireAdminAuth(req, res);
      if (!admin) return;

      // Admin Metrics
      if (pathname === '/api/admin/metrics' && method === 'GET') {
        const metrics = getSubmissionMetrics();
        return sendJson(res, 200, metrics);
      }

      // Image Upload from Local Computer
      if (pathname === '/api/admin/upload' && method === 'POST') {
        try {
          const body = await parseJsonBody(req, 2e7);
          if (!body.dataUrl) {
            return sendJson(res, 400, { error: 'Không tìm thấy dữ liệu ảnh (dataUrl).' });
          }

          const matches = body.dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (!matches || matches.length !== 3) {
            return sendJson(res, 400, { error: 'Định dạng ảnh không hợp lệ.' });
          }

          const mimeType = matches[1].toLowerCase();
          const base64Data = matches[2];
          const buffer = Buffer.from(base64Data, 'base64');

          const extMap = {
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg',
            'image/png': '.png',
            'image/webp': '.webp',
            'image/gif': '.gif',
            'image/svg+xml': '.svg'
          };

          const ext = extMap[mimeType] || '.jpg';
          const uploadDir = path.join(config.publicDir, 'uploads');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }

          const filename = `photo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
          const filePath = path.join(uploadDir, filename);

          fs.writeFileSync(filePath, buffer);

          const publicUrl = `/uploads/${filename}`;
          return sendJson(res, 200, { success: true, url: publicUrl, filename });
        } catch (err) {
          console.error('Upload Error:', err);
          return sendJson(res, 500, { error: 'Lỗi tải ảnh lên: ' + err.message });
        }
      }

      // Settings
      if (pathname === '/api/admin/settings') {
        if (method === 'GET') {
          return sendJson(res, 200, getInvitationSettings(true));
        }
        if (method === 'PUT') {
          const body = await parseJsonBody(req);
          const updated = updateInvitationSettings(body);
          return sendJson(res, 200, updated);
        }
      }

      // Submissions Management
      if (pathname === '/api/admin/submissions') {
        if (method === 'GET') {
          const status = urlObj.searchParams.get('status') || 'all';
          const search = urlObj.searchParams.get('search') || '';
          const list = listSubmissions({ status, search });
          return sendJson(res, 200, list);
        }
        if (method === 'DELETE') {
          deleteAllSubmissions();
          return sendJson(res, 200, { success: true, message: 'Đã xóa tất cả các kế hoạch.' });
        }
      }

      if (pathname === '/api/admin/submissions/export/csv' && method === 'GET') {
        const status = urlObj.searchParams.get('status') || 'all';
        const search = urlObj.searchParams.get('search') || '';
        const list = listSubmissions({ status, search });
        const csv = exportSubmissionsToCSV(list);
        res.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="birthday_submissions.csv"'
        });
        res.end(csv);
        return;
      }

      if (pathname.match(/^\/api\/admin\/submissions\/([^/]+)$/)) {
        const id = pathname.split('/')[4];
        if (method === 'GET') {
          const sub = getSubmissionById(id);
          if (!sub) return sendJson(res, 404, { error: 'Không tìm thấy' });
          const shareText = formatSubmissionForSharing(sub);
          return sendJson(res, 200, { ...sub, shareText });
        }
        if (method === 'DELETE') {
          deleteSubmission(id);
          return sendJson(res, 200, { success: true });
        }
      }

      if (pathname.match(/^\/api\/admin\/submissions\/([^/]+)\/status$/) && method === 'PATCH') {
        const id = pathname.split('/')[4];
        const body = await parseJsonBody(req);
        try {
          const updated = updateSubmissionStatus(id, body.status);
          return sendJson(res, 200, updated);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      // Activity Management CRUD
      // Food Categories
      if (pathname === '/api/admin/food-categories') {
        if (method === 'POST') {
          const item = createFoodCategory(await parseJsonBody(req));
          return sendJson(res, 201, item);
        }
      }
      if (pathname.match(/^\/api\/admin\/food-categories\/([^/]+)$/)) {
        const id = pathname.split('/')[4];
        if (method === 'PUT') return sendJson(res, 200, updateFoodCategory(id, await parseJsonBody(req)));
        if (method === 'DELETE') return sendJson(res, 200, deleteFoodCategory(id));
      }

      // Dishes
      if (pathname === '/api/admin/dishes' && method === 'POST') {
        return sendJson(res, 201, createDish(await parseJsonBody(req)));
      }
      if (pathname.match(/^\/api\/admin\/dishes\/([^/]+)$/)) {
        const id = pathname.split('/')[4];
        if (method === 'PUT') return sendJson(res, 200, updateDish(id, await parseJsonBody(req)));
        if (method === 'DELETE') return sendJson(res, 200, deleteDish(id));
      }

      // Restaurants
      if (pathname === '/api/admin/restaurants' && method === 'POST') {
        return sendJson(res, 201, createRestaurant(await parseJsonBody(req)));
      }
      if (pathname.match(/^\/api\/admin\/restaurants\/([^/]+)$/)) {
        const id = pathname.split('/')[4];
        if (method === 'PUT') return sendJson(res, 200, updateRestaurant(id, await parseJsonBody(req)));
        if (method === 'DELETE') return sendJson(res, 200, deleteRestaurant(id));
      }

      // Drink Styles & Cafes
      if (pathname === '/api/admin/drink-styles') {
        if (method === 'POST') return sendJson(res, 201, createDrinkStyle(await parseJsonBody(req)));
      }
      if (pathname.match(/^\/api\/admin\/drink-styles\/([^/]+)$/)) {
        const id = pathname.split('/')[4];
        if (method === 'PUT') return sendJson(res, 200, updateDrinkStyle(id, await parseJsonBody(req)));
        if (method === 'DELETE') return sendJson(res, 200, deleteDrinkStyle(id));
      }

      if (pathname === '/api/admin/cafes') {
        if (method === 'GET') return sendJson(res, 200, getAllCafes());
        if (method === 'POST') return sendJson(res, 201, createCafe(await parseJsonBody(req)));
      }
      if (pathname.match(/^\/api\/admin\/cafes\/([^/]+)$/)) {
        const id = pathname.split('/')[4];
        if (method === 'PUT') return sendJson(res, 200, updateCafe(id, await parseJsonBody(req)));
        if (method === 'DELETE') return sendJson(res, 200, deleteCafe(id));
      }

      // Workshop Categories & Workshops
      if (pathname === '/api/admin/workshop-categories' && method === 'POST') {
        return sendJson(res, 201, createWorkshopCategory(await parseJsonBody(req)));
      }
      if (pathname.match(/^\/api\/admin\/workshop-categories\/([^/]+)$/)) {
        const id = pathname.split('/')[4];
        if (method === 'PUT') return sendJson(res, 200, updateWorkshopCategory(id, await parseJsonBody(req)));
        if (method === 'DELETE') return sendJson(res, 200, deleteWorkshopCategory(id));
      }

      if (pathname === '/api/admin/workshops' && method === 'POST') {
        return sendJson(res, 201, createWorkshop(await parseJsonBody(req)));
      }
      if (pathname.match(/^\/api\/admin\/workshops\/([^/]+)$/)) {
        const id = pathname.split('/')[4];
        if (method === 'PUT') return sendJson(res, 200, updateWorkshop(id, await parseJsonBody(req)));
        if (method === 'DELETE') return sendJson(res, 200, deleteWorkshop(id));
      }

      // Photobooths
      if (pathname === '/api/admin/photobooths') {
        if (method === 'GET') return sendJson(res, 200, getPhotobooths(false));
        if (method === 'POST') return sendJson(res, 201, createPhotobooth(await parseJsonBody(req)));
      }
      if (pathname.match(/^\/api\/admin\/photobooths\/([^/]+)$/)) {
        const id = pathname.split('/')[4];
        if (method === 'PUT') return sendJson(res, 200, updatePhotobooth(id, await parseJsonBody(req)));
        if (method === 'DELETE') return sendJson(res, 200, deletePhotobooth(id));
      }

      // Movies (legacy compatibility)
      if (pathname === '/api/admin/movies') {
        if (method === 'GET') return sendJson(res, 200, getMovies(false));
        if (method === 'POST') return sendJson(res, 201, createMovie(await parseJsonBody(req)));
      }
      if (pathname.match(/^\/api\/admin\/movies\/([^/]+)$/)) {
        const id = pathname.split('/')[4];
        if (method === 'PUT') return sendJson(res, 200, updateMovie(id, await parseJsonBody(req)));
        if (method === 'DELETE') return sendJson(res, 200, deleteMovie(id));
      }

      // Dates & Slots
      if (pathname === '/api/admin/available-dates') {
        if (method === 'GET') return sendJson(res, 200, getAvailableDatesWithSlots(false));
        if (method === 'POST') return sendJson(res, 201, createAvailableDate(await parseJsonBody(req)));
      }
      if (pathname.match(/^\/api\/admin\/available-dates\/([^/]+)$/)) {
        const id = pathname.split('/')[4];
        if (method === 'PUT') return sendJson(res, 200, updateAvailableDate(id, await parseJsonBody(req)));
        if (method === 'DELETE') return sendJson(res, 200, deleteAvailableDate(id));
      }

      if (pathname === '/api/admin/time-slots' && method === 'POST') {
        return sendJson(res, 201, createTimeSlot(await parseJsonBody(req)));
      }
      if (pathname.match(/^\/api\/admin\/time-slots\/([^/]+)$/)) {
        const id = pathname.split('/')[4];
        if (method === 'PUT') return sendJson(res, 200, updateTimeSlot(id, await parseJsonBody(req)));
        if (method === 'DELETE') return sendJson(res, 200, deleteTimeSlot(id));
      }

      return sendJson(res, 404, { error: 'Admin API endpoint not found' });
    }

    // ==========================================
    // 4. STATIC ASSETS & SINGLE PAGE APP
    // ==========================================
    if (pathname.startsWith('/css/')) {
      return serveStatic(res, path.join(config.publicDir, pathname), 'text/css');
    }
    if (pathname.startsWith('/js/')) {
      return serveStatic(res, path.join(config.publicDir, pathname), 'application/javascript');
    }
    if (pathname.startsWith('/assets/') || pathname.startsWith('/uploads/')) {
      const ext = path.extname(pathname).toLowerCase();
      const mimeTypes = {
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.gif': 'image/gif'
      };
      return serveStatic(res, path.join(config.publicDir, pathname), mimeTypes[ext] || 'application/octet-stream');
    }

    // All pages serve the main HTML application
    return serveStatic(res, path.join(config.publicDir, 'index.html'), 'text/html');

  } catch (error) {
    console.error('Server Error:', error);
    sendJson(res, 500, { error: 'Internal Server Error' });
  }
});

export function startServer(port = config.port) {
  return new Promise((resolve) => {
    server.listen(port, config.host, () => {
      console.log(`✨ Dreamy Birthday Planner server running on http://${config.host}:${port}`);
      resolve(server);
    });
  });
}

export function stopServer() {
  return new Promise((resolve) => {
    server.close(() => {
      resolve();
    });
  });
}

if (process.argv[1]?.endsWith('server.js')) {
  startServer();
}
