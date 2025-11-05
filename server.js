import express from "express";
import cors from "cors";
import pkg from "pg";
const { Pool } = pkg;

const app = express();
const port = process.env.PORT || 10000;

// 🧩 Database setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// 🧰 Middleware
app.use(cors());
app.use(express.json());

// ✅ Ensure orders table exists
const createTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        restaurant_id TEXT DEFAULT 'res-1',
        table_no TEXT,
        customer_name TEXT,
        notes TEXT,
        items JSONB,
        total NUMERIC,
        status TEXT DEFAULT 'pending',
        time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Table 'orders' ready");
  } catch (err) {
    console.error("❌ Table creation error:", err);
  }
};
createTable();

// 🟢 Create new order
app.post("/api/orders", async (req, res) => {
  try {
    const { restaurant_id = "res-1", table_no, customer_name, notes, items, total, status } = req.body;

    const result = await pool.query(
      `INSERT INTO orders (restaurant_id, table_no, customer_name, notes, items, total, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *;`,
      [restaurant_id, table_no, customer_name, notes || "", JSON.stringify(items || []), total, status || "pending"]
    );

    console.log("✅ New order placed:", result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Order insert error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 🟣 Get all orders
app.get("/api/orders", async (req, res) => {
  try {
    const restaurant_id = req.query.restaurant_id || "res-1";
    const result = await pool.query(
      `SELECT * FROM orders WHERE restaurant_id = $1 ORDER BY time DESC`,
      [restaurant_id]
    );

    // 🧩 Sanitize output so dashboard never crashes
    const safeRows = result.rows.map((row) => ({
      ...row,
      items: Array.isArray(row.items)
        ? row.items
        : typeof row.items === "string"
        ? JSON.parse(row.items)
        : [],
    }));

    res.json(safeRows);
  } catch (err) {
    console.error("❌ Fetch orders error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 🟠 Update order status
app.patch("/api/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await pool.query(
      `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *;`,
      [status, id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "Order not found" });

    console.log("✅ Order updated:", result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Update order error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 🧪 Health check
app.get("/", (req, res) => {
  res.send("✅ Nevolt Backend is running");
});

// 🚀 Start server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
