import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'admin_auth';
const MAX_AGE = 60 * 60 * 8;

function sign(value, secret) {
  return createHmac('sha256', secret).update(value).digest('hex');
}

function verifyCookie(cookieHeader, secret) {
  if (!cookieHeader) return false;
  const match = cookieHeader.split(/;\s*/).find(c => c.startsWith(COOKIE_NAME + '='));
  if (!match) return false;
  const token = decodeURIComponent(match.slice(COOKIE_NAME.length + 1));
  const [ts, sig] = token.split('.');
  if (!ts || !sig) return false;
  const expected = sign(ts, secret);
  try {
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  } catch { return false; }
  const age = Date.now() / 1000 - Number(ts);
  return age >= 0 && age < MAX_AGE;
}

function parseBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      const params = new URLSearchParams(data);
      resolve(Object.fromEntries(params));
    });
  });
}

const LOGIN_HTML = (error) => `<!doctype html><html><head><meta charset="utf-8"><title>Admin Login</title><meta name="robots" content="noindex,nofollow"><style>body{font-family:system-ui,sans-serif;background:#0b3b3f;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.card{background:rgba(255,255,255,.06);padding:2rem;border-radius:12px;width:340px;box-shadow:0 10px 30px rgba(0,0,0,.3)}h1{margin:0 0 .5rem;font-size:1.4rem}p{margin:0 0 1rem;opacity:.8;font-size:.9rem}input{width:100%;padding:.7rem;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.2);color:#fff;box-sizing:border-box;margin-bottom:.75rem}button{width:100%;padding:.75rem;border:0;border-radius:8px;background:#ef6c1a;color:#fff;font-weight:600;cursor:pointer}.err{color:#ffb4a8;font-size:.85rem;margin-bottom:.75rem}</style></head><body><form class="card" method="POST" action="/admin"><h1>Admin Panel</h1><p>Enter the admin password.</p>${error ? '<div class="err">Incorrect password.</div>' : ''}<input type="password" name="password" autofocus required placeholder="Password"/><button type="submit">Sign In</button></form></body></html>`;

export default async function handler(req, res) {
  const PASSWORD = process.env.ADMIN_PASSWORD;
  const SECRET = process.env.ADMIN_COOKIE_SECRET || PASSWORD || 'dev-secret';

  if (!PASSWORD) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain');
    return res.end('ADMIN_PASSWORD env var is not set.');
  }

  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'POST') {
    const body = await parseBody(req);
    const submitted = body.password || '';
    const ok = submitted.length === PASSWORD.length &&
               timingSafeEqual(Buffer.from(submitted), Buffer.from(PASSWORD));
    if (!ok) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(LOGIN_HTML(true));
    }
    const ts = Math.floor(Date.now() / 1000).toString();
    const token = `${ts}.${sign(ts, SECRET)}`;
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`);
    res.statusCode = 302;
    res.setHeader('Location', '/admin');
    return res.end();
  }

  const authed = verifyCookie(req.headers.cookie, SECRET);
  if (!authed) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(LOGIN_HTML(false));
  }

  try {
    const html = readFileSync(join(process.cwd(), '_admin.html'), 'utf-8');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(html);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain');
    return res.end('admin.html not found');
  }
}
