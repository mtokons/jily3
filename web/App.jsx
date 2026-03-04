import React, { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:4000' });
const TODAY = new Date().toISOString().slice(0, 10);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function getMonthOptions() {
  const opts = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = d.toISOString().slice(0, 7);
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    opts.push({ val, label });
  }
  return opts;
}

// ─── Theme colours ────────────────────────────────────────────────────────────
const brand  = '#4f46e5';
const green  = '#16a34a';
const red    = '#dc2626';
const amber  = '#d97706';
const teal   = '#0891b2';
const white  = '#ffffff';
const border = '#e2e8f0';
const muted  = '#64748b';
const bgPage = '#f1f5f9';
const bgCard = '#ffffff';
const textDk = '#0f172a';

// ─── Reusable style objects ───────────────────────────────────────────────────
const card    = { background: bgCard, borderRadius: '16px', padding: '22px', border: '1px solid ' + border, boxShadow: '0 2px 8px rgba(0,0,0,.05)' };
const input   = { width: '100%', padding: '10px 12px', border: '1.5px solid ' + border, borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: '#f8fafc' };
const th      = { textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid ' + border, color: muted, fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '.04em' };
const td      = { padding: '10px 12px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' };
const lbl     = { display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '5px', color: textDk };
const frmRow  = { marginBottom: '14px' };
const twoIn   = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' };

function btn(bg, fg) {
  return { background: bg, color: fg || white, border: 'none', borderRadius: '10px', padding: '11px 22px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' };
}
function smBtn(bg, fg, bdr) {
  return { background: bg, color: fg || white, border: bdr ? '1px solid ' + bdr : 'none', borderRadius: '8px', padding: '7px 12px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' };
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, accent }) {
  return (
    <div style={{ ...card, borderLeft: '4px solid ' + accent, padding: '18px 20px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
      <div style={{ fontSize: '26px', fontWeight: 800, color: accent, margin: '4px 0 0' }}>৳{fmt(value)}</div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
      onClick={onClose}
    >
      <div style={{ background: white, borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '500px', boxShadow: '0 24px 64px rgba(0,0,0,.2)' }} onClick={e => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 20px', fontSize: '20px', fontWeight: 800 }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [products, setProducts] = useState([]);
  const [sales, setSales]       = useState([]);
  const [summary, setSummary]   = useState({ todayRevenue: 0, totalRevenue: 0, totalProfit: 0, monthRevenue: 0, monthProfit: 0 });
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const monthOpts = useMemo(() => getMonthOptions(), []);
  const [selMonth, setSelMonth] = useState(monthOpts[0].val);

  const [showPModal, setShowPModal] = useState(false);
  const [showSModal, setShowSModal] = useState(false);

  const emptyP = { code: '', name: '', costPrice: '', salesPrice: '' };
  const emptyS = () => ({ productCode: '', qty: '', date: new Date().toISOString().slice(0, 10) });
  const [pForm, setPForm] = useState(emptyP);
  const [sForm, setSForm] = useState(emptyS);
  const [editPId, setEditPId] = useState(null);
  const [editSId, setEditSId] = useState(null);

  const productMap = useMemo(() => {
    const m = {};
    products.forEach(p => { m[p.code] = p; });
    return m;
  }, [products]);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [pr, sr, smr] = await Promise.all([
        api.get('/products'),
        api.get('/sales'),
        api.get('/summary?month=' + selMonth),
      ]);
      setProducts(pr.data || []);
      setSales(sr.data || []);
      setSummary(smr.data || {});
      setError('');
    } catch (e) {
      setError((e.response && e.response.data && e.response.data.error) || 'Failed to load. Is the backend running on port 4000?');
    } finally {
      setLoading(false);
    }
  }, [selMonth]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Product CRUD
  const saveProduct = async () => {
    if (!pForm.code || !pForm.name || pForm.costPrice === '' || pForm.salesPrice === '') return;
    try {
      if (editPId) await api.put('/products/' + editPId, pForm);
      else         await api.post('/products', pForm);
      setShowPModal(false); setPForm(emptyP); setEditPId(null);
      await loadAll();
    } catch (e) { setError((e.response && e.response.data && e.response.data.error) || 'Product save failed.'); }
  };

  const deleteProduct = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try { await api.delete('/products/' + id); await loadAll(); }
    catch (e) { setError((e.response && e.response.data && e.response.data.error) || 'Delete failed.'); }
  };

  const openEditProduct = (p) => {
    setPForm({ code: p.code, name: p.name, costPrice: p.costPrice, salesPrice: p.salesPrice });
    setEditPId(p.id); setShowPModal(true);
  };

  // Sale CRUD
  const saveSale = async () => {
    if (!sForm.productCode || !sForm.qty || !sForm.date) return;
    const prod = productMap[sForm.productCode];
    const payload = {
      productCode: sForm.productCode,
      productName: prod ? prod.name : '',
      qty: Number(sForm.qty),
      date: sForm.date,
      costPrice: prod ? prod.costPrice : 0,
      salesPrice: prod ? prod.salesPrice : 0,
    };
    try {
      if (editSId) await api.put('/sales/' + editSId, payload);
      else         await api.post('/sales', payload);
      setShowSModal(false); setSForm(emptyS()); setEditSId(null);
      await loadAll();
    } catch (e) { setError((e.response && e.response.data && e.response.data.error) || 'Sale save failed.'); }
  };

  const deleteSale = async (id) => {
    if (!window.confirm('Delete this sale entry?')) return;
    try { await api.delete('/sales/' + id); await loadAll(); }
    catch (e) { setError((e.response && e.response.data && e.response.data.error) || 'Delete failed.'); }
  };

  const openEditSale = (s) => {
    setSForm({ productCode: s.productCode, qty: s.qty, date: s.date });
    setEditSId(s.id); setShowSModal(true);
  };

  // Inline sale preview
  const salePreview = (() => {
    if (!sForm.productCode || !sForm.qty) return null;
    const prod = productMap[sForm.productCode];
    if (!prod) return null;
    const q = Number(sForm.qty) || 0;
    const rev = prod.salesPrice * q;
    const cost = prod.costPrice * q;
    const profit = rev - cost;
    return { rev, cost, profit };
  })();

  const selMonthLabel = (monthOpts.find(o => o.val === selMonth) || {}).label || '';

  return (
    <div style={{ minHeight: '100vh', background: bgPage, fontFamily: "'Inter', system-ui, sans-serif", color: textDk }}>

      {/* NAV */}
      <nav style={{ background: brand, padding: '0 28px', display: 'flex', alignItems: 'center', height: '62px', boxShadow: '0 3px 12px rgba(79,70,229,.4)' }}>
        <span style={{ fontSize: '22px', fontWeight: 900, color: white, letterSpacing: '-.5px' }}>Jily Enterprise</span>
        <span style={{ fontSize: '13px', color: 'rgba(255,255,255,.7)', marginLeft: '14px', fontWeight: 500 }}>Sales Management System</span>
        <button onClick={loadAll} style={{ marginLeft: 'auto', ...smBtn('rgba(255,255,255,.15)', white, null), padding: '8px 16px' }}>↻ Refresh</button>
      </nav>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '28px 20px' }}>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: red, borderRadius: '10px', padding: '12px 16px', marginBottom: '18px', fontSize: '13px', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            <span>{error}</span>
            <span style={{ cursor: 'pointer' }} onClick={() => setError('')}>✕</span>
          </div>
        )}

        {/* DASHBOARD HEADER ROW */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '18px', fontWeight: 800 }}>Dashboard</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: muted, fontWeight: 600 }}>Month:</span>
            <select
              style={{ padding: '8px 14px', border: '1.5px solid ' + border, borderRadius: '10px', fontSize: '14px', background: white, outline: 'none', fontWeight: 600, cursor: 'pointer' }}
              value={selMonth}
              onChange={e => setSelMonth(e.target.value)}
            >
              {monthOpts.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* STAT CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px', marginBottom: '28px' }}>
          <StatCard label="Today's Sales"               value={summary.todayRevenue}  accent={brand} />
          <StatCard label={selMonthLabel + ' Sales'}    value={summary.monthRevenue}  accent={amber} />
          <StatCard label={selMonthLabel + ' Profit'}   value={summary.monthProfit}   accent={summary.monthProfit >= 0 ? green : red} />
          <StatCard label="Total Company Sales"         value={summary.totalRevenue}  accent={teal} />
          <StatCard label="Total Profit / Loss"         value={summary.totalProfit}   accent={summary.totalProfit >= 0 ? green : red} />
        </div>

        {/* ACTION BUTTONS */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '28px', flexWrap: 'wrap' }}>
          <button style={btn(brand)} onClick={() => { setPForm(emptyP); setEditPId(null); setShowPModal(true); }}>
            ＋ Add Product
          </button>
          <button style={btn(green)} onClick={() => { setSForm(emptyS()); setEditSId(null); setShowSModal(true); }}>
            ＋ Record Sale
          </button>
        </div>

        {/* TABLES */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '20px' }}>

          {/* PRODUCTS */}
          <div style={card}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 750 }}>Products ({products.length})</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th style={th}>Code</th>
                  <th style={th}>Name</th>
                  <th style={th}>Cost</th>
                  <th style={th}>Price</th>
                  <th style={th}>Margin</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: muted }}>Loading…</td></tr>}
                {!loading && products.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: muted }}>No products. Click "+ Add Product".</td></tr>}
                {products.map(p => {
                  const margin = p.salesPrice - p.costPrice;
                  return (
                    <tr key={p.id} style={{ transition: 'background .15s' }}>
                      <td style={td}><span style={{ background: brand + '15', color: brand, borderRadius: '6px', padding: '2px 8px', fontWeight: 700, fontSize: '11px' }}>{p.code}</span></td>
                      <td style={{ ...td, fontWeight: 600 }}>{p.name}</td>
                      <td style={td}>৳{fmt(p.costPrice)}</td>
                      <td style={{ ...td, fontWeight: 700 }}>৳{fmt(p.salesPrice)}</td>
                      <td style={td}><span style={{ color: margin >= 0 ? green : red, fontWeight: 700 }}>৳{fmt(margin)}</span></td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        <button style={smBtn('#f1f5f9', textDk, border)} onClick={() => openEditProduct(p)}>Edit</button>
                        &nbsp;
                        <button style={smBtn(red)} onClick={() => deleteProduct(p.id)}>Del</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* SALES */}
          <div style={card}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 750 }}>Sales Entries ({sales.length})</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th style={th}>Date</th>
                  <th style={th}>Product</th>
                  <th style={th}>Qty</th>
                  <th style={th}>Revenue</th>
                  <th style={th}>Profit</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: muted }}>Loading…</td></tr>}
                {!loading && sales.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: muted }}>No sales. Click "+ Record Sale".</td></tr>}
                {sales.map(s => (
                  <tr key={s.id}>
                    <td style={td}>{s.date}</td>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{s.productName}</div>
                      <div style={{ fontSize: '11px', color: muted }}>{s.productCode}</div>
                    </td>
                    <td style={td}>{s.qty}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{s.revenue}</td>
                    <td style={td}><span style={{ color: Number(String(s.profit).replace(/[^0-9.-]/g, '')) >= 0 ? green : red, fontWeight: 700 }}>{s.profit}</span></td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <button style={smBtn('#f1f5f9', textDk, border)} onClick={() => openEditSale(s)}>Edit</button>
                      &nbsp;
                      <button style={smBtn(red)} onClick={() => deleteSale(s.id)}>Del</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </div>

      {/* ADD/EDIT PRODUCT MODAL */}
      {showPModal && (
        <Modal title={editPId ? 'Edit Product' : 'Add New Product'} onClose={() => setShowPModal(false)}>
          <div style={twoIn}>
            <div style={frmRow}>
              <label style={lbl}>Product Code *</label>
              <input style={input} placeholder="e.g. PROD-001" value={pForm.code} onChange={e => setPForm({ ...pForm, code: e.target.value })} />
            </div>
            <div style={frmRow}>
              <label style={lbl}>Product Name *</label>
              <input style={input} placeholder="e.g. Sugar 1kg" value={pForm.name} onChange={e => setPForm({ ...pForm, name: e.target.value })} />
            </div>
          </div>
          <div style={twoIn}>
            <div style={frmRow}>
              <label style={lbl}>Costing Price *</label>
              <input style={input} type="number" placeholder="0.00" value={pForm.costPrice} onChange={e => setPForm({ ...pForm, costPrice: e.target.value })} />
            </div>
            <div style={frmRow}>
              <label style={lbl}>Sales Price *</label>
              <input style={input} type="number" placeholder="0.00" value={pForm.salesPrice} onChange={e => setPForm({ ...pForm, salesPrice: e.target.value })} />
            </div>
          </div>
          {pForm.costPrice !== '' && pForm.salesPrice !== '' && (
            <div style={{ padding: '10px 14px', background: '#f0fdf4', borderRadius: '10px', fontSize: '13px', fontWeight: 600, color: green, marginBottom: '8px' }}>
              Margin per unit: ৳{fmt(Number(pForm.salesPrice) - Number(pForm.costPrice))}
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button style={smBtn(white, textDk, border)} onClick={() => setShowPModal(false)}>Cancel</button>
            <button style={btn(brand)} onClick={saveProduct}>{editPId ? 'Update Product' : 'Save Product'}</button>
          </div>
        </Modal>
      )}

      {/* ADD/EDIT SALE MODAL */}
      {showSModal && (
        <Modal title={editSId ? 'Edit Sale Entry' : 'Record Daily Sale'} onClose={() => setShowSModal(false)}>
          <div style={frmRow}>
            <label style={lbl}>Select Product *</label>
            <select style={{ ...input, cursor: 'pointer' }} value={sForm.productCode} onChange={e => setSForm({ ...sForm, productCode: e.target.value })}>
              <option value="">— Choose a product —</option>
              {products.map(p => (
                <option key={p.code} value={p.code}>{p.code} — {p.name}  (Price: ৳{fmt(p.salesPrice)})</option>
              ))}
            </select>
          </div>
          <div style={twoIn}>
            <div style={frmRow}>
              <label style={lbl}>Quantity *</label>
              <input style={input} type="number" placeholder="0" value={sForm.qty} onChange={e => setSForm({ ...sForm, qty: e.target.value })} />
            </div>
            <div style={frmRow}>
              <label style={lbl}>Date *</label>
              <input style={input} type="date" value={sForm.date} onChange={e => setSForm({ ...sForm, date: e.target.value })} />
            </div>
          </div>
          {salePreview && (
            <div style={{ padding: '12px 14px', background: salePreview.profit >= 0 ? '#f0fdf4' : '#fef2f2', borderRadius: '10px', fontSize: '13px', fontWeight: 600, color: salePreview.profit >= 0 ? green : red, marginBottom: '8px' }}>
              Revenue: <strong>৳{fmt(salePreview.rev)}</strong> &nbsp;|&nbsp;
              Cost: <strong>৳{fmt(salePreview.cost)}</strong> &nbsp;|&nbsp;
              Profit: <strong>{salePreview.profit >= 0 ? '+' : ''}৳{fmt(salePreview.profit)}</strong>
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button style={smBtn(white, textDk, border)} onClick={() => setShowSModal(false)}>Cancel</button>
            <button style={btn(green)} onClick={saveSale}>{editSId ? 'Update Sale' : 'Save Sale'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
