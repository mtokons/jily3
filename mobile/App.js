/**
 * Jily Enterprise – Mobile App (Expo / React Native)
 *
 * API URL notes:
 *   Android emulator  → http://10.0.2.2:4000
 *   Physical device   → replace with your machine's LAN IP, e.g. http://192.168.1.10:4000
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';

// ─── Config ──────────────────────────────────────────────────────────────────
// For physical device: use your Mac's LAN IP
// For emulator: use http://10.0.2.2:4000
const API_BASE = 'https://jily3.onrender.com';
const api      = axios.create({ baseURL: API_BASE, timeout: 10000 });
const getToday = () => new Date().toISOString().slice(0, 10);

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtNum = (n) =>
  Number(String(n || 0).replace(/[^0-9.-]/g, '')).toLocaleString('en-BD', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const BDT = (v) => '৳' + fmtNum(v);
const isNeg = (v) => {
  const n = Number(String(v || 0).replace(/[^0-9.-]/g, ''));
  return n < 0;
};

function getMonthOptions() {
  const opts = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = d.toISOString().slice(0, 7);
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    opts.push({ val, label });
  }
  return opts;
}

// ─── Colors ──────────────────────────────────────────────────────────────────
const C = {
  brand : '#4f46e5',
  green : '#16a34a',
  red   : '#dc2626',
  amber : '#d97706',
  teal  : '#0891b2',
  violet: '#7c3aed',
  white : '#ffffff',
  border: '#e2e8f0',
  muted : '#64748b',
  bgPage: '#f1f5f9',
  bgCard: '#ffffff',
  dark  : '#0f172a',
};

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, accent }) {
  return (
    <View style={[s.card, { borderLeftWidth: 4, borderLeftColor: accent, marginBottom: 10 }]}>
      <Text style={[s.statLabel, { color: C.muted }]}>{label}</Text>
      <Text style={[s.statValue, { color: accent }]}>{value}</Text>
    </View>
  );
}

// ─── SectionHeader ───────────────────────────────────────────────────────────
function SectionHeader({ title, count, btnLabel, btnColor, onPress }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}{count !== undefined ? ` (${count})` : ''}</Text>
      {btnLabel && (
        <TouchableOpacity style={[s.addBtn, { backgroundColor: btnColor || C.brand }]} onPress={onPress}>
          <Text style={s.addBtnText}>＋ {btnLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── FieldRow ─────────────────────────────────────────────────────────────────
function FieldRow({ label, children }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ─── DateInput ───────────────────────────────────────────────────────────────
function DateInput({ value, onChange }) {
  return (
    <TextInput
      style={s.input}
      value={value}
      onChangeText={onChange}
      placeholder="YYYY-MM-DD"
      placeholderTextColor={C.muted}
    />
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]           = useState('dashboard');
  const [products, setProducts] = useState([]);
  const [sales, setSales]       = useState([]);
  const [summary, setSummary]   = useState({});
  const [investment, setInvestment] = useState({ entries: [], summary: {} });
  const [buys, setBuys]             = useState([]);
  const [inventory, setInventory]   = useState({ items: [], summary: {} });
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const monthOpts = useMemo(() => getMonthOptions(), []);
  const [selMonth, setSelMonth] = useState(monthOpts[0].val);

  // Product form
  const emptyP = { code: '', name: '', costPrice: '', salesPrice: '' };
  const [pForm, setPForm]   = useState(emptyP);
  const [pModal, setPModal] = useState(false);
  const [editPId, setEditPId] = useState(null);

  // Sale form
  const emptyS = () => ({ productCode: '', qty: '', discount: '0', date: getToday() });
  const [sForm, setSForm]   = useState(emptyS());
  const [sModal, setSModal] = useState(false);
  const [editSId, setEditSId] = useState(null);

  // Investment forms
  const emptyInv = () => ({ amount: '', date: getToday(), note: '' });
  const emptyWdr = () => ({ amount: '', date: getToday() });
  const emptyBuy = () => ({ productCode: '', qty: '', costPrice: '', date: getToday() });
  const [invModal, setInvModal] = useState(false);
  const [wdrModal, setWdrModal] = useState(false);
  const [buyModal, setBuyModal] = useState(false);
  const [invForm, setInvForm]   = useState(emptyInv());
  const [wdrForm, setWdrForm]   = useState(emptyWdr());
  const [buyForm, setBuyForm]   = useState(emptyBuy());

  const productMap = useMemo(() => {
    const m = {};
    products.forEach(p => { m[p.code] = p; });
    return m;
  }, [products]);

  // ── loadAll ──────────────────────────────────────────────────────────────
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
      setError('Cannot reach backend. Check API_BASE in App.js.\n(' + API_BASE + ')');
    } finally {
      setLoading(false);
    }
  }, [selMonth]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Products CRUD ─────────────────────────────────────────────────────────
  const saveProduct = async () => {
    if (!pForm.code || !pForm.name || pForm.costPrice === '' || pForm.salesPrice === '') {
      Alert.alert('Missing fields', 'Please fill in all product fields.'); return;
    }
    try {
      if (editPId) await api.put('/products/' + editPId, pForm);
      else         await api.post('/products', pForm);
      setPModal(false); setPForm(emptyP); setEditPId(null); await loadAll();
    } catch (e) { Alert.alert('Error', 'Product save failed.'); }
  };

  const deleteProduct = (id) => {
    Alert.alert('Delete Product', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.delete('/products/' + id); await loadAll(); }
        catch (e) { Alert.alert('Error', 'Delete failed.'); }
      }},
    ]);
  };

  // ── Sales CRUD ────────────────────────────────────────────────────────────
  const saveSale = async () => {
    if (!sForm.productCode || !sForm.qty || !sForm.date) {
      Alert.alert('Missing fields', 'Product, quantity and date are required.'); return;
    }
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
      setSModal(false); setSForm(emptyS()); setEditSId(null); await loadAll();
    } catch (e) { Alert.alert('Error', 'Sale save failed.'); }
  };

  const deleteSale = (id) => {
    Alert.alert('Delete Sale', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.delete('/sales/' + id); await loadAll(); }
        catch (e) { Alert.alert('Error', 'Delete failed.'); }
      }},
    ]);
  };

  // ── Investment / Withdrawal ────────────────────────────────────────────────
  const saveInvestment = async () => {
    if (!invForm.amount || !invForm.date) {
      Alert.alert('Missing fields', 'Amount and date are required.'); return;
    }
    try {
      await api.post('/investment', { type: 'investment', amount: Number(invForm.amount), date: invForm.date, note: invForm.note });
      setInvModal(false); setInvForm(emptyInv()); await loadAll();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to save investment.');
    }
  };

  const saveWithdrawal = async () => {
    if (!wdrForm.amount || !wdrForm.date) {
      Alert.alert('Missing fields', 'Amount and date are required.'); return;
    }
    try {
      await api.post('/investment', { type: 'withdrawal', amount: Number(wdrForm.amount), date: wdrForm.date });
      setWdrModal(false); setWdrForm(emptyWdr()); await loadAll();
    } catch (e) {
      Alert.alert('Insufficient Balance', e.response?.data?.error || 'Withdrawal failed.');
    }
  };

  const saveBuy = async () => {
    if (!buyForm.productCode || !buyForm.qty || !buyForm.date) {
      Alert.alert('Missing fields', 'Product, quantity and date are required.'); return;
    }
    const prod = productMap[buyForm.productCode];
    const cp   = Number(buyForm.costPrice) || (prod ? prod.costPrice : 0);
    const payload = {
      productCode: buyForm.productCode,
      productName: prod ? prod.name : '',
      qty: Number(buyForm.qty),
      costPrice: cp,
      date: buyForm.date,
    };
    try {
      await api.post('/buys', payload);
      setBuyModal(false); setBuyForm(emptyBuy()); await loadAll();
    } catch (e) { Alert.alert('Error', e.response?.data?.error || 'Purchase save failed.'); }
  };

  // ── Sale preview ─────────────────────────────────────────────────────────
  const salePreview = useMemo(() => {
    if (!sForm.productCode || !sForm.qty) return null;
    const prod = productMap[sForm.productCode];
    if (!prod) return null;
    const q      = Number(sForm.qty) || 0;
    const d      = Number(sForm.discount) || 0;
    const rev    = Number(String(prod.salesPrice).replace(/[^0-9.-]/g,'')) * q - d;
    const cost   = Number(String(prod.costPrice).replace(/[^0-9.-]/g,''))  * q;
    const profit = rev - cost;
    return { rev, cost, profit };
  }, [sForm.productCode, sForm.qty, sForm.discount, productMap]);

  const selMonthLabel = (monthOpts.find(o => o.val === selMonth) || {}).label || '';

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderTabBar = () => (
    <View style={s.tabBar}>
      {[['dashboard','Dashboard'],['products','Products'],['buy','Buy'],['inventory','Inventory'],['sales','Sales'],['investment','Investment']].map(([key,lbl]) => (
        <TouchableOpacity key={key} style={[s.tabBtn, tab === key && s.tabBtnActive]} onPress={() => setTab(key)}>
          <Text style={[s.tabBtnText, tab === key && s.tabBtnTextActive]}>{lbl}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ─── DASHBOARD TAB ───────────────────────────────────────────────────────
  const renderDashboard = () => (
    <ScrollView contentContainerStyle={s.scrollContent}>
      <Text style={s.pageTitle}>Dashboard</Text>
      <Text style={s.subTitle}>Month</Text>
      <View style={s.pickerWrapper}>
        <Picker selectedValue={selMonth} onValueChange={v => setSelMonth(v)} style={{ color: C.dark }}>
          {monthOpts.map(o => <Picker.Item key={o.val} label={o.label} value={o.val} />)}
        </Picker>
      </View>
      {loading ? <ActivityIndicator size="large" color={C.brand} style={{ marginTop: 30 }} /> : (
        <>
          <StatCard label="Today's Sales"              value={summary.todayRevenue || '৳0.00'} accent={C.brand} />
          <StatCard label={selMonthLabel + ' Sales'}   value={summary.monthRevenue || '৳0.00'} accent={C.amber} />
          <StatCard label={selMonthLabel + ' Profit'}  value={summary.monthProfit  || '৳0.00'} accent={isNeg(summary.monthProfit)  ? C.red : C.green} />
          <StatCard label="Total Company Sales"        value={summary.totalRevenue || '৳0.00'} accent={C.teal} />
          <StatCard label="Total Profit / Loss"        value={summary.totalProfit  || '৳0.00'} accent={isNeg(summary.totalProfit)  ? C.red : C.green} />
          <TouchableOpacity style={[s.refreshBtn]} onPress={loadAll}>
            <Text style={s.refreshBtnText}>↻  Refresh Dashboard</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );

  // ─── PRODUCTS TAB ────────────────────────────────────────────────────────
  const renderProducts = () => (
    <View style={{ flex: 1 }}>
      <SectionHeader
        title="Products" count={products.length}
        btnLabel="Add Product" btnColor={C.brand}
        onPress={() => { setPForm(emptyP); setEditPId(null); setPModal(true); }}
      />
      {loading ? <ActivityIndicator size="large" color={C.brand} style={{ marginTop: 30 }} /> : (
        <FlatList
          data={products}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={s.listContent}
          ListEmptyComponent={<Text style={s.emptyText}>No products yet. Tap "+ Add Product".</Text>}
          renderItem={({ item: p }) => {
            const margin = Number(String(p.salesPrice).replace(/[^0-9.-]/g,'')) - Number(String(p.costPrice).replace(/[^0-9.-]/g,''));
            return (
              <View style={s.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <View style={s.codeBadge}><Text style={s.codeBadgeText}>{p.code}</Text></View>
                      <Text style={s.productName}>{p.name}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 16 }}>
                      <Text style={s.priceLabel}>Cost: <Text style={s.priceVal}>{BDT(p.costPrice)}</Text></Text>
                      <Text style={s.priceLabel}>Price: <Text style={[s.priceVal, { color: C.brand }]}>{BDT(p.salesPrice)}</Text></Text>
                      <Text style={s.priceLabel}>Margin: <Text style={[s.priceVal, { color: margin >= 0 ? C.green : C.red }]}>{BDT(margin)}</Text></Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity style={s.editBtn} onPress={() => {
                      setPForm({ code: p.code, name: p.name, costPrice: String(p.costPrice), salesPrice: String(p.salesPrice) });
                      setEditPId(p.id); setPModal(true);
                    }}>
                      <Text style={s.editBtnText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.delBtn} onPress={() => deleteProduct(p.id)}>
                      <Text style={s.delBtnText}>Del</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );

  // ─── SALES TAB ───────────────────────────────────────────────────────────
  const renderSales = () => (
    <View style={{ flex: 1 }}>
      <SectionHeader
        title="Sales Entries" count={sales.length}
        btnLabel="Record Sale" btnColor={C.green}
        onPress={() => { setSForm(emptyS()); setEditSId(null); setSModal(true); }}
      />
      {loading ? <ActivityIndicator size="large" color={C.brand} style={{ marginTop: 30 }} /> : (
        <FlatList
          data={sales}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={s.listContent}
          ListEmptyComponent={<Text style={s.emptyText}>No sales yet. Tap "+ Record Sale".</Text>}
          renderItem={({ item: sale }) => (
            <View style={s.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.productName, { marginBottom: 4 }]}>{sale.productName}</Text>
                  <Text style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{sale.productCode}  ·  {sale.date}  ·  Qty: {sale.qty}</Text>
                  <View style={{ flexDirection: 'row', gap: 14 }}>
                    <Text style={s.priceLabel}>Revenue: <Text style={[s.priceVal, { color: C.brand }]}>{sale.revenue}</Text></Text>
                    <Text style={s.priceLabel}>Profit: <Text style={[s.priceVal, { color: isNeg(sale.profit) ? C.red : C.green }]}>{sale.profit}</Text></Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity style={s.editBtn} onPress={() => {
                    setSForm({ productCode: sale.productCode, qty: String(sale.qty), date: sale.date });
                    setEditSId(sale.id); setSModal(true);
                  }}>
                    <Text style={s.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.delBtn} onPress={() => deleteSale(sale.id)}>
                    <Text style={s.delBtnText}>Del</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
  // ─── INVESTMENT TAB ───────────────────────────────────────────────────────
  const renderInvestment = () => {
    const invSum = investment.summary || {};
    const isNegBal = (invSum.aktersBalanceRaw || 0) < 0;
    return (
      <ScrollView contentContainerStyle={s.scrollContent}>
        <Text style={s.pageTitle}>Investment & Profit</Text>

        {loading ? <ActivityIndicator size="large" color={C.brand} style={{ marginTop: 30 }} /> : (
          <>
            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <TouchableOpacity
                style={[s.addBtn, { backgroundColor: C.brand, flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' }]}
                onPress={() => { setInvForm(emptyInv()); setInvModal(true); }}
              >
                <Text style={s.addBtnText}>💰 Add Investment</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.addBtn, { backgroundColor: C.amber, flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' }]}
                onPress={() => { setWdrForm(emptyWdr()); setWdrModal(true); }}
              >
                <Text style={s.addBtnText}>💸 Akter Withdraw</Text>
              </TouchableOpacity>
            </View>

            {/* Summary Cards */}
            <Text style={[s.subTitle, { marginBottom: 8 }]}>Company Overview</Text>
            <StatCard label="Total Investment (Tokon)"  value={invSum.totalInvestment  || '৳0.00'} accent={C.brand} />
            <StatCard label="Total Buy Cost"            value={invSum.totalBuyCost     || '৳0.00'} accent={C.violet} />
            <StatCard label="Total Sales Revenue"       value={invSum.totalRevenue     || '৳0.00'} accent={C.teal} />
            <StatCard label="Net Profit / Loss"         value={invSum.netProfit        || '৳0.00'} accent={isNeg(invSum.netProfit) ? C.red : C.green} />
            <StatCard label="Cash In Hand"              value={invSum.cashInHand       || '৳0.00'} accent={C.dark} />

            <Text style={[s.subTitle, { marginBottom: 8, marginTop: 8 }]}>Profit Share (50% each)</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <View style={[s.card, { flex: 1, borderLeftWidth: 4, borderLeftColor: C.brand }]}>
                <Text style={[s.statLabel, { color: C.muted }]}>Tokon's Share</Text>
                <Text style={[s.statValue, { color: C.brand, fontSize: 18 }]}>{invSum.tokonsProfit || '৳0.00'}</Text>
              </View>
              <View style={[s.card, { flex: 1, borderLeftWidth: 4, borderLeftColor: C.amber }]}>
                <Text style={[s.statLabel, { color: C.muted }]}>Akter's Share</Text>
                <Text style={[s.statValue, { color: C.amber, fontSize: 18 }]}>{invSum.aktersProfit || '৳0.00'}</Text>
              </View>
            </View>

            <Text style={[s.subTitle, { marginBottom: 8 }]}>Akter's Withdrawal Tracker</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <View style={[s.card, { flex: 1, borderLeftWidth: 4, borderLeftColor: C.red }]}>
                <Text style={[s.statLabel, { color: C.muted }]}>Withdrawn</Text>
                <Text style={[s.statValue, { color: C.red, fontSize: 18 }]}>{invSum.aktersWithdrawals || '৳0.00'}</Text>
              </View>
              <View style={[s.card, { flex: 1, borderLeftWidth: 4, borderLeftColor: isNegBal ? C.red : C.green }]}>
                <Text style={[s.statLabel, { color: C.muted }]}>Available Balance</Text>
                <Text style={[s.statValue, { color: isNegBal ? C.red : C.green, fontSize: 18 }]}>{invSum.aktersBalance || '৳0.00'}</Text>
              </View>
            </View>

            {/* History */}
            <Text style={[s.subTitle, { marginBottom: 8 }]}>Transaction History</Text>
            {(investment.entries || []).length === 0 ? (
              <Text style={s.emptyText}>No entries yet. Add an investment to get started.</Text>
            ) : (
              [...(investment.entries || [])].reverse().map(entry => (
                <View key={entry.id} style={[s.card, { borderLeftWidth: 4, borderLeftColor: entry.type === 'investment' ? C.brand : C.amber }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <View style={[s.codeBadge, { backgroundColor: entry.type === 'investment' ? C.brand + '20' : C.amber + '20' }]}>
                          <Text style={[s.codeBadgeText, { color: entry.type === 'investment' ? C.brand : C.amber }]}>
                            {entry.type === 'investment' ? 'INVEST' : 'WITHDRAW'}
                          </Text>
                        </View>
                        <Text style={s.productName}>{entry.person}</Text>
                      </View>
                      {!!entry.note && <Text style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{entry.note}</Text>}
                      <Text style={{ fontSize: 11, color: C.muted }}>{entry.date}</Text>
                    </View>
                    <Text style={[s.statValue, { fontSize: 16, color: entry.type === 'investment' ? C.brand : C.amber }]}>
                      {entry.type === 'investment' ? '+' : '-'}{BDT(entry.amount)}
                    </Text>
                  </View>
                </View>
              ))
            )}

            <TouchableOpacity style={[s.refreshBtn, { marginTop: 8 }]} onPress={loadAll}>
              <Text style={s.refreshBtnText}>↻  Refresh</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    );
  };
  // ─── BUY TAB ─────────────────────────────────────────────────────────────
  const renderBuy = () => {
    const totalBuyCost = buys.reduce((acc, b) => acc + b.totalCost, 0);
    return (
      <ScrollView contentContainerStyle={s.scrollContent}>
        <Text style={s.pageTitle}>Stock Purchases ({buys.length})</Text>
        {loading ? <ActivityIndicator size="large" color={C.violet} style={{ marginTop: 30 }} /> : (
          <>
            <TouchableOpacity
              style={[s.addBtn, { backgroundColor: C.violet, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginBottom: 16 }]}
              onPress={() => { setBuyForm(emptyBuy()); setBuyModal(true); }}
            >
              <Text style={s.addBtnText}>＋ Record Purchase</Text>
            </TouchableOpacity>
            <StatCard label="Total Purchase Cost" value={BDT(totalBuyCost)} accent={C.violet} />
            {buys.length === 0 ? (
              <Text style={s.emptyText}>No purchases yet. Tap "+ Record Purchase".</Text>
            ) : (
              [...buys].reverse().map(b => (
                <View key={b.id} style={[s.card, { borderLeftWidth: 4, borderLeftColor: C.violet }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.productName}>{b.productName}</Text>
                      <Text style={[s.priceLabel, { marginTop: 2 }]}>{b.productCode}  ·  Qty: {b.qty}  ·  {b.date}</Text>
                      <Text style={s.priceLabel}>Cost/Unit: {BDT(b.costPrice)}</Text>
                    </View>
                    <Text style={[s.statValue, { fontSize: 16, color: C.violet }]}>{BDT(b.totalCost)}</Text>
                  </View>
                </View>
              ))
            )}
            <TouchableOpacity style={[s.refreshBtn, { marginTop: 8 }]} onPress={loadAll}>
              <Text style={s.refreshBtnText}>↻  Refresh</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    );
  };

  const renderBuyModal = () => (
    <Modal visible={buyModal} animationType="slide" transparent onRequestClose={() => setBuyModal(false)}>
      <View style={s.modalOverlay}>
        <View style={s.modalBox}>
          <Text style={s.modalTitle}>Record Stock Purchase</Text>
          <ScrollView>
            <FieldRow label="Select Product *">
              <View style={[s.input, { padding: 0 }]}>
                <Picker
                  selectedValue={buyForm.productCode}
                  onValueChange={v => {
                    const prod = productMap[v];
                    setBuyForm({ ...buyForm, productCode: v, costPrice: prod ? String(prod.costPrice) : '' });
                  }}
                  style={{ color: C.dark }}
                >
                  <Picker.Item label="— Choose a product —" value="" />
                  {products.map(p => (
                    <Picker.Item key={p.code} label={`${p.code} — ${p.name}`} value={p.code} />
                  ))}
                </Picker>
              </View>
            </FieldRow>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <FieldRow label="Quantity *">
                  <TextInput style={s.input} value={buyForm.qty} onChangeText={v => setBuyForm({ ...buyForm, qty: v })} keyboardType="numeric" placeholder="0" placeholderTextColor={C.muted} />
                </FieldRow>
              </View>
              <View style={{ flex: 1 }}>
                <FieldRow label="Cost Price/Unit *">
                  <TextInput style={s.input} value={buyForm.costPrice} onChangeText={v => setBuyForm({ ...buyForm, costPrice: v })} keyboardType="numeric" placeholder="0.00" placeholderTextColor={C.muted} />
                </FieldRow>
              </View>
            </View>
            <FieldRow label="Date *">
              <DateInput value={buyForm.date} onChange={v => setBuyForm({ ...buyForm, date: v })} />
            </FieldRow>
            {!!(buyForm.qty && buyForm.costPrice) && (
              <View style={[s.previewBox, { backgroundColor: '#f5f3ff', borderColor: C.violet }]}>
                <Text style={{ color: C.violet, fontWeight: '700', fontSize: 13 }}>
                  Total Cost: {BDT(Number(buyForm.qty) * Number(buyForm.costPrice))}
                </Text>
              </View>
            )}
          </ScrollView>
          <View style={s.modalActions}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setBuyModal(false)}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: C.violet }]} onPress={saveBuy}>
              <Text style={s.saveBtnText}>Save Purchase</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // ─── PRODUCT MODAL ───────────────────────────────────────────────────────
  const renderProductModal = () => (
    <Modal visible={pModal} animationType="slide" transparent onRequestClose={() => setPModal(false)}>
      <View style={s.modalOverlay}>
        <View style={s.modalBox}>
          <Text style={s.modalTitle}>{editPId ? 'Edit Product' : 'Add New Product'}</Text>
          <ScrollView>
            <FieldRow label="Product Code *">
              <TextInput style={s.input} value={pForm.code} onChangeText={v => setPForm({ ...pForm, code: v })} placeholder="e.g. PROD-001" placeholderTextColor={C.muted} />
            </FieldRow>
            <FieldRow label="Product Name *">
              <TextInput style={s.input} value={pForm.name} onChangeText={v => setPForm({ ...pForm, name: v })} placeholder="e.g. Sugar 1kg" placeholderTextColor={C.muted} />
            </FieldRow>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <FieldRow label="Costing Price *">
                  <TextInput style={s.input} value={pForm.costPrice} onChangeText={v => setPForm({ ...pForm, costPrice: v })} keyboardType="numeric" placeholder="0.00" placeholderTextColor={C.muted} />
                </FieldRow>
              </View>
              <View style={{ flex: 1 }}>
                <FieldRow label="Sales Price *">
                  <TextInput style={s.input} value={pForm.salesPrice} onChangeText={v => setPForm({ ...pForm, salesPrice: v })} keyboardType="numeric" placeholder="0.00" placeholderTextColor={C.muted} />
                </FieldRow>
              </View>
            </View>
            {pForm.costPrice !== '' && pForm.salesPrice !== '' && (
              <View style={[s.previewBox, { backgroundColor: '#f0fdf4', borderColor: C.green }]}>
                <Text style={{ color: C.green, fontWeight: '700', fontSize: 13 }}>
                  Margin per unit: {BDT(Number(pForm.salesPrice) - Number(pForm.costPrice))}
                </Text>
              </View>
            )}
          </ScrollView>
          <View style={s.modalActions}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setPModal(false)}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: C.brand }]} onPress={saveProduct}>
              <Text style={s.saveBtnText}>{editPId ? 'Update Product' : 'Save Product'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // ─── SALE MODAL ──────────────────────────────────────────────────────────
  const renderSaleModal = () => (
    <Modal visible={sModal} animationType="slide" transparent onRequestClose={() => setSModal(false)}>
      <View style={s.modalOverlay}>
        <View style={s.modalBox}>
          <Text style={s.modalTitle}>{editSId ? 'Edit Sale Entry' : 'Record Daily Sale'}</Text>
          <ScrollView>
            <FieldRow label="Select Product *">
              <View style={[s.input, { padding: 0 }]}>
                <Picker
                  selectedValue={sForm.productCode}
                  onValueChange={v => setSForm({ ...sForm, productCode: v })}
                  style={{ color: C.dark }}
                >
                  <Picker.Item label="— Choose a product —" value="" />
                  {products.map(p => (
                    <Picker.Item key={p.code} label={`${p.code} — ${p.name}  (৳${fmtNum(p.salesPrice)})`} value={p.code} />
                  ))}
                </Picker>
              </View>
            </FieldRow>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <FieldRow label="Quantity *">
                  <TextInput style={s.input} value={sForm.qty} onChangeText={v => setSForm({ ...sForm, qty: v })} keyboardType="numeric" placeholder="0" placeholderTextColor={C.muted} />
                </FieldRow>
              </View>
              <View style={{ flex: 1 }}>
                <FieldRow label="Discount (৳)">
                  <TextInput style={s.input} value={sForm.discount} onChangeText={v => setSForm({ ...sForm, discount: v })} keyboardType="numeric" placeholder="0.00" placeholderTextColor={C.muted} />
                </FieldRow>
              </View>
            </View>
            <FieldRow label="Date *">
              <DateInput value={sForm.date} onChange={v => setSForm({ ...sForm, date: v })} />
            </FieldRow>
            {salePreview && (
              <View style={[s.previewBox, { backgroundColor: salePreview.profit >= 0 ? '#f0fdf4' : '#fef2f2', borderColor: salePreview.profit >= 0 ? C.green : C.red }]}>
                <Text style={{ color: salePreview.profit >= 0 ? C.green : C.red, fontWeight: '700', fontSize: 13 }}>
                  Revenue: {BDT(salePreview.rev)}  |  Cost: {BDT(salePreview.cost)}  |  Profit: {salePreview.profit >= 0 ? '+' : ''}{BDT(salePreview.profit)}
                </Text>
              </View>
            )}
          </ScrollView>
          <View style={s.modalActions}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setSModal(false)}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: C.green }]} onPress={saveSale}>
              <Text style={s.saveBtnText}>{editSId ? 'Update Sale' : 'Save Sale'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // ─── INVESTMENT MODAL ─────────────────────────────────────────────────────
  const renderInvestmentModal = () => (
    <Modal visible={invModal} animationType="slide" transparent onRequestClose={() => setInvModal(false)}>
      <View style={s.modalOverlay}>
        <View style={s.modalBox}>
          <Text style={s.modalTitle}>Add Investment (Tokon)</Text>
          <ScrollView>
            <FieldRow label="Amount (৳) *">
              <TextInput style={s.input} value={invForm.amount} onChangeText={v => setInvForm({ ...invForm, amount: v })} keyboardType="numeric" placeholder="0.00" placeholderTextColor={C.muted} />
            </FieldRow>
            <FieldRow label="Date *">
              <DateInput value={invForm.date} onChange={v => setInvForm({ ...invForm, date: v })} />
            </FieldRow>
            <FieldRow label="Note (optional)">
              <TextInput style={s.input} value={invForm.note} onChangeText={v => setInvForm({ ...invForm, note: v })} placeholder="e.g. Bought stock for March" placeholderTextColor={C.muted} />
            </FieldRow>
          </ScrollView>
          <View style={s.modalActions}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setInvModal(false)}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: C.brand }]} onPress={saveInvestment}>
              <Text style={s.saveBtnText}>Save Investment</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // ─── WITHDRAWAL MODAL ─────────────────────────────────────────────────────
  const renderWithdrawalModal = () => (
    <Modal visible={wdrModal} animationType="slide" transparent onRequestClose={() => setWdrModal(false)}>
      <View style={s.modalOverlay}>
        <View style={s.modalBox}>
          <Text style={s.modalTitle}>Akter Withdraw Profit</Text>
          <View style={[s.previewBox, { backgroundColor: '#fffbeb', borderColor: C.amber, marginBottom: 16 }]}>
            <Text style={{ color: C.amber, fontWeight: '700', fontSize: 13 }}>
              Available Balance: {(investment.summary || {}).aktersBalance || '৳0.00'}
            </Text>
            <Text style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>
              Akter can only withdraw from his profit share, not the investment amount.
            </Text>
          </View>
          <ScrollView>
            <FieldRow label="Withdrawal Amount (৳) *">
              <TextInput style={s.input} value={wdrForm.amount} onChangeText={v => setWdrForm({ ...wdrForm, amount: v })} keyboardType="numeric" placeholder="0.00" placeholderTextColor={C.muted} />
            </FieldRow>
            <FieldRow label="Date *">
              <DateInput value={wdrForm.date} onChange={v => setWdrForm({ ...wdrForm, date: v })} />
            </FieldRow>
          </ScrollView>
          <View style={s.modalActions}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setWdrModal(false)}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: C.amber }]} onPress={saveWithdrawal}>
              <Text style={s.saveBtnText}>Confirm Withdrawal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
  // ─── INVENTORY TAB ──────────────────────────────────────────────────────────────
  const renderInventory = () => {
    const invSum2 = inventory.summary || {};
    return (
      <ScrollView contentContainerStyle={s.scrollContent}>
        <Text style={s.pageTitle}>Inventory ({(inventory.items || []).length} products)</Text>
        {loading ? <ActivityIndicator size="large" color={C.violet} style={{ marginTop: 30 }} /> : (
          <>
            <StatCard label="Stock Cost Value"       value={invSum2.totalCostValue       || '৳0.00'} accent={C.violet} />
            <StatCard label="Stock Sales Value"      value={invSum2.totalSalesValue      || '৳0.00'} accent={C.teal} />
            <StatCard label="Potential Profit"       value={invSum2.totalPotentialProfit || '৳0.00'} accent={C.green} />
            {(inventory.items || []).length === 0 ? (
              <Text style={s.emptyText}>No inventory data yet. Add purchases in the Buy tab.</Text>
            ) : (
              (inventory.items || []).map((item, i) => (
                <View key={i} style={[s.card, { borderLeftWidth: 4, borderLeftColor: item.remaining <= 0 ? C.red : item.remaining <= 5 ? C.amber : C.green }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.productName}>{item.name}</Text>
                      <Text style={[s.priceLabel, { marginTop: 2, marginBottom: 6 }]}>{item.code}</Text>
                      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                        <Text style={s.priceLabel}>Bought: <Text style={s.priceVal}>{item.bought}</Text></Text>
                        <Text style={s.priceLabel}>Sold: <Text style={s.priceVal}>{item.sold}</Text></Text>
                        <Text style={s.priceLabel}>Stock: <Text style={[s.priceVal, { color: item.remaining <= 0 ? C.red : item.remaining <= 5 ? C.amber : C.green }]}>{item.remaining}</Text></Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                        <Text style={s.priceLabel}>Cost Val: <Text style={s.priceVal}>{item.costValue}</Text></Text>
                        <Text style={s.priceLabel}>Sales Val: <Text style={s.priceVal}>{item.salesValue}</Text></Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>Pot. Profit</Text>
                      <Text style={[s.statValue, { fontSize: 14, color: item.potentialProfitRaw >= 0 ? C.green : C.red }]}>{item.potentialProfit}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
            <TouchableOpacity style={[s.refreshBtn, { marginTop: 8 }]} onPress={loadAll}>
              <Text style={s.refreshBtnText}>↻  Refresh</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    );
  };
  // ─── Root ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.brand} />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Jily Enterprise</Text>
        <Text style={s.headerSub}>Sales Management</Text>
      </View>

      {/* Error banner */}
      {!!error && (
        <View style={s.errorBanner}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError('')}><Text style={s.errorText}>✕</Text></TouchableOpacity>
        </View>
      )}

      {/* Tab content */}
      <View style={{ flex: 1, backgroundColor: C.bgPage }}>
        {tab === 'dashboard'  && renderDashboard()}
        {tab === 'products'   && renderProducts()}
        {tab === 'buy'        && renderBuy()}
        {tab === 'inventory'  && renderInventory()}
        {tab === 'sales'      && renderSales()}
        {tab === 'investment' && renderInvestment()}
      </View>

      {/* Tab bar */}
      {renderTabBar()}

      {/* Modals */}
      {renderProductModal()}
      {renderSaleModal()}
      {renderBuyModal()}
      {renderInvestmentModal()}
      {renderWithdrawalModal()}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: C.brand },
  header:          { backgroundColor: C.brand, paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  headerTitle:     { fontSize: 20, fontWeight: '900', color: C.white, letterSpacing: -0.5 },
  headerSub:       { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  errorBanner:     { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, padding: 10, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between' },
  errorText:       { color: C.red, fontSize: 12, fontWeight: '600', flex: 1 },
  scrollContent:   { padding: 16, paddingBottom: 30 },
  listContent:     { padding: 12 },
  pageTitle:       { fontSize: 18, fontWeight: '800', color: C.dark, marginBottom: 14 },
  subTitle:        { fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  pickerWrapper:   { backgroundColor: C.white, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, marginBottom: 16 },
  card:            { backgroundColor: C.bgCard, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  statLabel:       { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  statValue:       { fontSize: 24, fontWeight: '800' },
  sectionHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, backgroundColor: C.bgPage, borderBottomWidth: 1, borderColor: C.border },
  sectionTitle:    { fontSize: 16, fontWeight: '800', color: C.dark },
  addBtn:          { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  addBtnText:      { color: C.white, fontWeight: '700', fontSize: 13 },
  codeBadge:       { backgroundColor: C.brand + '20', borderRadius: 6, paddingVertical: 2, paddingHorizontal: 8 },
  codeBadgeText:   { color: C.brand, fontWeight: '700', fontSize: 11 },
  productName:     { fontSize: 14, fontWeight: '700', color: C.dark },
  priceLabel:      { fontSize: 12, color: C.muted },
  priceVal:        { fontSize: 12, fontWeight: '700', color: C.dark },
  editBtn:         { backgroundColor: '#f1f5f9', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: C.border },
  editBtnText:     { fontSize: 12, fontWeight: '600', color: C.dark },
  delBtn:          { backgroundColor: C.red, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  delBtnText:      { fontSize: 12, fontWeight: '600', color: C.white },
  emptyText:       { textAlign: 'center', color: C.muted, marginTop: 40, fontSize: 14 },
  tabBar:          { flexDirection: 'row', backgroundColor: C.white, borderTopWidth: 1, borderColor: C.border },
  tabBtn:          { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  tabBtnActive:    { borderTopWidth: 3, borderTopColor: C.brand },
  tabBtnText:      { fontSize: 13, fontWeight: '600', color: C.muted },
  tabBtnTextActive:{ color: C.brand, fontWeight: '800' },
  refreshBtn:      { backgroundColor: C.brand, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  refreshBtnText:  { color: C.white, fontSize: 14, fontWeight: '700' },
  // Modal
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' },
  modalBox:        { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  modalTitle:      { fontSize: 18, fontWeight: '800', color: C.dark, marginBottom: 20 },
  fieldLabel:      { fontSize: 13, fontWeight: '600', color: C.dark, marginBottom: 6 },
  input:           { backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: C.border, borderRadius: 10, padding: 11, fontSize: 14, color: C.dark },
  previewBox:      { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 8 },
  modalActions:    { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  cancelBtn:       { backgroundColor: '#f1f5f9', borderRadius: 10, paddingVertical: 11, paddingHorizontal: 20, borderWidth: 1, borderColor: C.border },
  cancelBtnText:   { fontSize: 14, fontWeight: '600', color: C.dark },
  saveBtn:         { borderRadius: 10, paddingVertical: 11, paddingHorizontal: 22 },
  saveBtnText:     { color: C.white, fontSize: 14, fontWeight: '700' },
});
