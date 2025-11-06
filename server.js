import express from "express";
import cors from "cors";
import pkg from "pg";

const { Pool } = pkg;

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// 🟢 External PostgreSQL connection
const pool = new Pool({
  connectionString:
    "postgresql://restaurant_backend_tahc_user:7ZNAWJG49Rq2pitu5FIAVp9BOQenNbdz@dpg-d449tu9r0fns7382dqp0-a/restaurant_backend_tahc",
  ssl: { rejectUnauthorized: false },
});

// 🧩 Ensure table exists
async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      restaurant_id TEXT,
      customer_name TEXT,
      table_no TEXT,
      items JSONB,
      notes TEXT,
      total NUMERIC,
      status TEXT DEFAULT 'pending',
      placed_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log("✅ Orders table is ready");
}

// 🟩 Route alias: Allow /api/orders to call /api/order
app.post("/api/orders", (req, res) => {
  req.url = "/api/order";
  app._router.handle(req, res);
});

// 🟢 Create new order
app.post("/api/order", async (req, res) => {
  try {
    const { restaurant_id, customer_name, table_no, items, notes, total } =
      req.body;

    const result = await pool.query(
      `INSERT INTO orders (restaurant_id, customer_name, table_no, items, notes, total, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [restaurant_id, customer_name, table_no, JSON.stringify(items), notes || "", total]
    );

    console.log("✅ New order inserted:", result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error creating order:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 🟢 Get all orders (filtered by restaurant)
app.get("/api/orders", async (req, res) => {
  try {
    const { restaurant_id } = req.query;
    const result = await pool.query(
      `SELECT * FROM orders WHERE restaurant_id = $1 ORDER BY placed_at DESC`,
      [restaurant_id]
    );
    console.log(`🧾 Fetched ${result.rows.length} orders for`, restaurant_id);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching orders:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 🟢 Update order status (complete)
app.patch("/api/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const result = await pool.query(
      `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    console.log("✅ Order updated:", result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error updating order:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 🧩 Health check
app.get("/", (_, res) => res.send("✅ Nevolt backend running!"));

// 🚀 Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
  await ensureTables();
  console.log(`🚀 Server running on port ${PORT}`);
});
