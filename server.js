const express = require('express');
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

const defaultUsers = {
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

// ================= POSTGRESQL DATABASE HELPERS =================

async function getDbData(tableName, fallback) {
  try {
    const res = await pool.query(`SELECT data FROM ${tableName} WHERE id = 1`);
    if (res.rows.length > 0) return res.rows[0].data;
  } catch (err) {
    console.error(`Error reading ${tableName}:`, err.message);
  }
  return fallback;
}

async function saveDbData(tableName, data) {
  try {
    await pool.query(
      `INSERT INTO ${tableName} (id, data) VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      [data]
    );
    return data;
  } catch (err) {
    console.error(`Error saving ${tableName}:`, err.message);
    return data;
  }
}

async function loadCatalog() {
  return await getDbData('catalog_data', defaultCatalog);
}

async function saveCatalog(data) {
  return await saveDbData('catalog_data', data);
}

async function loadUsers() {
  return await getDbData('users_data', defaultUsers);
}

async function saveUsers(data) {
  return await saveDbData('users_data', data);
}

async function loadPending() {
  return await getDbData('pending_data', {});
}

async function savePending(data) {
  return await saveDbData('pending_data', data);
}

// ================= STOCK REDUCTION HELPER =================

async function reduceProductStock(productName, quantityToReduce = 1) {
  if (!productName) return;
  try {
    const catalog = await loadCatalog();
    let updated = false;

    for (const category of Object.values(catalog)) {
      if (!Array.isArray(category?.products)) continue;

      const product = category.products.find((p) => p.name === productName);
      if (product) {
        const currentQty = Number(product.quantity || 0);
        product.quantity = Math.max(0, currentQty - Number(quantityToReduce));
        updated = true;
        break;
      }
    }

    if (updated) {
      await saveCatalog(catalog);
      console.log(`Stock reduced for "${productName}" by ${quantityToReduce}`);
    }
  } catch (err) {
    console.error('Error reducing product stock:', err.message);
  }
}

// ================= USER HELPERS =================

function findUserByUsernameIn(usersArray, username) {
  return usersArray.find((user) => user.username === username);
}

function findUserByCredentialsIn(usersArray, username, password) {
  return usersArray.find((user) => user.username === username && user.password === password);
}

function enrichCatalogWithRatings(catalog, userData) {
  const ratingBuckets = new Map();

  for (const user of userData.users || []) {
    for (const order of user.orders || []) {
      if (!order?.productName || !Number.isFinite(Number(order.rating))) continue;
      const productName = order.productName;
      const current = ratingBuckets.get(productName) || { total: 0, count: 0 };
      current.total += Number(order.rating);
      current.count += 1;
      ratingBuckets.set(productName, current);
    }
  }

  const catalogClone = JSON.parse(JSON.stringify(catalog || {}));
  for (const category of Object.values(catalogClone)) {
    if (!Array.isArray(category?.products)) continue;
    for (const product of category.products) {
      const ratingData = ratingBuckets.get(product.name);
      if (!ratingData || ratingData.count === 0) {
        product.rating = 0;
        product.ratingCount = 0;
        continue;
      }
      product.rating = Number((ratingData.total / ratingData.count).toFixed(1));
      product.ratingCount = ratingData.count;
    }
  }

  return catalogClone;
}

function findProductInCatalog(catalog, productName) {
  if (!catalog || !productName) return null;
  for (const category of Object.values(catalog)) {
    const product = category?.products?.find((item) => item.name === productName);
    if (product) return product;
  }
  return null;
}

// Middleware
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

// Prevent stale caching on browser refresh
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

// ================= API ENDPOINTS =================

app.get('/api/catalog', async (req, res) => {
  try {
    const catalog = await loadCatalog();
    const userData = await loadUsers();
    res.json(enrichCatalogWithRatings(catalog, userData));
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
    const saved = await saveCatalog(req.body);
    res.json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save catalog' });
  }
});

app.post('/api/user-login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password required' });
  }
  const userData = await loadUsers();
  const user = findUserByCredentialsIn(userData.users, username, password);
  if (!user) {
    const existingUser = findUserByUsernameIn(userData.users, username);
    if (existingUser) {
      return res.status(401).json({ success: false, message: 'Incorrect password. Use reset if needed.' });
    }
    return res.status(404).json({ success: false, message: 'Account not found. Create a new user.' });
  }
  const responseUser = { username: user.username, name: user.name, favorites: user.favorites, cart: user.cart, orders: user.orders };
  res.json({ success: true, user: responseUser });
});

app.post('/api/user-signup', async (req, res) => {
  const { username, password, name } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password required' });
  }
  const userData = await loadUsers();
  const existingUser = findUserByUsernameIn(userData.users, username);
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
  await saveUsers(userData);
  const responseUser = { username: newUser.username, name: newUser.name, favorites: newUser.favorites, cart: newUser.cart, orders: newUser.orders };
  res.json({ success: true, user: responseUser });
});

app.post('/api/user-reset', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and new password required' });
  }
  const userData = await loadUsers();
  const user = findUserByUsernameIn(userData.users, username);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Account not found. Please sign up.' });
  }
  user.password = password;
  await saveUsers(userData);
  res.json({ success: true, message: 'Password reset successfully' });
});

app.get('/api/user-profile', async (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ success: false, message: 'Username required' });
  const userData = await loadUsers();
  const user = findUserByUsernameIn(userData.users, username);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  const responseUser = { username: user.username, name: user.name, favorites: user.favorites, cart: user.cart, orders: user.orders };
  res.json({ success: true, user: responseUser });
});

app.get('/api/user-orders', async (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ success: false, message: 'Username required' });
  const userData = await loadUsers();
  const user = findUserByUsernameIn(userData.users, username);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, orders: user.orders || [] });
});

app.post('/api/user-favorite', async (req, res) => {
  const { username, productName, action } = req.body || {};
  if (!username || !productName || !action) {
    return res.status(400).json({ success: false, message: 'Username, productName, and action required' });
  }
  const userData = await loadUsers();
  const user = findUserByUsernameIn(userData.users, username);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  user.favorites = user.favorites || [];
  if (action === 'add') {
    if (!user.favorites.includes(productName)) user.favorites.push(productName);
  } else if (action === 'remove') {
    user.favorites = user.favorites.filter((item) => item !== productName);
  } else {
    return res.status(400).json({ success: false, message: 'Unknown action' });
  }
  await saveUsers(userData);
  res.json({ success: true, favorites: user.favorites });
});

app.post('/api/user-cart', async (req, res) => {
  const { username, productName, quantity, action } = req.body || {};
  if (!username || !action) {
    return res.status(400).json({ success: false, message: 'Username and action required' });
  }
  const userData = await loadUsers();
  const user = findUserByUsernameIn(userData.users, username);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const catalog = await loadCatalog();
  const catalogProduct = productName ? findProductInCatalog(catalog, productName) : null;

  user.cart = user.cart || [];

  if (action === 'add') {
    if (!productName) return res.status(400).json({ success: false, message: 'Product name required to add to cart' });
    if (catalogProduct && Number(catalogProduct.quantity || 0) <= 0) {
      return res.status(400).json({ success: false, message: 'This product is currently updating. We will contact you later when it is available.' });
    }
    const existing = user.cart.find((item) => item.productName === productName);
    const requestedQty = Number(quantity || 1);
    if (catalogProduct) {
      const totalQty = (Number(existing?.quantity || 0) + requestedQty);
      if (totalQty > Number(catalogProduct.quantity || 0)) {
        return res.status(400).json({ success: false, message: `Only ${catalogProduct.quantity} item(s) available right now.` });
      }
    }
    if (existing) existing.quantity = Number(existing.quantity || 1) + requestedQty;
    else user.cart.push({ productName, quantity: requestedQty });
  } else if (action === 'remove') {
    if (!productName) return res.status(400).json({ success: false, message: 'Product name required to remove from cart' });
    user.cart = user.cart.filter((item) => item.productName !== productName);
  } else if (action === 'update') {
    if (!productName) return res.status(400).json({ success: false, message: 'Product name required to update cart' });
    const existing = user.cart.find((item) => item.productName === productName);
    const q = Number(quantity || 0);
    if (catalogProduct && q > Number(catalogProduct.quantity || 0)) {
      return res.status(400).json({ success: false, message: `Only ${catalogProduct.quantity} item(s) available right now.` });
    }
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
  await saveUsers(userData);
  res.json({ success: true, cart: user.cart });
});

app.post('/api/save-order', async (req, res) => {
  const { username, order } = req.body || {};
  if (!username || !order) {
    return res.status(400).json({ success: false, message: 'Username and order required' });
  }
  const userData = await loadUsers();
  const user = findUserByUsernameIn(userData.users, username);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  user.orders = user.orders || [];
  user.orders.push(order);
  await saveUsers(userData);
  res.json({ success: true, orders: user.orders });
});

app.post('/api/user-rate', async (req, res) => {
  const { username, transactionId, rating } = req.body || {};
  if (!username || !transactionId || rating == null) {
    return res.status(400).json({ success: false, message: 'Username, transactionId and rating required' });
  }
  const userData = await loadUsers();
  const user = findUserByUsernameIn(userData.users, username);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  user.orders = user.orders || [];
  const order = user.orders.find((item) => item.transactionId === transactionId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  order.rating = Number(rating);
  await saveUsers(userData);
  res.json({ success: true, orders: user.orders });
});

// ============= REAL UPI PAYMENT ENDPOINTS =============

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

    const pendingMap = await loadPending();
    pendingMap[transactionId] = {
      transactionId,
      expectedReferenceId,
      amount,
      productName,
      status: 'PENDING',
      createdAt,
      username: username || null,
      quantity: orderQuantity
    };
    await savePending(pendingMap);

    if (username) {
      const userData = await loadUsers();
      const user = findUserByUsernameIn(userData.users, username);
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
          await saveUsers(userData);
        }
      }
    }

    const upiString = `upi://pay?pa=${UPI_CONFIG.upiId}&pn=${encodeURIComponent(UPI_CONFIG.merchantName)}&am=${amount}&tr=${transactionId}&tn=${encodeURIComponent(`Payment for ${productName} - ${transactionId}`)}`;
    const qrCode = await QRCode.toDataURL(upiString);

    res.json({
      transactionId: transactionId,
      qrCode: qrCode,
      upiLink: upiString,
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

app.post('/api/create-phonepe-order', async (req, res) => {
  try {
    const { amount, productName } = req.body || {};
    if (!amount || amount < 1) return res.status(400).json({ error: 'Invalid amount' });

    const merchantOrderId = `PP${Date.now()}`;
    const pendingMap = await loadPending();
    pendingMap[merchantOrderId] = {
      transactionId: merchantOrderId,
      amount,
      productName,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };
    await savePending(pendingMap);

    const PHONEPE_BASE = process.env.PHONEPE_BASE || 'https://sandbox.phonepe.com/pay';
    const PHONEPE_MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID || 'MERCHANT_ID';

    const payUrl = `${PHONEPE_BASE}?merchantId=${encodeURIComponent(PHONEPE_MERCHANT_ID)}&merchantOrderId=${encodeURIComponent(merchantOrderId)}&amount=${encodeURIComponent(amount)}`;

    res.json({ orderId: merchantOrderId, payUrl, amount, productName });
  } catch (err) {
    console.error('PhonePe order creation error:', err);
    res.status(500).json({ error: 'Failed to create PhonePe order' });
  }
});

app.post('/api/phonepe-webhook', async (req, res) => {
  try {
    const sigHeader = req.headers['x-phonepe-signature'] || req.headers['x-signature'] || '';
    const secret = process.env.PHONEPE_WEBHOOK_SECRET || 'phonepe-webhook-secret';

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
      return res.status(400).send('Invalid JSON');
    }

    const merchantOrderId = payload.merchantOrderId || payload.transactionId || (payload.data && payload.data.merchantOrderId);
    const status = payload.status || (payload.data && payload.data.status) || '';
    const amount = Number(payload.amount || (payload.data && payload.data.amount) || 0);

    const pendingMap = await loadPending();
    let pending = pendingMap[merchantOrderId];
    if (!pending) {
      pending = {
        transactionId: merchantOrderId,
        amount: amount || 0,
        productName: payload.productName || payload.description || 'Unknown',
        status: 'PENDING',
        createdAt: new Date().toISOString()
      };
      pendingMap[merchantOrderId] = pending;
    }

    if (status === 'SUCCESS' || status === 'COMPLETED' || status === 'CAPTURED') {
      if (pending.amount !== amount) {
        pending.status = 'FAILED_AMOUNT_MISMATCH';
        await savePending(pendingMap);
        return res.status(400).send('Amount mismatch');
      }

      pending.status = 'COMPLETED';
      pending.referenceId = payload.referenceId || payload.transactionReference || (payload.data && payload.data.referenceId) || '';
      pending.verifiedAt = new Date().toISOString();

      await savePending(pendingMap);

      // Reduce product stock in database
      await reduceProductStock(pending.productName, pending.quantity || 1);

      if (pending.username) {
        const userData = await loadUsers();
        const user = findUserByUsernameIn(userData.users, pending.username);
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
          await saveUsers(userData);
        }
      }

      return res.json({ success: true });
    }

    pending.status = status || 'PENDING';
    await savePending(pendingMap);
    return res.json({ success: true });
  } catch (err) {
    console.error('PhonePe webhook processing error:', err);
    return res.status(500).send('Webhook error');
  }
});

app.get('/api/phonepe-order-status', async (req, res) => {
  const orderId = req.query.orderId;
  if (!orderId) return res.status(400).json({ success: false, message: 'orderId required' });
  const pendingMap = await loadPending();
  const pending = pendingMap[orderId];
  if (!pending) return res.status(404).json({ success: false, message: 'Order not found' });
  res.json({ success: true, orderId, status: pending.status, amount: pending.amount, verifiedAt: pending.verifiedAt || null });
});

app.post('/api/verify-upi-payment', async (req, res) => {
  try {
    const { transactionId, referenceId, amount, productName, username } = req.body;

    if (!transactionId || !referenceId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Transaction ID or Reference ID missing' 
      });
    }

    const pendingMap = await loadPending();
    const pending = pendingMap[transactionId];
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

    const referenceAlreadyUsedInPending = Object.values(pendingMap).some((tx) =>
      tx.status === 'COMPLETED' && tx.referenceId === cleanedReferenceId
    );

    if (referenceAlreadyUsedInPending) {
      return res.status(400).json({
        success: false,
        message: 'This reference ID has already been used. Please check your payment confirmation.'
      });
    }

    const userData = await loadUsers();
    const referenceAlreadyUsedInUsers = userData.users.some((u) => (u.orders || []).some((o) => (o.referenceId || '').replace(/\s+/g, '').toUpperCase() === cleanedReferenceId));

    if (referenceAlreadyUsedInUsers) {
      return res.status(400).json({
        success: false,
        message: 'This reference ID has already been used for another order. Please contact support if you believe this is an error.'
      });
    }

    pending.status = 'AWAITING_VERIFICATION';
    pending.referenceId = cleanedReferenceId;
    pending.submittedAt = new Date().toISOString();

    await savePending(pendingMap);

    // Reduce product stock in database
    await reduceProductStock(productName, req.body.quantity || pending.quantity || 1);

    if (username) {
      const user = findUserByUsernameIn(userData.users, username);
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
        await saveUsers(userData);
      }
    }

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