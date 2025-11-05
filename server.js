import express from "express";
import pkg from "pg";
const { Pool } = pkg;
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// ✅ PostgreSQL connection
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false },
});

// ✅ Initialize table
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        restaurant_id TEXT,
        customer_name TEXT,
        table_no TEXT,
        items JSONB,
        total INT,
        notes TEXT,
        status TEXT DEFAULT 'pending',
        placed_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Table 'orders' ready");
  } catch (err) {
    console.error("❌ Error creating table:", err);
  }
}
initDB();

// 🟢 POST - Place new order
app.post("/api/order", async (req, res) => {
  try {
    const { customer_name, table_no, items, total, notes } = req.body;
    const restaurant_id = "res-1"; // fixed restaurant id

    const result = await pool.query(
      `INSERT INTO orders (restaurant_id, customer_name, table_no, items, total, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [restaurant_id, customer_name, table_no, JSON.stringify(items), total, notes || ""]
    );

    console.log("✅ New order placed:", result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Order insert error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🟡 GET - Fetch all orders
app.get("/api/orders", async (req, res) => {
  try {
    const { restaurant_id } = req.query;
    if (!restaurant_id)
      return res.status(400).json({ error: "Missing restaurant_id" });

    const result = await pool.query(
      `SELECT * FROM orders WHERE restaurant_id = $1 ORDER BY placed_at DESC`,
      [restaurant_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🔵 PATCH - Update order status
app.patch("/api/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await pool.query(`UPDATE orders SET status = $1 WHERE id = $2`, [status, id]);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Update error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🏠 Default route
app.get("/", (req, res) => {
  res.send("✅ Nevolt backend running fine and connected to Render DB!");
});

app.listen(process.env.PORT || 10000, () => {
  console.log(`🚀 Server running on port ${process.env.PORT || 10000}`);
});
