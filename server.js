const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const dataFile = path.join(__dirname, 'data.json');

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

function ensureDataFile() {
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify(defaultCatalog, null, 2));
  }
}

function readCatalog() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}

function writeCatalog(data) {
  ensureDataFile();
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
  return data;
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

app.get('/api/catalog', (req, res) => {
  res.json(readCatalog());
});

app.post('/api/catalog', (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Invalid catalog payload' });
  }

  const saved = writeCatalog(req.body);
  res.json(saved);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
