const { google } = require('googleapis');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const SHEET_ID = '1ExtunXeJhWy7VP8r-PCDuQY8dAKsuYamGTVUUQcOfwc';

let CREDENTIALS;
if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
  CREDENTIALS = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  // Fix private key newlines in case Render escapes them
  if (CREDENTIALS.private_key) {
    CREDENTIALS.private_key = CREDENTIALS.private_key.replace(/\\n/g, '\n');
  }
} else {
  CREDENTIALS = require('./credentials.json');
}

const auth = new google.auth.GoogleAuth({
  credentials: CREDENTIALS,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

const PRODUCT_HEADERS = ['Code', 'Name', 'Cost Price', 'Sales Price'];
const SALES_HEADERS   = ['Product Code', 'Product Name', 'Qty', 'Date', 'Cost Price', 'Sales Price', 'Revenue', 'Total Cost', 'Profit'];

// Returns data rows only (skips row 1 = header)
async function getDataRows(range) {
  const result = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range });
  const all = result.data.values || [];
  return all.slice(1);
}

// Writes header + data rows back to sheet
async function overwriteDataRows(sheetName, headers, dataRows) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [headers, ...dataRows] },
  });
}

async function appendRow(range, row) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

async function ensureSheetsExist() {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const existing = (meta.data.sheets || []).map(s => s.properties && s.properties.title);
  const requests = [];
  if (!existing.includes('Products')) requests.push({ addSheet: { properties: { title: 'Products' } } });
  if (!existing.includes('Sales'))    requests.push({ addSheet: { properties: { title: 'Sales' } } });
  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests } });
  }
  // Ensure headers exist
  const pRow = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Products!A1:D1' });
  if (!pRow.data.values || pRow.data.values[0][0] !== 'Code') {
    await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: 'Products!A1', valueInputOption: 'USER_ENTERED', requestBody: { values: [PRODUCT_HEADERS] } });
  }
  const sRow = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Sales!A1:I1' });
  if (!sRow.data.values || sRow.data.values[0][0] !== 'Product Code') {
    await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: 'Sales!A1', valueInputOption: 'USER_ENTERED', requestBody: { values: [SALES_HEADERS] } });
  }
}

// ─── PRODUCTS ────────────────────────────────────────────────────────────────

app.get('/products', async (req, res) => {
  try {
    const rows = await getDataRows('Products!A:D');
    res.json(rows.map((r, i) => ({
      id: i + 1,
      code: r[0] || '',
      name: r[1] || '',
      costPrice: Number(r[2]) || 0,
      salesPrice: Number(r[3]) || 0,
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/products', async (req, res) => {
  const { code, name, costPrice, salesPrice } = req.body;
  if (!code || !name || costPrice == null || salesPrice == null)
    return res.status(400).json({ error: 'All fields required.' });
  try {
    await appendRow('Products!A:D', [code, name, Number(costPrice), Number(salesPrice)]);
    res.json({ code, name, costPrice: Number(costPrice), salesPrice: Number(salesPrice) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/products/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { code, name, costPrice, salesPrice } = req.body;
  try {
    const rows = await getDataRows('Products!A:D');
    if (id < 1 || id > rows.length) return res.status(404).json({ error: 'Not found.' });
    rows[id - 1] = [code, name, Number(costPrice), Number(salesPrice)];
    await overwriteDataRows('Products', PRODUCT_HEADERS, rows);
    res.json({ id, code, name, costPrice: Number(costPrice), salesPrice: Number(salesPrice) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/products/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const rows = await getDataRows('Products!A:D');
    if (id < 1 || id > rows.length) return res.status(404).json({ error: 'Not found.' });
    rows.splice(id - 1, 1);
    await overwriteDataRows('Products', PRODUCT_HEADERS, rows);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── SALES ───────────────────────────────────────────────────────────────────

app.get('/sales', async (req, res) => {
  try {
    const rows = await getDataRows('Sales!A:I');
    // Format currency fields as BDT
    const formatBDT = v => `৳${Number(v).toLocaleString('en-BD', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    res.json(rows.map((r, i) => ({
      id: i + 1,
      productCode: r[0] || '',
      productName: r[1] || '',
      qty: Number(r[2]) || 0,
      date: r[3] || '',
      costPrice: formatBDT(r[4]),
      salesPrice: formatBDT(r[5]),
      revenue: formatBDT(r[6]),
      totalCost: formatBDT(r[7]),
      profit: formatBDT(r[8]),
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/sales', async (req, res) => {
  const { productCode, productName, qty, date, costPrice, salesPrice } = req.body;
  if (!productCode || !qty || !date)
    return res.status(400).json({ error: 'productCode, qty, date required.' });
  const q = Number(qty);
  const cp = Number(costPrice) || 0;
  const sp = Number(salesPrice) || 0;
  const revenue = sp * q;
  const totalCost = cp * q;
  const profit = revenue - totalCost;
  try {
    await appendRow('Sales!A:I', [productCode, productName || '', q, date, cp, sp, revenue, totalCost, profit]);
    // Format currency fields as BDT
    const formatBDT = v => `৳${Number(v).toLocaleString('en-BD', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    res.json({
      productCode,
      productName,
      qty: q,
      date,
      costPrice: formatBDT(cp),
      salesPrice: formatBDT(sp),
      revenue: formatBDT(revenue),
      totalCost: formatBDT(totalCost),
      profit: formatBDT(profit)
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/sales/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { productCode, productName, qty, date, costPrice, salesPrice } = req.body;
  const q = Number(qty);
  const cp = Number(costPrice) || 0;
  const sp = Number(salesPrice) || 0;
  const revenue = sp * q;
  const totalCost = cp * q;
  const profit = revenue - totalCost;
  try {
    const rows = await getDataRows('Sales!A:I');
    if (id < 1 || id > rows.length) return res.status(404).json({ error: 'Not found.' });
    rows[id - 1] = [productCode, productName || '', q, date, cp, sp, revenue, totalCost, profit];
    await overwriteDataRows('Sales', SALES_HEADERS, rows);
    // Format currency fields as BDT
    const formatBDT = v => `৳${Number(v).toLocaleString('en-BD', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    res.json({
      id,
      productCode,
      productName,
      qty: q,
      date,
      costPrice: formatBDT(cp),
      salesPrice: formatBDT(sp),
      revenue: formatBDT(revenue),
      totalCost: formatBDT(totalCost),
      profit: formatBDT(profit)
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/sales/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const rows = await getDataRows('Sales!A:I');
    if (id < 1 || id > rows.length) return res.status(404).json({ error: 'Not found.' });
    rows.splice(id - 1, 1);
    await overwriteDataRows('Sales', SALES_HEADERS, rows);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── SUMMARY ─────────────────────────────────────────────────────────────────

app.get('/summary', async (req, res) => {
  try {
    const rows = await getDataRows('Sales!A:I');
    const sales = rows.map(r => ({
      date: r[3] || '',
      revenue: Number(r[6]) || 0,
      profit: Number(r[8]) || 0,
    }));
    const today = new Date().toISOString().slice(0, 10);
    const todayRevenue  = sales.filter(s => s.date === today).reduce((a, s) => a + s.revenue, 0);
    const totalRevenue  = sales.reduce((a, s) => a + s.revenue, 0);
    const totalProfit   = sales.reduce((a, s) => a + s.profit, 0);
    const { month } = req.query;
    const monthRevenue  = month ? sales.filter(s => s.date && s.date.slice(0, 7) === month).reduce((a, s) => a + s.revenue, 0) : 0;
    const monthProfit   = month ? sales.filter(s => s.date && s.date.slice(0, 7) === month).reduce((a, s) => a + s.profit, 0) : 0;
    // Format all currency values as BDT
    const formatBDT = v => `৳${Number(v).toLocaleString('en-BD', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    res.json({
      todayRevenue: formatBDT(todayRevenue),
      totalRevenue: formatBDT(totalRevenue),
      totalProfit: formatBDT(totalProfit),
      monthRevenue: formatBDT(monthRevenue),
      monthProfit: formatBDT(monthProfit)
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── BOOT ─────────────────────────────────────────────────────────────────────

const PORT = 4000;
ensureSheetsExist()
  .then(() => {
    app.listen(PORT, () => console.log('Backend running on port ' + PORT));
  })
  .catch(e => {
    console.error('Sheet init failed:', e.message);
    process.exit(1);
  });
