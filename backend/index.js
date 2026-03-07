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
  if (CREDENTIALS.private_key) {
    CREDENTIALS.private_key = CREDENTIALS.private_key.replace(/\\n/g, '\n');
  }
} else {
  // Try Render secret file path first, then local fallback
  const fs = require('fs');
  const secretPath = '/etc/secrets/credentials.json';
  if (fs.existsSync(secretPath)) {
    CREDENTIALS = JSON.parse(fs.readFileSync(secretPath, 'utf8'));
  } else {
    CREDENTIALS = require('./credentials.json');
  }
}

const auth = new google.auth.GoogleAuth({
  credentials: CREDENTIALS,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

const PRODUCT_HEADERS    = ['Code', 'Name', 'Cost Price', 'Sales Price'];
const SALES_HEADERS      = ['Product Code', 'Product Name', 'Qty', 'Date', 'Cost Price', 'Sales Price', 'Discount', 'Revenue', 'Total Cost', 'Profit'];
const INVESTMENT_HEADERS = ['Type', 'Person', 'Amount', 'Date', 'Note'];
const BUY_HEADERS        = ['Product Code', 'Product Name', 'Qty', 'Cost Price', 'Total Cost', 'Date'];

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
  if (!existing.includes('Products'))   requests.push({ addSheet: { properties: { title: 'Products' } } });
  if (!existing.includes('Sales'))      requests.push({ addSheet: { properties: { title: 'Sales' } } });
  if (!existing.includes('Investment')) requests.push({ addSheet: { properties: { title: 'Investment' } } });
  if (!existing.includes('Buy'))        requests.push({ addSheet: { properties: { title: 'Buy' } } });
  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests } });
  }
  // Ensure headers exist
  const pRow = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Products!A1:D1' });
  if (!pRow.data.values || pRow.data.values[0][0] !== 'Code') {
    await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: 'Products!A1', valueInputOption: 'USER_ENTERED', requestBody: { values: [PRODUCT_HEADERS] } });
  }
  const sRow = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Sales!A1:J1' });
  if (!sRow.data.values || sRow.data.values[0][0] !== 'Product Code' || !(sRow.data.values[0] || []).includes('Discount')) {
    await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: 'Sales!A1', valueInputOption: 'USER_ENTERED', requestBody: { values: [SALES_HEADERS] } });
  }
  const iRow = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Investment!A1:E1' });
  if (!iRow.data.values || iRow.data.values[0][0] !== 'Type') {
    await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: 'Investment!A1', valueInputOption: 'USER_ENTERED', requestBody: { values: [INVESTMENT_HEADERS] } });
  }
  const bRow = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Buy!A1:F1' });
  if (!bRow.data.values || bRow.data.values[0][0] !== 'Product Code') {
    await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: 'Buy!A1', valueInputOption: 'USER_ENTERED', requestBody: { values: [BUY_HEADERS] } });
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
    const rows = await getDataRows('Sales!A:J');
    const formatBDT = v => `৳${Number(v).toLocaleString('en-BD', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    res.json(rows.map((r, i) => {
      const has = r.length >= 10;
      const discount  = has ? Number(r[6]) || 0 : 0;
      const revenue   = has ? Number(r[7]) || 0 : Number(r[6]) || 0;
      const totalCost = has ? Number(r[8]) || 0 : Number(r[7]) || 0;
      const profit    = has ? Number(r[9]) || 0 : Number(r[8]) || 0;
      return {
        id: i + 1,
        productCode: r[0] || '',
        productName: r[1] || '',
        qty: Number(r[2]) || 0,
        date: r[3] || '',
        costPrice:   formatBDT(r[4]),
        salesPrice:  formatBDT(r[5]),
        discount:    formatBDT(discount),
        discountRaw: discount,
        revenue:     formatBDT(revenue),
        totalCost:   formatBDT(totalCost),
        profit:      formatBDT(profit),
      };
    }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/sales', async (req, res) => {
  const { productCode, productName, qty, date, costPrice, salesPrice, discount } = req.body;
  if (!productCode || !qty || !date)
    return res.status(400).json({ error: 'productCode, qty, date required.' });
  const q  = Number(qty);
  const cp = Number(costPrice) || 0;
  const sp = Number(salesPrice) || 0;
  const d  = Number(discount) || 0;
  const revenue   = (sp * q) - d;
  const totalCost = cp * q;
  const profit    = revenue - totalCost;
  try {
    await appendRow('Sales!A:J', [productCode, productName || '', q, date, cp, sp, d, revenue, totalCost, profit]);
    const formatBDT = v => `৳${Number(v).toLocaleString('en-BD', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    res.json({
      productCode, productName, qty: q, date,
      costPrice:   formatBDT(cp),
      salesPrice:  formatBDT(sp),
      discount:    formatBDT(d),
      revenue:     formatBDT(revenue),
      totalCost:   formatBDT(totalCost),
      profit:      formatBDT(profit),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/sales/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { productCode, productName, qty, date, costPrice, salesPrice, discount } = req.body;
  const q  = Number(qty);
  const cp = Number(costPrice) || 0;
  const sp = Number(salesPrice) || 0;
  const d  = Number(discount) || 0;
  const revenue   = (sp * q) - d;
  const totalCost = cp * q;
  const profit    = revenue - totalCost;
  try {
    const rows = await getDataRows('Sales!A:J');
    if (id < 1 || id > rows.length) return res.status(404).json({ error: 'Not found.' });
    rows[id - 1] = [productCode, productName || '', q, date, cp, sp, d, revenue, totalCost, profit];
    await overwriteDataRows('Sales', SALES_HEADERS, rows);
    const formatBDT = v => `৳${Number(v).toLocaleString('en-BD', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    res.json({
      id, productCode, productName, qty: q, date,
      costPrice:   formatBDT(cp),
      salesPrice:  formatBDT(sp),
      discount:    formatBDT(d),
      revenue:     formatBDT(revenue),
      totalCost:   formatBDT(totalCost),
      profit:      formatBDT(profit),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/sales/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const rows = await getDataRows('Sales!A:J');
    if (id < 1 || id > rows.length) return res.status(404).json({ error: 'Not found.' });
    rows.splice(id - 1, 1);
    await overwriteDataRows('Sales', SALES_HEADERS, rows);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── SUMMARY ─────────────────────────────────────────────────────────────────

app.get('/summary', async (req, res) => {
  try {
    const rows = await getDataRows('Sales!A:J');
    const sales = rows.map(r => ({
      date: r[3] || '',
      revenue: r.length >= 10 ? Number(r[7]) || 0 : Number(r[6]) || 0,
      profit:  r.length >= 10 ? Number(r[9]) || 0 : Number(r[8]) || 0,
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

// ─── INVESTMENT ───────────────────────────────────────────────────────────────

async function getInvestmentSummary(month) {
  const [invRows, salesRows, buyRows] = await Promise.all([
    getDataRows('Investment!A:E'),
    getDataRows('Sales!A:J'),
    getDataRows('Buy!A:F'),
  ]);
  const totalInvestment  = invRows.filter(r => r[0] === 'investment').reduce((a, r) => a + (Number(r[2]) || 0), 0);
  const totalWithdrawals = invRows.filter(r => r[0] === 'withdrawal').reduce((a, r) => a + (Number(r[2]) || 0), 0);
  // Calculate profit from sales entries
  const sales = salesRows.map(r => ({
    date: r[3] || '',
    profit: r.length >= 10 ? Number(r[9]) || 0 : Number(r[8]) || 0,
  }));
  const today = new Date().toISOString().slice(0, 10);
  const todayProfit   = sales.filter(s => s.date === today).reduce((a, s) => a + s.profit, 0);
  const selMonth      = month || new Date().toISOString().slice(0, 7);
  const monthProfit   = sales.filter(s => s.date && s.date.slice(0, 7) === selMonth).reduce((a, s) => a + s.profit, 0);
  const totalProfit   = sales.reduce((a, s) => a + s.profit, 0);
  const totalRevenue  = salesRows.reduce((a, r) => {
    const rev = r.length >= 10 ? Number(r[7]) || 0 : Number(r[6]) || 0;
    return a + rev;
  }, 0);
  const totalBuyCost  = buyRows.reduce((a, r) => a + (Number(r[4]) || 0), 0);
  // netProfit: totalRevenue - totalBuyCost (overall business margin)
  const netProfit     = totalRevenue - totalBuyCost;
  // salesProfit: sum of per-sale product profit (Revenue - CostOfGoodsSold per sale)
  const salesProfit   = totalProfit;
  // Profit share based on salesProfit
  const aktersProfit  = salesProfit * 0.5;
  const tokonsProfit  = salesProfit * 0.5;
  const aktersBalance = aktersProfit - totalWithdrawals;
  const cashInHand    = totalInvestment - totalBuyCost + totalRevenue - totalWithdrawals;
  return { totalInvestment, totalWithdrawals, totalRevenue, totalBuyCost, netProfit, salesProfit, aktersProfit, tokonsProfit, aktersBalance, cashInHand, todayProfit, monthProfit, totalProfit };
}

app.get('/investment', async (req, res) => {
  try {
    const { month } = req.query;
    const [invRows, summary] = await Promise.all([
      getDataRows('Investment!A:E'),
      getInvestmentSummary(month),
    ]);
    const entries = invRows.map((r, i) => ({
      id: i + 1,
      type: r[0] || '',
      person: r[1] || '',
      amount: Number(r[2]) || 0,
      date: r[3] || '',
      note: r[4] || '',
    }));
    const formatBDT = v => `৳${Number(v).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    res.json({
      entries,
      summary: {
        totalInvestment:   formatBDT(summary.totalInvestment),
        totalBuyCost:      formatBDT(summary.totalBuyCost),
        totalRevenue:      formatBDT(summary.totalRevenue),
        netProfit:        formatBDT(summary.netProfit),
        salesProfit:      formatBDT(summary.salesProfit),
        todayProfit:      formatBDT(summary.todayProfit),
        monthProfit:      formatBDT(summary.monthProfit),
        totalProfit:      formatBDT(summary.totalProfit),
        aktersProfit:     formatBDT(summary.aktersProfit),
        tokonsProfit:     formatBDT(summary.tokonsProfit),
        aktersWithdrawals:formatBDT(summary.totalWithdrawals),
        aktersBalance:    formatBDT(summary.aktersBalance),
        cashInHand:       formatBDT(summary.cashInHand),
        aktersBalanceRaw: summary.aktersBalance,
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/investment', async (req, res) => {
  const { type, amount, date, note } = req.body;
  if (!type || !amount || !date)
    return res.status(400).json({ error: 'type, amount, date required.' });
  if (!['investment', 'withdrawal'].includes(type))
    return res.status(400).json({ error: 'type must be investment or withdrawal.' });
  const amt = Number(amount);
  if (amt <= 0) return res.status(400).json({ error: 'Amount must be positive.' });

  try {
    if (type === 'withdrawal') {
      const summary = await getInvestmentSummary();
      if (amt > summary.aktersBalance) {
        return res.status(400).json({
          error: `Insufficient balance. Akter's available profit balance: ৳${summary.aktersBalance.toFixed(2)}`,
        });
      }
    }
    const person = type === 'investment' ? 'Tokon' : 'Akter';
    await appendRow('Investment!A:E', [type, person, amt, date, note || '']);
    res.json({ type, person, amount: amt, date, note: note || '' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── INVENTORY ───────────────────────────────────────────────────────────────

app.get('/inventory', async (req, res) => {
  try {
    const [productRows, buyRows, salesRows] = await Promise.all([
      getDataRows('Products!A:D'),
      getDataRows('Buy!A:F'),
      getDataRows('Sales!A:J'),
    ]);
    const productMap = {};
    productRows.forEach(r => {
      if (r[0]) productMap[r[0]] = { code: r[0], name: r[1] || '', costPrice: Number(r[2]) || 0, salesPrice: Number(r[3]) || 0 };
    });
    const bought = {};
    buyRows.forEach(r => { if (r[0]) bought[r[0]] = (bought[r[0]] || 0) + (Number(r[2]) || 0); });
    const soldMap = {};
    salesRows.forEach(r => { if (r[0]) soldMap[r[0]] = (soldMap[r[0]] || 0) + (Number(r[2]) || 0); });
    const allCodes = new Set([...Object.keys(bought), ...Object.keys(soldMap)]);
    const formatBDT = v => `৳${Number(v).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const items = Array.from(allCodes).map(code => {
      const p           = productMap[code] || { code, name: '', costPrice: 0, salesPrice: 0 };
      const boughtQty   = bought[code]  || 0;
      const soldQty     = soldMap[code] || 0;
      const remaining   = boughtQty - soldQty;
      const costValue   = remaining * p.costPrice;
      const salesValue  = remaining * p.salesPrice;
      const potProfit   = salesValue - costValue;
      return {
        code: p.code, name: p.name,
        bought: boughtQty, sold: soldQty, remaining,
        costPrice: p.costPrice, salesPrice: p.salesPrice,
        costValue:          formatBDT(costValue),
        salesValue:         formatBDT(salesValue),
        potentialProfit:    formatBDT(potProfit),
        potentialProfitRaw: potProfit,
      };
    }).sort((a, b) => (a.code || '').localeCompare(b.code || ''));
    const totalCostValue  = Array.from(allCodes).reduce((a, code) => {
      const p = productMap[code] || { costPrice: 0 };
      return a + ((bought[code] || 0) - (soldMap[code] || 0)) * p.costPrice;
    }, 0);
    const totalSalesValue = Array.from(allCodes).reduce((a, code) => {
      const p = productMap[code] || { salesPrice: 0 };
      return a + ((bought[code] || 0) - (soldMap[code] || 0)) * p.salesPrice;
    }, 0);
    res.json({
      items,
      summary: {
        totalCostValue:       formatBDT(totalCostValue),
        totalSalesValue:      formatBDT(totalSalesValue),
        totalPotentialProfit: formatBDT(totalSalesValue - totalCostValue),
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── BUYS ────────────────────────────────────────────────────────────────────

app.get('/buys', async (req, res) => {
  try {
    const rows = await getDataRows('Buy!A:F');
    res.json(rows.map((r, i) => ({
      id: i + 1,
      productCode: r[0] || '',
      productName: r[1] || '',
      qty: Number(r[2]) || 0,
      costPrice: Number(r[3]) || 0,
      totalCost: Number(r[4]) || 0,
      date: r[5] || '',
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/buys', async (req, res) => {
  const { productCode, productName, qty, costPrice, date } = req.body;
  if (!productCode || !qty || !date)
    return res.status(400).json({ error: 'productCode, qty, date required.' });
  const q         = Number(qty);
  const cp        = Number(costPrice) || 0;
  const totalCost = cp * q;
  try {
    await appendRow('Buy!A:F', [productCode, productName || '', q, cp, totalCost, date]);
    res.json({ productCode, productName: productName || '', qty: q, costPrice: cp, totalCost, date });
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
