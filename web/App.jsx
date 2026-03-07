import React, { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';

const API_BASE = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? 'http://localhost:4000'
  : 'https://jily3.onrender.com';
const api = axios.create({ baseURL: API_BASE });
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
  // handle both raw numbers and pre-formatted BDT strings from API
  const display = typeof value === 'string' && value.startsWith('৳') ? value : '৳' + fmt(value);
  return (
    <div style={{ ...card, borderLeft: '4px solid ' + accent, padding: '18px 20px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
      <div style={{ fontSize: '26px', fontWeight: 800, color: accent, margin: '4px 0 0' }}>{display}</div>
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

// ─── ProductTable ─────────────────────────────────────────────────────────────
function ProductTable({ products, loading, openEdit, onDelete }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
      <thead>
        <tr>
          <th style={th}>Code</th><th style={th}>Name</th><th style={th}>Cost</th>
          <th style={th}>Price</th><th style={th}>Margin</th><th style={th}></th>
        </tr>
      </thead>
      <tbody>
        {loading && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: muted }}>Loading…</td></tr>}
        {!loading && products.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: muted }}>No products. Click "+ Add Product".</td></tr>}
        {products.map(p => {
          const margin = p.salesPrice - p.costPrice;
          return (
            <tr key={p.id}>
              <td style={td}><span style={{ background: brand + '15', color: brand, borderRadius: '6px', padding: '2px 8px', fontWeight: 700, fontSize: '11px' }}>{p.code}</span></td>
              <td style={{ ...td, fontWeight: 600 }}>{p.name}</td>
              <td style={td}>৳{fmt(p.costPrice)}</td>
              <td style={{ ...td, fontWeight: 700 }}>৳{fmt(p.salesPrice)}</td>
              <td style={td}><span style={{ color: margin >= 0 ? green : red, fontWeight: 700 }}>৳{fmt(margin)}</span></td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                <button style={smBtn('#f1f5f9', textDk, border)} onClick={() => openEdit(p)}>Edit</button>
                &nbsp;<button style={smBtn(red)} onClick={() => onDelete(p.id)}>Del</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── SalesTable ───────────────────────────────────────────────────────────────
function SalesTable({ sales, loading, openEdit, onDelete }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
      <thead>
        <tr>
          <th style={th}>Date</th><th style={th}>Product</th><th style={th}>Qty</th>
          <th style={th}>Discount</th><th style={th}>Revenue</th><th style={th}>Profit</th><th style={th}></th>
        </tr>
      </thead>
      <tbody>
        {loading && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: muted }}>Loading…</td></tr>}
        {!loading && sales.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: muted }}>No sales. Click "+ Record Sale".</td></tr>}
        {sales.map(s => (
          <tr key={s.id}>
            <td style={td}>{s.date}</td>
            <td style={td}><div style={{ fontWeight: 600 }}>{s.productName}</div><div style={{ fontSize: '11px', color: muted }}>{s.productCode}</div></td>
            <td style={td}>{s.qty}</td>
            <td style={{ ...td, color: red }}>{s.discountRaw > 0 ? s.discount : '—'}</td>
            <td style={{ ...td, fontWeight: 700 }}>{s.revenue}</td>
            <td style={td}><span style={{ color: Number(String(s.profit).replace(/[^0-9.-]/g, '')) >= 0 ? green : red, fontWeight: 700 }}>{s.profit}</span></td>
            <td style={{ ...td, whiteSpace: 'nowrap' }}>
              <button style={smBtn('#f1f5f9', textDk, border)} onClick={() => openEdit(s)}>Edit</button>
              &nbsp;<button style={smBtn(red)} onClick={() => onDelete(s.id)}>Del</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]           = useState('dashboard');
  const [products, setProducts] = useState([]);
  const [sales, setSales]       = useState([]);
  const [summary, setSummary]   = useState({ todayRevenue: 0, totalRevenue: 0, totalProfit: 0, monthRevenue: 0, monthProfit: 0 });
  const [investment, setInvestment] = useState({ entries: [], summary: {} });
  const [buys, setBuys]             = useState([]);
  const [inventory, setInventory]   = useState({ items: [], summary: {} });
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const monthOpts = useMemo(() => getMonthOptions(), []);
  const [selMonth, setSelMonth] = useState(monthOpts[0].val);

  const [showPModal, setShowPModal] = useState(false);
  const [showSModal, setShowSModal] = useState(false);
  const [showInvModal, setShowInvModal] = useState(false);
  const [showWdrModal, setShowWdrModal] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);

  const emptyP = { code: '', name: '', costPrice: '', salesPrice: '' };
  const emptyS = () => ({ productCode: '', qty: '', discount: '0', date: new Date().toISOString().slice(0, 10) });
  const emptyInv = () => ({ amount: '', date: TODAY, note: '' });
  const emptyWdr = () => ({ amount: '', date: TODAY });
  const emptyBuy = () => ({ productCode: '', qty: '', costPrice: '', date: TODAY });
  const [buyForm, setBuyForm] = useState(emptyBuy());
  const [pForm, setPForm] = useState(emptyP);
  const [sForm, setSForm] = useState(emptyS);
  const [invForm, setInvForm] = useState(emptyInv());
  const [wdrForm, setWdrForm] = useState(emptyWdr());
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
      const [pr, sr, smr, ir, br, inv] = await Promise.all([
        api.get('/products'),
        api.get('/sales'),
        api.get('/summary?month=' + selMonth),
        api.get('/investment'),
        api.get('/buys'),
        api.get('/inventory'),
      ]);
      setProducts(pr.data || []);
      setSales(sr.data || []);
      setSummary(smr.data || {});
      setInvestment(ir.data || { entries: [], summary: {} });
      setBuys(br.data || []);
      setInventory(inv.data || { items: [], summary: {} });
      setError('');
    } catch (e) {
      setError((e.response && e.response.data && e.response.data.error) || 'Failed to load. Is the backend running?');
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
      discount: Number(sForm.discount) || 0,
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
    setSForm({ productCode: s.productCode, qty: s.qty, discount: String(s.discountRaw || 0), date: s.date });
    setEditSId(s.id); setShowSModal(true);
  };

  // Investment / Withdrawal
  const saveInvestment = async () => {
    if (!invForm.amount || !invForm.date) return;
    try {
      await api.post('/investment', { type: 'investment', amount: Number(invForm.amount), date: invForm.date, note: invForm.note });
      setShowInvModal(false); setInvForm(emptyInv()); await loadAll();
    } catch (e) { setError((e.response && e.response.data && e.response.data.error) || 'Failed to save investment.'); }
  };

  const saveWithdrawal = async () => {
    if (!wdrForm.amount || !wdrForm.date) return;
    try {
      await api.post('/investment', { type: 'withdrawal', amount: Number(wdrForm.amount), date: wdrForm.date });
      setShowWdrModal(false); setWdrForm(emptyWdr()); await loadAll();
    } catch (e) { setError((e.response && e.response.data && e.response.data.error) || 'Withdrawal failed — check available balance.'); }
  };

  const saveBuy = async () => {
    if (!buyForm.productCode || !buyForm.qty || !buyForm.date) return;
    const prod = productMap[buyForm.productCode];
    const cp = Number(buyForm.costPrice) || (prod ? prod.costPrice : 0);
    const payload = {
      productCode: buyForm.productCode,
      productName: prod ? prod.name : '',
      qty: Number(buyForm.qty),
      costPrice: cp,
      date: buyForm.date,
    };
    try {
      await api.post('/buys', payload);
      setShowBuyModal(false); setBuyForm(emptyBuy()); await loadAll();
    } catch (e) { setError((e.response && e.response.data && e.response.data.error) || 'Purchase save failed.'); }
  };

  // Inline sale preview
  const salePreview = (() => {
    if (!sForm.productCode || !sForm.qty) return null;
    const prod = productMap[sForm.productCode];
    if (!prod) return null;
    const q = Number(sForm.qty) || 0;
    const d = Number(sForm.discount) || 0;
    const rev = (prod.salesPrice * q) - d;
    const cost = prod.costPrice * q;
    const profit = rev - cost;
    return { rev, cost, profit };
  })();

  const selMonthLabel = (monthOpts.find(o => o.val === selMonth) || {}).label || '';
  const invSum = investment.summary || {};
  const invData = inventory || { items: [], summary: {} };

  return (
    <div style={{ minHeight: '100vh', background: bgPage, fontFamily: "'Inter', system-ui, sans-serif", color: textDk }}>

      {/* NAV */}
      <nav style={{ background: brand, padding: '0 28px', display: 'flex', alignItems: 'center', height: '62px', boxShadow: '0 3px 12px rgba(79,70,229,.4)', gap: '0' }}>
        <span style={{ fontSize: '22px', fontWeight: 900, color: white, letterSpacing: '-.5px', marginRight: '14px' }}>Jily Enterprise</span>
        {/* Tab links */}
        {[['dashboard','Dashboard'],['products','Products'],['buy','Buy'],['inventory','Inventory'],['sales','Sales'],['investment','Investment']].map(([key,lbl]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            background: 'none', border: 'none', color: tab === key ? white : 'rgba(255,255,255,.65)',
            fontWeight: tab === key ? 800 : 600, fontSize: '14px', cursor: 'pointer', padding: '0 16px',
            height: '62px', borderBottom: tab === key ? '3px solid white' : '3px solid transparent',
          }}>{lbl}</button>
        ))}
        <button onClick={loadAll} style={{ marginLeft: 'auto', ...smBtn('rgba(255,255,255,.15)', white, null), padding: '8px 16px' }}>↻ Refresh</button>
      </nav>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '28px 20px' }}>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: red, borderRadius: '10px', padding: '12px 16px', marginBottom: '18px', fontSize: '13px', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            <span>{error}</span>
            <span style={{ cursor: 'pointer' }} onClick={() => setError('')}>✕</span>
          </div>
        )}

        {/* ── DASHBOARD ─────────────────────────────────────────────────────── */}
        {tab === 'dashboard' && (<>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px', marginBottom: '28px' }}>
            <StatCard label="Today's Sales"             value={summary.todayRevenue}  accent={brand} />
            <StatCard label={selMonthLabel + ' Sales'}  value={summary.monthRevenue}  accent={amber} />
            <StatCard label={selMonthLabel + ' Profit'} value={summary.monthProfit}   accent={green} />
            <StatCard label="Total Company Sales"       value={summary.totalRevenue}  accent={teal} />
            <StatCard label="Total Profit / Loss"       value={summary.totalProfit}   accent={green} />
          </div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '28px', flexWrap: 'wrap' }}>
            <button style={btn(brand)} onClick={() => { setPForm(emptyP); setEditPId(null); setShowPModal(true); }}>＋ Add Product</button>
            <button style={btn(green)} onClick={() => { setSForm(emptyS()); setEditSId(null); setShowSModal(true); }}>＋ Record Sale</button>
            <button style={btn(amber)} onClick={() => { setShowInvModal(true); }}>💰 Add Investment</button>
            <button style={btn('#92400e')} onClick={() => { setShowWdrModal(true); }}>💸 Akter Withdraw</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '20px' }}>
            <ProductTable products={products} loading={loading} openEdit={(p) => { setPForm({ code: p.code, name: p.name, costPrice: p.costPrice, salesPrice: p.salesPrice }); setEditPId(p.id); setShowPModal(true); }} onDelete={async id => { if (!window.confirm('Delete this product?')) return; try { await api.delete('/products/' + id); await loadAll(); } catch(e){setError('Delete failed.');} }} />
            <SalesTable sales={sales} loading={loading} openEdit={(s) => { setSForm({ productCode: s.productCode, qty: s.qty, discount: String(s.discountRaw||0), date: s.date }); setEditSId(s.id); setShowSModal(true); }} onDelete={async id => { if (!window.confirm('Delete this sale?')) return; try { await api.delete('/sales/' + id); await loadAll(); } catch(e){setError('Delete failed.');} }} />
          </div>
        </>)}

        {/* ── PRODUCTS ──────────────────────────────────────────────────────── */}
        {tab === 'products' && (<>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
            <span style={{ fontSize: '18px', fontWeight: 800 }}>Products ({products.length})</span>
            <button style={{ ...btn(brand), marginLeft: 'auto' }} onClick={() => { setPForm(emptyP); setEditPId(null); setShowPModal(true); }}>＋ Add Product</button>
          </div>
          <div style={card}>
            <ProductTable products={products} loading={loading} openEdit={(p) => { setPForm({ code: p.code, name: p.name, costPrice: p.costPrice, salesPrice: p.salesPrice }); setEditPId(p.id); setShowPModal(true); }} onDelete={async id => { if (!window.confirm('Delete this product?')) return; try { await api.delete('/products/' + id); await loadAll(); } catch(e){setError('Delete failed.');} }} />
          </div>
        </>)}

        {/* ── INVENTORY ────────────────────────────────────────────────────── */}
        {tab === 'inventory' && (() => {
          const invSum2 = invData.summary || {};
          return (<>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
              <span style={{ fontSize: '18px', fontWeight: 800 }}>Inventory ({(invData.items || []).length} products)</span>
              <button onClick={loadAll} style={{ ...smBtn('rgba(79,70,229,.1)', brand, null), marginLeft: 'auto', padding: '8px 16px' }}>↻ Refresh</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
              <StatCard label="Stock Cost Value"       value={invSum2.totalCostValue      || '৳0.00'} accent={'#7c3aed'} />
              <StatCard label="Stock Sales Value"      value={invSum2.totalSalesValue     || '৳0.00'} accent={teal} />
              <StatCard label="Potential Profit"       value={invSum2.totalPotentialProfit|| '৳0.00'} accent={green} />
            </div>
            <div style={card}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th style={th}>Product</th><th style={th}>Bought</th><th style={th}>Sold</th>
                    <th style={th}>Remaining</th><th style={th}>Cost Value</th><th style={th}>Sales Value</th><th style={th}>Pot. Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: muted }}>Loading…</td></tr>}
                  {!loading && (invData.items || []).length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: muted }}>No inventory data yet.</td></tr>}
                  {(invData.items || []).map((item, i) => (
                    <tr key={i}>
                      <td style={td}><div style={{ fontWeight: 600 }}>{item.name}</div><div style={{ fontSize: '11px', color: muted }}>{item.code}</div></td>
                      <td style={td}>{item.bought}</td>
                      <td style={td}>{item.sold}</td>
                      <td style={{ ...td, fontWeight: 800, color: item.remaining <= 0 ? red : item.remaining <= 5 ? amber : green }}>{item.remaining}</td>
                      <td style={td}>{item.costValue}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{item.salesValue}</td>
                      <td style={td}><span style={{ color: item.potentialProfitRaw >= 0 ? green : red, fontWeight: 700 }}>{item.potentialProfit}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>);
        })()}

        {/* ── SALES ─────────────────────────────────────────────────────────── */}
        {tab === 'sales' && (<>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
            <span style={{ fontSize: '18px', fontWeight: 800 }}>Sales Entries ({sales.length})</span>
            <button style={{ ...btn(green), marginLeft: 'auto' }} onClick={() => { setSForm(emptyS()); setEditSId(null); setShowSModal(true); }}>＋ Record Sale</button>
          </div>
          <div style={card}>
            <SalesTable sales={sales} loading={loading} openEdit={(s) => { setSForm({ productCode: s.productCode, qty: s.qty, discount: String(s.discountRaw||0), date: s.date }); setEditSId(s.id); setShowSModal(true); }} onDelete={async id => { if (!window.confirm('Delete this sale?')) return; try { await api.delete('/sales/' + id); await loadAll(); } catch(e){setError('Delete failed.');} }} />
          </div>
        </>)}

        {/* ── BUY ──────────────────────────────────────────────────────────── */}
        {tab === 'buy' && (<>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
            <span style={{ fontSize: '18px', fontWeight: 800 }}>Stock Purchases ({buys.length})</span>
            <button style={{ ...btn('#7c3aed'), marginLeft: 'auto' }} onClick={() => { setBuyForm(emptyBuy()); setShowBuyModal(true); }}>＋ Record Purchase</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <StatCard label="Total Purchase Cost" value={buys.reduce((a, b) => a + b.totalCost, 0)} accent={'#7c3aed'} />
          </div>
          <div style={card}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th style={th}>Date</th><th style={th}>Product</th><th style={th}>Qty</th>
                  <th style={th}>Cost/Unit</th><th style={th}>Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: muted }}>Loading…</td></tr>}
                {!loading && buys.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: muted }}>No purchases yet. Click "+ Record Purchase".</td></tr>}
                {[...buys].reverse().map(b => (
                  <tr key={b.id}>
                    <td style={td}>{b.date}</td>
                    <td style={td}><div style={{ fontWeight: 600 }}>{b.productName}</div><div style={{ fontSize: '11px', color: muted }}>{b.productCode}</div></td>
                    <td style={td}>{b.qty}</td>
                    <td style={td}>৳{fmt(b.costPrice)}</td>
                    <td style={{ ...td, fontWeight: 700, color: '#7c3aed' }}>৳{fmt(b.totalCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>)}

        {/* ── INVESTMENT ────────────────────────────────────────────────────── */}
        {tab === 'investment' && (<>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '18px', fontWeight: 800 }}>Investment & Profit Sharing</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button style={btn(brand)} onClick={() => { setInvForm(emptyInv()); setShowInvModal(true); }}>💰 Add Investment</button>
              <button style={btn(amber)} onClick={() => { setWdrForm(emptyWdr()); setShowWdrModal(true); }}>💸 Akter Withdraw</button>
            </div>
          </div>

          {/* Summary grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <StatCard label="Total Investment (Tokon)" value={invSum.totalInvestment  || '৳0.00'} accent={brand} />
            <StatCard label="Total Buy Cost"           value={invSum.totalBuyCost     || '৳0.00'} accent={'#7c3aed'} />
            <StatCard label="Total Sales Revenue"      value={invSum.totalRevenue     || '৳0.00'} accent={teal} />
            <StatCard label="Net Profit / Loss"        value={invSum.netProfit        || '৳0.00'} accent={green} />
            <StatCard label="Cash In Hand"             value={invSum.cashInHand       || '৳0.00'} accent={textDk} />
          </div>

          {/* Profit share */}
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '12px', marginTop: 0 }}>Profit Share (50 / 50)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
            <div style={{ ...card, borderLeft: '4px solid ' + brand }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Tokon's Share</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: brand, margin: '4px 0 0' }}>{invSum.tokonsProfit || '৳0.00'}</div>
            </div>
            <div style={{ ...card, borderLeft: '4px solid ' + amber }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Akter's Share</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: amber, margin: '4px 0 0' }}>{invSum.aktersProfit || '৳0.00'}</div>
            </div>
          </div>

          {/* Withdrawal tracker */}
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '12px', marginTop: 0 }}>Akter's Withdrawal Tracker</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
            <div style={{ ...card, borderLeft: '4px solid ' + red }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Total Withdrawn</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: red, margin: '4px 0 0' }}>{invSum.aktersWithdrawals || '৳0.00'}</div>
            </div>
            <div style={{ ...card, borderLeft: '4px solid ' + green }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Available Balance</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: (invSum.aktersBalanceRaw || 0) < 0 ? red : green, margin: '4px 0 0' }}>{invSum.aktersBalance || '৳0.00'}</div>
            </div>
          </div>

          {/* Transaction history */}
          <div style={card}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 750 }}>Transaction History ({(investment.entries || []).length})</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th style={th}>Date</th>
                  <th style={th}>Type</th>
                  <th style={th}>Person</th>
                  <th style={th}>Amount</th>
                  <th style={th}>Note</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: muted }}>Loading…</td></tr>}
                {!loading && (investment.entries || []).length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: muted }}>No entries yet. Add an investment to get started.</td></tr>}
                {[...(investment.entries || [])].reverse().map(e => (
                  <tr key={e.id}>
                    <td style={td}>{e.date}</td>
                    <td style={td}>
                      <span style={{ background: e.type === 'investment' ? brand + '15' : amber + '25', color: e.type === 'investment' ? brand : amber, borderRadius: '6px', padding: '2px 8px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>
                        {e.type}
                      </span>
                    </td>
                    <td style={{ ...td, fontWeight: 600 }}>{e.person}</td>
                    <td style={{ ...td, fontWeight: 700, color: e.type === 'investment' ? brand : amber }}>
                      {e.type === 'investment' ? '+' : '-'}৳{fmt(e.amount)}
                    </td>
                    <td style={{ ...td, color: muted }}>{e.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>)}

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
              <label style={lbl}>Discount (৳)</label>
              <input style={input} type="number" placeholder="0.00" value={sForm.discount} onChange={e => setSForm({ ...sForm, discount: e.target.value })} />
            </div>
          </div>
          <div style={frmRow}>
            <label style={lbl}>Date *</label>
            <input style={input} type="date" value={sForm.date} onChange={e => setSForm({ ...sForm, date: e.target.value })} />
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

      {/* ADD INVESTMENT MODAL */}
      {showInvModal && (
        <Modal title="Add Investment (Tokon)" onClose={() => setShowInvModal(false)}>
          <div style={frmRow}>
            <label style={lbl}>Amount (৳) *</label>
            <input style={input} type="number" placeholder="0.00" value={invForm.amount} onChange={e => setInvForm({ ...invForm, amount: e.target.value })} />
          </div>
          <div style={frmRow}>
            <label style={lbl}>Date *</label>
            <input style={input} type="date" value={invForm.date} onChange={e => setInvForm({ ...invForm, date: e.target.value })} />
          </div>
          <div style={frmRow}>
            <label style={lbl}>Note (optional)</label>
            <input style={input} placeholder="e.g. Bought stock for March" value={invForm.note} onChange={e => setInvForm({ ...invForm, note: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button style={smBtn(white, textDk, border)} onClick={() => setShowInvModal(false)}>Cancel</button>
            <button style={btn(brand)} onClick={saveInvestment}>Save Investment</button>
          </div>
        </Modal>
      )}

      {/* BUY MODAL */}
      {showBuyModal && (
        <Modal title="Record Stock Purchase" onClose={() => setShowBuyModal(false)}>
          <div style={frmRow}>
            <label style={lbl}>Select Product *</label>
            <select style={{ ...input, cursor: 'pointer' }} value={buyForm.productCode} onChange={e => {
              const prod = productMap[e.target.value];
              setBuyForm({ ...buyForm, productCode: e.target.value, costPrice: prod ? String(prod.costPrice) : '' });
            }}>
              <option value="">— Choose a product —</option>
              {products.map(p => (
                <option key={p.code} value={p.code}>{p.code} — {p.name}</option>
              ))}
            </select>
          </div>
          <div style={twoIn}>
            <div style={frmRow}>
              <label style={lbl}>Quantity *</label>
              <input style={input} type="number" placeholder="0" value={buyForm.qty} onChange={e => setBuyForm({ ...buyForm, qty: e.target.value })} />
            </div>
            <div style={frmRow}>
              <label style={lbl}>Cost Price/Unit *</label>
              <input style={input} type="number" placeholder="0.00" value={buyForm.costPrice} onChange={e => setBuyForm({ ...buyForm, costPrice: e.target.value })} />
            </div>
          </div>
          <div style={frmRow}>
            <label style={lbl}>Date *</label>
            <input style={input} type="date" value={buyForm.date} onChange={e => setBuyForm({ ...buyForm, date: e.target.value })} />
          </div>
          {buyForm.qty && buyForm.costPrice && (
            <div style={{ padding: '10px 14px', background: '#f5f3ff', borderRadius: '10px', fontSize: '13px', fontWeight: 600, color: '#7c3aed', marginBottom: '8px' }}>
              Total Cost: ৳{fmt(Number(buyForm.qty) * Number(buyForm.costPrice))}
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button style={smBtn(white, textDk, border)} onClick={() => setShowBuyModal(false)}>Cancel</button>
            <button style={btn('#7c3aed')} onClick={saveBuy}>Save Purchase</button>
          </div>
        </Modal>
      )}

      {/* WITHDRAWAL MODAL */}
      {showWdrModal && (
        <Modal title="Akter Withdraw Profit" onClose={() => setShowWdrModal(false)}>
          <div style={{ padding: '12px 14px', background: '#fffbeb', border: '1px solid ' + amber, borderRadius: '10px', marginBottom: '16px', fontSize: '13px' }}>
            <div style={{ fontWeight: 700, color: amber }}>Available Balance: {invSum.aktersBalance || '৳0.00'}</div>
            <div style={{ color: muted, marginTop: '4px' }}>Akter can only withdraw from his profit share, not the investment amount.</div>
          </div>
          <div style={frmRow}>
            <label style={lbl}>Withdrawal Amount (৳) *</label>
            <input style={input} type="number" placeholder="0.00" value={wdrForm.amount} onChange={e => setWdrForm({ ...wdrForm, amount: e.target.value })} />
          </div>
          <div style={frmRow}>
            <label style={lbl}>Date *</label>
            <input style={input} type="date" value={wdrForm.date} onChange={e => setWdrForm({ ...wdrForm, date: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button style={smBtn(white, textDk, border)} onClick={() => setShowWdrModal(false)}>Cancel</button>
            <button style={btn(amber)} onClick={saveWithdrawal}>Confirm Withdrawal</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
