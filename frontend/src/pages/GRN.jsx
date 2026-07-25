import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Plus, X, Eye, Search, Filter, ArrowLeft, Package, Camera } from 'lucide-react';
import { QRCodeCanvas as QRCode } from 'qrcode.react';
import Barcode from 'react-barcode';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Html5Qrcode } from 'html5-qrcode';

const API = 'http://localhost:5000/api';
const getAuthHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

export default function GRN() {
  const [grns, setGrns] = useState([]);
  const [filteredGRNs, setFilteredGRNs] = useState([]);
  const [gatePasses, setGatePasses] = useState([]);
  const [stores, setStores] = useState([]);
  const [view, setView] = useState('list');
  const [loading, setLoading] = useState(false);
  const [selectedGRN, setSelectedGRN] = useState(null);
  const [printType, setPrintType] = useState(null);
  const [gpSearch, setGpSearch] = useState('');
  const [matchedGP, setMatchedGP] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const printRef = useRef(null);
  const scannerRef = useRef(null);

  const [filters, setFilters] = useState({
    status: '', from_date: '', to_date: '', supplier: ''
  });

  const [form, setForm] = useState({
    gp_id: '', supplier_id: '',
    grn_date: new Date().toISOString().split('T')[0],
    invoice_number: '', invoice_value: 0,
    store_id: '', po_number: '', remarks: '', items: [],
    qc_required: ''
  });

  useEffect(() => {
    fetchGRNs();
    fetchGatePasses();
    fetchStores();
  }, []);

  useEffect(() => {
    setFilteredGRNs(grns);
  }, [grns]);

  const fetchGRNs = async () => {
    try {
      const res = await axios.get(`${API}/grn`, getAuthHeader());
      setGrns(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchGatePasses = async () => {
    try {
      const res = await axios.get(`${API}/grn/open-gate-passes`, getAuthHeader());
      setGatePasses(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchStores = async () => {
    try {
      const res = await axios.get(`${API}/grn/stores`, getAuthHeader());
      setStores(res.data);
    } catch (err) { console.error(err); }
  };

  const applyFilters = () => {
    const result = grns.filter(g => {
      if (filters.status && g.status !== filters.status) return false;
      if (filters.supplier && !g.supplier_name?.toLowerCase().includes(filters.supplier.toLowerCase())) return false;
      if (filters.from_date && new Date(g.grn_date) < new Date(filters.from_date)) return false;
      if (filters.to_date && new Date(g.grn_date) > new Date(filters.to_date)) return false;
      return true;
    });
    setFilteredGRNs(result);
  };

  const clearFilters = () => {
    setFilters({ status: '', from_date: '', to_date: '', supplier: '' });
    setFilteredGRNs(grns);
  };

  const handleGPSearch = async (value) => {
    setGpSearch(value);
    const gp = gatePasses.find(g =>
      g.gp_number.toLowerCase().includes(value.toLowerCase())
    );
    if (gp) {
      setMatchedGP(gp);
      setForm(prev => ({
        ...prev,
        gp_id: gp.gp_id,
        supplier_id: gp.supplier_id,
        invoice_number: gp.invoice_number || ''
      }));
      try {
        const res = await axios.get(`${API}/grn/gate-pass-items/${gp.gp_id}`, getAuthHeader());
        const items = res.data.map(item => ({
          item_id: item.item_id,
          item_name: item.item_name,
          item_code: item.item_code,
          ordered_qty: item.expected_qty,
          received_qty: item.expected_qty,
          accepted_qty: item.expected_qty,
          rejected_qty: 0,
          unit: item.unit || 'Kg',
          unit_rate: 0,
          value: 0,
          batch_number: '',
          mfg_date: '',
          expiry_date: ''
        }));
        setForm(prev => ({ ...prev, items }));
      } catch (err) { console.error(err); }
    } else {
      setMatchedGP(null);
      setForm(prev => ({ ...prev, gp_id: '', supplier_id: '', items: [] }));
    }
  };

  const startScanner = () => {
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
            if (parsed.gp) scannedValue = parsed.gp;
          } catch (e) {
            // not JSON, treat as plain barcode text
          }
          handleGPSearch(scannedValue);
          stopScanner();
        },
        (errorMessage) => {}
      ).catch(err => {
        console.error('Camera start error:', err);
        alert('Could not access camera. Please check browser permissions.');
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

  const updateItem = (index, field, value) => {
    setForm(prev => {
      const newItems = prev.items.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        if (field === 'received_qty' || field === 'rejected_qty') {
          const received = parseFloat(field === 'received_qty' ? value : updated.received_qty) || 0;
          const rejected = parseFloat(field === 'rejected_qty' ? value : updated.rejected_qty) || 0;
          updated.accepted_qty = Math.max(0, received - rejected);
          updated.value = updated.accepted_qty * (parseFloat(updated.unit_rate) || 0);
        }
        if (field === 'unit_rate') {
          updated.value = parseFloat(value || 0) * (parseFloat(updated.accepted_qty) || 0);
        }
        return updated;
      });

      const totalValue = newItems.reduce((sum, item) => sum + (parseFloat(item.value) || 0), 0);

      return { ...prev, items: newItems, invoice_value: totalValue.toFixed(2) };
    });
  };

  const addManualItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, {
        item_id: '', item_name: '', item_code: '',
        ordered_qty: 0, received_qty: 0,
        accepted_qty: 0, rejected_qty: 0,
        unit: 'Kg', unit_rate: 0, value: 0,
        batch_number: '', mfg_date: '', expiry_date: ''
      }]
    }));
  };

  const removeItem = (index) => {
    setForm(prev => {
      const newItems = prev.items.filter((_, i) => i !== index);
      const totalValue = newItems.reduce((sum, item) => sum + (parseFloat(item.value) || 0), 0);
      return { ...prev, items: newItems, invoice_value: totalValue.toFixed(2) };
    });
  };

  const handleSubmit = async () => {
    if (!form.gp_id) return alert('Please select a Gate Pass');
    if (!form.store_id) return alert('Please select a Receiving Store');
    if (form.items.length > 0 && !form.qc_required) return alert('Please select whether QC Inspection is required');
    setLoading(true);
    try {
      const res = await axios.post(`${API}/grn`, form, getAuthHeader());
      const grn_id = res.data.grn_id;
      
      // Fetch full details of the newly created GRN (with generated items/id)
      const grnDetailRes = await axios.get(`${API}/grn/${grn_id}`, getAuthHeader());
      setSelectedGRN(grnDetailRes.data);
      setView('labels-generated');
      resetForm();
      fetchGRNs();
      fetchGatePasses();
    } catch (err) {
      alert('Error creating GRN');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      gp_id: '', supplier_id: '',
      grn_date: new Date().toISOString().split('T')[0],
      invoice_number: '', invoice_value: 0,
      store_id: '', po_number: '', remarks: '', items: [],
      qc_required: ''
    });
    setGpSearch('');
    setMatchedGP(null);
  };

  const handlePrintPDF = async () => {
    const element = document.getElementById('grn-print-area');
    if (!element) return;
    const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${selectedGRN.grn_number}.pdf`);
  };

  const printSingleLabelPDF = async (item) => {
    const labelCode = `MAT/2627/${String(item.grn_item_id).padStart(5, '0')}`;
    const element = document.getElementById(`label-print-${item.grn_item_id}`);
    if (!element) return;
    const canvas = await html2canvas(element, { scale: 3, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [50, 25]
    });
    pdf.addImage(imgData, 'PNG', 2, 2, 46, 21);
    pdf.save(`Label_${labelCode}.pdf`);
  };

  const handleDownloadCodePDF = async () => {
    const element = printRef.current;
    if (!element) return;
    const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${selectedGRN.grn_number}_${printType}.pdf`);
  };

  const getStatusBadge = (status) => {
    const styles = {
      'Draft': 'bg-gray-100 text-gray-600',
      'Submitted': 'bg-amber-100 text-amber-700',
      'QC Pending': 'bg-blue-100 text-blue-700',
      'Completed': 'bg-green-100 text-green-700',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || styles['Draft']}`}>
        {status}
      </span>
    );
  };

  // ─── LABELS GENERATED SUCCESS VIEW ───────────────────────────
  if (view === 'labels-generated' && selectedGRN) {
    const totalLabels = (selectedGRN.items || []).length;
    return (
      <div className="space-y-6 text-slate-700">
        
        {/* Header with actions */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🏷️</span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-800">Labels Generated</h1>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">
                Stickers ready for printing and posting on packages.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('detail')}
              className="flex items-center gap-1.5 text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg transition"
            >
              👁️ View GRN
            </button>
            <button
              onClick={() => window.location.href = '/quality'}
              className="flex items-center gap-1.5 text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition shadow-sm"
            >
              🛡️ QC Inspection
            </button>
            <button
              onClick={() => { setView('list'); setSelectedGRN(null); }}
              className="flex items-center gap-1.5 text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg transition"
            >
              List
            </button>
          </div>
        </div>

        {/* Status alert banner */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold">
              ✓
            </div>
            <div>
              <p className="text-sm font-bold text-green-800">
                GRN <span className="underline">{selectedGRN.grn_number}</span> submitted successfully.
              </p>
              <p className="text-slate-500 text-xs mt-0.5">{totalLabels} label(s) generated.</p>
            </div>
          </div>
          <span className="bg-amber-100 text-amber-700 border border-amber-250 px-3 py-1 rounded text-xs font-black uppercase tracking-wider">
            {selectedGRN.status || 'Submitted'}
          </span>
        </div>

        {/* Action bar (Copies, Barcode, PDF) */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 flex items-center gap-4 flex-wrap text-xs font-bold">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-semibold">Copies:</span>
            <select className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-700 focus:outline-none">
              <option>1</option><option>2</option><option>3</option>
            </select>
          </div>
          <button className="flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition shadow-sm">
            📊 Barcode
          </button>
          <button className="flex items-center gap-1 border border-slate-305 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg transition">
            ⊞ QR Code
          </button>
          <button
            onClick={() => handlePrintPDF()}
            className="flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition shadow-sm"
          >
            🖨️ Print All as PDF
          </button>
          <button className="flex items-center gap-1 border border-slate-305 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg transition">
            Print All ZPL
          </button>
        </div>

        {/* Labels list */}
        <div className="space-y-4">
          {(selectedGRN.items || []).map((item) => {
            const labelCode = `MAT/2627/${String(item.grn_item_id).padStart(5, '0')}`;
            return (
              <div
                key={item.grn_item_id}
                className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:border-slate-300 transition"
              >
                <div className="flex items-center gap-4 flex-wrap md:flex-nowrap">
                  {/* Visual Barcode Column */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                    <Barcode value={labelCode} width={1.5} height={40} fontSize={8} />
                  </div>
                  
                  {/* Description Column */}
                  <div>
                    <h3 className="text-slate-800 font-extrabold text-sm tracking-tight">{item.item_name}</h3>
                    <p className="text-slate-500 text-xs mt-1 leading-relaxed font-semibold">
                      Batch: <span className="text-slate-700 font-bold">{item.batch_number || '-'}</span> | Qty: <span className="text-green-600 font-extrabold">{item.received_qty} {item.unit}</span> | Mfg: {item.mfg_date || '-'} Exp: {item.expiry_date || '-'} | Store: <span className="text-orange-500 font-bold">{selectedGRN.store_name}</span>
                    </p>
                  </div>
                </div>

                {/* Actions and Badge */}
                <div className="flex items-center gap-3 self-end md:self-center">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-250">
                    {item.status === 'QC Pending' ? 'QCHold' : item.status}
                  </span>
                  <button className="border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1 rounded text-xs font-bold transition">
                    ZPL
                  </button>
                  <button
                    onClick={() => printSingleLabelPDF(item)}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded text-xs font-bold transition shadow-sm"
                  >
                    PDF
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Offscreen Printable Label Stamps */}
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
          {(selectedGRN.items || []).map((item) => {
            const labelCode = `MAT/2627/${String(item.grn_item_id).padStart(5, '0')}`;
            return (
              <div
                key={item.grn_item_id}
                id={`label-print-${item.grn_item_id}`}
                className="w-[188px] h-[94px] p-2 bg-white flex flex-col items-center justify-center text-black"
                style={{ fontFamily: 'monospace' }}
              >
                <p className="text-[8px] font-black mb-0.5 text-center">Jayashree Polymers</p>
                <Barcode value={labelCode} width={1.2} height={30} fontSize={8} margin={0} />
                <p className="text-[7px] text-center mt-1 font-bold truncate w-full">{item.item_name}</p>
                <p className="text-[7px] font-bold">{item.received_qty} {item.unit} | B: {item.batch_number || '-'}</p>
              </div>
            );
          })}
        </div>

      </div>
    );
  }

  // ─── GRN DETAIL VIEW ─────────────────────────────────────────
  if (selectedGRN) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">{selectedGRN.grn_number}</h1>
              <span className="text-xs">{getStatusBadge(selectedGRN.status)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSelectedGRN(null); setPrintType(null); }}
              className="flex items-center gap-2 border border-slate-300 text-slate-600 px-3 py-2 rounded-lg text-sm hover:bg-slate-50 transition"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={() => { setSelectedGRN(null); setPrintType(null); }}
              className="text-slate-400 hover:text-red-500 border border-slate-200 p-2 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div id="grn-print-area" className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
          <div className="text-center mb-4 pb-4 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-800">Jayashree Polymers (India) Pvt. Ltd.</h2>
            <p className="text-slate-500 text-xs">IMT Manesar, Gurugram, Haryana</p>
            <h3 className="text-base font-bold text-orange-600 mt-1">Goods Receipt Note</h3>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-5">
  <div className="grid grid-cols-2 gap-8">

    {/* Left Side */}
    <div className="space-y-4">
      <div>
        <span className="text-slate-500 text-sm">Supplier:</span>
        <p className="font-bold text-slate-800">
          {selectedGRN.supplier_name}
        </p>
      </div>

      <div>
        <span className="text-slate-500 text-sm">Invoice:</span>
        <p className="font-semibold text-slate-700">
          {selectedGRN.invoice_number || '-'}
        </p>
      </div>

      <div>
        <span className="text-slate-500 text-sm">Gate Pass:</span>
        <p className="font-semibold text-slate-700">
          {selectedGRN.gp_number || '-'}
        </p>
      </div>

      <div>
        <span className="text-slate-500 text-sm">Date:</span>
        <p className="font-semibold text-slate-700">
          {new Date(selectedGRN.grn_date).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          })}
        </p>
      </div>
    </div>

    {/* Right Side */}
    <div className="space-y-4">
      <div>
        <span className="text-slate-500 text-sm">Store:</span>
        <p className="font-bold text-slate-800">
          {selectedGRN.store_name}
        </p>
      </div>

      <div>
        <span className="text-slate-500 text-sm">Value:</span>
        <p className="font-bold text-green-600">
          ₹{Number(selectedGRN.invoice_value || 0).toLocaleString('en-IN')}
        </p>
      </div>

      <div>
        <span className="text-slate-500 text-sm">PO:</span>
        <p className="font-semibold text-slate-700">
          {selectedGRN.po_number || '-'}
        </p>
      </div>

      <div>
        <span className="text-slate-500 text-sm">Lines:</span>
        <p className="font-semibold text-slate-700">
          {(selectedGRN.items || []).length}
          {' | '}
          ₹{Number(selectedGRN.invoice_value || 0).toLocaleString('en-IN')}
        </p>
      </div>
    </div>

  </div>
</div>

          <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
              <span className="font-semibold text-slate-700 text-sm">Items ({(selectedGRN.items || []).length})</span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['#', 'ITEM', 'BATCH', 'QTY', 'UOM', 'RATE', 'VALUE', 'EXP'].map(h => (
                    <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(selectedGRN.items || []).length === 0 ? (
                  <tr><td colSpan="8" className="text-center py-6 text-slate-400">No items</td></tr>
                ) : (
                  (selectedGRN.items || []).map((item, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-700">
  {i + 1}
</td>
<td className="px-4 py-2 text-slate-600">
  {item.item_code}
</td>
                      <td className="px-4 py-2 font-medium text-slate-800">{item.item_name}</td>
                      <td className="px-4 py-2 text-slate-500">{item.batch_number || '—'}</td>
                      <td className="px-4 py-2 text-slate-700">{parseFloat(item.received_qty || 0).toFixed(3)}</td>
                      <td className="px-4 py-2 text-slate-500">{item.unit}</td>
                      <td className="px-4 py-2 text-slate-500">{item.unit_rate || '—'}</td>
                      <td className="px-4 py-2 text-slate-500">{item.value || '—'}</td>
                      <td className="px-4 py-2 text-slate-500">{item.expiry_date || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center text-xs text-slate-500 mt-4">
            <div><div className="h-10 border-b border-slate-300 mb-1"></div>Received By</div>
            <div><div className="h-10 border-b border-slate-300 mb-1"></div>Checked By</div>
            <div><div className="h-10 border-b border-slate-300 mb-1"></div>Approved By</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-slate-600 text-sm">Copies:</span>
            <select className="border border-slate-300 rounded px-2 py-1 text-sm">
              <option>1</option><option>2</option><option>3</option>
            </select>
          </div>
          <button
            onClick={handlePrintPDF}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            🖨️ Print All as PDF
          </button>
          <button
            onClick={() => setPrintType(printType === 'barcode' ? null : 'barcode')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition border ${
              printType === 'barcode' ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            📊 Barcode
          </button>
          <button
            onClick={() => setPrintType(printType === 'qr' ? null : 'qr')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition border ${
              printType === 'qr' ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            ⊞ QR Code
          </button>
        </div>

        {printType && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4 flex flex-col items-center">
            <p className="text-slate-500 text-sm mb-4 font-medium">
              {printType === 'qr' ? 'QR Code Preview' : 'Barcode Preview'}
            </p>
            <div ref={printRef} className="flex flex-col items-center p-6 bg-white">
              <p className="text-slate-800 font-bold text-sm mb-2">Jayashree Polymers (India) Pvt. Ltd.</p>
              <p className="text-slate-500 text-xs mb-4">{selectedGRN.grn_number} | {selectedGRN.supplier_name}</p>
              {printType === 'qr' && (
                <>
                  <QRCode
                    value={JSON.stringify({
                      grn: selectedGRN.grn_number,
                      supplier: selectedGRN.supplier_name,
                      date: selectedGRN.grn_date,
                      gp: selectedGRN.gp_number,
                      store: selectedGRN.store_name
                    })}
                    size={180}
                  />
                  <p className="text-slate-600 text-sm mt-3 font-medium">{selectedGRN.grn_number}</p>
                  <p className="text-slate-400 text-xs mt-1">{selectedGRN.supplier_name}</p>
                </>
              )}
              {printType === 'barcode' && (
                <Barcode value={selectedGRN.grn_number} width={2} height={80} fontSize={14} />
              )}
            </div>
            <button
              onClick={handleDownloadCodePDF}
              className="mt-2 flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              ⬇ Download as PDF
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-700 mb-4">Labels ({(selectedGRN.items || []).length})</h3>
          <div className="space-y-3">
            {(selectedGRN.items || []).map((item, i) => (
              <div key={i} className="flex items-center justify-between border border-slate-200 rounded-lg p-4">
                <div>
                  <p className="font-bold text-slate-800">
  {item.item_name}
</p>

<p className="text-slate-500 text-sm">
  {item.received_qty} {item.unit}
  {' | Batch: '}
  {item.batch_number || '-'}
</p>

<p className="text-slate-500 text-sm">
  Mfg: {item.mfg_date || '-'}
  {' | Exp: '}
  {item.expiry_date || '-'}
</p>

<p className="text-slate-500 text-sm">
  Store: {selectedGRN.store_name}
</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-green-600 bg-green-50 border border-green-200 px-3 py-1 rounded-full text-xs font-medium">
                    ✓ Available
                  </span>
                  <button className="border border-slate-300 text-slate-600 px-3 py-1 rounded text-xs hover:bg-slate-50">
                    PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── NEW GRN FORM VIEW ───────────────────────────────────────
  if (view === 'new') {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-orange-500" />
            <h1 className="text-xl font-bold text-slate-800">New GRN</h1>
          </div>
          <button
            onClick={() => { setView('list'); resetForm(); }}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800 border border-slate-300 px-3 py-2 rounded-lg text-sm transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Gate Pass No <span className="text-red-500">*</span>
            </label>
            <div className={`flex items-center gap-2 border-2 rounded-lg px-3 py-2 ${matchedGP ? 'border-green-400 bg-green-50' : 'border-dashed border-slate-300'}`}>
              <button
                type="button"
                onClick={startScanner}
                className="text-slate-400 hover:text-orange-500 transition flex-shrink-0"
                title="Scan with camera"
              >
                <Camera className="w-4 h-4" />
              </button>
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={gpSearch}
                onChange={e => handleGPSearch(e.target.value)}
                placeholder="Scan barcode or type GP/2026/..."
                className="flex-1 outline-none text-sm bg-transparent"
              />
            </div>
            {matchedGP && (
              <p className="text-green-600 text-xs mt-1">✅ Matched: {matchedGP.gp_number} — {matchedGP.supplier_name}</p>
            )}
            {gatePasses.length === 0 && (
              <p className="text-slate-400 text-xs mt-1">No available Gate Passes found.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Receiving Store <span className="text-red-500">*</span>
            </label>
            <select
              value={form.store_id}
              onChange={e => setForm({ ...form, store_id: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
            >
              <option value="">Select store...</option>
              {stores.map(s => (
                <option key={s.store_id} value={s.store_id}>{s.store_name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Invoice No</label>
              <input type="text" value={form.invoice_number}
                onChange={e => setForm({ ...form, invoice_number: e.target.value })}
                placeholder="Supplier invoice number"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Date</label>
              <input type="date" value={form.grn_date}
                onChange={e => setForm({ ...form, grn_date: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Value (₹)</label>
              <input type="number" value={form.invoice_value} disabled
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-100 text-slate-600" />
              <p className="text-slate-400 text-xs mt-1">Auto-calculated from line items</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">PO No</label>
              <input type="text" value={form.po_number}
                onChange={e => setForm({ ...form, po_number: e.target.value })}
                placeholder="Purchase order reference"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-700">Items Received</h3>
              <button onClick={addManualItem}
                className="flex items-center gap-1 border border-slate-300 text-slate-600 px-3 py-1.5 rounded-lg text-sm hover:bg-slate-50 transition">
                <Plus className="w-4 h-4" /> Add Item
              </button>
            </div>

            {form.items.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Load a Gate Pass to auto-fill items, or click "Add Item".</p>
              </div>
            ) : (
              <div className="space-y-3">
                {form.items.map((item, index) => (
                  <div key={index} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-slate-700 text-sm">
                        Item {index + 1} {item.item_name ? `— ${item.item_name}` : ''}
                      </span>
                      <button onClick={() => removeItem(index)} className="text-red-400 hover:text-red-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Ordered Qty</label>
                        <input type="number" value={item.ordered_qty}
                          onChange={e => updateItem(index, 'ordered_qty', e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Received Qty</label>
                        <input type="number" value={item.received_qty}
                          onChange={e => updateItem(index, 'received_qty', e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Rejected Qty</label>
                        <input type="number" value={item.rejected_qty}
                          onChange={e => updateItem(index, 'rejected_qty', e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Accepted Qty</label>
                        <input type="number" value={item.accepted_qty} disabled
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-green-50 text-green-700 font-medium" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">UOM</label>
                        <select value={item.unit} onChange={e => updateItem(index, 'unit', e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none">
                          <option>Kg</option>
                          <option>Nos</option>
                          <option>Ltr</option>
                          <option>Box</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Unit Rate (₹)</label>
                        <input type="number" value={item.unit_rate}
                          onChange={e => updateItem(index, 'unit_rate', e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Batch No</label>
                        <input type="text" value={item.batch_number}
                          onChange={e => updateItem(index, 'batch_number', e.target.value)}
                          placeholder="Batch#"
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Mfg Date</label>
                        <input type="date" value={item.mfg_date}
                          onChange={e => updateItem(index, 'mfg_date', e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Expiry Date</label>
                        <input type="date" value={item.expiry_date}
                          onChange={e => updateItem(index, 'expiry_date', e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {form.items.length > 0 && (
            <div className="border border-amber-300 bg-amber-50 rounded-xl p-5">
              <p className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                ⚠️ QC Inspection Required? <span className="text-red-500">*</span>
              </p>
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="qc_required"
                    checked={form.qc_required === 'Yes'}
                    onChange={() => setForm({ ...form, qc_required: 'Yes' })}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium text-slate-800 text-sm">Yes — QC Inspection Required</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      Labels will be set to <strong>QC Hold</strong>. QC team will inspect before material is available.
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="qc_required"
                    checked={form.qc_required === 'No'}
                    onChange={() => setForm({ ...form, qc_required: 'No' })}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium text-slate-800 text-sm">No — Skip QC</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      Labels will be immediately <strong>Available</strong> for put-away. Use only for pre-approved items.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            <button
              onClick={() => { setView('list'); resetForm(); }}
              className="border border-slate-300 text-slate-600 px-6 py-2 rounded-lg font-medium hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-medium transition disabled:opacity-50"
            >
              {loading ? 'Submitting...' : '➤ Submit GRN'}
            </button>
          </div>
        </div>

        {/* Camera Scanner Modal */}
        {showScanner && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800">Scan Gate Pass</h3>
                <button onClick={stopScanner} className="text-slate-400 hover:text-red-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div id="qr-reader" className="rounded-lg overflow-hidden"></div>
              <p className="text-slate-500 text-xs text-center mt-3">
                Point camera at the QR code or barcode on the Gate Pass slip
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── LIST VIEW ───────────────────────────────────────────────
  return (
    <div className="bg-[#121212] text-slate-200 min-h-screen p-6 font-sans space-y-6">
      <div className="flex items-center justify-between border-b border-[#2a2a2a] pb-4">
        <div>
          <h1 className="text-lg font-black text-white">Goods Receipt Notes</h1>
          <p className="text-xs text-slate-400 font-medium">Manage all incoming material receipts</p>
        </div>
        <button
          onClick={() => setView('new')}
          className="flex items-center gap-2 bg-[#10b981] hover:bg-[#059669] text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg shadow-emerald-500/10 transition"
        >
          <Plus className="w-4 h-4" /> New GRN
        </button>
      </div>

      <div className="bg-[#1e1e1e] rounded-xl border border-[#2a2a2a] p-4 shadow-md space-y-3">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Status</label>
            <select value={filters.status}
              onChange={e => setFilters({ ...filters, status: e.target.value })}
              className="w-full bg-[#121212] border border-[#333] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold">
              <option value="">All Statuses</option>
              <option>Draft</option>
              <option>Submitted</option>
              <option>QC Pending</option>
              <option>Completed</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-semibold">From Date</label>
            <input type="date" value={filters.from_date}
              onChange={e => setFilters({ ...filters, from_date: e.target.value })}
              className="w-full bg-[#121212] border border-[#333] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium" />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-semibold">To Date</label>
            <input type="date" value={filters.to_date}
              onChange={e => setFilters({ ...filters, to_date: e.target.value })}
              className="w-full bg-[#121212] border border-[#333] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium" />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Supplier</label>
            <input type="text" value={filters.supplier}
              onChange={e => setFilters({ ...filters, supplier: e.target.value })}
              placeholder="Supplier name..."
              className="w-full bg-[#121212] border border-[#333] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium" />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={applyFilters}
            className="flex items-center gap-1 bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-600 transition">
            <Filter className="w-3.5 h-3.5" /> Filter
          </button>
          <button onClick={clearFilters}
            className="border border-[#333] text-slate-400 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-[#252525] transition">
            ✕ Clear
          </button>
        </div>
      </div>

      <div className="bg-[#1e1e1e] rounded-xl border border-[#2a2a2a] overflow-hidden shadow-lg">
        <div className="px-4 py-3 border-b border-[#2a2a2a]">
          <h2 className="text-xs font-black uppercase text-white tracking-wider">
            Existing GRNs ({filteredGRNs.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-semibold text-slate-200">
            <thead className="bg-[#252525] border-b border-[#333]">
              <tr>
                {['GRN NO', 'DATE', 'SUPPLIER', 'STORE', 'INVOICE', 'STATUS', ''].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-black text-slate-200 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a2a]">
              {filteredGRNs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-400">No GRNs found.</td>
                </tr>
              ) : (
                filteredGRNs.map(grn => (
                  <tr key={grn.grn_id}
                    className="hover:bg-[#252525] border-b border-[#2a2a2a] transition cursor-pointer"
                    onClick={async () => {
                      try {
                        const res = await axios.get(`${API}/grn/${grn.grn_id}`, getAuthHeader());
                        setSelectedGRN(res.data);
                        setPrintType(null);
                      } catch (err) {
                        setSelectedGRN(grn);
                        setPrintType(null);
                      }
                    }}>
                    <td className="px-6 py-3 font-extrabold text-emerald-400 text-xs">{grn.grn_number}</td>
                    <td className="px-6 py-3 text-slate-300 font-mono text-xs">
                      {new Date(grn.grn_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </td>
                    <td className="px-6 py-3 text-white font-extrabold text-xs">{grn.supplier_name}</td>
                    <td className="px-6 py-3 text-slate-300 text-xs font-medium">{grn.store_name}</td>
                    <td className="px-6 py-3 text-slate-300 text-xs font-medium">{grn.invoice_number || '-'}</td>
                    <td className="px-6 py-3">{getStatusBadge(grn.status)}</td>
                    <td className="px-6 py-3"><Eye className="w-4 h-4 text-emerald-400" /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}