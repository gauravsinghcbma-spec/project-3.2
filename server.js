const express = require('express');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const QRCode = require('qrcode');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;

// UPI Configuration
const UPI_CONFIG = {
  upiId: 'g47128163@oksbi',
  merchantName: 'Gaurav',
  merchantCode: 'SPIRITUAL_STORE'
};

const pendingTransactions = new Map();
const pendingPath = path.join(__dirname, 'pending.json');

function loadPendingFromFile() {
  try {
    if (fs.existsSync(pendingPath)) {
      const raw = JSON.parse(fs.readFileSync(pendingPath, 'utf8')) || {};
      Object.keys(raw).forEach((k) => pendingTransactions.set(k, raw[k]));
    }
  } catch (err) {
    console.warn('Could not load pending transactions:', err.message);
  }
}

function savePendingToFile() {
  try {
    const obj = {};
    for (const [k, v] of pendingTransactions.entries()) obj[k] = v;
    fs.writeFileSync(pendingPath, JSON.stringify(obj, null, 2));
  } catch (err) {
    console.warn('Could not save pending transactions:', err.message);
  }
}

// Load pending transactions on startup so webhooks can be processed after restarts
loadPendingFromFile();

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:xbrDXDxvacRISsCdOQQLWNUvVyGTsCGB@tokaido.proxy.rlwy.net:5432/railway';

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

const defaultCatalog = {
  1: {
    id: 1,
    name: 'Spiritual Books',
    image: 'images/books.jpg',
    description: 'Sacred books and devotional items for spiritual growth.',
    products: [
      { name: 'Bhagavad Gita', image: 'images/bhagavad-gita.jpg', description: 'A timeless spiritual guide with divine teachings.', price: 250, quantity: 10 },
      { name: 'Srimad Bhagavatam', image: 'images/bhagavatam.jpg', description: 'A sacred scripture rich with stories and wisdom.', price: 480, quantity: 5 }
    ]
  },
  2: {
    id: 2,
    name: 'Clothing',
    image: 'images/clothing.jpg',
    description: 'Traditional and comfortable clothing for daily wear and festivals.',
    products: [
      { name: 'Dhoti', image: 'images/dhoti.jpg', description: 'Traditional dhoti made for comfort and simplicity.', price: 799, quantity: 20 },
      { name: 'Kurta', image: 'images/kurta.jpg', description: 'Soft cotton kurta with a classic style.', price: 999, quantity: 15 }
    ]
  },
  3: {
    id: 3,
    name: 'Pooja Items',
    image: 'images/pooja.jpg',
    description: 'Beautiful devotional items for daily worship and rituals.',
    products: [
      { name: 'Tilak Box', image: 'images/tilak-box.jpg', description: 'Elegant tilak box for everyday sacred use.', price: 399, quantity: 30 },
      { name: 'Diya', image: 'images/diya.jpg', description: 'Traditional diya for prayer and festive lighting.', price: 199, quantity: 50 }
    ]
  }
};

const dataPath = path.join(__dirname, 'data.json');
const usersPath = path.join(__dirname, 'users.json');

function loadCatalogFromFile() {
  try {
    if (fs.existsSync(dataPath)) {
      return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    }
  } catch (err) {
    console.warn('Could not read local catalog file, using defaults:', err.message);
  }
  return defaultCatalog;
}

function loadUsersFromFile() {
  try {
    if (fs.existsSync(usersPath)) {
      const file = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
      if (file && Array.isArray(file.users)) return file;
    }
  } catch (err) {
    console.warn('Could not read user data file, using default user:', err.message);
  }
  return {
    users: [
      {
        username: 'customer',
        password: 'user123',
        name: 'Guest Customer',
        favorites: [],
        cart: [],
        orders: []
      }
    ]
  };
}

function saveUsersToFile(data) {
  try {
    fs.writeFileSync(usersPath, JSON.stringify(data, null, 2));
    return data;
  } catch (err) {
    console.warn('Could not save user data file:', err.message);
    return data;
  }
}

const userData = loadUsersFromFile();

function findUserByUsername(username) {
  return userData.users.find((user) => user.username === username);
}

function findUserByCredentials(username, password) {
  return userData.users.find((user) => user.username === username && user.password === password);
}

async function getCatalogFromDb() {
  let client;
  try {
    client = await pool.connect();
    const res = await client.query('SELECT data FROM catalog_data WHERE id = $1', [1]);
    if (res.rowCount === 0) {
      await client.query('INSERT INTO catalog_data (id, data) VALUES ($1, $2)', [1, defaultCatalog]);
      return defaultCatalog;
    }
    return res.rows[0].data;
  } catch (err) {
    console.warn('Database unavailable, using local catalog fallback:', err.message);
    return loadCatalogFromFile();
  } finally {
    if (client) {
      client.release();
    }
  }
}

async function saveCatalogToDb(data) {
  let client;
  try {
    client = await pool.connect();
    await client.query(
      `INSERT INTO catalog_data (id, data) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      [1, data]
    );
    return data;
  } catch (err) {
    console.warn('Database unavailable, saving catalog locally:', err.message);
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    return data;
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Capture raw request body for signature verification when provider sends a
// signature header. This keeps a raw Buffer copy on `req.rawBody` so webhook
// handlers can compute HMAC against the exact bytes the provider signed.
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf) => {
    const sigHeader = req.headers['x-phonepe-signature'] || req.headers['x-signature'];
    if (sigHeader) {
      req.rawBody = buf;
    }
  }
}));
app.use(express.static(__dirname));

app.get('/api/catalog', async (req, res) => {
  try {
    // Prefer local data.json when available so changes are reflected live
    if (fs.existsSync(dataPath)) {
      try {
        const file = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        return res.json(file);
      } catch (e) {
        console.warn('Could not parse data.json, falling back to DB:', e.message);
      }
    }
    const catalog = await getCatalogFromDb();
    res.json(catalog);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to read catalog' });
  }
});

app.post('/api/catalog', async (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Invalid catalog payload' });
  }
  try {
    const saved = await saveCatalogToDb(req.body);
    res.json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save catalog' });
  }
});

app.post('/api/user-login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password required' });
  }
  const user = findUserByCredentials(username, password);
  if (!user) {
    const existingUser = findUserByUsername(username);
    if (existingUser) {
      return res.status(401).json({ success: false, message: 'Incorrect password. Use reset if needed.' });
    }
    return res.status(404).json({ success: false, message: 'Account not found. Create a new user.' });
  }
  const responseUser = { username: user.username, name: user.name, favorites: user.favorites, cart: user.cart, orders: user.orders };
  res.json({ success: true, user: responseUser });
});

app.post('/api/user-signup', (req, res) => {
  const { username, password, name } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password required' });
  }
  const existingUser = findUserByUsername(username);
  if (existingUser) {
    return res.status(409).json({ success: false, message: 'Username already exists. Choose another.' });
  }
  const newUser = {
    username,
    password,
    name: name || username,
    favorites: [],
    cart: [],
    orders: []
  };
  userData.users.push(newUser);
  saveUsersToFile(userData);
  const responseUser = { username: newUser.username, name: newUser.name, favorites: newUser.favorites, cart: newUser.cart, orders: newUser.orders };
  res.json({ success: true, user: responseUser });
});

app.post('/api/user-reset', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and new password required' });
  }
  const user = findUserByUsername(username);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Account not found. Please sign up.' });
  }
  user.password = password;
  saveUsersToFile(userData);
  res.json({ success: true, message: 'Password reset successfully' });
});

app.get('/api/user-profile', (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ success: false, message: 'Username required' });
  const user = findUserByUsername(username);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  const responseUser = { username: user.username, name: user.name, favorites: user.favorites, cart: user.cart, orders: user.orders };
  res.json({ success: true, user: responseUser });
});

app.get('/api/user-orders', (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ success: false, message: 'Username required' });
  const user = findUserByUsername(username);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, orders: user.orders || [] });
});

app.post('/api/user-favorite', (req, res) => {
  const { username, productName, action } = req.body || {};
  if (!username || !productName || !action) {
    return res.status(400).json({ success: false, message: 'Username, productName, and action required' });
  }
  const user = findUserByUsername(username);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  if (action === 'add') {
    if (!user.favorites.includes(productName)) user.favorites.push(productName);
  } else if (action === 'remove') {
    user.favorites = user.favorites.filter((item) => item !== productName);
  } else {
    return res.status(400).json({ success: false, message: 'Unknown action' });
  }
  saveUsersToFile(userData);
  res.json({ success: true, favorites: user.favorites });
});

app.post('/api/user-cart', (req, res) => {
  const { username, productName, quantity, action } = req.body || {};
  if (!username || !action) {
    return res.status(400).json({ success: false, message: 'Username and action required' });
  }
  const user = findUserByUsername(username);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  if (action === 'add') {
    if (!productName) return res.status(400).json({ success: false, message: 'Product name required to add to cart' });
    const existing = user.cart.find((item) => item.productName === productName);
    if (existing) existing.quantity = Number(existing.quantity || 1) + Number(quantity || 1);
    else user.cart.push({ productName, quantity: Number(quantity || 1) });
  } else if (action === 'remove') {
    if (!productName) return res.status(400).json({ success: false, message: 'Product name required to remove from cart' });
    user.cart = user.cart.filter((item) => item.productName !== productName);
  } else if (action === 'update') {
    // Set exact quantity for a cart item; remove if quantity <= 0
    if (!productName) return res.status(400).json({ success: false, message: 'Product name required to update cart' });
    const existing = user.cart.find((item) => item.productName === productName);
    const q = Number(quantity || 0);
    if (existing) {
      if (q <= 0) {
        user.cart = user.cart.filter((item) => item.productName !== productName);
      } else {
        existing.quantity = q;
      }
    } else {
      if (q > 0) user.cart.push({ productName, quantity: q });
    }
  } else if (action === 'clear') {
    user.cart = [];
  } else {
    return res.status(400).json({ success: false, message: 'Unknown action' });
  }
  saveUsersToFile(userData);
  res.json({ success: true, cart: user.cart });
});

app.post('/api/save-order', (req, res) => {
  const { username, order } = req.body || {};
  if (!username || !order) {
    return res.status(400).json({ success: false, message: 'Username and order required' });
  }
  const user = findUserByUsername(username);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  user.orders = user.orders || [];
  user.orders.push(order);
  saveUsersToFile(userData);
  res.json({ success: true, orders: user.orders });
});

app.post('/api/user-rate', (req, res) => {
  const { username, transactionId, rating } = req.body || {};
  if (!username || !transactionId || rating == null) {
    return res.status(400).json({ success: false, message: 'Username, transactionId and rating required' });
  }
  const user = findUserByUsername(username);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  user.orders = user.orders || [];
  const order = user.orders.find((item) => item.transactionId === transactionId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  order.rating = Number(rating);
  saveUsersToFile(userData);
  res.json({ success: true, orders: user.orders });
});

// ============= REAL UPI PAYMENT ENDPOINTS =============

// Generate UPI QR Code & Link
app.post('/api/create-upi-order', async (req, res) => {
  try {
    const { amount, productName, username, quantity } = req.body;

    if (!amount || amount < 1) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const orderQuantity = Number(quantity || 1);
    const transactionId = `TXN${Date.now()}`;
    const expectedReferenceId = `${transactionId}`;
    const createdAt = new Date().toISOString();
    const pendingRecord = {
      transactionId,
      expectedReferenceId,
      amount,
      productName,
      status: 'PENDING',
      createdAt,
      username: username || null,
      quantity: orderQuantity
    };

    pendingTransactions.set(transactionId, pendingRecord);

    if (username) {
      const user = findUserByUsername(username);
      if (user) {
        user.orders = user.orders || [];
        const existingOrder = user.orders.find((o) => o.transactionId === transactionId);
        if (!existingOrder) {
          user.orders.push({
            transactionId,
            referenceId: '',
            amount,
            productName,
            quantity: orderQuantity,
            status: 'PENDING',
            createdAt
          });
          saveUsersToFile(userData);
        }
      }
    }

    // Create UPI string for QR code
    // Use the transactionId as the merchant reference so the bank app can return it
    const upiString = `upi://pay?pa=${UPI_CONFIG.upiId}&pn=${encodeURIComponent(UPI_CONFIG.merchantName)}&am=${amount}&tr=${transactionId}&tn=${encodeURIComponent(`Payment for ${productName} - ${transactionId}`)}`;
    
    // Generate QR code as data URL
    const qrCode = await QRCode.toDataURL(upiString);
    
    // Generate UPI link for direct click
    const upiLink = upiString;

    res.json({
      transactionId: transactionId,
      qrCode: qrCode,
      upiLink: upiLink,
      upiId: UPI_CONFIG.upiId,
      merchantName: UPI_CONFIG.merchantName,
      amount: amount,
      productName: productName
    });
  } catch (err) {
    console.error('UPI order creation error:', err);
    res.status(500).json({ error: 'Failed to create UPI order' });
  }
});

// Create PhonePe order (sandbox/simple redirect helper)
app.post('/api/create-phonepe-order', async (req, res) => {
  try {
    const { amount, productName } = req.body || {};
    if (!amount || amount < 1) return res.status(400).json({ error: 'Invalid amount' });

    const merchantOrderId = `PP${Date.now()}`;
    pendingTransactions.set(merchantOrderId, {
      transactionId: merchantOrderId,
      amount,
      productName,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    });
    // Persist pending transactions so webhooks are accepted after restarts
    savePendingToFile();

    const PHONEPE_BASE = process.env.PHONEPE_BASE || 'https://sandbox.phonepe.com/pay';
    const PHONEPE_MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID || 'MERCHANT_ID';

    const payUrl = `${PHONEPE_BASE}?merchantId=${encodeURIComponent(PHONEPE_MERCHANT_ID)}&merchantOrderId=${encodeURIComponent(merchantOrderId)}&amount=${encodeURIComponent(amount)}`;

    res.json({ orderId: merchantOrderId, payUrl, amount, productName });
  } catch (err) {
    console.error('PhonePe order creation error:', err);
    res.status(500).json({ error: 'Failed to create PhonePe order' });
  }
});

// PhonePe webhook endpoint — parse raw bytes so HMAC matches provider signature
// PhonePe webhook endpoint — compute HMAC on the exact raw bytes provider sent.
// We capture the raw bytes in `req.rawBody` using the `verify` hook on json parser.
app.post('/api/phonepe-webhook', (req, res) => {
  try {
    const sigHeader = req.headers['x-phonepe-signature'] || req.headers['x-signature'] || '';
    const secret = process.env.PHONEPE_WEBHOOK_SECRET || 'phonepe-webhook-secret';

    // Prefer the raw buffer captured by the json verify hook; fall back to
    // stringifying the parsed body only as a last resort (less secure).
    const bodyBuffer = req.rawBody !== undefined ? req.rawBody : req.body;
    const bodyString = Buffer.isBuffer(bodyBuffer)
      ? bodyBuffer.toString('utf8')
      : (typeof bodyBuffer === 'string' ? bodyBuffer : JSON.stringify(bodyBuffer));

    const computed = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');
    if (!sigHeader || computed !== sigHeader) {
      console.warn('PhonePe webhook signature mismatch', { computed, sigHeader });
      return res.status(400).send('Invalid signature');
    }

    let payload;
    try {
      payload = JSON.parse(bodyString);
    } catch (parseErr) {
      console.error('PhonePe webhook JSON parse error:', parseErr, 'bodyString:', bodyString);
      return res.status(400).send('Invalid JSON');
    }
    // expected payload must contain merchantOrderId, status, amount
    const merchantOrderId = payload.merchantOrderId || payload.transactionId || (payload.data && payload.data.merchantOrderId);
    const status = payload.status || (payload.data && payload.data.status) || '';
    const amount = Number(payload.amount || (payload.data && payload.data.amount) || 0);

    console.log('PhonePe webhook received', { merchantOrderId, status, amount });

    let pending = pendingTransactions.get(merchantOrderId);
    if (!pending) {
      console.info('Webhook received for unknown order — creating record', merchantOrderId);
      // If provider notifies us about an order we never created (possible
      // in sandbox/manual tests), create a minimal record so the client can
      // poll for its status. We'll fill with available payload fields.
      pending = {
        transactionId: merchantOrderId,
        amount: amount || 0,
        productName: payload.productName || payload.description || 'Unknown',
        status: 'PENDING',
        createdAt: new Date().toISOString()
      };
      pendingTransactions.set(merchantOrderId, pending);
      savePendingToFile();
    }

    if (status === 'SUCCESS' || status === 'COMPLETED' || status === 'CAPTURED') {
      if (pending.amount !== amount) {
        console.warn('Webhook amount mismatch', { expected: pending.amount, got: amount });
        // still mark as investigated but do not complete automatically
        pending.status = 'FAILED_AMOUNT_MISMATCH';
        return res.status(400).send('Amount mismatch');
      }

      pending.status = 'COMPLETED';
      pending.referenceId = payload.referenceId || payload.transactionReference || (payload.data && payload.data.referenceId) || '';
      pending.verifiedAt = new Date().toISOString();

      // persist updated pending state
      savePendingToFile();

      // If username present in pending (set by client when order created), save to user orders
      if (pending.username) {
        const user = findUserByUsername(pending.username);
        if (user) {
          user.orders = user.orders || [];
          user.orders.push({
            transactionId: pending.transactionId,
            referenceId: pending.referenceId,
            amount: pending.amount,
            productName: pending.productName,
            quantity: pending.quantity || 1,
            status: 'COMPLETED',
            createdAt: pending.verifiedAt
          });
          saveUsersToFile(userData);
        }
      }

      return res.json({ success: true });
    }

    // other statuses - mark pending accordingly and persist
    pending.status = status || 'PENDING';
    savePendingToFile();
    return res.json({ success: true });
  } catch (err) {
    console.error('PhonePe webhook processing error:', err);
    return res.status(500).send('Webhook error');
  }
});

// Pollable status endpoint for client to check order state
app.get('/api/phonepe-order-status', (req, res) => {
  const orderId = req.query.orderId;
  if (!orderId) return res.status(400).json({ success: false, message: 'orderId required' });
  const pending = pendingTransactions.get(orderId);
  if (!pending) return res.status(404).json({ success: false, message: 'Order not found' });
  res.json({ success: true, orderId, status: pending.status, amount: pending.amount, verifiedAt: pending.verifiedAt || null });
});

// Verify Real UPI Payment (Manual verification)
app.post('/api/verify-upi-payment', async (req, res) => {
  try {
    const { transactionId, referenceId, amount, productName, username } = req.body;

    if (!transactionId || !referenceId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Transaction ID or Reference ID missing' 
      });
    }

    const pending = pendingTransactions.get(transactionId);
    if (!pending) {
      return res.status(400).json({
        success: false,
        message: 'Transaction not found or expired. Please start payment again.'
      });
    }

    if (pending.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'This transaction has already been verified.'
      });
    }

    if (pending.amount !== amount || pending.productName !== productName) {
      return res.status(400).json({
        success: false,
        message: 'Payment details do not match the pending transaction.'
      });
    }

    const cleanedReferenceId = (referenceId || '').replace(/\s+/g, '').toUpperCase();
    const validReferencePattern = /^[A-Z0-9]{6,30}$/;

    if (!validReferencePattern.test(cleanedReferenceId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid reference ID format. Please enter a valid UPI transaction reference ID from your bank SMS or UPI app.' 
      });
    }

    const expectedReferenceId = (pending.expectedReferenceId || pending.transactionId || '').replace(/\s+/g, '').toUpperCase();
    if (expectedReferenceId && cleanedReferenceId !== expectedReferenceId) {
      return res.status(400).json({
        success: false,
        message: `Reference ID does not match expected transaction reference. Please enter the exact Transaction ID: ${expectedReferenceId}`
      });
    }

    // Log attempt for easier debugging
    console.log('Verifying payment:', { transactionId, cleanedReferenceId, amount, productName, username });

    // Ensure the reference hasn't been used for a completed transaction in pending store
    const referenceAlreadyUsedInPending = [...pendingTransactions.values()].some((tx) =>
      tx.status === 'COMPLETED' && tx.referenceId === cleanedReferenceId
    );

    if (referenceAlreadyUsedInPending) {
      return res.status(400).json({
        success: false,
        message: 'This reference ID has already been used. Please check your payment confirmation.'
      });
    }

    // Ensure the reference hasn't been used in any saved user orders
    const referenceAlreadyUsedInUsers = userData.users.some((u) => (u.orders || []).some((o) => (o.referenceId || '').replace(/\s+/g, '').toUpperCase() === cleanedReferenceId));

    if (referenceAlreadyUsedInUsers) {
      return res.status(400).json({
        success: false,
        message: 'This reference ID has already been used for another order. Please contact support if you believe this is an error.'
      });
    }

    // Bind the provided reference to this pending transaction and mark as awaiting manual verification
    pending.status = 'AWAITING_VERIFICATION';
    pending.referenceId = cleanedReferenceId;
    pending.submittedAt = new Date().toISOString();

    // persist pending state so restart won't lose submitted verifications
    savePendingToFile();

    // If username provided, update the user's original pending order record or add a new one
    if (username) {
      const user = findUserByUsername(username);
      if (user) {
        user.orders = user.orders || [];
        const existing = user.orders.find((o) => o.transactionId === transactionId);
        if (existing) {
          existing.referenceId = cleanedReferenceId;
          existing.status = 'PENDING_VERIFICATION';
          existing.amount = amount;
          existing.productName = productName;
          existing.quantity = existing.quantity || req.body.quantity || 1;
          existing.createdAt = existing.createdAt || pending.submittedAt;
        } else {
          user.orders.push({
            transactionId,
            referenceId: cleanedReferenceId,
            amount,
            productName,
            quantity: req.body.quantity || 1,
            status: 'PENDING_VERIFICATION',
            createdAt: pending.submittedAt
          });
        }
        saveUsersToFile(userData);
      }
    }

    // Return pending response so client shows the verification-in-progress message
    return res.json({
      success: true,
      pending: true,
      message: 'We will verify your payment and later contact you soon.',
      transactionId: transactionId,
      referenceId: cleanedReferenceId,
      amount: amount,
      productName: productName,
      submittedAt: pending.submittedAt,
      status: pending.status
    });
  } catch (err) {
    console.error('Payment verification error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
