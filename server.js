const express = require('express');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // ssl: { rejectUnauthorized: false }
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

async function getCatalogFromDb() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT data FROM catalog_data WHERE id = $1', [1]);
    if (res.rowCount === 0) {
      // initialize DB row
      await client.query('INSERT INTO catalog_data (id, data) VALUES ($1, $2)', [1, defaultCatalog]);
      return defaultCatalog;
    }
    return res.rows[0].data;
  } finally {
    client.release();
  }
}

async function saveCatalogToDb(data) {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO catalog_data (id, data) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      [1, data]
    );
    return data;
  } finally {
    client.release();
  }
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

app.get('/api/catalog', async (req, res) => {
  try {
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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
