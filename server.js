const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0'; // bind to all interfaces by default for LAN access

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Serve static frontend files from project root
app.use(express.static(path.join(__dirname)));

// Ensure folders exist
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

const FILES = {
  books: path.join(DATA_DIR, 'books.json'),
  users: path.join(DATA_DIR, 'users.json'),
  chapters: path.join(DATA_DIR, 'chapters.json'),
  purchases: path.join(DATA_DIR, 'purchases.json'),
  reading_progress: path.join(DATA_DIR, 'reading_progress.json'),
  reports: path.join(DATA_DIR, 'reports.json'),
  comments: path.join(DATA_DIR, 'comments.json')
};

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';
const ADMIN_USER = process.env.ADMIN_USER || 'miyobamhamalila@gmail.com';
const ADMIN_PASS = process.env.ADMIN_PASS || '445';

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'Invalid auth header' });
  const token = parts[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Login endpoint removed; use /auth/login instead

function readJSON(file) {
  try {
    if (!fs.existsSync(file)) { fs.writeFileSync(file, JSON.stringify([])); }
    return JSON.parse(fs.readFileSync(file));
  } catch (e) { return []; }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function wrapData(rows) { return { data: rows }; }
function uid() { return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2,8); }

// GET books
app.get('/tables/books', (req, res) => {
  const books = readJSON(FILES.books);
  res.json(wrapData(books));
});

// Auth: login (simple admin)
app.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = generateToken({ username, role: 'admin' });
    return res.json({ token, username, role: 'admin' });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
});

// Auth: verify token
app.get('/auth/me', authMiddleware, (req, res) => {
  res.json({ username: req.user.username, role: req.user.role });
});

// POST book (admin/front-end may not use this; local posting persists client-side)
app.post('/tables/books', authMiddleware, (req, res) => {
  const books = readJSON(FILES.books);
  const b = Object.assign({ id: uid(), created_at: new Date().toISOString(), owner_id: req.user.username, owner_name: req.user.username }, req.body);
  books.unshift(b);
  writeJSON(FILES.books, books);
  res.json(b);
});

// Edit book (admin or owner)
app.put('/tables/books/:id', authMiddleware, (req, res) => {
  const id = req.params.id;
  const books = readJSON(FILES.books);
  const idx = books.findIndex(b => String(b.id) === String(id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const book = books[idx];
  if (req.user.role !== 'admin' && req.user.username !== book.owner_id) return res.status(403).json({ error: 'Forbidden' });
  books[idx] = Object.assign(book, req.body);
  writeJSON(FILES.books, books);
  res.json(books[idx]);
});

// Delete book (admin or owner)
app.delete('/tables/books/:id', authMiddleware, (req, res) => {
  const id = req.params.id;
  let books = readJSON(FILES.books);
  const book = books.find(b => String(b.id) === String(id));
  if (!book) return res.status(404).json({ error: 'Not found' });
  if (req.user.role !== 'admin' && req.user.username !== book.owner_id) return res.status(403).json({ error: 'Forbidden' });
  books = books.filter(b => String(b.id) !== String(id));
  writeJSON(FILES.books, books);
  res.json({ ok: true });
});

// GET users
app.get('/tables/users', (req, res) => {
  const users = readJSON(FILES.users);
  res.json(wrapData(users));
});

// POST users (signup)
app.post('/tables/users', (req, res) => {
  const users = readJSON(FILES.users);
  const u = Object.assign({ id: uid(), joined_date: new Date().toISOString() }, req.body);
  users.push(u);
  writeJSON(FILES.users, users);
  res.json(u);
});

// GET chapters
app.get('/tables/chapters', (req, res) => {
  const chapters = readJSON(FILES.chapters);
  res.json(wrapData(chapters));
});

// Create chapter
app.post('/tables/chapters', (req, res) => {
  const chapters = readJSON(FILES.chapters);
  const c = Object.assign({ id: uid(), created_at: new Date().toISOString() }, req.body);
  chapters.push(c);
  writeJSON(FILES.chapters, chapters);
  res.json(c);
});

// Update chapter (admin only)
app.put('/tables/chapters/:id', authMiddleware, (req, res) => {
  const id = req.params.id;
  const chapters = readJSON(FILES.chapters);
  const idx = chapters.findIndex(x => String(x.id) === String(id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  chapters[idx] = Object.assign(chapters[idx], req.body);
  writeJSON(FILES.chapters, chapters);
  res.json(chapters[idx]);
});

// Delete chapter (admin only)
app.delete('/tables/chapters/:id', authMiddleware, (req, res) => {
  const id = req.params.id;
  let chapters = readJSON(FILES.chapters);
  const found = chapters.find(x => String(x.id) === String(id));
  if (!found) return res.status(404).json({ error: 'Not found' });
  chapters = chapters.filter(x => String(x.id) !== String(id));
  writeJSON(FILES.chapters, chapters);
  res.json({ ok: true });
});

// GET purchases
app.get('/tables/purchases', (req, res) => {
  const purchases = readJSON(FILES.purchases);
  res.json(wrapData(purchases));
});

// POST purchase
app.post('/tables/purchases', (req, res) => {
  const purchases = readJSON(FILES.purchases);
  const p = Object.assign({ id: uid(), purchase_date: new Date().toISOString() }, req.body);
  purchases.push(p);
  writeJSON(FILES.purchases, purchases);
  res.json(p);
});

// Reports: allow contact messages and content reports to be stored
app.get('/tables/reports', (req, res) => {
  const reports = readJSON(FILES.reports);
  res.json(wrapData(reports));
});

app.post('/tables/reports', (req, res) => {
  const reports = readJSON(FILES.reports);
  const r = Object.assign({ id: uid(), created_at: new Date().toISOString() }, req.body);
  reports.unshift(r);
  writeJSON(FILES.reports, reports);
  res.json(r);
});

// Comments
app.get('/tables/comments', (req, res) => {
  const comments = readJSON(FILES.comments);
  res.json(wrapData(comments));
});

app.post('/tables/comments', authMiddleware, (req, res) => {
  const comments = readJSON(FILES.comments);
  const c = Object.assign({ id: uid(), created_at: new Date().toISOString(), user_id: req.user.username, user_name: req.user.username }, req.body);
  comments.push(c);
  writeJSON(FILES.comments, comments);
  res.json(c);
});

// GET reading_progress
app.get('/tables/reading_progress', (req, res) => {
  const rp = readJSON(FILES.reading_progress);
  res.json(wrapData(rp));
});

// POST reading_progress
app.post('/tables/reading_progress', (req, res) => {
  const rp = readJSON(FILES.reading_progress);
  const item = Object.assign({ id: uid(), last_read: new Date().toISOString() }, req.body);
  rp.push(item);
  writeJSON(FILES.reading_progress, rp);
  res.json(item);
});

// PATCH reading_progress/:id
app.patch('/tables/reading_progress/:id', (req, res) => {
  const id = req.params.id;
  const rp = readJSON(FILES.reading_progress);
  const idx = rp.findIndex(x => x.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  rp[idx] = Object.assign(rp[idx], req.body);
  writeJSON(FILES.reading_progress, rp);
  res.json(rp[idx]);
});

// Upload via base64 JSON { filename, data }
app.post('/upload', (req, res) => {
  const { filename, data } = req.body || {};
  if (!filename || !data) return res.status(400).json({ error: 'filename and data required' });
  const m = data.match(/^data:(.+);base64,(.+)$/);
  if (!m) return res.status(400).json({ error: 'Invalid data' });
  const mime = m[1];
  // Allow common image types and PDFs
  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
  if (!allowed.includes(mime)) return res.status(400).json({ error: 'Unsupported mime type' });
  const safe = Date.now() + '-' + filename.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
  const out = path.join(UPLOADS_DIR, safe);
  fs.writeFileSync(out, Buffer.from(m[2], 'base64'));
  res.json({ url: '/uploads/' + path.basename(out) });
});

// Update /tables/books/:id (edit) - admin only
app.put('/tables/books/:id', (req, res) => {
  const id = req.params.id;
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  try { jwt.verify(auth.split(' ')[1], JWT_SECRET); } catch (e) { return res.status(401).json({ error: 'Invalid token' }); }
  const books = readJSON(FILES.books);
  const idx = books.findIndex(b => String(b.id) === String(id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  books[idx] = Object.assign(books[idx], req.body);
  writeJSON(FILES.books, books);
  res.json(books[idx]);
});

// Delete book - admin only
app.delete('/tables/books/:id', (req, res) => {
  const id = req.params.id;
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  try { jwt.verify(auth.split(' ')[1], JWT_SECRET); } catch (e) { return res.status(401).json({ error: 'Invalid token' }); }
  let books = readJSON(FILES.books);
  const before = books.length;
  books = books.filter(b => String(b.id) !== String(id));
  writeJSON(FILES.books, books);
  res.json({ ok: true, removed: before - books.length });
});

// Serve index
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

if (process.env.FUNCTIONS_WORKER_RUNTIME) {
  module.exports = app;
} else {
  app.listen(PORT, HOST, () => {
    // helpful startup message including LAN IPs
    const os = require('os');
    const ifaces = os.networkInterfaces();
    const addrs = [];
    Object.keys(ifaces).forEach((ifname) => {
      ifaces[ifname].forEach((iface) => {
        if (iface.family === 'IPv4' && !iface.internal) addrs.push(iface.address);
      });
    });

    console.log(`M.Y.B server running at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    if (addrs.length > 0) console.log(`Accessible on your LAN at: ${addrs.map(a => `http://${a}:${PORT}`).join(', ')}`);
    // expose addrs for UI to query
    global.LAN_ADDRS = addrs;
  });

  // Simple endpoint providing server information (LAN addresses)
  app.get('/server-info', (req, res) => {
    const addrs = global.LAN_ADDRS || [];
    res.json({ addrs: addrs, port: PORT });
  });
}
