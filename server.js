import express from "express";
import cors from "cors";
import { google } from "googleapis";
import path from "path";
import fs from "fs";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// ⚡ CLEAN AUTH: JSON parse mein error na aaye isliye clean read kar rahe hain
function getSheetsInstance() {
  const KEYFILEPATH = path.join(process.cwd(), "service-account.json");
  
  // File ko buffer read karke string banao, phir control characters strip karo
  const rawData = fs.readFileSync(KEYFILEPATH, 'utf8')
                    .replace(/[\u0000-\u001F]+/g, ""); 
  
  const credentials = JSON.parse(rawData);

  const auth = new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key,
    ["https://www.googleapis.com/auth/spreadsheets"]
  );

  return google.sheets({ version: "v4", auth });
}

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const RANGE = "Sheet1!A:I";

// --- ROUTES ---

app.post("/api/orders", async (req, res) => {
  try {
    const { id, restaurant_id, customer_name, table_no, items, notes, total } = req.body;
    const placed_at = new Date().toISOString();
    const status = "pending";
    const orderId = id || Date.now().toString();

    const newRow = [orderId, restaurant_id, customer_name, table_no, typeof items === "object" ? JSON.stringify(items) : items, notes || "", total || 0, status, placed_at];

    const sheets = getSheetsInstance(); 
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
      valueInputOption: "USER_ENTERED",
      resource: { values: [newRow] }
    });

    res.status(201).json({ id: orderId, status, message: "Order placed!" });
  } catch (error) {
    console.error("❌ Order Creation Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const sheets = getSheetsInstance();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE
    });

    const rows = response.data.values;
    let rowIndex = -1;
    if (rows) {
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === id.toString()) {
          rowIndex = i + 1;
          break;
        }
      }
    }

    if (rowIndex === -1) return res.status(404).json({ error: "Order not found" });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Sheet1!H${rowIndex}`,
      valueInputOption: "USER_ENTERED",
      resource: { values: [[status]] }
    });

    res.json({ id, status, message: "Updated!" });
  } catch (error) {
    console.error("❌ Update Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/", (_, res) => res.send("✅ Nevolt API is live!"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
