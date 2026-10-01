/* =====================================================================
 * Жаргал-Өлзий ӨЭМТ — вэб серверийн код (Node.js + Express + SQLite)
 * Нийтэд нээлттэй сайт + admin/эмчийн нэвтрэлт + өгөгдлийн сан.
 * ===================================================================== */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'солино-уу-нууц-түлхүүр-production-дээр';
const DEFAULT_ADMIN_USER = process.env.ADMIN_USER || 'admin';
const DEFAULT_ADMIN_PASS = process.env.ADMIN_PASS || 'jargal2026';

const DATA_DIR = process.env.DATA_DIR || __dirname; // байнгын диск дээр (жишээ /data) заавал зааж өгнө
const db = new Database(path.join(DATA_DIR, 'data.sqlite'));
db.pragma('journal_mode = WAL');
const uid = () => crypto.randomBytes(8).toString('hex');

/* ---------------- schema ---------------- */
db.exec(`
CREATE TABLE IF NOT EXISTS doctors(
  id TEXT PRIMARY KEY, name TEXT, role TEXT, description TEXT,
  schedule TEXT, color INTEGER DEFAULT 0, sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS services(
  id TEXT PRIMARY KEY, title TEXT, description TEXT, sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS courses(
  id TEXT PRIMARY KEY, title TEXT, description TEXT, price INTEGER DEFAULT 0,
  code TEXT, youtube TEXT, sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS documents(
  id TEXT PRIMARY KEY, category TEXT, title TEXT, date TEXT, body TEXT);
CREATE TABLE IF NOT EXISTS appointments(
  id TEXT PRIMARY KEY, name TEXT, phone TEXT, doctor_id TEXT, doctor_name TEXT,
  date TEXT, time TEXT, note TEXT, status TEXT DEFAULT 'wait', created_at INTEGER);
CREATE TABLE IF NOT EXISTS accounts(
  id TEXT PRIMARY KEY, username TEXT UNIQUE, role TEXT, doctor_id TEXT, pass_hash TEXT);
CREATE TABLE IF NOT EXISTS settings(
  id INTEGER PRIMARY KEY CHECK(id=1), data TEXT);
`);

/* ---------------- seed defaults (first run) ---------------- */
function seed() {
  const nDoctors = db.prepare('SELECT COUNT(*) c FROM doctors').get().c;
  if (nDoctors === 0) {
    const ins = db.prepare('INSERT INTO doctors(id,name,role,description,schedule,color,sort) VALUES(?,?,?,?,?,?,?)');
    [
      ['Б. Оюунчимэг', 'Өрхийн их эмч', 'Дотрын өвчин, урьдчилан сэргийлэх үзлэгийн чиглэлээр 15 гаруй жил ажилласан.', 'Даваа–Баасан, 08:00–16:00', 0],
      ['Д. Батбаяр', 'Өрхийн их эмч', 'Насанд хүрэгчдийн эрүүл мэнд, архаг өвчний хяналтын мэргэжилтэн.', 'Даваа–Баасан, 09:00–17:00', 1],
      ['С. Энхжаргал', 'Их эмч (хүүхэд)', 'Хүүхдийн өсөлт хөгжил, дархлаажуулалт, нярайн хяналтын чиглэлээр.', 'Даваа–Баасан, 08:30–15:30', 2],
      ['Г. Нарантуяа', 'Сувилагч', 'Тарилга, боолт, эрүүл мэндийн зөвлөгөө болон гэрийн эргэлтийн үйлчилгээ.', 'Даваа–Бямба, 08:00–16:00', 4],
    ].forEach((d, i) => ins.run(uid(), d[0], d[1], d[2], d[3], d[4], i));
  }
  const nServices = db.prepare('SELECT COUNT(*) c FROM services').get().c;
  if (nServices === 0) {
    const ins = db.prepare('INSERT INTO services(id,title,description,sort) VALUES(?,?,?,?)');
    [
      ['Ерөнхий үзлэг, оношилгоо', 'Өрхийн эмчийн анхан шатны үзлэг, зөвлөгөө'],
      ['Урьдчилан сэргийлэх үзлэг', 'Эрт илрүүлэг, тандалт, эрүүл мэндийн үнэлгээ'],
      ['Дархлаажуулалт', 'Хүүхэд, насанд хүрэгчдийн вакцинжуулалт'],
      ['Жирэмсний хяналт', 'Жирэмсэн эх, төрсний дараах хяналт'],
      ['Хүүхдийн эрүүл мэнд', 'Өсөлт хөгжлийн хяналт, нярайн үзлэг'],
      ['Архаг өвчний хяналт', 'Даралт, чихрийн шижин зэрэг өвчний тогтмол хяналт'],
      ['Лабораторийн шинжилгээ', 'Цусны болон бусад суурь шинжилгээ'],
      ['Гэрээр үйлчлэх', 'Хөдөлгөөн хязгаарлагдмал иргэдэд гэрийн эргэлт'],
    ].forEach((s, i) => ins.run(uid(), s[0], s[1], i));
  }
  const nCourses = db.prepare('SELECT COUNT(*) c FROM courses').get().c;
  if (nCourses === 0) {
    const ins = db.prepare('INSERT INTO courses(id,title,description,price,code,youtube,sort) VALUES(?,?,?,?,?,?,?)');
    ins.run(uid(), 'Гэрийн нөхцөлд артерийн даралтаа зөв хэмжих', 'Даралтын аппаратыг зөв ашиглах, хэмжилтийн үр дүнгээ уншиж ойлгох практик хичээл.', 25000, 'ULZII25', '', 0);
    ins.run(uid(), 'Нярай хүүхдийн арчилгаа, хооллолт', 'Шинэ төрсөн хүүхдийг арчлах, хөхөөр хооллох, эрүүл мэндийн үндсэн зөвлөмжүүд.', 35000, 'BABY01', '', 1);
  }
  const nDocs = db.prepare('SELECT COUNT(*) c FROM documents').get().c;
  if (nDocs === 0) {
    const ins = db.prepare('INSERT INTO documents(id,category,title,date,body) VALUES(?,?,?,?,?)');
    ins.run(uid(), 'Мэдээлэл', 'Улирлын томуугаас урьдчилан сэргийлэх зөвлөмж', '2026-01-15', 'Улирлын томуу, ханиад томуугаас сэргийлэхийн тулд гараа тогтмол угаах, олон нийтийн газар амны хаалт зүүх, дархлаагаа дэмжсэн хооллолт, хангалттай нойр, дархлаажуулалтад хамрагдахыг зөвлөж байна. Халуурах, ханиалгах шинж илэрвэл гэртээ амарч, шаардлагатай бол өрхийн эмчдээ хандана уу.');
    ins.run(uid(), 'Бичиг баримт', 'Үйлчлүүлэгчийн эрх, үүрэг', '2026-01-10', 'Үйлчлүүлэгч эрүүл мэндийн тусламж үйлчилгээг чанартай, хүндэтгэлтэй авах эрхтэй. Мөн эмчийн зөвлөмжийг дагах, үнэн зөв мэдээлэл өгөх, цагаа баримтлах үүрэгтэй.');
    ins.run(uid(), 'Дотоод үйл ажиллагаа', 'Төвийн дотоод журам (ажилтнуудад)', '2026-01-05', 'Энэ хэсэгт ажилтнуудад зориулсан дотоод журам, ажлын цагийн хуваарь, ёс зүйн дүрэм, халдвар хамгааллын протокол зэрэг мэдээлэл байрлана.');
  }
  const s = db.prepare('SELECT data FROM settings WHERE id=1').get();
  if (!s) {
    db.prepare('INSERT INTO settings(id,data) VALUES(1,?)').run(JSON.stringify({
      branches: [
        { name: 'Төв салбар', address: 'СХД, 20-р хороо, Цэргийн хотхон', phone: '+976-8663-5577' },
        { name: 'Салбар', address: 'СХД, 32-р хороо, 3-84 гарам', phone: '+976-8682-4477' },
      ],
      hours: 'Даваа–Баасан: 08:30–17:00 · Бямба, Ням: Амарна',
      email: 'jargalulzii@email.mn',
      facebook: 'https://www.facebook.com/',
      andmedUrl: '',
    }));
  }
  const admin = db.prepare("SELECT id FROM accounts WHERE role='admin'").get();
  if (!admin) {
    db.prepare('INSERT INTO accounts(id,username,role,doctor_id,pass_hash) VALUES(?,?,?,?,?)')
      .run('admin', DEFAULT_ADMIN_USER, 'admin', null, bcrypt.hashSync(DEFAULT_ADMIN_PASS, 10));
    console.log(`\n  [seed] Админ бүртгэл үүслээ →  нэр: ${DEFAULT_ADMIN_USER}  нууц үг: ${DEFAULT_ADMIN_PASS}`);
    console.log('  Нэвтэрсний дараа Тохиргоо хэсгээс нууц үгээ солино уу.\n');
  }
}
// зургийн багана нэмэх (хуучин сан дээр ч ажиллана)
{
  const cols = db.prepare('PRAGMA table_info(doctors)').all().map(c => c.name);
  if (!cols.includes('photo')) db.exec('ALTER TABLE doctors ADD COLUMN photo TEXT');
  const dcols = db.prepare('PRAGMA table_info(documents)').all().map(c => c.name);
  if (!dcols.includes('file_data')) db.exec('ALTER TABLE documents ADD COLUMN file_data TEXT');
  if (!dcols.includes('file_type')) db.exec('ALTER TABLE documents ADD COLUMN file_type TEXT');
  if (!dcols.includes('file_name')) db.exec('ALTER TABLE documents ADD COLUMN file_name TEXT');
  const acols = db.prepare('PRAGMA table_info(appointments)').all().map(c => c.name);
  if (!acols.includes('reg')) db.exec('ALTER TABLE appointments ADD COLUMN reg TEXT');
}
seed();

/* ---------------- helpers ---------------- */
const getSettings = () => JSON.parse(db.prepare('SELECT data FROM settings WHERE id=1').get().data);
function parseDataUrl(d){ const m = /^data:([^;]+);base64,(.*)$/s.exec(d || ''); return m ? { type: m[1], b64: m[2] } : null; }
const docName = (id) => (db.prepare('SELECT name FROM doctors WHERE id=?').get(id) || {}).name || '';

function auth(roles) { // roles: array or null (any logged-in)
  return (req, res, next) => {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Нэвтрээгүй байна.' });
    try {
      const p = jwt.verify(token, JWT_SECRET);
      if (roles && !roles.includes(p.role)) return res.status(403).json({ error: 'Эрх хүрэлцэхгүй.' });
      req.user = p;
      next();
    } catch (e) { return res.status(401).json({ error: 'Нэвтрэлт хүчингүй.' }); }
  };
}

// маш энгийн rate-limit (нэг IP / цонх)
const hits = new Map();
function limit(max, windowMs) {
  return (req, res, next) => {
    const key = req.ip + ':' + req.path;
    const now = Date.now();
    const rec = hits.get(key) || { n: 0, t: now };
    if (now - rec.t > windowMs) { rec.n = 0; rec.t = now; }
    rec.n++; hits.set(key, rec);
    if (rec.n > max) return res.status(429).json({ error: 'Хэт олон хүсэлт. Түр хүлээгээд дахин оролдоно уу.' });
    next();
  };
}

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '8mb' }));

/* =====================================================================
 * НИЙТИЙН API (нэвтрэх шаардлагагүй)
 * ===================================================================== */
app.get('/api/public', (req, res) => {
  res.json({
    doctors: db.prepare('SELECT id,name,role,description,schedule,color,photo FROM doctors ORDER BY sort,name').all(),
    services: db.prepare('SELECT id,title,description FROM services ORDER BY sort').all(),
    courses: db.prepare('SELECT id,title,description,price FROM courses ORDER BY sort').all(),
    documents: db.prepare('SELECT id,category,title,date,body,file_name AS fileName FROM documents ORDER BY date DESC').all(),
    settings: getSettings(),
  });
});

app.post('/api/appointments', limit(8, 60000), (req, res) => {
  const { name, phone, doctorId, date, time, note } = req.body || {};
  const reg = String((req.body || {}).reg || '').trim().toUpperCase();
  if (!name || !phone || !doctorId || !date || !time || !reg)
    return res.status(400).json({ error: 'Мэдээллээ бүрэн бөглөнө үү.' });
  if (!/^[А-ЯӨҮ]{2}\d{8}$/.test(reg))
    return res.status(400).json({ error: 'Регистрийн дугаар буруу байна (жишээ: АА12345678).' });
  const doc = db.prepare('SELECT id,name FROM doctors WHERE id=?').get(doctorId);
  if (!doc) return res.status(400).json({ error: 'Эмч олдсонгүй.' });
  db.prepare('INSERT INTO appointments(id,name,phone,reg,doctor_id,doctor_name,date,time,note,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
    .run(uid(), String(name).slice(0, 120), String(phone).slice(0, 40), reg, doc.id, doc.name,
      String(date).slice(0, 20), String(time).slice(0, 20), String(note || '').slice(0, 500), 'wait', Date.now());
  res.json({ ok: true });
});

app.post('/api/courses/:id/unlock', limit(20, 60000), (req, res) => {
  const c = db.prepare('SELECT code,youtube FROM courses WHERE id=?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Сургалт олдсонгүй.' });
  const code = String((req.body || {}).code || '').trim().toUpperCase();
  if (!code || code !== String(c.code || '').toUpperCase())
    return res.status(403).json({ error: 'Код буруу байна.' });
  res.json({ youtube: c.youtube || '' });
});

app.get('/api/documents/:id/file', (req, res) => {
  try {
    const d = db.prepare('SELECT file_data,file_type,file_name FROM documents WHERE id=?').get(req.params.id);
    if (!d || !d.file_data) return res.status(404).json({ error: 'Файл олдсонгүй.' });
    res.set('Content-Type', d.file_type || 'application/octet-stream');
    res.set('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(d.file_name || 'file')}`);
    res.send(Buffer.from(d.file_data, 'base64'));
  } catch (e) { res.status(500).json({ error: 'Файл уншихад алдаа гарлаа.' }); }
});

app.post('/api/login', limit(10, 60000), (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Нэр, нууц үгээ оруулна уу.' });
  const acc = db.prepare('SELECT * FROM accounts WHERE lower(username)=lower(?)').get(username);
  if (!acc || !bcrypt.compareSync(password, acc.pass_hash))
    return res.status(401).json({ error: 'Нэвтрэх нэр эсвэл нууц үг буруу байна.' });
  const name = acc.role === 'doctor' ? docName(acc.doctor_id) : acc.username;
  const token = jwt.sign({ id: acc.id, role: acc.role, doctorId: acc.doctor_id || null }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, role: acc.role, doctorId: acc.doctor_id || null, name });
});

/* =====================================================================
 * ЦАГ ЗАХИАЛГА (admin бүгд / эмч зөвхөн өөрийнх)
 * ===================================================================== */
app.get('/api/admin/appointments', auth(), (req, res) => {
  const rows = req.user.role === 'admin'
    ? db.prepare('SELECT * FROM appointments ORDER BY created_at DESC').all()
    : db.prepare('SELECT * FROM appointments WHERE doctor_id=? ORDER BY created_at DESC').all(req.user.doctorId);
  res.json(rows.map(r => ({ id: r.id, name: r.name, phone: r.phone, reg: r.reg, doctorId: r.doctor_id, doctorName: r.doctor_name, date: r.date, time: r.time, note: r.note, status: r.status, createdAt: r.created_at })));
});

app.patch('/api/admin/appointments/:id', auth(), (req, res) => {
  const a = db.prepare('SELECT doctor_id FROM appointments WHERE id=?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Олдсонгүй.' });
  if (req.user.role !== 'admin' && a.doctor_id !== req.user.doctorId)
    return res.status(403).json({ error: 'Эрх хүрэлцэхгүй.' });
  const status = ['wait', 'ok', 'no'].includes((req.body || {}).status) ? req.body.status : 'wait';
  db.prepare('UPDATE appointments SET status=? WHERE id=?').run(status, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/admin/appointments/:id', auth(['admin']), (req, res) => {
  db.prepare('DELETE FROM appointments WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

/* =====================================================================
 * ЭМЧ (admin)
 * ===================================================================== */
app.post('/api/admin/doctors', auth(['admin']), (req, res) => {
  const { name, role, description, schedule, color, photo } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Нэр шаардлагатай.' });
  const n = db.prepare('SELECT COALESCE(MAX(sort),0)+1 s FROM doctors').get().s;
  const id = uid();
  db.prepare('INSERT INTO doctors(id,name,role,description,schedule,color,photo,sort) VALUES(?,?,?,?,?,?,?,?)')
    .run(id, name, role || '', description || '', schedule || '', +color || 0, photo || null, n);
  res.json({ id });
});
app.put('/api/admin/doctors/:id', auth(['admin']), (req, res) => {
  const { name, role, description, schedule, color, photo } = req.body || {};
  db.prepare('UPDATE doctors SET name=?,role=?,description=?,schedule=?,color=?,photo=? WHERE id=?')
    .run(name || '', role || '', description || '', schedule || '', +color || 0, photo == null ? null : photo, req.params.id);
  res.json({ ok: true });
});
app.delete('/api/admin/doctors/:id', auth(['admin']), (req, res) => {
  db.prepare('DELETE FROM doctors WHERE id=?').run(req.params.id);
  db.prepare('DELETE FROM accounts WHERE role=? AND doctor_id=?').run('doctor', req.params.id);
  res.json({ ok: true });
});

/* эмчийн нэвтрэх эрх (admin оноож өгнө) */
app.post('/api/admin/doctor-login', auth(['admin']), (req, res) => {
  const { doctorId, username, password } = req.body || {};
  if (!doctorId || !username) return res.status(400).json({ error: 'Эмч, нэвтрэх нэр шаардлагатай.' });
  const taken = db.prepare('SELECT id FROM accounts WHERE lower(username)=lower(?) AND NOT (role=? AND doctor_id=?)').get(username, 'doctor', doctorId);
  if (taken) return res.status(400).json({ error: 'Энэ нэвтрэх нэр аль хэдийн бүртгэлтэй байна.' });
  const existing = db.prepare('SELECT * FROM accounts WHERE role=? AND doctor_id=?').get('doctor', doctorId);
  if (existing) {
    if (password) db.prepare('UPDATE accounts SET username=?,pass_hash=? WHERE id=?').run(username, bcrypt.hashSync(password, 10), existing.id);
    else db.prepare('UPDATE accounts SET username=? WHERE id=?').run(username, existing.id);
  } else {
    if (!password) return res.status(400).json({ error: 'Шинэ бүртгэлд нууц үг шаардлагатай.' });
    db.prepare('INSERT INTO accounts(id,username,role,doctor_id,pass_hash) VALUES(?,?,?,?,?)')
      .run(uid(), username, 'doctor', doctorId, bcrypt.hashSync(password, 10));
  }
  res.json({ ok: true });
});

/* =====================================================================
 * ҮЙЛЧИЛГЭЭ (admin)
 * ===================================================================== */
app.post('/api/admin/services', auth(['admin']), (req, res) => {
  const { title, description } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Нэр шаардлагатай.' });
  const n = db.prepare('SELECT COALESCE(MAX(sort),0)+1 s FROM services').get().s;
  const id = uid();
  db.prepare('INSERT INTO services(id,title,description,sort) VALUES(?,?,?,?)').run(id, title, description || '', n);
  res.json({ id });
});
app.put('/api/admin/services/:id', auth(['admin']), (req, res) => {
  const { title, description } = req.body || {};
  db.prepare('UPDATE services SET title=?,description=? WHERE id=?').run(title || '', description || '', req.params.id);
  res.json({ ok: true });
});
app.delete('/api/admin/services/:id', auth(['admin']), (req, res) => {
  db.prepare('DELETE FROM services WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

/* =====================================================================
 * СУРГАЛТ (admin — код, YouTube-той бүрэн)
 * ===================================================================== */
app.get('/api/admin/courses', auth(['admin']), (req, res) => {
  res.json(db.prepare('SELECT id,title,description,price,code,youtube FROM courses ORDER BY sort').all());
});
app.post('/api/admin/courses', auth(['admin']), (req, res) => {
  const { title, description, price, code, youtube } = req.body || {};
  if (!title || !code) return res.status(400).json({ error: 'Нэр, код шаардлагатай.' });
  const n = db.prepare('SELECT COALESCE(MAX(sort),0)+1 s FROM courses').get().s;
  const id = uid();
  db.prepare('INSERT INTO courses(id,title,description,price,code,youtube,sort) VALUES(?,?,?,?,?,?,?)')
    .run(id, title, description || '', +price || 0, code, youtube || '', n);
  res.json({ id });
});
app.put('/api/admin/courses/:id', auth(['admin']), (req, res) => {
  const { title, description, price, code, youtube } = req.body || {};
  db.prepare('UPDATE courses SET title=?,description=?,price=?,code=?,youtube=? WHERE id=?')
    .run(title || '', description || '', +price || 0, code || '', youtube || '', req.params.id);
  res.json({ ok: true });
});
app.delete('/api/admin/courses/:id', auth(['admin']), (req, res) => {
  db.prepare('DELETE FROM courses WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

/* =====================================================================
 * МЭДЭЭЛЭЛ / БИЧИГ БАРИМТ (admin)
 * ===================================================================== */
app.post('/api/admin/documents', auth(['admin']), (req, res) => {
  const { category, title, date, body, file, fileName } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Гарчиг шаардлагатай.' });
  const id = uid();
  const p = file ? parseDataUrl(file) : null;
  db.prepare('INSERT INTO documents(id,category,title,date,body,file_data,file_type,file_name) VALUES(?,?,?,?,?,?,?,?)')
    .run(id, category || 'Мэдээлэл', title, date || new Date().toISOString().slice(0, 10), body || '',
         p ? p.b64 : null, p ? p.type : null, p ? (fileName || 'file') : null);
  res.json({ id });
});
app.put('/api/admin/documents/:id', auth(['admin']), (req, res) => {
  const { category, title, date, body, file, fileName } = req.body || {};
  db.prepare('UPDATE documents SET category=?,title=?,date=?,body=? WHERE id=?')
    .run(category || 'Мэдээлэл', title || '', date || '', body || '', req.params.id);
  if (file !== undefined) {
    if (file) { const p = parseDataUrl(file); if (p) db.prepare('UPDATE documents SET file_data=?,file_type=?,file_name=? WHERE id=?').run(p.b64, p.type, fileName || 'file', req.params.id); }
    else db.prepare('UPDATE documents SET file_data=NULL,file_type=NULL,file_name=NULL WHERE id=?').run(req.params.id);
  }
  res.json({ ok: true });
});
app.delete('/api/admin/documents/:id', auth(['admin']), (req, res) => {
  db.prepare('DELETE FROM documents WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

/* =====================================================================
 * ТОХИРГОО + БҮРТГЭЛ (admin)
 * ===================================================================== */
app.put('/api/admin/settings', auth(['admin']), (req, res) => {
  const cur = getSettings();
  const next = Object.assign({}, cur, req.body || {});
  db.prepare('UPDATE settings SET data=? WHERE id=1').run(JSON.stringify(next));
  res.json({ ok: true });
});
app.get('/api/admin/accounts', auth(['admin']), (req, res) => {
  res.json(db.prepare('SELECT id,username,role,doctor_id AS doctorId FROM accounts').all());
});
app.put('/api/admin/admin-credentials', auth(['admin']), (req, res) => {
  const { username, password } = req.body || {};
  if (!username) return res.status(400).json({ error: 'Нэвтрэх нэр шаардлагатай.' });
  const acc = db.prepare("SELECT id FROM accounts WHERE role='admin'").get();
  if (password) db.prepare('UPDATE accounts SET username=?,pass_hash=? WHERE id=?').run(username, bcrypt.hashSync(password, 10), acc.id);
  else db.prepare('UPDATE accounts SET username=? WHERE id=?').run(username, acc.id);
  res.json({ ok: true });
});

/* =====================================================================
 * ЭМЧ — ӨӨРИЙН МЭДЭЭЛЭЛ
 * ===================================================================== */
app.put('/api/me/profile', auth(['doctor']), (req, res) => {
  const { description, schedule, photo } = req.body || {};
  if (photo === undefined)
    db.prepare('UPDATE doctors SET description=?,schedule=? WHERE id=?').run(description || '', schedule || '', req.user.doctorId);
  else
    db.prepare('UPDATE doctors SET description=?,schedule=?,photo=? WHERE id=?').run(description || '', schedule || '', photo || null, req.user.doctorId);
  res.json({ ok: true });
});
app.put('/api/me/password', auth(), (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'Нууц үг шаардлагатай.' });
  db.prepare('UPDATE accounts SET pass_hash=? WHERE id=?').run(bcrypt.hashSync(password, 10), req.user.id);
  res.json({ ok: true });
});

/* ---------------- static + fallback ---------------- */
app.use('/api', (req, res) => res.status(404).json({ error: 'Ийм API байхгүй.' }));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));
const INDEX_PATH = path.join(__dirname, 'public', 'index.html');
app.get('*', (req, res) => {
  const origin = `${req.protocol}://${req.get('host')}`;
  let html;
  try { html = fs.readFileSync(INDEX_PATH, 'utf8'); }
  catch (e) { return res.status(500).send('index.html олдсонгүй'); }
  res.set('Content-Type', 'text/html; charset=utf-8').send(html.split('__ORIGIN__').join(origin));
});

// --- алдаа боловсруулагч: том файл/буруу өгөгдөлд сервер унахгүй, цэвэр мессеж буцаана ---
app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413))
    return res.status(413).json({ error: 'Файл хэт том байна. 5MB-аас бага файл сонгоно уу.' });
  if (err && err.type === 'entity.parse.failed')
    return res.status(400).json({ error: 'Өгөгдөл буруу байна.' });
  console.error('Алдаа:', err && err.message);
  if (!res.headersSent) res.status(500).json({ error: 'Серверийн алдаа гарлаа.' });
});
// гэнэтийн алдаанд процесс унахаас сэргийлэх
process.on('uncaughtException', e => console.error('uncaughtException:', e && e.message));
process.on('unhandledRejection', e => console.error('unhandledRejection:', e && (e.message || e)));

app.listen(PORT, () => console.log(`\n  Жаргал-Өлзий сервер ажиллаж байна →  http://localhost:${PORT}\n`));
