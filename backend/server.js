const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const Razorpay = require('razorpay');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const DATA_FILE = path.join(__dirname, 'data.json');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
app.use('/uploads', express.static(UPLOAD_DIR));

/* ---------------- simple JSON file "database" ---------------- */
function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const seed = {
      products: [
        { id: 'p1', name: 'Midnight Gold Tee', price: 1499, icon: '👕', img: null, sku: 'U19-001', desc: 'Heavyweight cotton tee with subtle gold foil print.', stock: true },
        { id: 'p2', name: 'Onyx Track Jacket', price: 2999, icon: '🧥', img: null, sku: 'U19-002', desc: 'Satin track jacket, black with gold piping.', stock: true },
        { id: 'p3', name: 'Reserve Cargo Pants', price: 2499, icon: '👖', img: null, sku: 'U19-003', desc: 'Relaxed fit cargo with embossed hardware.', stock: false },
        { id: 'p4', name: 'Gilded Track Shirt', price: 1799, icon: '🎽', img: null, sku: 'U19-004', desc: 'Mesh track shirt, limited run.', stock: true }
      ],
      coupons: [],
      orders: [],
      users: [],
      adminPasswordHash: bcrypt.hashSync('under19', 10)
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
let DB = loadData();

/* ---------------- razorpay ---------------- */
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

/* ---------------- admin auth ---------------- */
const adminSessions = new Set();
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || !adminSessions.has(token)) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (!password || !bcrypt.compareSync(password, DB.adminPasswordHash)) {
    return res.status(401).json({ error: 'Incorrect password' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  adminSessions.add(token);
  res.json({ token });
});

app.post('/api/admin/change-password', requireAdmin, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
  DB.adminPasswordHash = bcrypt.hashSync(newPassword, 10);
  saveData(DB);
  res.json({ ok: true });
});

/* ---------------- image upload (admin) ---------------- */
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e6) + path.extname(file.originalname))
  }),
  limits: { fileSize: 5 * 1024 * 1024 }
});
app.post('/api/admin/upload-image', requireAdmin, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: '/uploads/' + req.file.filename });
});

/* ---------------- products ---------------- */
app.get('/api/products', (req, res) => res.json(DB.products));

app.post('/api/admin/products', requireAdmin, (req, res) => {
  const { name, price, icon, sku, desc, img } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'Name and price are required' });
  const product = { id: 'p' + Date.now(), name, price: Number(price), icon: icon || '🖤', img: img || null, sku: sku || ('U19-' + Math.floor(Math.random() * 900 + 100)), desc: desc || '', stock: true };
  DB.products.push(product);
  saveData(DB);
  res.json(product);
});

app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  const p = DB.products.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  Object.assign(p, req.body);
  saveData(DB);
  res.json(p);
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  DB.products = DB.products.filter(x => x.id !== req.params.id);
  saveData(DB);
  res.json({ ok: true });
});

/* ---------------- coupons ---------------- */
app.get('/api/coupons/:code', (req, res) => {
  const c = DB.coupons.find(x => x.code.toUpperCase() === req.params.code.toUpperCase() && x.active);
  if (!c) return res.status(404).json({ error: 'Invalid or inactive coupon code' });
  res.json(c);
});

app.get('/api/admin/coupons', requireAdmin, (req, res) => res.json(DB.coupons));

app.post('/api/admin/coupons', requireAdmin, (req, res) => {
  const { code, discount } = req.body;
  if (!code || !discount) return res.status(400).json({ error: 'Code and discount are required' });
  if (DB.coupons.find(c => c.code.toUpperCase() === code.toUpperCase())) return res.status(400).json({ error: 'Coupon already exists' });
  const coupon = { code: code.toUpperCase(), discount: Number(discount), active: true };
  DB.coupons.push(coupon);
  saveData(DB);
  res.json(coupon);
});

app.put('/api/admin/coupons/:code', requireAdmin, (req, res) => {
  const c = DB.coupons.find(x => x.code === req.params.code.toUpperCase());
  if (!c) return res.status(404).json({ error: 'Coupon not found' });
  Object.assign(c, req.body);
  saveData(DB);
  res.json(c);
});

app.delete('/api/admin/coupons/:code', requireAdmin, (req, res) => {
  DB.coupons = DB.coupons.filter(x => x.code !== req.params.code.toUpperCase());
  saveData(DB);
  res.json({ ok: true });
});

/* ---------------- buyer auth ---------------- */
app.post('/api/signup', (req, res) => {
  const { name, phone, address, password } = req.body;
  if (!name || !phone || !password) return res.status(400).json({ error: 'Please fill in all required fields' });
  if (DB.users.find(u => u.phone === phone)) return res.status(400).json({ error: 'An account with this phone number already exists' });
  DB.users.push({ name, phone, address: address || '', passwordHash: bcrypt.hashSync(password, 10) });
  saveData(DB);
  res.json({ name, phone, address: address || '' });
});

app.post('/api/login', (req, res) => {
  const { phone, password } = req.body;
  const u = DB.users.find(x => x.phone === phone);
  if (!u || !bcrypt.compareSync(password || '', u.passwordHash)) return res.status(401).json({ error: 'Incorrect phone number or password' });
  res.json({ name: u.name, phone: u.phone, address: u.address });
});

/* ---------------- payments (razorpay) ---------------- */
app.post('/api/create-order', async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: 'rcpt_' + Date.now()
    });
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not create payment order. Check your Razorpay keys.' });
  }
});

app.post('/api/verify-payment', (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderDetails } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment details' });
  }
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(razorpay_order_id + '|' + razorpay_payment_id)
    .digest('hex');
  if (expected !== razorpay_signature) {
    return res.status(400).json({ error: 'Payment verification failed' });
  }
  const order = {
    id: 'U19' + Date.now().toString().slice(-8),
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    items: orderDetails.items,
    subtotal: orderDetails.subtotal,
    discount: orderDetails.discount,
    total: orderDetails.total,
    coupon: orderDetails.coupon || null,
    buyer: orderDetails.buyer,
    status: 'Paid',
    date: new Date().toISOString()
  };
  DB.orders.push(order);
  saveData(DB);
  res.json({ ok: true, orderId: order.id });
});

app.get('/api/admin/orders', requireAdmin, (req, res) => res.json(DB.orders));

app.get('/', (req, res) => res.send('UNDER19 COLLXN API is running.'));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log('UNDER19 COLLXN backend running on port ' + PORT));
