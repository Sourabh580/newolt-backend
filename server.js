import express from "express";
import cors from "cors";
import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// 🛠️ Private Key Formatter: Jo Render par cryptographic decoding error ko fix karega
const formatPrivateKey = (key) => {
  if (!key) return '';
  
  // Agar key ke aage-piche galti se quotes aa gaye hon toh unhe saaf karein
  let cleanKey = key.replace(/^["']|["']$/g, '');
  
  // Agar literal \n text hai toh use asli line break character se badlein
  if (cleanKey.includes('\\n')) {
    return cleanKey.replace(/\\n/g, '\n');
  }
  
  // Agar Render ne saari lines jod kar ek lambi line bana di hai, toh use format karein
  if (!cleanKey.includes('\n')) {
    const header = "-----BEGIN PRIVATE KEY-----";
    const footer = "-----END PRIVATE KEY-----";
    let body = cleanKey.replace(header, '').replace(footer, '').replace(/\s/g, '');
    const lines = body.match(/.{1,64}/g) || [];
    return `${header}\n${lines.join('\n')}\n${footer}\n`;
  }
  
  return cleanKey;
};

// Google Sheets Authorization Setup
const auth = new google.auth.JWT(
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  null,
  formatPrivateKey(process.env.GOOGLE_PRIVATE_KEY), // Formatter yahan apply kar diya hai
  ["https://www.googleapis.com/auth/spreadsheets"]
);

const sheets = google.sheets({ version: "v4", auth });
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const RANGE = "Sheet1!A:I"; // A se I columns tak ka range

// Helper function: Google Sheet mein row add karne ke liye
async function appendToSheet(rowData) {
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
      valueInputOption: "USER_ENTERED",
      resource: {
        values: [rowData]
      }
    });
  } catch (error) {
    console.error("Error writing to Google Sheet:", error.message);
    throw error;
  }
}

// Helper function: Id ke anusar row dhoondhne aur status update karne ke liye
async function updateOrderStatusInSheet(orderId, newStatus) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE
    });

    const rows = response.data.values;
    if (!rows) return false;

    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === orderId.toString()) {
        rowIndex = i + 1; // Sheets 1-indexed hota hai
        break;
      }
    }

    if (rowIndex === -1) return false;

    // Status column (Column H yani 8th column) ko update karenge
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Sheet1!H${rowIndex}`,
      valueInputOption: "USER_ENTERED",
      resource: {
        values: [[newStatus]]
      }
    });

    return true;
  } catch (error) {
    console.error("Error updating Google Sheet:", error.message);
    throw error;
  }
}

// ------------------- API ROUTES -------------------

// 1. Naya Order Create karne ka API
app.post("/api/orders", async (req, res) => {
  try {
    const { id, restaurant_id, customer_name, table_no, items, notes, total } = req.body;

    const placed_at = new Date().toISOString();
    const status = "pending";
    const orderId = id || Date.now().toString(); // Agar frontend se id na aaye toh timestamp use karega

    // Array order: id, restaurant_id, customer_name, table_no, items, notes, total, status, placed_at
    const newRow = [
      orderId,
      restaurant_id,
      customer_name,
      table_no,
      typeof items === "object" ? JSON.stringify(items) : items,
      notes || "",
      total || 0,
      status,
      placed_at
    ];

    await appendToSheet(newRow);

    console.log(`✅ Order #${orderId} saved to Google Sheet!`);
    res.status(201).json({ id: orderId, status, message: "Order placed successfully!" });
  } catch (error) {
    console.error("❌ Error creating order:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// 2. Order Status Update karne ka API (PATCH - complete/cancel ke liye)
app.patch("/api/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const isUpdated = await updateOrderStatusInSheet(id, status);

    if (isUpdated) {
      console.log(`✅ Order #${id} marked as ${status}`);
      res.json({ id, status, message: `Order status updated to ${status}!` });
    } else {
      res.status(404).json({ error: "Order not found in Sheet" });
    }
  } catch (error) {
    console.error("❌ Error updating order:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// 3. Health Check
app.get("/", (_, res) => res.send("✅ Nevolt backend with Google Sheets is running live!"));

// 🚀 Start Server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
