import express from "express";
import cors from "cors";
import pkg from "pg";

const { Pool } = pkg;
const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// 🟢 PostgreSQL connection
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
      total_price NUMERIC,
      status TEXT DEFAULT 'pending',
      placed_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log("✅ Orders table ready");
}

// 🟢 Create new order
app.post("/api/orders", async (req, res) => {
  try {
    const { restaurant_id, customer_name, table_no, items, notes, total } = req.body;
    const total_price = parseFloat(total) || 0;

    const result = await pool.query(
      `INSERT INTO orders (restaurant_id, customer_name, table_no, items, notes, total_price, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [restaurant_id, customer_name, table_no, JSON.stringify(items), notes || "", total_price]
    );

    console.log("✅ New order created:", {
      id: result.rows[0].id,
      customer_name,
      table_no,
      total_price,
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error creating order:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 🟢 Get orders (supports after_id)
app.get("/api/orders", async (req, res) => {
  try {
    const { restaurant_id, after_id } = req.query;
    let query = `SELECT * FROM orders WHERE restaurant_id = $1`;
    const params = [restaurant_id];

    if (after_id && !isNaN(after_id)) {
      query += ` AND id > $2`;
      params.push(after_id);
    }

    query += ` ORDER BY placed_at DESC`;

    const result = await pool.query(query, params);
    console.log(`🧾 Orders fetched: ${result.rows.length} for ${restaurant_id}`);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching orders:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 🟡 Update order status (complete)
app.patch("/api/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await pool.query(
      `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Order not found" });
    }

    console.log(`✅ Order #${id} marked as ${status}`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error updating order:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 🩺 Health check
app.get("/", (_, res) => res.send("✅ Nevolt backend running!"));

// 🚀 Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
  await ensureTables();
  console.log(`🚀 Server running on port ${PORT}`);
});
