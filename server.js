import express from "express";
import pkg from "pg";
const { Pool } = pkg;
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// ✅ PostgreSQL Connection (Render-compatible)
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false },
});

// ✅ Initialize Database
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        table_no TEXT NOT NULL,
        notes TEXT,
        status TEXT DEFAULT 'pending',
        items JSONB,
        total INT,
        placed_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Table 'orders' initialized successfully");
  } catch (err) {
    console.error("❌ Error initializing DB:", err);
  }
}
initDB();

// 🟢 POST: Create New Order
app.post("/api/orders", async (req, res) => {
  try {
    const { restaurant_id, customer_name, table_no, notes, items, total } = req.body;

    if (!restaurant_id || !customer_name || !table_no || !items) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await pool.query(
      `INSERT INTO orders (restaurant_id, customer_name, table_no, notes, items, total)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [restaurant_id, customer_name, table_no, notes || "", items, total]
    );

    console.log("🆕 New order added:", result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error creating order:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🟡 GET: Fetch All Orders for a Restaurant
app.get("/api/orders", async (req, res) => {
  try {
    const { restaurant_id } = req.query;
    if (!restaurant_id)
      return res.status(400).json({ error: "Missing restaurant_id" });

    const result = await pool.query(
      "SELECT * FROM orders WHERE restaurant_id = $1 ORDER BY placed_at DESC",
      [restaurant_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching orders:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🔵 PATCH: Update Order Status
app.patch("/api/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await pool.query(
      "UPDATE orders SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );

    if (result.rowCount === 0)
      return res.status(404).json({ error: "Order not found" });

    console.log("✅ Order updated:", result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error updating order:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🏠 Default Route
app.get("/", (req, res) => {
  res.send("✅ Nevolt backend running & connected to PostgreSQL successfully!");
});

// 🚀 Start Server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
