import express from "express";
import pkg from "pg";
const { Pool } = pkg;
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: [
      "https://dine-2.onrender.com",
      "https://owner-dashboard-2z3z.onrender.com",
    ],
  })
);

// 🟢 PostgreSQL Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://restaurant_backend_tahc_user:7ZNAWJG49Rq2pitu5FIAVp9BOQenNbdz@dpg-d449tu9r0fns7382dqp0-a/restaurant_backend_tahc",
  ssl: { rejectUnauthorized: false },
});

// 🧱 Ensure table exists
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        restaurant_id TEXT,
        customer_name TEXT,
        table_no TEXT,
        items JSONB,
        total_price INT,
        status TEXT DEFAULT 'pending',
        placed_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Orders table ready");
  } catch (err) {
    console.error("❌ Error creating table:", err);
  }
}
initDB();

// 🟩 POST: Place new order
app.post("/api/order", async (req, res) => {
  try {
    console.log("📥 Order request body:", req.body);

    const { restaurant_id, customer_name, table_no, items, total_price } = req.body;

    if (!restaurant_id || !items) {
      return res.status(400).json({ error: "Missing restaurant_id or items" });
    }

    const result = await pool.query(
      `INSERT INTO orders (restaurant_id, customer_name, table_no, items, total_price)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [restaurant_id, customer_name || "Guest", table_no || "-", items, total_price || 0]
    );

    console.log("✅ Order saved successfully:", result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error while creating order:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🟨 GET: Fetch all orders
app.get("/api/orders", async (req, res) => {
  try {
    const { restaurant_id } = req.query;
    if (!restaurant_id)
      return res.status(400).json({ error: "Missing restaurant_id" });

    const result = await pool.query(
      "SELECT * FROM orders WHERE restaurant_id = $1 ORDER BY placed_at DESC",
      [restaurant_id]
    );
    console.log(`📤 Sending ${result.rows.length} orders`);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🟦 PATCH: Update order status
app.patch("/api/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await pool.query("UPDATE orders SET status = $1 WHERE id = $2", [status, id]);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Update error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => {
  res.send("✅ Nevolt backend connected and working fine!");
});

app.listen(process.env.PORT || 10000, () => {
  console.log(`🚀 Server running on port ${process.env.PORT || 10000}`);
});
