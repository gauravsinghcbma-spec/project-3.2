const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:xbrDXDxvacRISsCdOQQLWNUvVyGTsCGB@tokaido.proxy.rlwy.net:5432/railway';

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

// Helper function to create table and insert JSON data
async function migrateFile(client, tableName, fileName) {
  const filePath = path.join(__dirname, fileName);
  
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${fileName}: File not found.`);
    return;
  }

  try {
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Create table for the specific JSON file
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id INTEGER PRIMARY KEY,
        data JSONB NOT NULL
      );
    `);

    // Insert or update the data
    await client.query(
      `INSERT INTO ${tableName} (id, data) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      [1, json]
    );

    console.log(`Migration completed: ${fileName} -> ${tableName}(id=1)`);
  } catch (err) {
    console.error(`Error migrating ${fileName}:`, err.message);
  }
}

async function run() {
  const client = await pool.connect();
  try {
    // 1. Migrate Catalog Data (data.json)
    await migrateFile(client, 'catalog_data', 'data.json');

    // 2. Migrate Users Data (users.json)
    await migrateFile(client, 'users_data', 'users.json');

    // 3. Migrate Pending Orders (pending.json)
    await migrateFile(client, 'pending_data', 'pending.json');

    console.log('All migrations executed successfully!');
  } catch (err) {
    console.error('Migration execution error:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();