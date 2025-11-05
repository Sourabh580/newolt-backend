// server.js
import express from "express";
import cors from "cors";
import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// Create pool using either DATABASE_URL or individual vars (Render gives DATABASE_URL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.DB_HOST || undefined,
  user: process.env.DB_USER || undefined,
  password: process.env.DB_PASSWORD || undefined,
  database: process.env.DB_NAME || undefined,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

// Ensure table exists and has required columns (idempotent)
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        restaurant_id TEXT DEFAULT 'res-1',
        customer_name TEXT,
        table_no TEXT,
        notes TEXT DEFAULT '',
        items JSONB DEFAULT '[]'::jsonb,
        total NUMERIC DEFAULT 0,
        status TEXT DEFAULT 'pending',
        placed_at TIMESTAMP DEFAULT NOW()
      );
    `);
    // Try to add missing columns if older schema present (safe ALTERs)
    // these ALTERs will fail harmlessly if columns already exist; we catch errors.
    try { await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT ''`); } catch(e) {}
    try { await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb`); } catch(e) {}
    try { await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS total NUMERIC DEFAULT 0`); } catch(e) {}
    console.log("✅ orders table is ready");
  } catch (err) {
    console.error("❌ initDB error:", err);
  }
}
initDB();

// helper to normalize items to an array
function normalizeItems(items) {
  if (!items) return [];
  if (Array.isArray(items)) return items;
  if (typeof items === "string") {
    try { return JSON.parse(items); } catch (e) { return []; }
  }
  return [];
}

// Unified function to insert order and return inserted row
async function insertOrder(payload) {
  const restaurant_id = payload.restaurant_id || "res-1";
  const customer_name = payload.customer_name || payload.customerName || null;
  const table_no = payload.table_no || payload.tableNumber || null;
  const notes = payload.notes ?? "";
  const items = normalizeItems(payload.items || payload.cart || payload.itemsJson);
  const total = payload.total ?? payload.price ?? payload.amount ?? 0;
  const status = payload.status || "pending";

  const result = await pool.query(
    `INSERT INTO orders (restaurant_id, customer_name, table_no, notes, items, total, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [restaurant_id, customer_name, table_no, notes, JSON.stringify(items), total, status]
  );

  // return row with items parsed as array
  const row = result.rows[0];
  row.items = Array.isArray(row.items) ? row.items : normalizeItems(row.items);
  return row;
}

// Accept both /api/order and /api/orders for POST (some frontends use one or the other)
app.post("/api/order", async (req, res) => {
  try {
    const row = await insertOrder(req.body);
    console.log("✅ New order inserted (singular):", { id: row.id, restaurant_id: row.restaurant_id });
    // Optionally notify websockets here
    res.status(201).json(row);
  } catch (err) {
    console.error("❌ POST /api/order error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/orders", async (req, res) => {
  try {
    const row = await insertOrder(req.body);
    console.log("✅ New order inserted (plural):", { id: row.id, restaurant_id: row.restaurant_id });
    res.status(201).json(row);
  } catch (err) {
    console.error("❌ POST /api/orders error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET orders for a restaurant: always return array (never undefined)
app.get("/api/orders", async (req, res) => {
  try {
    const restaurant_id = req.query.restaurant_id;
    if (!restaurant_id) return res.status(400).json({ error: "Missing restaurant_id query param" });

    const result = await pool.query(
      `SELECT * FROM orders WHERE restaurant_id = $1 ORDER BY placed_at DESC`,
      [restaurant_id]
    );

    // sanitize rows: ensure items is an array
    const rows = result.rows.map((r) => ({
      ...r,
      items: Array.isArray(r.items) ? r.items : normalizeItems(r.items),
    }));

    res.json(rows);
  } catch (err) {
    console.error("❌ GET /api/orders error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH to update status (keeps returning updated row)
app.patch("/api/orders/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "Missing status in body" });

    const result = await pool.query(
      `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (!result.rows[0]) return res.status(404).json({ error: "Order not found" });
    const row = result.rows[0];
    row.items = Array.isArray(row.items) ? row.items : normalizeItems(row.items);
    console.log("✅ Order updated:", { id: row.id, status: row.status });
    res.json(row);
  } catch (err) {
    console.error("❌ PATCH /api/orders/:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// health
app.get("/", (req, res) => res.send("✅ Nevolt backend OK"));

const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`🚀 Server listening on ${port}`);
});
