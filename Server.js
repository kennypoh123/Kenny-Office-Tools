// Minimal API for saving Date + Description rows from the
// "Bank Statement to Excel" tool into a Railway PostgreSQL database.
//
// Endpoints:
//   GET  /api/health          -> { ok: true }
//   GET  /api/transactions    -> list all saved rows (newest first)
//   POST /api/transactions    -> save one or many rows: { rows: [{ date, description }, ...] }
//   DELETE /api/transactions/:id -> delete one row
//
// Environment variables (Railway sets DATABASE_URL automatically when you
// link a Postgres plugin to this service):
//   DATABASE_URL   - Postgres connection string (required)
//   ALLOWED_ORIGIN - optional, restrict CORS to your site
//                    e.g. https://kennypoh123.github.io  (default: allow all)
//   PORT           - Railway sets this automatically

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({ origin: allowedOrigin }));

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL environment variable. Link a PostgreSQL plugin to this Railway service, or set it manually.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway')
    ? { rejectUnauthorized: false }
    : undefined
});

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bank_transactions (
      id SERIAL PRIMARY KEY,
      tx_date TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

app.get('/api/health', async (req, res) => {
  res.json({ ok: true });
});

app.get('/api/transactions', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, tx_date AS date, description, created_at FROM bank_transactions ORDER BY id DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch transactions', detail: err.message });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    const cleaned = rows
      .map(r => ({
        date: (r.date || '').toString().trim(),
        description: (r.description || '').toString().trim()
      }))
      .filter(r => r.date || r.description);

    if (!cleaned.length) {
      return res.status(400).json({ error: 'No valid rows provided. Expected { rows: [{ date, description }] }' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const inserted = [];
      for (const row of cleaned) {
        const result = await client.query(
          'INSERT INTO bank_transactions (tx_date, description) VALUES ($1, $2) RETURNING id, tx_date AS date, description, created_at',
          [row.date, row.description]
        );
        inserted.push(result.rows[0]);
      }
      await client.query('COMMIT');
      res.status(201).json({ inserted: inserted.length, rows: inserted });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save transactions', detail: err.message });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM bank_transactions WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete transaction', detail: err.message });
  }
});

const port = process.env.PORT || 3000;

ensureTable()
  .then(() => {
    app.listen(port, () => console.log(`Bank statement DB API listening on port ${port}`));
  })
  .catch(err => {
    console.error('Failed to initialise database table:', err.message);
    process.exit(1);
  });