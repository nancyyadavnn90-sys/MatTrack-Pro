import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Search, Camera, X, Check, ArrowRightLeft, Settings2, CheckCircle2,
  Download, Layers, User
} from 'lucide-react';

const API = 'http://localhost:5000/api';

const getAuthHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

export default function Inventory() {
  const [activeTab, setActiveTab] = useState('put-away');
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const scannerRef = useRef(null);
  
  // ─── TAB STATES ─────────────────────────────────────────────
  
  // 1. Put-Away
  const [putAwayScan, setPutAwayScan] = useState('');
  const [putAwayLabel, setPutAwayLabel] = useState(null);
  const [pendingPutAway, setPendingPutAway] = useState([]);
  const [putAwayForm, setPutAwayForm] = useState({ store_id: '', bin: '' });
  
  // 2. Query
  const [queryScan, setQueryScan] = useState('');
  const [queryFilters, setQueryFilters] = useState({
    search: '', store_id: '', bin: '', batch_no: '', status: ''
  });
  const [queryResults, setQueryResults] = useState([]);
  
  // 3. Stock positions sheet
  const [fgFilters, setFgFilters] = useState({ search: '', category: 'All' });
  const [fgResults, setFgResults] = useState([]);
  
  // 4. Transfer
  const [transferScan, setTransferScan] = useState('');
  const [transferLabel, setTransferLabel] = useState(null);
  const [transferForm, setTransferForm] = useState({ store_id: '', bin: '', reason: '' });
  
  // 5. Adjust
  const [adjustFilters, setAdjustFilters] = useState({ search: '' });
  const [adjustList, setAdjustList] = useState([]);
  const [adjustLabel, setAdjustLabel] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ new_qty: '', reason: '' });
  
  // 6. Ledger
  const [ledgerFilters, setLedgerFilters] = useState({
    date_from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    date_to: new Date().toISOString().split('T')[0],
    transaction_type: 'All',
    item_code: ''
  });
  const [ledgerResults, setLedgerResults] = useState([]);
  
  // 7. Issue
  const [issueScan, setIssueScan] = useState('');
  const [issueLabel, setIssueLabel] = useState(null);
  const [issueForm, setIssueForm] = useState({ issue_qty: '', work_order_no: '', remarks: '' });

  // ─── INITIAL EFFECTS ─────────────────────────────────────────
  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    if (activeTab === 'put-away') {
      fetchPendingPutAway();
    } else if (activeTab === 'query') {
      fetchQueryResults();
    } else if (activeTab === 'fg-stock') {
      fetchFgResults();
    } else if (activeTab === 'adjust') {
      fetchAdjustList();
    } else if (activeTab === 'ledger') {
      fetchLedgerResults();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ─── API FETCHERS ────────────────────────────────────────────
  const fetchStores = async () => {
    try {
      const res = await axios.get(`${API}/grn/stores`, getAuthHeader());
      setStores(res.data);
    } catch (err) {
      console.error('Error fetching stores:', err);
    }
  };

  const fetchPendingPutAway = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/inventory/labels?status=Available`, getAuthHeader());
      // Filter out labels that already have a bin
      const pending = res.data.filter(item => !item.bin || item.bin.trim() === '');
      setPendingPutAway(pending);
    } catch (err) {
      console.error('Error fetching pending put-away:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchQueryResults = async () => {
    setLoading(true);
    try {
      const { search, store_id, bin, batch_no, status } = queryFilters;
      const res = await axios.get(`${API}/inventory/labels`, {
        ...getAuthHeader(),
        params: { search: search || queryScan, store_id, bin, batch_no, status }
      });
      setQueryResults(res.data);
    } catch (err) {
      console.error('Error querying inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFgResults = async () => {
    setLoading(true);
    try {
      const params = { search: fgFilters.search };
      if (fgFilters.category && fgFilters.category !== 'All') {
        params.category = fgFilters.category;
      }
      const res = await axios.get(`${API}/inventory/positions`, {
        ...getAuthHeader(),
        params
      });
      setFgResults(res.data);
    } catch (err) {
      console.error('Error fetching stock positions:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdjustList = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/inventory/labels`, {
        ...getAuthHeader(),
        params: { search: adjustFilters.search, status: 'Available' }
      });
      setAdjustList(res.data);
    } catch (err) {
      console.error('Error fetching adjust list:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLedgerResults = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/inventory/ledger`, {
        ...getAuthHeader(),
        params: {
          date_from: ledgerFilters.date_from,
          date_to: ledgerFilters.date_to,
          transaction_type: ledgerFilters.transaction_type,
          item_code: ledgerFilters.item_code
        }
      });
      setLedgerResults(res.data);
    } catch (err) {
      console.error('Error fetching ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  // ─── SCANNER HANDLERS ────────────────────────────────────────
  const startScanner = (callback) => {
    setShowScanner(true);
    setTimeout(() => {
      const html5QrCode = new Html5Qrcode('qr-reader');
      scannerRef.current = html5QrCode;
      html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          let scannedValue = decodedText;
          try {
            const parsed = JSON.parse(decodedText);
            if (parsed.grn) scannedValue = parsed.grn;
            else if (parsed.label) scannedValue = parsed.label;
          } catch (e) {
            // Not JSON
          }
          callback(scannedValue);
          stopScanner();
        },
        (errorMessage) => {}
      ).catch(err => {
        console.error('Camera access error:', err);
        alert('Could not open camera. Please check permissions.');
        setShowScanner(false);
      });
    }, 300);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().then(() => {
        scannerRef.current.clear();
        scannerRef.current = null;
        setShowScanner(false);
      }).catch(() => {
        scannerRef.current = null;
        setShowScanner(false);
      });
    } else {
      setShowScanner(false);
    }
  };

  // ─── ACTION SUBMITTERS ───────────────────────────────────────

  // Search/Scan label for Put-Away
  const handlePutAwaySearch = async (val) => {
    const searchVal = val || putAwayScan;
    if (!searchVal) return;
    try {
      const res = await axios.get(`${API}/inventory/labels`, {
        ...getAuthHeader(),
        params: { search: searchVal }
      });
      if (res.data.length > 0) {
        const item = res.data[0];
        setPutAwayLabel(item);
        setPutAwayForm({ store_id: item.store_id || '', bin: item.bin || '' });
      } else {
        alert('Label not found or consumed.');
      }
    } catch (err) {
      alert('Error searching label.');
    }
  };

  // Assign Bin / Put-Away Submit
  const handlePutAwaySubmit = async (e) => {
    e.preventDefault();
    if (!putAwayLabel) return;
    setLoading(true);
    try {
      await axios.post(`${API}/inventory/put-away`, {
        label_number: putAwayLabel.label_number,
        store_id: putAwayForm.store_id,
        bin: putAwayForm.bin
      }, getAuthHeader());
      alert('Bin assigned successfully!');
      setPutAwayLabel(null);
      setPutAwayScan('');
      fetchPendingPutAway();
    } catch (err) {
      alert(err.response?.data?.message || 'Put-away failed');
    } finally {
      setLoading(false);
    }
  };

  // Scan label for Transfer
  const handleTransferSearch = async (val) => {
    const searchVal = val || transferScan;
    if (!searchVal) return;
    try {
      const res = await axios.get(`${API}/inventory/labels`, {
        ...getAuthHeader(),
        params: { search: searchVal, status: 'Available' }
      });
      if (res.data.length > 0) {
        const item = res.data[0];
        setTransferLabel(item);
        setTransferForm({ store_id: item.store_id || '', bin: item.bin || '', reason: '' });
      } else {
        alert('Active label not found.');
      }
    } catch (err) {
      alert('Error searching label.');
    }
  };

  // Transfer Submit
  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!transferLabel) return;
    setLoading(true);
    try {
      await axios.post(`${API}/inventory/transfer`, {
        label_number: transferLabel.label_number,
        store_id: transferForm.store_id,
        bin: transferForm.bin,
        reason: transferForm.reason
      }, getAuthHeader());
      alert('Stock transferred successfully!');
      setTransferLabel(null);
      setTransferScan('');
    } catch (err) {
      alert(err.response?.data?.message || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  // Adjustment Submit
  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!adjustLabel) return;
    setLoading(true);
    try {
      await axios.post(`${API}/inventory/adjust`, {
        label_number: adjustLabel.label_number,
        new_qty: adjustForm.new_qty,
        reason: adjustForm.reason
      }, getAuthHeader());
      alert('Stock adjusted successfully!');
      setAdjustLabel(null);
      setAdjustForm({ new_qty: '', reason: '' });
      fetchAdjustList();
    } catch (err) {
      alert(err.response?.data?.message || 'Adjustment failed');
    } finally {
      setLoading(false);
    }
  };

  // Scan label for Issue
  const handleIssueSearch = async (val) => {
    const searchVal = val || issueScan;
    if (!searchVal) return;
    try {
      const res = await axios.get(`${API}/inventory/labels`, {
        ...getAuthHeader(),
        params: { search: searchVal, status: 'Available' }
      });
      if (res.data.length > 0) {
        const item = res.data[0];
        if (item.label_type !== 'Raw Material') {
          alert('Only raw materials (MAT labels) can be issued to production.');
          return;
        }
        setIssueLabel(item);
        setIssueForm({ issue_qty: item.quantity, work_order_no: '', remarks: '' });
      } else {
        alert('Active label not found.');
      }
    } catch (err) {
      alert('Error searching label.');
    }
  };

  // Issue Submit
  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    if (!issueLabel) return;
    setLoading(true);
    try {
      await axios.post(`${API}/inventory/issue`, {
        label_number: issueLabel.label_number,
        issue_qty: issueForm.issue_qty,
        work_order_no: issueForm.work_order_no,
        remarks: issueForm.remarks
      }, getAuthHeader());
      alert('Material issued successfully!');
      setIssueLabel(null);
      setIssueScan('');
    } catch (err) {
      alert(err.response?.data?.message || 'Issue failed');
    } finally {
      setLoading(false);
    }
  };

  // CSV Export
  const exportLedgerCSV = () => {
    if (ledgerResults.length === 0) return;
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Date,Item Code,Item Name,Store,Type,Qty In,Qty Out,Balance,Reference,User\n';
    
    ledgerResults.forEach(r => {
      const date = new Date(r.transaction_date).toLocaleString();
      const row = [
        `"${date}"`,
        `"${r.item_code}"`,
        `"${r.item_name}"`,
        `"${r.store_name}"`,
        `"${r.transaction_type}"`,
        r.qty_in,
        r.qty_out,
        r.balance,
        `"${r.reference_number || ''}"`,
        `"${r.user_name}"`
      ].join(',');
      csvContent += row + '\n';
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Stock_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Status badges helper
  const getStatusBadge = (status) => {
    const styles = {
      'Available': 'bg-green-100 text-green-700 border-green-200',
      'QC Hold': 'bg-amber-100 text-amber-700 border-amber-200',
      'Quarantined': 'bg-red-100 text-red-700 border-red-200',
      'Consumed': 'bg-slate-100 text-slate-500 border-slate-200'
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* RELATED / QUICK LINKS BAR */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">Related</span>
        <button
          onClick={() => window.location.href = '/gate-pass'}
          className="flex items-center gap-1.5 bg-[#1e1e1e] text-slate-300 border border-[#2a2a2a] px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#252525] transition"
        >
          🚚 Gate Pass
        </button>
        <button
          onClick={() => window.location.href = '/grn'}
          className="flex items-center gap-1.5 bg-[#1e1e1e] text-slate-300 border border-[#2a2a2a] px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#252525] transition"
        >
          📦 Goods Receipt Note
        </button>
        <button
          className="flex items-center gap-1.5 bg-orange-900/20 text-orange-400 border border-orange-900/50 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
        >
          🗃️ Stock Position
        </button>
      </div>

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2a2a2a] pb-4">
        <div>
          <h1 className="text-lg font-black text-white tracking-wide flex items-center gap-2">
            <Layers className="w-6 h-6 text-emerald-400" /> Stock / Inventory
          </h1>
          <p className="text-slate-400 text-xs font-medium mt-0.5">
            Manage store materials, bin locations, stock movements, and production issues.
          </p>
        </div>

        {/* SUB-TABS NAVIGATION */}
        <div className="flex bg-[#1e1e1e] p-1 rounded-xl border border-[#2a2a2a] shadow-md self-start overflow-x-auto max-w-full">
          {[
            { id: 'put-away', label: 'Put-Away', icon: '📥' },
            { id: 'query', label: 'Query', icon: '🔍' },
            { id: 'fg-stock', label: 'Stock Positions Sheet', icon: '📋' },
            { id: 'transfer', label: 'Transfer', icon: '🔄' },
            { id: 'adjust', label: 'Adjust', icon: '⚙️' },
            { id: 'ledger', label: 'Ledger', icon: '📖' },
            { id: 'issue', label: 'Issue', icon: '📤' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                activeTab === t.id
                  ? 'bg-[#10b981] text-white shadow-md'
                  : 'text-slate-400 hover:bg-[#252525] hover:text-white'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── TAB CONTENT: PUT-AWAY ─────────────────────────────────── */}
      {activeTab === 'put-away' && (
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* BARCODE SCAN FIELD */}
          <div className="bg-[#1e1e1e] rounded-xl border border-[#2a2a2a] shadow-lg p-6">
            <label className="block text-xs font-black uppercase text-white mb-2 tracking-wider">Scan Label Barcode</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  <Search className="w-4 h-4 text-slate-400" />
                </span>
                <input
                  type="text"
                  placeholder="Scan or type label (e.g. MAT/2627/00004)..."
                  value={putAwayScan}
                  onChange={e => setPutAwayScan(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePutAwaySearch()}
                  className="w-full pl-9 pr-10 py-2.5 bg-[#121212] border border-[#3a3a3a] rounded-xl text-xs text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none font-medium transition"
                />
                <button
                  onClick={() => startScanner(handlePutAwaySearch)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-emerald-400 transition"
                >
                  <Camera className="w-5 h-5" />
                </button>
              </div>
              <button
                onClick={() => handlePutAwaySearch()}
                className="bg-[#10b981] hover:bg-[#059669] text-white font-black text-xs px-5 py-2.5 rounded-xl transition shadow-md"
              >
                Load
              </button>
            </div>
          </div>

          {/* SCANNED LABEL CARD */}
          {putAwayLabel && (
            <div className="bg-[#1e1e1e] rounded-xl border border-[#2a2a2a] shadow-lg overflow-hidden">
              <div className="bg-[#121212] px-6 py-4 flex items-center justify-between text-white border-b border-[#2a2a2a]">
                <div>
                  <h3 className="font-black text-sm tracking-wide text-white">{putAwayLabel.item_name}</h3>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Label: <span className="text-emerald-400 font-extrabold">{putAwayLabel.label_number}</span> | Type: {putAwayLabel.label_type}
                  </p>
                </div>
                {getStatusBadge(putAwayLabel.status)}
              </div>

              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 border-b border-[#2a2a2a] pb-5">
                  <div>
                    <p className="text-slate-400 text-xs font-semibold">Quantity</p>
                    <p className="text-white font-black text-sm mt-0.5">{putAwayLabel.quantity} {putAwayLabel.unit}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs font-semibold">Batch No</p>
                    <p className="text-white font-black text-sm mt-0.5">{putAwayLabel.batch_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs font-semibold">Current Store</p>
                    <p className="text-white font-black text-sm mt-0.5">{putAwayLabel.store_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs font-semibold">Current Bin</p>
                    <p className="text-white font-black text-sm mt-0.5">{putAwayLabel.bin || 'Unassigned'}</p>
                  </div>
                </div>

                <form onSubmit={handlePutAwaySubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Target Store *</label>
                      <select
                        value={putAwayForm.store_id}
                        onChange={e => setPutAwayForm({ ...putAwayForm, store_id: e.target.value })}
                        required
                        className="w-full bg-[#121212] border border-[#3a3a3a] text-white rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                      >
                        <option value="">Select store...</option>
                        {stores.map(s => (
                          <option key={s.store_id} value={s.store_id}>{s.store_name} ({s.store_type})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Target Bin *</label>
                      <input
                        type="text"
                        placeholder="Enter Bin (e.g. BIN-A1)..."
                        value={putAwayForm.bin}
                        onChange={e => setPutAwayForm({ ...putAwayForm, bin: e.target.value })}
                        required
                        className="w-full bg-[#121212] border border-[#3a3a3a] text-white rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-3">
                    <button
                      type="button"
                      onClick={() => setPutAwayLabel(null)}
                      className="border border-[#3a3a3a] text-slate-300 px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#252525] transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-[#10b981] hover:bg-[#059669] text-white font-black text-xs px-5 py-2 rounded-lg shadow-md flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" /> Assign Bin
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* PENDING PUT-AWAY LIST */}
          <div className="bg-[#1e1e1e] rounded-xl border border-[#2a2a2a] shadow-lg p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-[#2a2a2a] pb-3">
              <h3 className="font-black text-white text-xs uppercase tracking-wider">
                📁 Pending Put-Away ({pendingPutAway.length})
              </h3>
            </div>
            <div className="space-y-3">
              {pendingPutAway.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setPutAwayScan(item.label_number);
                    handlePutAwaySearch(item.label_number);
                  }}
                  className="p-4 border border-[#2a2a2a] hover:border-emerald-500 bg-[#121212] hover:bg-[#252525] rounded-xl cursor-pointer transition flex items-center justify-between"
                >
                  <div>
                    <p className="font-extrabold text-white text-xs">{item.item_name}</p>
                    <p className="text-slate-300 text-xs mt-1">
                      Qty: <span className="font-bold text-white">{item.quantity} {item.unit}</span>
                      {item.batch_number ? ` | Batch: ${item.batch_number}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 font-mono text-xs block">{item.label_number}</span>
                    <span className="text-orange-500 text-xs font-bold mt-1 inline-block">Assign Bin ➔</span>
                  </div>
                </div>
              ))}
              {pendingPutAway.length === 0 && (
                <div className="text-center py-10 text-slate-400 text-xs">
                  All items put away!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB CONTENT: QUERY ───────────────────────────────────── */}
      {activeTab === 'query' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Barcode Search</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Scan or type..."
                    value={queryScan}
                    onChange={e => setQueryScan(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                  <button
                    onClick={() => startScanner((val) => { setQueryScan(val); setQueryFilters({...queryFilters, search: val}); })}
                    className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-orange-500"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Item Code/Name</label>
                <input
                  type="text"
                  placeholder="Search item..."
                  value={queryFilters.search}
                  onChange={e => setQueryFilters({ ...queryFilters, search: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Store</label>
                <select
                  value={queryFilters.store_id}
                  onChange={e => setQueryFilters({ ...queryFilters, store_id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                >
                  <option value="">All Stores</option>
                  {stores.map(s => (
                    <option key={s.store_id} value={s.store_id}>{s.store_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Bin Location</label>
                <input
                  type="text"
                  placeholder="e.g. A1"
                  value={queryFilters.bin}
                  onChange={e => setQueryFilters({ ...queryFilters, bin: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Status</label>
                <select
                  value={queryFilters.status}
                  onChange={e => setQueryFilters({ ...queryFilters, status: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                >
                  <option value="">All Statuses</option>
                  <option value="Available">Available</option>
                  <option value="QC Hold">QC Hold</option>
                  <option value="Quarantined">Quarantined</option>
                  <option value="Consumed">Consumed</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-4 justify-end">
              <button
                onClick={() => {
                  setQueryFilters({ search: '', store_id: '', bin: '', batch_no: '', status: '' });
                  setQueryScan('');
                }}
                className="border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition"
              >
                Reset
              </button>
              <button
                onClick={fetchQueryResults}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition"
              >
                Search
              </button>
            </div>
          </div> 
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <th className="px-6 py-3.5">LABEL</th>
                    <th className="px-6 py-3.5">ITEM CODE</th>
                    <th className="px-6 py-3.5">ITEM NAME</th>
                    <th className="px-6 py-3.5">QTY</th>
                    <th className="px-6 py-3.5">STORE / BIN</th>
                    <th className="px-6 py-3.5">BATCH</th>
                    <th className="px-6 py-3.5">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {queryResults.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-3.5 text-orange-500 font-bold">{r.label_number}</td>
                      <td className="px-6 py-3.5">{r.item_code}</td>
                      <td className="px-6 py-3.5 font-bold">{r.item_name}</td>
                      <td className="px-6 py-3.5 font-bold">{r.quantity} {r.unit}</td>
                      <td className="px-6 py-3.5">{r.store_name} / <span className="font-bold text-slate-800">{r.bin || '-'}</span></td>
                      <td className="px-6 py-3.5">{r.batch_number || '-'}</td>
                      <td className="px-6 py-3.5">{getStatusBadge(r.status)}</td>
                    </tr>
                  ))}
                  {queryResults.length === 0 && (
                    <tr>
                      <td colSpan="7" className="text-center py-10 text-slate-400">
                        No results found. Adjust filters and try again.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB CONTENT: FG STOCK ────────────────────────────────── */}
      {activeTab === 'fg-stock' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Search Item</label>
                <input
                  type="text"
                  placeholder="Search item code or name..."
                  value={fgFilters.search}
                  onChange={e => setFgFilters(prev => ({ ...prev, search: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && fetchFgResults()}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>
              <div className="w-48">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Material Category</label>
                <select
                  value={fgFilters.category}
                  onChange={e => {
                    const newCat = e.target.value;
                    setFgFilters(prev => ({ ...prev, category: newCat }));
                    // Fetch immediately on select change
                    axios.get(`${API}/inventory/positions`, {
                      ...getAuthHeader(),
                      params: { search: fgFilters.search, category: newCat !== 'All' ? newCat : undefined }
                    }).then(res => setFgResults(res.data)).catch(err => console.error(err));
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                >
                  <option value="All">All Categories</option>
                  <option value="Raw Material">Raw Materials & Chemicals</option>
                  <option value="Semi Finished">Semi-Finished Compounds</option>
                  <option value="Finished Good">Finished Goods</option>
                </select>
              </div>
              <div className="pt-5">
                <button
                  onClick={fetchFgResults}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs px-4 py-2 rounded-lg transition shadow-sm"
                >
                  Search
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <th className="px-6 py-3.5">ITEM CODE</th>
                    <th className="px-6 py-3.5">ITEM NAME</th>
                    <th className="px-6 py-3.5">STORE LOCATION</th>
                    <th className="px-6 py-3.5">BALANCE STOCK</th>
                    <th className="px-6 py-3.5">UNIT</th>
                    <th className="px-6 py-3.5">REORDER LEVEL</th>
                    <th className="px-6 py-3.5">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {fgResults.map((r, idx) => {
                    const isLow = parseFloat(r.current_qty) < parseFloat(r.reorder_level);
                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-3.5 font-bold text-slate-800">{r.item_code}</td>
                        <td className="px-6 py-3.5 font-bold">{r.item_name}</td>
                        <td className="px-6 py-3.5">{r.store_name}</td>
                        <td className={`px-6 py-3.5 font-extrabold text-sm ${isLow ? 'text-red-500' : 'text-slate-800'}`}>
                          {r.current_qty}
                        </td>
                        <td className="px-6 py-3.5">{r.unit}</td>
                        <td className="px-6 py-3.5 text-slate-400 font-semibold">{r.reorder_level}</td>
                        <td className="px-6 py-3.5">
                          {isLow ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                              Low Stock
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                              In Stock
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {fgResults.length === 0 && (
                    <tr>
                      <td colSpan="7" className="text-center py-10 text-slate-400 font-bold">
                        No stock positions matching the selected filters found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB CONTENT: TRANSFER ────────────────────────────────── */}
      {activeTab === 'transfer' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <label className="block text-sm font-bold text-slate-700 mb-2">Scan Label Barcode</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  <Search className="w-5 h-5 text-slate-400" />
                </span>
                <input
                  type="text"
                  placeholder="Scan or type label (e.g. MAT/2627/00004)..."
                  value={transferScan}
                  onChange={e => setTransferScan(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleTransferSearch()}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:bg-white focus:outline-none transition"
                />
                <button
                  onClick={() => startScanner(handleTransferSearch)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-orange-500 transition"
                >
                  <Camera className="w-5 h-5" />
                </button>
              </div>
              <button
                onClick={() => handleTransferSearch()}
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition shadow-sm"
              >
                Load
              </button>
            </div>
          </div>

          {transferLabel && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
                <div>
                  <h3 className="font-extrabold text-base tracking-tight">{transferLabel.item_name}</h3>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Label: <span className="text-orange-400 font-bold">{transferLabel.label_number}</span>
                  </p>
                </div>
                {getStatusBadge(transferLabel.status)}
              </div>

              <div className="p-6">
                <div className="grid grid-cols-3 gap-4 mb-6 border-b border-slate-100 pb-5">
                  <div>
                    <p className="text-slate-400 text-xs font-semibold">Qty</p>
                    <p className="text-slate-800 font-bold text-sm mt-0.5">{transferLabel.quantity} {transferLabel.unit}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs font-semibold">Current Store</p>
                    <p className="text-slate-800 font-bold text-sm mt-0.5">{transferLabel.store_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs font-semibold">Current Bin</p>
                    <p className="text-slate-800 font-bold text-sm mt-0.5">{transferLabel.bin || '-'}</p>
                  </div>
                </div>

                <form onSubmit={handleTransferSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Target Store *</label>
                      <select
                        value={transferForm.store_id}
                        onChange={e => setTransferForm({ ...transferForm, store_id: e.target.value })}
                        required
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                      >
                        <option value="">Select target store...</option>
                        {stores.map(s => (
                          <option key={s.store_id} value={s.store_id}>{s.store_name} ({s.store_type})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Target Bin *</label>
                      <input
                        type="text"
                        placeholder="e.g. A2"
                        value={transferForm.bin}
                        onChange={e => setTransferForm({ ...transferForm, bin: e.target.value })}
                        required
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Reason for Transfer *</label>
                    <input
                      type="text"
                      placeholder="Enter transfer reason..."
                      value={transferForm.reason}
                      onChange={e => setTransferForm({ ...transferForm, reason: e.target.value })}
                      required
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2 justify-end pt-3">
                    <button
                      type="button"
                      onClick={() => setTransferLabel(null)}
                      className="border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm px-5 py-2 rounded-lg shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      <ArrowRightLeft className="w-4 h-4" /> Transfer
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB CONTENT: ADJUST ──────────────────────────────────── */}
      {activeTab === 'adjust' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Filter stock list by item code/name..."
                  value={adjustFilters.search}
                  onChange={e => setAdjustFilters({ search: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && fetchAdjustList()}
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
                <button
                  onClick={fetchAdjustList}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs px-4 py-2 rounded-lg transition"
                >
                  Search
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-y-auto max-h-[450px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 sticky top-0">
                      <th className="px-6 py-3">LABEL</th>
                      <th className="px-6 py-3">ITEM</th>
                      <th className="px-6 py-3">QTY</th>
                      <th className="px-6 py-3">STORE / BIN</th>
                      <th className="px-6 py-3">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {adjustList.map((r, idx) => (
                      <tr
                        key={idx}
                        onClick={() => {
                          setAdjustLabel(r);
                          setAdjustForm({ new_qty: r.quantity, reason: '' });
                        }}
                        className={`cursor-pointer hover:bg-orange-50/20 transition ${
                          adjustLabel?.label_number === r.label_number ? 'bg-orange-50/40 border-l-4 border-l-orange-500' : ''
                        }`}
                      >
                        <td className="px-6 py-3.5 text-orange-500 font-bold">{r.label_number}</td>
                        <td className="px-6 py-3.5 font-bold">{r.item_name}</td>
                        <td className="px-6 py-3.5 font-bold">{r.quantity} {r.unit}</td>
                        <td className="px-6 py-3.5">{r.store_name} / {r.bin || '-'}</td>
                        <td className="px-6 py-3.5">{getStatusBadge(r.status)}</td>
                      </tr>
                    ))}
                    {adjustList.length === 0 && (
                      <tr>
                        <td colSpan="5" className="text-center py-10 text-slate-400">
                          No active items to adjust.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div>
            {adjustLabel ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden sticky top-6">
                <div className="bg-slate-900 px-6 py-4 text-white">
                  <h3 className="font-extrabold text-sm tracking-tight">{adjustLabel.item_name}</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Label: {adjustLabel.label_number}</p>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <p className="text-slate-400 text-xs font-semibold">Current Quantity</p>
                    <p className="text-slate-800 font-extrabold text-base mt-0.5">{adjustLabel.quantity} {adjustLabel.unit}</p>
                  </div>
                  <form onSubmit={handleAdjustSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">New Quantity *</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Enter adjusted quantity..."
                        value={adjustForm.new_qty}
                        onChange={e => setAdjustForm({ ...adjustForm, new_qty: e.target.value })}
                        required
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Reason for Adjustment *</label>
                      <textarea
                        rows="3"
                        placeholder="Explain the stock discrepancy..."
                        value={adjustForm.reason}
                        onChange={e => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                        required
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                      ></textarea>
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => setAdjustLabel(null)}
                        className="border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-xs font-semibold hover:bg-slate-50 transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-sm transition disabled:opacity-50"
                      >
                        Apply Adjust
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 border-dashed p-10 text-center text-slate-400 text-xs flex flex-col items-center justify-center h-48">
                <Settings2 className="w-8 h-8 text-slate-300 mb-2" />
                Select a row from the table to make an inventory adjustment.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB CONTENT: LEDGER ──────────────────────────────────── */}
      {activeTab === 'ledger' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Date From</label>
                <input
                  type="date"
                  value={ledgerFilters.date_from}
                  onChange={e => setLedgerFilters({ ...ledgerFilters, date_from: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Date To</label>
                <input
                  type="date"
                  value={ledgerFilters.date_to}
                  onChange={e => setLedgerFilters({ ...ledgerFilters, date_to: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Transaction Type</label>
                <select
                  value={ledgerFilters.transaction_type}
                  onChange={e => setLedgerFilters({ ...ledgerFilters, transaction_type: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                >
                  <option value="All">All Types</option>
                  <option value="GRN">GRN Receipt</option>
                  <option value="Issue">Issue to Production</option>
                  <option value="Transfer">Bin Transfer</option>
                  <option value="Adjustment">Adjustment</option>
                  <option value="FG Receipt">FG Receipt</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Item Code</label>
                <input
                  type="text"
                  placeholder="e.g. RM001"
                  value={ledgerFilters.item_code}
                  onChange={e => setLedgerFilters({ ...ledgerFilters, item_code: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4 justify-between items-center">
              <button
                onClick={exportLedgerCSV}
                disabled={ledgerResults.length === 0}
                className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-lg text-xs font-bold hover:bg-emerald-100 disabled:opacity-50 transition"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setLedgerFilters({
                    date_from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    date_to: new Date().toISOString().split('T')[0],
                    transaction_type: 'All',
                    item_code: ''
                  })}
                  className="border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition"
                >
                  Reset
                </button>
                <button
                  onClick={fetchLedgerResults}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition"
                >
                  Search
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <th className="px-6 py-3.5">DATE & TIME</th>
                    <th className="px-6 py-3.5">ITEM CODE</th>
                    <th className="px-6 py-3.5">ITEM NAME</th>
                    <th className="px-6 py-3.5">STORE</th>
                    <th className="px-6 py-3.5">TYPE</th>
                    <th className="px-6 py-3.5 text-right">QTY IN</th>
                    <th className="px-6 py-3.5 text-right">QTY OUT</th>
                    <th className="px-6 py-3.5 text-right">BALANCE</th>
                    <th className="px-6 py-3.5">REFERENCE</th>
                    <th className="px-6 py-3.5">USER</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {ledgerResults.map((r, idx) => {
                    const badgeStyles = {
                      'GRN': 'bg-green-50 text-green-700 border-green-200',
                      'Issue': 'bg-amber-50 text-amber-700 border-amber-200',
                      'Transfer': 'bg-blue-50 text-blue-700 border-blue-200',
                      'Adjustment': 'bg-purple-50 text-purple-700 border-purple-200',
                      'FG Receipt': 'bg-cyan-50 text-cyan-700 border-cyan-200'
                    };
                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-3.5 text-slate-400">
                          {new Date(r.transaction_date).toLocaleString()}
                        </td>
                        <td className="px-6 py-3.5 font-bold text-slate-800">{r.item_code}</td>
                        <td className="px-6 py-3.5 font-bold">{r.item_name}</td>
                        <td className="px-6 py-3.5">{r.store_name}</td>
                        <td className="px-6 py-3.5">
                          <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${badgeStyles[r.transaction_type] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                            {r.transaction_type}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right font-bold text-green-600">
                          {parseFloat(r.qty_in) > 0 ? `+${r.qty_in}` : '-'}
                        </td>
                        <td className="px-6 py-3.5 text-right font-bold text-red-500">
                          {parseFloat(r.qty_out) > 0 ? `-${r.qty_out}` : '-'}
                        </td>
                        <td className="px-6 py-3.5 text-right font-extrabold text-slate-850">
                          {r.balance} {r.unit}
                        </td>
                        <td className="px-6 py-3.5 text-slate-500 font-semibold">{r.reference_number || '-'}</td>
                        <td className="px-6 py-3.5 flex items-center gap-1 mt-1 text-slate-500">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {r.user_name}
                        </td>
                      </tr>
                    );
                  })}
                  {ledgerResults.length === 0 && (
                    <tr>
                      <td colSpan="10" className="text-center py-10 text-slate-400">
                        No ledger entries found for selected criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB CONTENT: ISSUE MATERIAL ──────────────────────────── */}
      {activeTab === 'issue' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <label className="block text-sm font-bold text-slate-700 mb-2">Scan Material Label (MAT)</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  <Search className="w-5 h-5 text-slate-400" />
                </span>
                <input
                  type="text"
                  placeholder="Scan or type label (e.g. MAT/2627/00004)..."
                  value={issueScan}
                  onChange={e => setIssueScan(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleIssueSearch()}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:bg-white focus:outline-none transition"
                />
                <button
                  onClick={() => startScanner(handleIssueSearch)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-orange-500 transition"
                >
                  <Camera className="w-5 h-5" />
                </button>
              </div>
              <button
                onClick={() => handleIssueSearch()}
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition shadow-sm"
              >
                Load
              </button>
            </div>
          </div>

          {issueLabel && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
                <div>
                  <h3 className="font-extrabold text-base tracking-tight">{issueLabel.item_name}</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Label: <span className="text-orange-400 font-bold">{issueLabel.label_number}</span></p>
                </div>
                {getStatusBadge(issueLabel.status)}
              </div>

              <div className="p-6">
                <div className="grid grid-cols-3 gap-4 mb-6 border-b border-slate-100 pb-5">
                  <div>
                    <p className="text-slate-400 text-xs font-semibold">Available Qty</p>
                    <p className="text-slate-800 font-extrabold text-sm mt-0.5">{issueLabel.quantity} {issueLabel.unit}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs font-semibold">Current Store</p>
                    <p className="text-slate-800 font-bold text-sm mt-0.5">{issueLabel.store_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs font-semibold">Bin Location</p>
                    <p className="text-slate-800 font-bold text-sm mt-0.5">{issueLabel.bin || '-'}</p>
                  </div>
                </div>

                <form onSubmit={handleIssueSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Issue Quantity * (Max: {issueLabel.quantity})</label>
                      <input
                        type="number"
                        step="0.01"
                        max={issueLabel.quantity}
                        min="0.01"
                        required
                        value={issueForm.issue_qty}
                        onChange={e => setIssueForm({ ...issueForm, issue_qty: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Work Order No *</label>
                      <input
                        type="text"
                        placeholder="e.g. WO/2026/00001"
                        required
                        value={issueForm.work_order_no}
                        onChange={e => setIssueForm({ ...issueForm, work_order_no: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Remarks / Operator</label>
                    <input
                      type="text"
                      placeholder="Remarks..."
                      value={issueForm.remarks}
                      onChange={e => setIssueForm({ ...issueForm, remarks: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2 justify-end pt-3">
                    <button
                      type="button"
                      onClick={() => setIssueLabel(null)}
                      className="border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm px-5 py-2 rounded-lg shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Issue to Production
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CAMERA SCANNER MODAL WINDOW */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-slate-800 text-sm">Scan Barcode / QR Label</h3>
              <button onClick={stopScanner} className="text-slate-400 hover:text-red-500 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div id="qr-reader" className="rounded-xl overflow-hidden border border-slate-100"></div>
            <p className="text-slate-500 text-[10px] text-center mt-3 font-semibold uppercase tracking-wider">
              Point your camera at the barcode sticker label
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
