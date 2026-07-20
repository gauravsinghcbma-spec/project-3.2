const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // If Railway requires SSL, enable below:
  // ssl: { rejectUnauthorized: false }
});

async function run() {
  const dataPath = path.join(__dirname, 'data.json');
  if (!fs.existsSync(dataPath)) {
    console.error('data.json not found; create or copy it before migrating.');
    process.exit(1);
  }
  const json = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS catalog_data (
        id INTEGER PRIMARY KEY,
        data JSONB NOT NULL
      );
    `);
    await client.query(
      `INSERT INTO catalog_data (id, data) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      [1, json]
    );
    console.log('Migration completed: data.json -> catalog_data(id=1)');
  } catch (err) {
    console.error('Migration error', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
