 
import express from "express";
import cors from "cors";
import { google } from "googleapis";
import dotenv from "dotenv";
import path from "path"; // 👈 File path handle karne ke liye

dotenv.config();

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// 📁 Direct JSON file se auth setup (Bina kisi string convert/decoder jhanjhat ke)
const auth = new google.auth.GoogleAuth({
  keyFile: path.join(process.cwd(), "newolt-db-9b4bd56ccb02.json"), // Aapki downloaded file ka naam
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const RANGE = "Sheet1!A:I";

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
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) return false;

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

app.post("/api/orders", async (req, res) => {
  try {
    const { id, restaurant_id, customer_name, table_no, items, notes, total } = req.body;
    const placed_at = new Date().toISOString();
    const status = "pending";
    const orderId = id || Date.now().toString();

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

app.get("/", (_, res) => res.send("✅ Nevolt backend with Google Sheets is running live!"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

  