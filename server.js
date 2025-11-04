import express from "express";
import pkg from "pg";
const { Pool } = pkg;
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// ✅ PostgreSQL Connection (with SSL for Render)
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false }, // 👈 important for Render hosted DB
});

// ✅ Initialize table (wrapped in async function)
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        restaurant_id TEXT,
        customer_name TEXT,
        table_no TEXT,
        dish TEXT,
        price INT,
        status TEXT DEFAULT 'pending',
        placed_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Table 'orders' is ready");
  } catch (err) {
    console.error("❌ Error creating table:", err);
  }
}
initDB();

// 🟢 POST - Place new order
app.post("/api/order", async (req, res) => {
  try {
    const { restaurant_id, customer_name, table_no, dish, price } = req.body;

    if (!restaurant_id || !customer_name || !dish) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await pool.query(
      "INSERT INTO orders (restaurant_id, customer_name, table_no, dish, price) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [restaurant_id, customer_name, table_no, dish, price]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Order insert error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🟡 GET - Fetch all orders for a restaurant
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
    console.error("Fetch error:", err);
    res.status(500).json({ error: err.message });
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
    console.error("Update error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🏠 Default route
app.get("/", (req, res) => {
  res.send("✅ Newolt backend is running fine and connected to Render DB with SSL!");
});

app.listen(process.env.PORT || 10000, () => {
  console.log(`🚀 Server running on port ${process.env.PORT || 10000}`);
});
