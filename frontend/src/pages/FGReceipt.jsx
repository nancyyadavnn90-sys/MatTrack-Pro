import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  Search, Eye, X, ArrowLeft, Boxes, Plus, ClipboardList, Info, 
  Camera, Printer
} from 'lucide-react';
import jsPDF from 'jspdf';
import { QRCodeCanvas } from 'qrcode.react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const getAuthHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

export default function FGReceipt() {
  const [activeView, setActiveView] = useState('list'); // 'list', 'create'
  const [loading, setLoading] = useState(false);

  // Data lists
  const [receipts, setReceipts] = useState([]);
  const [pendingQC, setPendingQC] = useState([]);
  const [fgStores, setFgStores] = useState([]);
  const [stats, setStats] = useState({
    total_receipts: 0,
    pending_receipts: 0,
    total_pieces: 0
  });

  // Filters & selection
  const [filterText, setFilterText] = useState('');
  const [selectedQC, setSelectedQC] = useState(null);
  const [selectedFGR, setSelectedFGR] = useState(null); // for detail modal

  // Scan input states
  const [scanInput, setScanInput] = useState('');
  const [scanMatchSuccess, setScanMatchSuccess] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const scannerRef = useRef(null);

  // Form state
  const [receiptForm, setReceiptForm] = useState({
    received_qty: '',
    store_id: '',
    receipt_date: new Date().toISOString().split('T')[0],
    remarks: ''
  });

  // Printing confirmation state after creation
  const [createdFGRReceipt, setCreatedFGRReceipt] = useState(null);

  useEffect(() => {
    fetchFGReceipts();
    fetchPendingQC();
    fetchStats();
    fetchFGStores();
  }, []);

  // API Fetchers
  const fetchFGReceipts = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/fg-receipts`, getAuthHeader());
      setReceipts(res.data);
    } catch (err) {
      console.error('Error fetching FG receipts:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingQC = async () => {
    try {
      const res = await axios.get(`${API}/fg-receipts/pending`, getAuthHeader());
      setPendingQC(res.data);
    } catch (err) {
      console.error('Error fetching pending QC:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API}/fg-receipts/stats`, getAuthHeader());
      setStats(res.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchFGStores = async () => {
    try {
      const res = await axios.get(`${API}/fg-receipts/stores`, getAuthHeader());
      setFgStores(res.data);
      if (res.data.length > 0) {
        setReceiptForm(prev => ({ ...prev, store_id: res.data[0].store_id.toString() }));
      }
    } catch (err) {
      console.error('Error fetching stores:', err);
    }
  };

  // ─── BARCODE SCANNER LOGIC ──────────────────────────────────
  const startScanner = () => {
    setShowScanner(true);
    setScanMatchSuccess(false);
    setTimeout(() => {
      const html5QrCode = new Html5Qrcode('qr-reader-fgr');
      scannerRef.current = html5QrCode;
      html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleBarcodeLookup(decodedText);
          stopScanner();
        },
        () => {}
      ).catch(err => {
        console.error('Camera capture error:', err);
        alert('Could not start camera scanner. Check browser permissions.');
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

  const handleBarcodeLookup = (code) => {
    if (!code) return;
    
    let targetLabel = code.trim();
    
    // Check if the barcode text is a JSON payload (e.g. from our QR code labels)
    if (code.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(code);
        if (parsed.label) {
          targetLabel = parsed.label;
        } else if (parsed.inspection) {
          // If the QR contains inspection instead of label directly
          targetLabel = parsed.inspection;
        }
      } catch (e) {
        console.warn('Scanned code starts with curly braces but is not a valid JSON:', e);
      }
    }

    // Try to find matching Final QC record
    const match = pendingQC.find(
      qc => 
        qc.label_number?.toLowerCase() === targetLabel.toLowerCase() ||
        qc.inspection_number?.toLowerCase() === targetLabel.toLowerCase() ||
        qc.fqc_number?.toLowerCase() === targetLabel.toLowerCase()
    );

    if (match) {
      handleSelectQC(match);
      setScanInput(targetLabel);
      setScanMatchSuccess(true);
    } else {
      setScanMatchSuccess(false);
      alert(`No pending approved Final QC found for barcode "${targetLabel}".`);
    }
  };
  // Workflow Handlers
  const handleSelectQC = (qc) => {
    setSelectedQC(qc);
    const qtyStr = qc && qc.accepted_qty !== undefined && qc.accepted_qty !== null 
      ? String(qc.accepted_qty) 
      : '';
    setReceiptForm(prev => ({
      ...prev,
      received_qty: qtyStr
    }));
  };

  const handleCreateReceipt = async (e) => {
    e.preventDefault();
    if (!selectedQC) {
      alert('Please select or scan an approved Final QC batch.');
      return;
    }
    if (!receiptForm.received_qty || parseFloat(receiptForm.received_qty) <= 0) {
      alert('Please enter a valid received quantity.');
      return;
    }
    if (!receiptForm.store_id) {
      alert('Please select a Finished Goods Store.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        inspection_id: selectedQC.inspection_id,
        wo_id: selectedQC.wo_id,
        item_id: selectedQC.item_id,
        received_qty: parseFloat(receiptForm.received_qty),
        store_id: parseInt(receiptForm.store_id),
        receipt_date: receiptForm.receipt_date,
        remarks: receiptForm.remarks
      };

      const res = await axios.post(`${API}/fg-receipts`, payload, getAuthHeader());
      
      const selectedStore = fgStores.find(s => s.store_id.toString() === receiptForm.store_id);
      
      // Store FGR parameters for dynamic receipt print
      const mockReceiptDetail = {
        fgr_id: res.data.fgr_id,
        fgr_number: res.data.fgr_number,
        wo_number: selectedQC.wo_number,
        item_code: selectedQC.item_code,
        item_name: selectedQC.item_name,
        unit: selectedQC.unit,
        customer_name: selectedQC.customer_name || 'N/A',
        received_qty: receiptForm.received_qty,
        store_name: selectedStore?.store_name || 'FG Store',
        receipt_date: receiptForm.receipt_date,
        remarks: receiptForm.remarks,
        inspection_number: selectedQC.inspection_number
      };

      setCreatedFGRReceipt(mockReceiptDetail);
      
      // Reset form and view state
      setSelectedQC(null);
      setScanInput('');
      setScanMatchSuccess(false);
      setReceiptForm(prev => ({
        ...prev,
        received_qty: '',
        remarks: ''
      }));
      
      fetchFGReceipts();
      fetchPendingQC();
      fetchStats();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create FG Receipt');
    } finally {
      setLoading(false);
    }
  };

  const viewReceiptDetails = async (fgrId) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/fg-receipts/${fgrId}`, getAuthHeader());
      setSelectedFGR(res.data);
    } catch (err) {
      alert('Failed to load FG Receipt details.');
    } finally {
      setLoading(false);
    }
  };

  // ─── PDF RECEIPT PRINTING ───────────────────────────────────
  const printFGRReceiptPDF = (fgr) => {
    if (!fgr) return;
    
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a5'
      });

      // Colors
      doc.setFillColor(255, 107, 0); // Orange header
      doc.rect(0, 0, 148, 25, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('JAYASHREE POLYMERS', 10, 10);
      doc.setFontSize(10);
      doc.text('FINISHED GOODS RECEIPT (FGR) SLIP', 10, 17);

      doc.setTextColor(50, 50, 50);
      doc.setFontSize(10);

      // Box framing for metadata
      doc.rect(8, 30, 132, 85);
      
      let y = 38;
      const drawRow = (label, val) => {
        doc.setFont('Helvetica', 'bold');
        doc.text(`${label}:`, 12, y);
        doc.setFont('Helvetica', 'normal');
        doc.text(val ? val.toString() : '—', 55, y);
        y += 8;
      };

      drawRow('FGR Number', fgr.fgr_number);
      drawRow('Receipt Date', formatDate(fgr.receipt_date));
      drawRow('Work Order Ref', fgr.wo_number);
      drawRow('QC Inspection Ref', fgr.inspection_number);
      drawRow('Part / Product', fgr.item_name);
      drawRow('Part Code', fgr.item_code);
      drawRow('Customer', fgr.customer_name);
      drawRow('Received Quantity', `${parseFloat(fgr.received_qty).toLocaleString()} ${fgr.unit || 'Nos'}`);
      drawRow('Store Location', fgr.store_name);

      // Add QR Code if canvas exists
      const qrCanvas = document.getElementById('fgr-qr-canvas');
      if (qrCanvas) {
        try {
          const qrImgData = qrCanvas.toDataURL('image/png');
          // Draw QR code inside the box, in the upper right quadrant
          doc.addImage(qrImgData, 'PNG', 105, 35, 30, 30);
        } catch (qrErr) {
          console.error('Error drawing QR code to PDF:', qrErr);
        }
      }

      if (fgr.remarks) {
        doc.setFont('Helvetica', 'bold');
        doc.text('Remarks:', 12, y + 4);
        doc.setFont('Helvetica', 'normal');
        doc.text(doc.splitTextToSize(fgr.remarks, 120), 12, y + 10);
      }

      // Footer
      doc.setFont('Helvetica', 'bold');
      doc.text('Authorized Signature', 95, 135);
      doc.line(95, 131, 135, 131);

      doc.save(`FGR_Slip_${fgr.fgr_number.replace(/\//g, '_')}.pdf`);
      setCreatedFGRReceipt(null);
      setActiveView('list');
    } catch (err) {
      console.error(err);
      alert('Error producing PDF receipt slip.');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="bg-[#121212] text-slate-200 min-h-screen p-6 font-sans space-y-6">
      
      {/* ──────────────────────────────────────────────────────── */}
      {/* VIEW STATE: FG RECEIPTS LIST PAGE */}
      {/* ──────────────────────────────────────────────────────── */}
      {activeView === 'list' && (
        <>
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2a2a2a] pb-4">
            <div>
              <h1 className="text-lg font-black text-white tracking-wide flex items-center gap-2">
                <Boxes className="w-6 h-6 text-emerald-400" /> Finished Goods Receipt
              </h1>
              <p className="text-slate-400 text-xs font-medium mt-0.5">
                Receive finished goods into FG store after Final QC approval
              </p>
            </div>

            <button
              onClick={() => {
                setActiveView('create');
                fetchPendingQC();
              }}
              className="flex items-center gap-1.5 bg-[#10b981] hover:bg-[#059669] text-white px-5 py-2.5 rounded-xl text-xs font-black transition shadow-md self-start md:self-auto"
            >
              <Plus className="w-4 h-4" /> New FG Receipt
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#1e1e1e] p-4 rounded-xl border border-[#2a2a2a] shadow-md flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Total FG Receipts</p>
                <p className="text-2xl font-black text-white mt-1">{stats.total_receipts}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#121212] border border-[#2a2a2a] flex items-center justify-center text-lg text-slate-300">📋</div>
            </div>

            <div className="bg-[#1e1e1e] p-4 rounded-xl border border-[#2a2a2a] shadow-md flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Pending FG Receipt</p>
                <p className="text-2xl font-black text-amber-400 mt-1">{stats.pending_receipts}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-lg text-amber-400">⏳</div>
            </div>

            <div className="bg-[#1e1e1e] p-4 rounded-xl border border-[#2a2a2a] shadow-md flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Total Pieces in FG Store</p>
                <p className="text-2xl font-black text-emerald-400 mt-1">{parseFloat(stats.total_pieces).toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-lg text-emerald-400">📈</div>
            </div>
          </div>

          {/* Pending Alert Banner */}
          {stats.pending_receipts > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-lg flex-shrink-0">⚠️</div>
                <div>
                  <h4 className="text-sm font-black text-amber-300">{stats.pending_receipts} Final QC approved — pending FG Receipt</h4>
                  <p className="text-slate-300 text-xs mt-0.5">These parts have passed Final QC and need to be received into FG store.</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveView('create');
                  fetchPendingQC();
                }}
                className="bg-[#10b981] hover:bg-[#059669] text-white font-black text-xs px-4 py-2 rounded-lg transition shadow-md self-start md:self-auto"
              >
                Receive Now
              </button>
            </div>
          )}

          {/* Main Table - All Receipts */}
          <div className="bg-[#1e1e1e] rounded-xl border border-[#2a2a2a] shadow-lg overflow-hidden space-y-2 p-4">
            <div className="pb-3 border-b border-[#2a2a2a] flex items-center justify-between">
              <span className="text-white font-black text-xs uppercase tracking-wider">FG Receipt Transaction Register</span>
              <div className="relative">
                <Search className="absolute left-3 top-2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter receipts..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="pl-9 pr-3 py-1.5 bg-[#121212] border border-[#3a3a3a] rounded-xl text-xs w-64 text-white focus:outline-none focus:border-emerald-500 font-medium transition"
                />
              </div>
            </div>
            <div className="overflow-x-auto border border-[#2a2a2a] rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#333] text-slate-200 text-xs font-black uppercase tracking-wider bg-[#252525]">
                    <th className="py-3.5 px-4">FGR No</th>
                    <th className="py-3.5 px-4">Work Order</th>
                    <th className="py-3.5 px-4">Product</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4 text-right text-emerald-400">Received Qty</th>
                    <th className="py-3.5 px-4">FG Store</th>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2a2a] text-xs">
                  {receipts
                    .filter(r => !filterText || r.fgr_number.toLowerCase().includes(filterText.toLowerCase()) || r.item_name.toLowerCase().includes(filterText.toLowerCase()) || r.wo_number.toLowerCase().includes(filterText.toLowerCase()))
                    .map(r => (
                      <tr key={r.fgr_id} className="hover:bg-[#252525] border-b border-[#2a2a2a] transition cursor-pointer" onClick={() => viewReceiptDetails(r.fgr_id)}>
                        <td className="py-3.5 px-4 font-extrabold text-emerald-400">{r.fgr_number}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-300">{r.wo_number}</td>
                        <td className="py-3.5 px-4 font-extrabold text-white">{r.item_name}</td>
                        <td className="py-3.5 px-4 text-slate-300 font-bold">{r.customer_name || '—'}</td>
                        <td className="py-3.5 px-4 text-right font-black text-emerald-400">{parseFloat(r.received_qty).toLocaleString()} {r.unit}</td>
                        <td className="py-3.5 px-4 text-slate-300 font-medium">{r.store_name}</td>
                        <td className="py-3.5 px-4 text-slate-300 font-mono">{formatDate(r.receipt_date)}</td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); viewReceiptDetails(r.fgr_id); }}
                            className="p-1.5 hover:bg-[#252525] text-emerald-400 hover:text-emerald-300 rounded-lg transition"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  {receipts.length === 0 && (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-slate-400 font-medium">
                        No Finished Goods receipts created yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ──────────────────────────────────────────────────────── */}
      {/* VIEW STATE: NEW FG RECEIPT FORM (3 STEPS) */}
      {/* ──────────────────────────────────────────────────────── */}
      {activeView === 'create' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Back Action Bar */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setActiveView('list');
                setSelectedQC(null);
                setScanInput('');
                setScanMatchSuccess(false);
              }}
              className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-xs font-bold transition"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Register
            </button>
            <div className="h-4 w-px bg-slate-300"></div>
            <span className="text-slate-500 text-xs font-bold">New Finished Goods Receipt</span>
          </div>

          {/* Top Scan Barcode Section */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-slate-800 font-extrabold text-xs uppercase tracking-wider flex items-center gap-2">
              <Camera className="w-4.5 h-4.5 text-orange-500" /> Scan FG Barcode Label
            </h3>
            
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Scan QR/Barcode on Box OR type FGL / FQC number manually..."
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleBarcodeLookup(scanInput)}
                  className="pl-10 pr-4 py-2.5 w-full bg-slate-50 border border-slate-250 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition"
                />
              </div>
              <button
                type="button"
                onClick={() => handleBarcodeLookup(scanInput)}
                className="bg-orange-500 text-white text-xs font-bold px-5 py-2.5 rounded-lg hover:bg-orange-600 transition"
              >
                Match Barcode
              </button>
              <button
                type="button"
                onClick={startScanner}
                className="bg-slate-100 border border-slate-250 text-slate-700 p-2.5 rounded-lg hover:bg-slate-200 transition"
                title="Open Camera Scanner"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>

            {/* Scan match validation prompt */}
            {scanMatchSuccess && selectedQC && (
              <div className="bg-green-50 border border-green-200 p-3 rounded-lg flex items-center gap-2.5 animate-fadeIn">
                <span className="text-lg">✅</span>
                <div className="text-xxs font-semibold text-green-700">
                  <strong>Matched: {selectedQC.fqc_number || selectedQC.inspection_number}</strong> ({selectedQC.label_number})
                  <span className="block mt-0.5 font-normal text-green-600">
                    Product: {selectedQC.item_name} | Customer: {selectedQC.customer_name || 'N/A'} | Quantity: {selectedQC.accepted_qty} {selectedQC.unit} approved.
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Step 1 - Manual selection fallback list (2 columns) */}
            <div className="md:col-span-2 space-y-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm">Step 1 — Fallback List of Approved Final QC</h3>
                  <p className="text-slate-400 text-xxs mt-0.5">If no barcode is available, select a pending record manually from the grid below.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-1">
                  {pendingQC.map((qc) => {
                    const isSelected = selectedQC?.inspection_id === qc.inspection_id;
                    return (
                      <div
                        key={qc.inspection_id}
                        onClick={() => {
                          handleSelectQC(qc);
                          setScanMatchSuccess(false);
                          setScanInput(qc.label_number || qc.inspection_number);
                        }}
                        className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between gap-4 hover:shadow-md ${
                          isSelected
                            ? 'bg-orange-50/20 border-orange-500 ring-1 ring-orange-500 shadow-sm'
                            : 'bg-slate-50/50 border-slate-200'
                        }`}
                      >
                        <div className="space-y-1">
                          <span className="text-slate-400 text-xxs font-black uppercase tracking-wider block">FQC Number</span>
                          <span className="text-xs font-bold text-slate-800 block">{qc.fqc_number || qc.inspection_number}</span>
                          
                          <div className="pt-2 border-t border-slate-100 space-y-1 text-xxs text-slate-600 font-semibold">
                            <div><strong>WO:</strong> {qc.wo_number}</div>
                            <div><strong>Product:</strong> {qc.item_name}</div>
                            <div><strong>Customer:</strong> {qc.customer_name || 'N/A'}</div>
                          </div>
                        </div>

                        <div className="flex justify-between items-end">
                          <span className="text-[10px] text-slate-400 font-bold font-mono">{qc.item_code}</span>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 font-bold block">Approved Qty</span>
                            <span className="text-base font-black text-green-600 leading-none block">{qc.accepted_qty} {qc.unit}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {pendingQC.length === 0 && (
                    <div className="col-span-2 py-12 text-center text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                      <ClipboardList className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                      <p className="font-bold text-slate-655 text-sm">No approved Final QC records pending FG Receipt</p>
                      <p className="text-xxs text-slate-400 mt-1">Complete Final QC inspection first.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Step 2 - Details & Submit (1 column) */}
            <div>
              <form onSubmit={handleCreateReceipt} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-extrabold text-slate-800 text-sm border-b border-slate-100 pb-2">Step 2 — Receipt Details</h3>

                {selectedQC ? (
                  <div className="bg-orange-50/20 border border-orange-200 p-3 rounded-lg text-xxs space-y-1">
                    <span className="text-orange-850 font-bold block">Selected Inspection: {selectedQC.fqc_number || selectedQC.inspection_number}</span>
                    <span className="text-slate-600 block">Product: {selectedQC.item_name}</span>
                    <span className="text-slate-600 block">Work Order: {selectedQC.wo_number}</span>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-xxs text-slate-400 text-center font-semibold">
                    Scan a barcode or choose from the list to populate receipt properties.
                  </div>
                )}

                <div>
                  <label className="text-xxs text-slate-450 font-bold block mb-1">Received Quantity (pcs) *</label>
                  <input
                    type="number"
                    disabled={!selectedQC}
                    value={receiptForm.received_qty}
                    onChange={(e) => setReceiptForm(prev => ({ ...prev, received_qty: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-slate-50 disabled:text-slate-400"
                    required
                  />
                </div>

                <div>
                  <label className="text-xxs text-slate-450 font-bold block mb-1">Finished Goods Store *</label>
                  <select
                    disabled={!selectedQC}
                    value={receiptForm.store_id}
                    onChange={(e) => setReceiptForm(prev => ({ ...prev, store_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                    required
                  >
                    <option value="">-- Select FG Store --</option>
                    {fgStores.map(store => (
                      <option key={store.store_id} value={store.store_id}>{store.store_name} ({store.location})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xxs text-slate-450 font-bold block mb-1">Receipt Date *</label>
                  <input
                    type="date"
                    disabled={!selectedQC}
                    value={receiptForm.receipt_date}
                    onChange={(e) => setReceiptForm(prev => ({ ...prev, receipt_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                    required
                  />
                </div>

                <div>
                  <label className="text-xxs text-slate-450 font-bold block mb-1">Remarks</label>
                  <textarea
                    rows="2"
                    disabled={!selectedQC}
                    placeholder="Enter receipt comments..."
                    value={receiptForm.remarks}
                    onChange={(e) => setReceiptForm(prev => ({ ...prev, remarks: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-slate-50 disabled:text-slate-400"
                  ></textarea>
                </div>

                {/* Step 3 - DB action explanation box */}
                <div className="bg-blue-50 border border-blue-150 p-3.5 rounded-lg flex items-start gap-2.5 text-[10px] text-blue-700 font-semibold leading-relaxed">
                  <Info className="w-4 h-4 flex-shrink-0 text-blue-500 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Step 3 — Actions on Submit:</p>
                    <ul className="list-disc pl-3.5 space-y-0.5 font-semibold">
                      <li>FGR number auto-generated (FGR/2026/00001)</li>
                      <li>FG Stock increases in selected store</li>
                      <li>Stock ledger entry created automatically</li>
                      <li>Parts are now available for Dispatch</li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveView('list');
                      setSelectedQC(null);
                      setScanInput('');
                      setScanMatchSuccess(false);
                    }}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedQC || loading}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs py-2.5 rounded-lg transition disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {loading ? 'Creating...' : 'Create FG Receipt'}
                  </button>
                </div>
              </form>
            </div>

          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────── */}
      {/* POPUP MODAL: FG RECEIPT DETAIL */}
      {/* ──────────────────────────────────────────────────────── */}
      {selectedFGR && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xxs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-xl max-w-md w-full border border-slate-200 shadow-2xl p-5 space-y-4">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-800 text-base">{selectedFGR.fgr_number}</h3>
                <p className="text-slate-400 text-xxs">Finished Goods Receipt details</p>
              </div>
              <button
                onClick={() => setSelectedFGR(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-semibold text-slate-700">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-400 text-xxs block">Work Order</span>
                  <span className="text-slate-855 font-bold block mt-1">{selectedFGR.wo_number}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-xxs block">Product Name</span>
                  <span className="text-slate-855 font-bold block mt-1">{selectedFGR.item_name} ({selectedFGR.item_code})</span>
                </div>
                <div>
                  <span className="text-slate-400 text-xxs block">Customer</span>
                  <span className="text-slate-855 font-bold block mt-1">{selectedFGR.customer_name || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-xxs block">Received Quantity</span>
                  <span className="text-green-600 font-bold block mt-1">{parseFloat(selectedFGR.received_qty).toLocaleString()} {selectedFGR.unit}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-xxs block">FG Store Destination</span>
                  <span className="text-slate-855 font-bold block mt-1">{selectedFGR.store_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-xxs block">Receipt Date</span>
                  <span className="text-slate-855 font-bold block mt-1">{formatDate(selectedFGR.receipt_date)}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-xxs block">QC Status</span>
                  <span className="text-green-655 font-bold block mt-1">Passed (Final QC)</span>
                </div>
                <div>
                  <span className="text-slate-400 text-xxs block">Created By</span>
                  <span className="text-slate-855 font-bold block mt-1">{selectedFGR.creator_name}</span>
                </div>
              </div>

              {selectedFGR.remarks && (
                <div className="border-t border-slate-100 pt-3">
                  <span className="text-slate-400 text-xxs block">Remarks</span>
                  <p className="text-slate-700 text-xs font-normal mt-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    {selectedFGR.remarks}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
              <button
                onClick={() => printFGRReceiptPDF(selectedFGR)}
                className="flex items-center gap-1.5 bg-orange-50 text-orange-600 border border-orange-100 hover:bg-orange-500 hover:text-white transition px-4 py-2 rounded-lg text-xs font-bold"
              >
                <Printer className="w-4 h-4" /> Print Receipt Slip
              </button>
              <button
                onClick={() => setSelectedFGR(null)}
                className="bg-slate-100 hover:bg-slate-205 text-slate-700 px-5 py-2 rounded-lg text-xs font-bold transition"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION / PRINT RECEIPT MODAL AFTER CREATION */}
      {createdFGRReceipt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xxs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-xl max-w-sm w-full border border-slate-200 shadow-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center text-xl mx-auto shadow-inner">✓</div>
            
            <div className="space-y-1">
              <h3 className="font-extrabold text-slate-800 text-sm">FG Receipt Created!</h3>
              <p className="text-xxs text-slate-405 font-mono">FGR Ref: {createdFGRReceipt.fgr_number}</p>
              <p className="text-xs text-slate-500 pt-1">
                Quantity of {createdFGRReceipt.received_qty} {createdFGRReceipt.unit || 'pcs'} has been received into {createdFGRReceipt.store_name} and is available for dispatch.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-150 flex flex-col gap-2">
              <button
                onClick={() => printFGRReceiptPDF(createdFGRReceipt)}
                className="w-full bg-orange-500 hover:bg-orange-655 text-white text-xs font-bold py-2.5 rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Printer className="w-4 h-4" /> Print FGR Receipt PDF
              </button>
              <button
                onClick={() => {
                  setCreatedFGRReceipt(null);
                  setActiveView('list');
                }}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 rounded-lg transition"
              >
                Skip & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera scanner modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xxs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-xl max-w-sm w-full border border-slate-200 shadow-2xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-800 text-sm">Scan Box FG Label</span>
              <button onClick={stopScanner} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <div id="qr-reader-fgr" className="w-full h-64 bg-slate-100 rounded-lg overflow-hidden border border-slate-250"></div>
            <p className="text-slate-400 text-xxs text-center">Centering box sticker barcode / QR code automatically triggers receipt.</p>
          </div>
        </div>
      )}

      {/* Hidden QR Code Canvas for PDF slip generation */}
      <div style={{ display: 'none' }}>
        <QRCodeCanvas
          id="fgr-qr-canvas"
          value={JSON.stringify({
            fgr: selectedFGR?.fgr_number || createdFGRReceipt?.fgr_number || '',
            wo: selectedFGR?.wo_number || createdFGRReceipt?.wo_number || '',
            product: selectedFGR?.item_name || createdFGRReceipt?.item_name || '',
            qty: selectedFGR?.received_qty || createdFGRReceipt?.received_qty || 0,
            qc: selectedFGR?.inspection_number || createdFGRReceipt?.inspection_number || ''
          })}
          size={128}
        />
      </div>

    </div>
  );
}
