import express from "express";
import cors from "cors";
import pkg from "pg";

const { Pool } = pkg;
const app = express();

app.use(cors());
app.use(express.json());

// 🟢 Database connection
const pool = new Pool({
  connectionString:
    "postgresql://restaurant_backend_tahc_user:7ZNAWJG49Rq2pitu5FIAVp9BOQenNbdz@dpg-d449tu9r0fns7382dqp0-a/restaurant_backend_tahc",
  ssl: { rejectUnauthorized: false },
});

// 🧱 Create table if not exists
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      restaurant_id TEXT,
      table_no TEXT,
      customer_name TEXT,
      items JSONB,
      total_amount NUMERIC,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log("✅ Orders table is ready");
}
initDB();

// 🟢 Create new order
app.post("/api/orders", async (req, res) => {
  try {
    console.log("📥 New order received:", req.body);
    const { restaurant_id, table_no, customer_name, items, total_amount } = req.body;

    if (!restaurant_id || !items) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await pool.query(
      `INSERT INTO orders (restaurant_id, table_no, customer_name, items, total_amount)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [restaurant_id, table_no || null, customer_name || "Guest", items, total_amount || 0]
    );

    console.log("✅ Order saved:", result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error saving order:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// 🟢 Get all orders for a restaurant
app.get("/api/orders", async (req, res) => {
  try {
    const { restaurant_id } = req.query;
    if (!restaurant_id) return res.status(400).json({ error: "Missing restaurant_id" });

    const result = await pool.query(
      `SELECT * FROM orders WHERE restaurant_id = $1 ORDER BY created_at DESC`,
      [restaurant_id]
    );
    console.log("🧾 Orders fetched:", result.rows.length);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching orders:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// 🟡 Mark order as completed
app.patch("/api/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await pool.query(
      `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`,
      [status || "completed", id]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: "Order not found" });

    console.log("✅ Order updated:", result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error updating order:", err);
    res.status(500).json({ error: "Failed to update order" });
  }
});

// 🧪 Health check
app.get("/", (req, res) => {
  res.send("🚀 Nevolt Backend is running successfully!");
});

// 🟢 Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
