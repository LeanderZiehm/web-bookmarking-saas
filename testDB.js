require('dotenv').config();
const { Pool } = require('pg');

// Load DB credentials from environment
const {
  DB_USER,
  DB_HOST,
  DB_NAME,
  DB_PASSWORD,
  DB_PORT = 5432,
} = process.env;

if (!DB_USER || !DB_HOST || !DB_NAME || !DB_PASSWORD) {
  console.error('❌ Missing DB credentials in .env');
  process.exit(1);
}

// Initialize connection pool
const pool = new Pool({
  user: DB_USER,
  host: DB_HOST,
  database: DB_NAME,
  password: DB_PASSWORD,
  port: DB_PORT,
});

async function testDB() {
  console.log('🔍 Testing database connection...');

  try {
    // Step 1: Connect to the database
    const client = await pool.connect();
    console.log('✅ Connected to the database.');

    // Step 2: Test a simple read
    const readResult = await client.query('SELECT NOW()');
    console.log('✅ Read test passed:', readResult.rows[0]);

    // Step 3: Test an insert (into bookmarks table)
    const insertQuery = `
      INSERT INTO bookmarks (text, user_agent, ip_address, device_hash)
      VALUES ($1, $2, $3, $4)
      RETURNING id, created_at;
    `;
    const values = ['Test entry from db-test.js', 'TestAgent', '127.0.0.1', 'testhash'];
    const insertResult = await client.query(insertQuery, values);
    console.log('✅ Insert test passed:', insertResult.rows[0]);

    client.release();
  } catch (err) {
    console.error('❌ Error during DB test:', err);
  } finally {
    pool.end();
  }
}

testDB();
