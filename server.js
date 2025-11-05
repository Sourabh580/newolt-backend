import express from "express";
import pkg from "pg";
const { Pool } = pkg;
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// ✅ PostgreSQL Connection (Render)
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
        table_no TEXT,
        customer_name TEXT,
        notes TEXT,
        items JSONB,
        total INT,
        status TEXT DEFAULT 'pending',
        placed_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Table 'orders' ready");
  } catch (err) {
    console.error("❌ Table error:", err);
  }
}
initDB();

// 🟢 POST - Place new order
app.post("/api/orders", async (req, res) => {
  try {
    const { table_no, customer_name, notes, items, total } = req.body;

    if (!table_no || !customer_name || !items || items.length === 0) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await pool.query(
      "INSERT INTO orders (table_no, customer_name, notes, items, total) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [table_no, customer_name, notes, JSON.stringify(items), total]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Order insert error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 🟡 GET - Fetch all orders
app.get("/api/orders", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM orders ORDER BY placed_at DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Fetch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 🔵 PATCH - Update order status
app.patch("/api/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await pool.query("UPDATE orders SET status = $1 WHERE id = $2", [status, id]);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Update error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 🏠 Root check
app.get("/", (req, res) => {
  res.send("✅ Nevolt backend connected and running!");
});

app.listen(process.env.PORT || 10000, () => {
  console.log(`🚀 Server running on port ${process.env.PORT || 10000}`);
});
