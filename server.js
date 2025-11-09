import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 🧠 Database connection
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://restaurant_backend_tahc_user:7ZNAWJG49Rq2pitu5FIAVp9BOQenNbdz@dpg-d449tu9r0fns7382dqp0-a/restaurant_backend_tahc",
  ssl: { rejectUnauthorized: false },
});

// 🟢 Create table if not exists
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      restaurant_id TEXT NOT NULL,
      customer_name TEXT,
      table_no TEXT,
      dish TEXT,
      items JSONB,
      total_price NUMERIC DEFAULT 0,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log("✅ Orders table ready");
})();

// 🟩 Place a new order (from menu)
app.post("/api/order", async (req, res) => {
  try {
    const {
      restaurant_id,
      customer_name,
      table_no,
      dish,
      items,
      price,
      total_price,
    } = req.body;

    // 🧮 Calculate final total
    const finalTotal =
      total_price ||
      (Array.isArray(items)
        ? items.reduce(
            (sum, i) => sum + (i.price || 0) * (i.quantity || 1),
            0
          )
        : price || 0);

    const result = await pool.query(
      `INSERT INTO orders 
        (restaurant_id, customer_name, table_no, dish, items, total_price, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [
        restaurant_id,
        customer_name || "Guest",
        table_no || "N/A",
        dish || "",
        JSON.stringify(items || []),
        finalTotal,
      ]
    );

    console.log("✅ New order added:", result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Order insert error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🟢 Fetch all orders for a restaurant (used by dashboard)
app.get("/api/orders", async (req, res) => {
  try {
    const { restaurant_id } = req.query;
    if (!restaurant_id)
      return res.status(400).json({ error: "restaurant_id required" });

    const result = await pool.query(
      "SELECT * FROM orders WHERE restaurant_id = $1 ORDER BY created_at DESC",
      [restaurant_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Fetch orders error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🟠 Mark order as completed
app.patch("/api/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await pool.query(
      "UPDATE orders SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "Order not found" });

    console.log(`✅ Order #${id} updated to ${status}`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Update order error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🧾 Optional: Revenue summary endpoint
app.get("/api/revenue", async (req, res) => {
  try {
    const { restaurant_id } = req.query;
    if (!restaurant_id)
      return res.status(400).json({ error: "restaurant_id required" });

    const result = await pool.query(
      "SELECT SUM(total_price) AS total_revenue FROM orders WHERE restaurant_id = $1 AND status = 'completed'",
      [restaurant_id]
    );

    res.json({ revenue: Number(result.rows[0].total_revenue || 0) });
  } catch (err) {
    console.error("❌ Revenue fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Health check
app.get("/", (req, res) => {
  res.send("✅ Backend running successfully");
});

// 🟢 Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server live on port ${PORT}`));
