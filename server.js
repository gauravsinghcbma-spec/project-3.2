const express = require('express');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

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
