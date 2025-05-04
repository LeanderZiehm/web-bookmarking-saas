// index.js

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const crypto = require('crypto');

// Load config
const {
  PORT = 3000,
  DB_USER,
  DB_HOST,
  DB_NAME,
  DB_PASSWORD,
  DB_PORT = 5432,
} = process.env;

if (!DB_USER || !DB_HOST || !DB_NAME || !DB_PASSWORD) {
  console.error('Missing DB credentials in env');
  process.exit(1);
}

const pool = new Pool({
  user: DB_USER,
  host: DB_HOST,
  database: DB_NAME,
  password: DB_PASSWORD,
  port: DB_PORT,
});

// Setup Express
const app = express();
app.use(express.json());

app.get('/', async (req, res) => {
  const testText = 'This is a test bookmark entry.';
  const userAgent = req.headers['user-agent'] || '';
  const ip = req.ip;

  try {
    const saved = await saveBookmark(testText, ip, userAgent);
    console.log('Test insert successful:', saved);

    res.send(`
      <h1>Welcome to the Bookmarking Service!</h1>
      <p>Test bookmark saved!</p>
      <ul>
        <li>ID: ${saved.id}</li>
        <li>Created At: ${saved.created_at}</li>
        <li>Text: ${testText}</li>
      </ul>
    `);
  } catch (err) {
    console.error('Test insert failed:', err);
    res.status(500).send('Failed to save test bookmark.');
  }
});


// Helper to hash IP + User-Agent
function getDeviceHash(ip, ua) {
  return crypto.createHash('sha256').update(ip + ua).digest('hex');
}

// POST /bookmarks
app.post('/bookmarks', async (req, res) => {
  const { text } = req.body;
  const userAgent = req.headers['user-agent'] || '';
  const ip = req.ip;

  if (!text || typeof text !== 'string' || text.length > 5000) {
    return res.status(400).json({ error: 'Invalid `text` field' });
  }

  try {
    const result = await saveBookmark(text, ip, userAgent);
    res.status(201).json({
      id: result.id,
      createdAt: result.created_at,
    });
  } catch (err) {
    console.error('DB Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


async function saveBookmark(text, ip, userAgent) {
  const deviceHash = getDeviceHash(ip, userAgent);
  const query = `
    INSERT INTO bookmarks (text, user_agent, ip_address, device_hash)
    VALUES ($1, $2, $3, $4)
    RETURNING id, created_at;
  `;
  const values = [text, userAgent, ip, deviceHash];
  const { rows } = await pool.query(query, values);
  return rows[0];
}

// Healthcheck
app.get('/health', (req, res) => res.send('OK'));

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Bookmarking service running at http://localhost:${PORT}`);
});