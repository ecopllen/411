import { validateSessionToken } from '../services/authService.js';

export function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  for (const item of cookieHeader.split(';')) {
    const parts = item.trim().split('=');
    if (parts.length >= 2) {
      cookies[parts[0]] = decodeURIComponent(parts.slice(1).join('='));
    }
  }
  return cookies;
}

// IP-based rate limiter for public endpoints
const rateLimitMap = new Map();

export function rateLimit(limit = 10, windowMs = 60000) {
  return function checkRateLimit(req, res) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();
    let record = rateLimitMap.get(ip);

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      rateLimitMap.set(ip, record);
      return true;
    }

    record.count++;
    if (record.count > limit) {
      res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Quá nhiều yêu cầu. Vui lòng chờ 1 phút trước khi thử lại.' }));
      return false;
    }

    return true;
  };
}

export function requireAdminAuth(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.session_token || req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!token) {
    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Unauthorized: Vui lòng đăng nhập quyền quản trị' }));
    return null;
  }

  const session = validateSessionToken(token);
  if (!session) {
    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại' }));
    return null;
  }

  req.admin = session;
  return session;
}
