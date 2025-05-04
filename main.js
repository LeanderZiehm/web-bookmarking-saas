// index.js

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const crypto = require('crypto');
const path = require('path');

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
app.use(express.static(path.join(__dirname, 'public')));

// Serve dashboard HTML
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/', async (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
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

// GET /bookmarks - List all bookmarks with optional filtering
app.get('/bookmarks', async (req, res) => {
  try {
    // Extract query parameters for filtering
    const { limit = 50, offset = 0, search = '' } = req.query;
    
    // Basic validation
    const parsedLimit = Math.min(parseInt(limit) || 50, 100); // Max 100 items
    const parsedOffset = parseInt(offset) || 0;
    
    let query, values;
    
    if (search) {
      // If search parameter is provided, filter by text content
      query = `
        SELECT id, text, created_at, device_hash
        FROM bookmarks
        WHERE text ILIKE $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;
      values = [`%${search}%`, parsedLimit, parsedOffset];
    } else {
      // Otherwise just get all bookmarks with pagination
      query = `
        SELECT id, text, created_at, device_hash
        FROM bookmarks
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `;
      values = [parsedLimit, parsedOffset];
    }
    
    // Get total count for pagination
    const countQuery = search 
      ? `SELECT COUNT(*) FROM bookmarks WHERE text ILIKE $1`
      : `SELECT COUNT(*) FROM bookmarks`;
    const countValues = search ? [`%${search}%`] : [];
    
    const [results, countResult] = await Promise.all([
      pool.query(query, values),
      pool.query(countQuery, countValues)
    ]);
    
    const totalBookmarks = parseInt(countResult.rows[0].count);
    
    res.json({
      bookmarks: results.rows,
      pagination: {
        total: totalBookmarks,
        limit: parsedLimit,
        offset: parsedOffset,
        hasMore: totalBookmarks > (parsedOffset + parsedLimit)
      }
    });
  } catch (err) {
    console.error('Error fetching bookmarks:', err);
    res.status(500).json({ error: 'Failed to retrieve bookmarks' });
  }
});

// GET /bookmarks/:id - Get a specific bookmark by ID
app.get('/bookmarks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Input validation
    if (!id || !/^\d+$/.test(id)) {
      return res.status(400).json({ error: 'Invalid bookmark ID' });
    }
    
    const query = `
      SELECT id, text, created_at, device_hash
      FROM bookmarks
      WHERE id = $1
    `;
    
    const { rows } = await pool.query(query, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Bookmark not found' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching bookmark:', err);
    res.status(500).json({ error: 'Failed to retrieve bookmark' });
  }
});

// DELETE /bookmarks/:id - Delete a bookmark
app.delete('/bookmarks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Input validation
    if (!id || !/^\d+$/.test(id)) {
      return res.status(400).json({ error: 'Invalid bookmark ID' });
    }
    
    const query = `
      DELETE FROM bookmarks
      WHERE id = $1
      RETURNING id
    `;
    
    const { rows } = await pool.query(query, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Bookmark not found' });
    }
    
    res.json({ success: true, id: rows[0].id });
  } catch (err) {
    console.error('Error deleting bookmark:', err);
    res.status(500).json({ error: 'Failed to delete bookmark' });
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