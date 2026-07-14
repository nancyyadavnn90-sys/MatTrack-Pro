import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Search, Camera, X, ArrowLeft, CheckCircle2, AlertTriangle, ShieldAlert,
  CheckCircle, Tag
} from 'lucide-react';
import Barcode from 'react-barcode';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { QRCodeCanvas as QRCode } from 'qrcode.react';

const API = 'http://localhost:5000/api';

const getAuthHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

export default function Quality() {
  const [activeTab, setActiveTab] = useState('inward');
  const [loading, setLoading] = useState(false);
  
  // Lists
  const [queue, setQueue] = useState({ inward: [], inprocess: [], final: [] });
  const [passedList, setPassedList] = useState([]);
  const [ncsList, setNcsList] = useState([]);
  
  // Search filter inside lists 
  const [filterText, setFilterText] = useState('');
  
  // Active workflow detail states
  const [viewState, setViewState] = useState('list'); // 'list', 'inspect-form', 'nc-detail', 'inspect-detail'
  const [selectedItem, setSelectedItem] = useState(null); // active item for inspection
  const [selectedNC, setSelectedNC] = useState(null); // active NC details
  const [selectedInspectDetail, setSelectedInspectDetail] = useState(null); // active inspection detail view
  
  // Sticker printing states
  const [printType, setPrintType] = useState('barcode'); // 'barcode', 'qrcode'
  const [packSize, setPackSize] = useState('');
  const [isSplit, setIsSplit] = useState(false);
  
  // Form states
  const [inspectForm, setInspectForm] = useState({
    inspected_qty: '',
    accepted_qty: '',
    batch_number: '',
    mfg_date: '',
    expiry_date: '',
    remarks: '',
    defect_type: '',
    defect_description: '',
    severity: 'Minor'
  });
  
  const [visualCheck, setVisualCheck] = useState('Pass');
  const [qcParams, setQcParams] = useState([
    { name: 'Hardness (Shore A)', min: 60, max: 70, unit: '', value: '', status: 'Pending' },
    { name: 'Specific Gravity', min: 1.10, max: 1.20, unit: 'g/cm³', value: '', status: 'Pending' },
    { name: 'Tensile Strength', min: 10, max: null, unit: 'MPa', value: '', status: 'Pending' },
    { name: 'Elongation at Break', min: 250, max: null, unit: '%', value: '', status: 'Pending' },
    { name: 'Moisture Content', min: null, max: 0.5, unit: '%', value: '', status: 'Pending' }
  ]);
  
  const [dispositionForm, setDispositionForm] = useState({
    disposition: 'Reject',
    root_cause: '',
    corrective_action: '',
  });



  // Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const scannerRef = useRef(null);

  useEffect(() => {
    fetchQueue();
    fetchPassedInspections();
    fetchNonConformances();
  }, []);

  useEffect(() => {
    // Re-fetch when switching tabs
    if (activeTab === 'inward' || activeTab === 'inprocess' || activeTab === 'final') {
      fetchQueue();
    } else if (activeTab === 'nc') {
      fetchNonConformances();
    } else if (activeTab === 'passed') {
      fetchPassedInspections();
    }
  }, [activeTab]);

  // ─── API FETCHERS ────────────────────────────────────────────
  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/qc/queue`, getAuthHeader());
      setQueue(res.data);
    } catch (err) {
      console.error('Error fetching QC queue:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPassedInspections = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/qc/passed`, getAuthHeader());
      setPassedList(res.data);
    } catch (err) {
      console.error('Error fetching passed inspections:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchNonConformances = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/qc/ncs`, getAuthHeader());
      setNcsList(res.data);
    } catch (err) {
      console.error('Error fetching NCRs:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadNCDetail = async (id) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/qc/ncs/${id}`, getAuthHeader());
      setSelectedNC(res.data);
      setDispositionForm({
        disposition: res.data.disposition || 'Reject',
        root_cause: res.data.root_cause || '',
        corrective_action: res.data.corrective_action || '',
        remarks: res.data.remarks || ''
      });
      setViewState('nc-detail');
    } catch (err) {
      alert('Error loading NC details.');
    } finally {
      setLoading(false);
    }
  };

  const loadInspectionDetail = async (id) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/qc/inspections/${id}`, getAuthHeader());
      setSelectedInspectDetail(res.data);
      setViewState('inspect-detail');
    } catch (err) {
      alert('Error loading inspection details.');
    } finally {
      setLoading(false);
    }
  };

  // ─── BARCODE SEARCH QUEUE ────────────────────────────────────
  const handleBarcodeSearch = async (code) => {
    if (!code) return;
    setLoading(true);
    try {
      // Find matching item in queue
      // Look in Inward
      let found = queue.inward.find(item => `MAT/2627/${String(item.reference_id).padStart(5, '0')}` === code || item.grn_number === code);
      let type = 'Inward';
      
      // Look in In-Process
      if (!found) {
        found = queue.inprocess.find(item => `WIP/2627/${String(item.reference_id).padStart(5, '0')}` === code || item.batch_number === code);
        type = 'In-Process';
      }
      
      // Look in Final
      if (!found) {
        found = queue.final.find(item => `FGL/2627/${String(item.reference_id).padStart(5, '0')}` === code || item.fgr_number === code);
        type = 'Final';
      }

      if (found) {
        startInspection(found, type);
      } else {
        // Try looking up completed inspections
        try {
          const res = await axios.get(`${API}/qc/inspections/label/${encodeURIComponent(code)}`, getAuthHeader());
          if (res.data) {
            setSelectedInspectDetail(res.data);
            setViewState('inspect-detail');
          } else {
            alert('Item not found in pending queue or completed inspections.');
          }
        } catch (lookupErr) {
          alert('Item not found in pending queue or completed inspections.');
        }
      }
    } catch (err) {
      alert('Error searching barcode.');
    } finally {
      setLoading(false);
    }
  };

  // ─── WORKFLOW FUNCTIONS ──────────────────────────────────────
  const startInspection = (item, type) => {
    setSelectedItem({ ...item, inspection_type: type });

    // Formatting existing dates
    const mfg = item.expiry_date ? new Date(new Date(item.expiry_date).getTime() - 365*24*60*60*1000).toISOString().split('T')[0] : '';
    const exp = item.expiry_date ? new Date(item.expiry_date).toISOString().split('T')[0] : '';

    setInspectForm({
      inspected_qty: item.quantity,
      accepted_qty: item.quantity,
      batch_number: item.batch_number || '',
      mfg_date: mfg || new Date().toISOString().split('T')[0],
      expiry_date: exp || new Date(new Date().getTime() + 60*24*60*60*1000).toISOString().split('T')[0],
      remarks: '',
      defect_type: '',
      defect_description: '',
      severity: 'Minor'
    });
    setVisualCheck('Pass');

    // Reset parameters
    setQcParams([
      { name: 'Hardness (Shore A)', min: 60, max: 70, unit: '', value: '', status: 'Pending' },
      { name: 'Specific Gravity', min: 1.10, max: 1.20, unit: 'g/cm³', value: '', status: 'Pending' },
      { name: 'Tensile Strength', min: 10, max: null, unit: 'MPa', value: '', status: 'Pending' },
      { name: 'Elongation at Break', min: 250, max: null, unit: '%', value: '', status: 'Pending' },
      { name: 'Moisture Content', min: null, max: 0.5, unit: '%', value: '', status: 'Pending' }
    ]);

    setViewState('inspect-form');
  };

  const handleInspectionSubmit = async (e) => {
    e.preventDefault();
    const acc = parseFloat(inspectForm.accepted_qty || 0);
    const total = parseFloat(inspectForm.inspected_qty || 0);
    const rej = total - acc;

    if (acc < 0 || acc > total) {
      alert('Accepted quantity must be between 0 and inspected quantity.');
      return;
    }

    if (rej > 0 && !inspectForm.defect_type) {
      alert('Defect type is required since some quantity was rejected.');
      return;
    }

    // Summarize QC testing values inside remarks
    let finalRemarks = inspectForm.remarks;
    const testRuns = qcParams.filter(p => p.value !== '');
    if (testRuns.length > 0) {
      const runSummaries = testRuns.map(p => `${p.name}: ${p.value}${p.unit} (${p.status})`).join(', ');
      finalRemarks = finalRemarks ? `${finalRemarks} | Tests: [${runSummaries}]` : `Tests: [${runSummaries}]`;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/qc/inspections`, {
        inspection_type: selectedItem.inspection_type,
        reference_id: selectedItem.reference_id,
        item_id: selectedItem.item_id,
        inspected_qty: total,
        accepted_qty: acc,
        rejected_qty: rej,
        remarks: finalRemarks,
        defect_type: inspectForm.defect_type,
        defect_description: inspectForm.defect_description,
        severity: inspectForm.severity,
        // Verified batch number and dates
        batch_number: inspectForm.batch_number,
        mfg_date: inspectForm.mfg_date,
        expiry_date: inspectForm.expiry_date
      }, getAuthHeader());

      alert('Inspection submitted successfully!');
      setViewState('list');
      setSelectedItem(null);
      fetchQueue();
      fetchNonConformances();
    } catch (err) {
      alert(err.response?.data?.message || 'Inspection failed');
    } finally {
      setLoading(false);
    }
  };

  const handleParamValueChange = (index, value) => {
    setQcParams(prev => {
      const updated = [...prev];
      const p = updated[index];
      p.value = value;

      if (value === '') {
        p.status = 'Pending';
      } else {
        const valNum = parseFloat(value);
        if (isNaN(valNum)) {
          p.status = 'Pending';
        } else {
          let pass = true;
          if (p.min !== null && valNum < p.min) pass = false;
          if (p.max !== null && valNum > p.max) pass = false;
          p.status = pass ? 'Pass' : 'Fail';
        }
      }

      // Automatically toggle visual check to 'Fail' and accepted qty to 0 if any parameter fails
      const hasFailure = updated.some(item => item.status === 'Fail');
      if (hasFailure) {
        setVisualCheck('Fail');
        setInspectForm(f => ({
          ...f,
          accepted_qty: '0'
        }));
      }

      return updated;
    });
  };

  const handleNCDispositionSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/qc/ncs/${selectedNC.nc_id}/close`, dispositionForm, getAuthHeader());
      alert('Non-conformance report closed successfully!');
      setViewState('list');
      setSelectedNC(null);
      fetchNonConformances();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to close NC');
    } finally {
      setLoading(false);
    }
  };

  // ─── SCANNER HANDLERS ────────────────────────────────────────
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
            if (parsed.label) scannedValue = parsed.label;
            else if (parsed.grn) scannedValue = parsed.grn;
          } catch (e) {
            // Not JSON
          }
          handleBarcodeSearch(scannedValue);
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

  const formatDateSafe = (dateStr) => {
    if (!dateStr || String(dateStr).startsWith('0000') || dateStr === '—') return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Status badges helper
  const getNCStatusBadge = (status) => {
    const styles = {
      'Open': 'bg-amber-100 text-amber-700 border-amber-250',
      'Under Review': 'bg-blue-100 text-blue-700 border-blue-200',
      'Closed': 'bg-slate-100 text-slate-500 border-slate-200'
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {status}
      </span>
    );
  };

  const getResultBadge = (result) => {
    const styles = {
      'Accepted': 'bg-green-100 text-green-700 border-green-200',
      'Partially Accepted': 'bg-amber-100 text-amber-700 border-amber-200',
      'Rejected': 'bg-red-100 text-red-700 border-red-200',
      'Pending': 'bg-slate-100 text-slate-500 border-slate-200'
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${styles[result] || 'bg-gray-100 text-gray-700'}`}>
        {result}
      </span>
    );
  };

  const printDirectLabelPDF = async (item) => {
    if (!item || !item.label_number) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/qc/inspections/label/${encodeURIComponent(item.label_number)}`, getAuthHeader());
      const inspectDetail = res.data;
      setSelectedInspectDetail(inspectDetail);
      
      setTimeout(async () => {
        try {
          const element = document.getElementById(`sticker-offscreen-1`);
          if (element) {
            const canvas = await html2canvas(element, { 
              scale: 3, 
              backgroundColor: '#ffffff',
              useCORS: true,
              logging: false
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
              orientation: 'landscape',
              unit: 'mm',
              format: [50, 25]
            });
            pdf.addImage(imgData, 'PNG', 2, 2, 46, 21);
            pdf.save(`Label_${inspectDetail.label_number.split('/').join('_')}.pdf`);
          } else {
            alert('Failed to render sticker element offscreen.');
          }
        } catch (printErr) {
          alert('Failed to generate sticker PDF.');
        } finally {
          setSelectedInspectDetail(null);
          setLoading(false);
        }
      }, 600);
    } catch (err) {
      alert('Failed to load inspection details for printing.');
      setLoading(false);
    }
  };

  const handlePrintStickerPDF = async () => {
    if (!selectedInspectDetail) return;
    try {
      const total = parseFloat(selectedInspectDetail.accepted_qty || 0);
      const size = parseFloat(packSize || 0);
      
      let labels = [];
      if (size > 0 && total > 0) {
        let remaining = total;
        let idx = 1;
        while (remaining > 0) {
          const currentQty = Math.min(size, remaining);
          labels.push({
            index: idx,
            qty: currentQty,
            code: selectedInspectDetail.label_number || 'N/A'
          });
          remaining -= currentQty;
          idx++;
        }
      } else {
        labels.push({
          index: 1,
          qty: total,
          code: selectedInspectDetail.label_number || 'N/A'
        });
      }

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [50, 25]
      });

      let addedPagesCount = 0;

      for (let i = 0; i < labels.length; i++) {
        const label = labels[i];
        const elementId = `sticker-offscreen-${label.index}`;
        const element = document.getElementById(elementId);
        if (!element) {
          console.warn(`Sticker element not found: ${elementId}`);
          continue;
        }

        if (addedPagesCount > 0) {
          pdf.addPage([50, 25], 'landscape');
        }

        const canvas = await html2canvas(element, { 
          scale: 3, 
          backgroundColor: '#ffffff',
          useCORS: true,
          logging: false
        });
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 2, 2, 46, 21);
        addedPagesCount++;
      }

      if (addedPagesCount === 0) {
        alert('Could not find any label sticker elements in the DOM to print.');
        return;
      }

      pdf.save(`Stickers_${selectedInspectDetail.inspection_number}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate sticker PDF: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">

      {/* RELATED / QUICK LINKS BAR */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">Related</span>
        <button
          onClick={() => window.location.href = '/grn'}
          className="flex items-center gap-1.5 bg-slate-50 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-100 transition"
        >
          📦 GRN
        </button>
        <button
          onClick={() => window.location.href = '/gate-pass'}
          className="flex items-center gap-1.5 bg-slate-50 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-100 transition"
        >
          🚚 Gate Pass
        </button>
        <button
          onClick={() => window.location.href = '/inventory'}
          className="flex items-center gap-1.5 bg-slate-50 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-100 transition"
        >
          🗃️ Store
        </button>
      </div>

      {/* HEADER SECTION */}
      {viewState === 'list' && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <ShieldAlert className="w-7 h-7 text-orange-500" /> Quality Control
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Inspect inward materials, track WIP quality, review FG batches, and resolve NCRs.
            </p>
          </div>

          {/* SUB-TABS NAVIGATION */}
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm self-start overflow-x-auto max-w-full">
            {[
              { id: 'inward', label: 'Inward', icon: '📥' },
              { id: 'inprocess', label: 'In-Process', icon: '⚙️' },
              { id: 'final', label: 'Final', icon: '📦' },
              { id: 'nc', label: 'NCs', icon: '⚠️' },
              { id: 'passed', label: 'Passed', icon: '✓' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => { setActiveTab(t.id); setFilterText(''); }}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  activeTab === t.id
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── WORKFLOW VIEW: LISTINGS ───────────────────────────────── */}
      {viewState === 'list' && (
        <div className="space-y-6">

          {/* BARCODE SCANNER & FILTER HEADER (shown for all tabs) */}
          {['inward', 'inprocess', 'final', 'passed', 'ncs'].includes(activeTab) && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-4xl mx-auto space-y-4">
              <label className="block text-sm font-bold text-slate-700">QC Inspection Queue</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center">
                    <Search className="w-5 h-5 text-slate-400" />
                  </span>
                  <input
                    type="text"
                    placeholder="Scan label barcode to start inspection..."
                    onKeyDown={e => e.key === 'Enter' && handleBarcodeSearch(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:bg-white focus:outline-none transition"
                  />
                  <button
                    onClick={startScanner}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-orange-500 transition"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Type to filter..."
                  value={filterText}
                  onChange={e => setFilterText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none transition"
                />
              </div>
            </div>
          )}

          {/* ─── SUB-TAB: INWARD QUEUE ────────────────────────────────── */}
          {activeTab === 'inward' && (
            <div className="max-w-4xl mx-auto">
              {queue.inward.filter(item => 
                item.item_name.toLowerCase().includes(filterText.toLowerCase()) ||
                item.item_code.toLowerCase().includes(filterText.toLowerCase()) ||
                item.grn_number.toLowerCase().includes(filterText.toLowerCase())
              ).length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 text-xs flex flex-col items-center justify-center h-56 shadow-sm">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
                  <p className="font-bold text-slate-800 text-sm">Queue Clear!</p>
                  <p className="text-slate-400 text-xs mt-1">No labels pending QC inspection.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                          <th className="px-6 py-3.5">GRN NO</th>
                          <th className="px-6 py-3.5">DATE</th>
                          <th className="px-6 py-3.5">SUPPLIER</th>
                          <th className="px-6 py-3.5">ITEM CODE</th>
                          <th className="px-6 py-3.5">ITEM NAME</th>
                          <th className="px-6 py-3.5">PENDING QTY</th>
                          <th className="px-6 py-3.5 text-center">ACTION</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {queue.inward.filter(item => 
                          item.item_name.toLowerCase().includes(filterText.toLowerCase()) ||
                          item.item_code.toLowerCase().includes(filterText.toLowerCase()) ||
                          item.grn_number.toLowerCase().includes(filterText.toLowerCase())
                        ).map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="px-6 py-3.5 text-orange-500 font-bold">{item.grn_number}</td>
                            <td className="px-6 py-3.5">{new Date(item.grn_date).toLocaleDateString()}</td>
                            <td className="px-6 py-3.5">{item.supplier_name}</td>
                            <td className="px-6 py-3.5">{item.item_code}</td>
                            <td className="px-6 py-3.5 font-bold text-slate-800">{item.item_name}</td>
                            <td className="px-6 py-3.5 font-bold">{item.quantity} {item.unit}</td>
                            <td className="px-6 py-3.5 text-center">
                              <button
                                onClick={() => startInspection(item, 'Inward')}
                                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold text-[10px] px-3 py-1 rounded transition shadow-sm"
                              >
                                Inspect
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── SUB-TAB: IN-PROCESS QUEUE ────────────────────────────── */}
          {activeTab === 'inprocess' && (
            <div className="max-w-4xl mx-auto">
              {queue.inprocess.filter(item => 
                item.item_name.toLowerCase().includes(filterText.toLowerCase()) ||
                item.item_code.toLowerCase().includes(filterText.toLowerCase()) ||
                item.batch_number.toLowerCase().includes(filterText.toLowerCase())
              ).length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 text-xs flex flex-col items-center justify-center h-56 shadow-sm">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
                  <p className="font-bold text-slate-800 text-sm">No Pending In-Process Inspections</p>
                  <p className="text-slate-400 text-xs mt-1">All job cards have passed QC.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                          <th className="px-6 py-3.5">BATCH NO</th>
                          <th className="px-6 py-3.5">WORK ORDER</th>
                          <th className="px-6 py-3.5">ITEM CODE</th>
                          <th className="px-6 py-3.5">ITEM NAME</th>
                          <th className="px-6 py-3.5">QTY</th>
                          <th className="px-6 py-3.5">MACHINE</th>
                          <th className="px-6 py-3.5 text-center">ACTION</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {queue.inprocess.filter(item => 
                          item.item_name.toLowerCase().includes(filterText.toLowerCase()) ||
                          item.item_code.toLowerCase().includes(filterText.toLowerCase()) ||
                          item.batch_number.toLowerCase().includes(filterText.toLowerCase())
                        ).map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="px-6 py-3.5 text-orange-500 font-bold">{item.batch_number}</td>
                            <td className="px-6 py-3.5 font-bold">{item.wo_number || '-'}</td>
                            <td className="px-6 py-3.5">{item.item_code}</td>
                            <td className="px-6 py-3.5 font-bold text-slate-800">{item.item_name}</td>
                            <td className="px-6 py-3.5 font-bold">{item.quantity} {item.unit}</td>
                            <td className="px-6 py-3.5">{item.machine_name || '-'}</td>
                            <td className="px-6 py-3.5 text-center">
                              <button
                                onClick={() => startInspection(item, 'In-Process')}
                                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold text-[10px] px-3 py-1 rounded transition shadow-sm"
                              >
                                Inspect
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── SUB-TAB: FINAL FG QUEUE ──────────────────────────────── */}
          {activeTab === 'final' && (
            <div className="max-w-4xl mx-auto">
              {queue.final.filter(item => 
                item.item_name.toLowerCase().includes(filterText.toLowerCase()) ||
                item.item_code.toLowerCase().includes(filterText.toLowerCase()) ||
                item.fgr_number.toLowerCase().includes(filterText.toLowerCase())
              ).length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 text-xs flex flex-col items-center justify-center h-56 shadow-sm">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
                  <p className="font-bold text-slate-800 text-sm">No Pending Final QC</p>
                  <p className="text-slate-400 text-xs mt-1">All FG receipts have passed inspection.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                          <th className="px-6 py-3.5">FGR NO</th>
                          <th className="px-6 py-3.5">RECEIPT DATE</th>
                          <th className="px-6 py-3.5">WORK ORDER</th>
                          <th className="px-6 py-3.5">ITEM CODE</th>
                          <th className="px-6 py-3.5">ITEM NAME</th>
                          <th className="px-6 py-3.5">QTY</th>
                          <th className="px-6 py-3.5 text-center">ACTION</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {queue.final.filter(item => 
                          item.item_name.toLowerCase().includes(filterText.toLowerCase()) ||
                          item.item_code.toLowerCase().includes(filterText.toLowerCase()) ||
                          item.fgr_number.toLowerCase().includes(filterText.toLowerCase())
                        ).map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="px-6 py-3.5 text-orange-500 font-bold">{item.fgr_number}</td>
                            <td className="px-6 py-3.5">{new Date(item.receipt_date).toLocaleDateString()}</td>
                            <td className="px-6 py-3.5 font-bold">{item.wo_number || '-'}</td>
                            <td className="px-6 py-3.5">{item.item_code}</td>
                            <td className="px-6 py-3.5 font-bold text-slate-800">{item.item_name}</td>
                            <td className="px-6 py-3.5 font-bold">{item.quantity} {item.unit}</td>
                            <td className="px-6 py-3.5 text-center">
                              <button
                                onClick={() => startInspection(item, 'Final')}
                                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold text-[10px] px-3 py-1 rounded transition shadow-sm"
                              >
                                Inspect
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── SUB-TAB: NON-CONFORMANCES (NCRs) ──────────────────────── */}
          {activeTab === 'nc' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <input
                  type="text"
                  placeholder="Filter Non-Conformances..."
                  value={filterText}
                  onChange={e => setFilterText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none transition"
                />
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                        <th className="px-6 py-3.5">NC NO</th>
                        <th className="px-6 py-3.5">SEVERITY</th>
                        <th className="px-6 py-3.5">STATUS</th>
                        <th className="px-6 py-3.5">GRN NO</th>
                        <th className="px-6 py-3.5">ITEM CODE</th>
                        <th className="px-6 py-3.5">ITEM NAME</th>
                        <th className="px-6 py-3.5">BATCH/LOT</th>
                        <th className="px-6 py-3.5">REJECTED QTY</th>
                        <th className="px-6 py-3.5">REASON</th>
                        <th className="px-6 py-3.5">INSPECTED BY</th>
                        <th className="px-6 py-3.5">CREATED AT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {ncsList.filter(nc => 
                        nc.nc_number.toLowerCase().includes(filterText.toLowerCase()) ||
                        nc.item_name.toLowerCase().includes(filterText.toLowerCase()) ||
                        nc.item_code.toLowerCase().includes(filterText.toLowerCase())
                      ).map((nc, idx) => (
                        <tr
                          key={idx}
                          onClick={() => loadNCDetail(nc.nc_id)}
                          className="hover:bg-slate-50 transition cursor-pointer"
                        >
                          <td className="px-6 py-3.5 text-orange-500 font-bold">{nc.nc_number}</td>
                          <td className="px-6 py-3.5">
                            <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                              nc.severity === 'Critical' ? 'bg-red-50 text-red-700 border-red-200' :
                              nc.severity === 'Major' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                              'bg-amber-50 text-amber-700 border-amber-250'
                            }`}>
                              {nc.severity}
                            </span>
                          </td>
                          <td className="px-6 py-3.5">{getNCStatusBadge(nc.status)}</td>
                          <td className="px-6 py-3.5 font-bold">{nc.grn_number || '-'}</td>
                          <td className="px-6 py-3.5">{nc.item_code}</td>
                          <td className="px-6 py-3.5 font-bold text-slate-800">{nc.item_name}</td>
                          <td className="px-6 py-3.5">{nc.batch_number || '-'}</td>
                          <td className="px-6 py-3.5 font-extrabold text-red-500">{nc.qty_affected} {nc.unit}</td>
                          <td className="px-6 py-3.5 text-slate-500 font-semibold">{nc.defect_type}</td>
                          <td className="px-6 py-3.5 text-slate-500">{nc.inspector_name || 'N/A'}</td>
                          <td className="px-6 py-3.5 text-slate-400">
                            {new Date(nc.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                      {ncsList.length === 0 && (
                        <tr>
                          <td colSpan="11" className="text-center py-10 text-slate-400">
                            No Non-Conformances reported.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─── SUB-TAB: PASSED INSPECTIONS ─────────────────────────── */}
          {activeTab === 'passed' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <input
                  type="text"
                  placeholder="Filter Passed Inspections..."
                  value={filterText}
                  onChange={e => setFilterText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none transition"
                />
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                        <th className="px-6 py-3.5">INSPECTION NO</th>
                        <th className="px-6 py-3.5">RESULT</th>
                        <th className="px-6 py-3.5">LABEL</th>
                        <th className="px-6 py-3.5">ITEM</th>
                        <th className="px-6 py-3.5">BATCH</th>
                        <th className="px-6 py-3.5 text-right">ACCEPTED QTY</th>
                        <th className="px-6 py-3.5">PASSED AT</th>
                        <th className="px-6 py-3.5">INSPECTOR</th>
                        <th className="px-6 py-3.5 text-center">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {passedList.filter(item => 
                        item.inspection_number.toLowerCase().includes(filterText.toLowerCase()) ||
                        item.item_name.toLowerCase().includes(filterText.toLowerCase()) ||
                        item.item_code.toLowerCase().includes(filterText.toLowerCase())
                      ).map((item, idx) => (
                        <tr
                          key={idx}
                          onClick={() => loadInspectionDetail(item.inspection_id)}
                          className="hover:bg-slate-50 transition cursor-pointer"
                        >
                          <td className="px-6 py-3.5 text-orange-500 font-bold">{item.inspection_number}</td>
                          <td className="px-6 py-3.5">{getResultBadge(item.result)}</td>
                          <td className="px-6 py-3.5 font-bold">{item.label_number || '-'}</td>
                          <td className="px-6 py-3.5">{item.item_name}</td>
                          <td className="px-6 py-3.5 text-slate-500">{item.batch_number || '-'}</td>
                          <td className="px-6 py-3.5 font-extrabold text-green-600 text-right">
                            {Number(item.accepted_qty).toFixed(2)} {item.unit}
                          </td>
                          <td className="px-6 py-3.5 text-slate-400">
                            {new Date(item.inspection_date).toLocaleString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false
                            }).replace(',', '')}
                          </td>
                          <td className="px-6 py-3.5 text-slate-500 font-semibold">{item.inspector_name}</td>
                          <td className="px-6 py-3.5 text-center flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                loadInspectionDetail(item.inspection_id);
                              }}
                              className="px-2.5 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-[11px] font-bold transition shadow-sm"
                            >
                              Inspect
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                printDirectLabelPDF(item);
                              }}
                              className="px-2.5 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-[11px] font-bold transition shadow-sm"
                            >
                              PDF
                            </button>
                          </td>
                        </tr>
                      ))}
                      {passedList.length === 0 && (
                        <tr>
                          <td colSpan="9" className="text-center py-10 text-slate-400">
                            No inspections marked as passed yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ─── WORKFLOW VIEW: QC INSPECTION FORM ──────────────────────── */}
      {viewState === 'inspect-form' && selectedItem && (
        <div className="space-y-6 text-slate-700">
          
          {/* Form Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <span className="text-xl">📋</span>
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  QC/2627/{String(selectedItem.reference_id).padStart(5, '0')}
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                InProgress
              </span>
              <button
                onClick={() => { setViewState('list'); setSelectedItem(null); }}
                className="flex items-center gap-1 border border-slate-300 text-slate-700 hover:bg-slate-50 px-3 py-1.5 rounded-lg text-xs font-bold transition"
              >
                ↰ Queue
              </button>
            </div>
          </div>

          {/* Context Details Grid (Grid 1) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="space-y-4 text-xs font-semibold">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Item Code:</span>
                <span className="text-slate-800">{selectedItem.item_code}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Drawing No:</span>
                <span className="text-slate-500">—</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Label No:</span>
                <span className="text-orange-500 font-bold">MAT/2627/{String(selectedItem.reference_id).padStart(5, '0')}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Lot Qty:</span>
                <span className="text-slate-800">{selectedItem.quantity} {selectedItem.unit || 'NOS'}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Mfg Date:</span>
                <input
                  type="date"
                  value={inspectForm.mfg_date}
                  onChange={e => setInspectForm({ ...inspectForm, mfg_date: e.target.value })}
                  className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-700 focus:ring-1 focus:ring-orange-500 focus:outline-none text-xs"
                />
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Store:</span>
                <span className="text-slate-800">{selectedItem.store_id === 1 ? 'Raw Material Store' : selectedItem.store_id === 2 ? 'WIP Store' : 'Finished Goods Store'}</span>
              </div>
            </div>

            <div className="space-y-4 text-xs font-semibold">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Item Name:</span>
                <span className="text-slate-800">{selectedItem.item_name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Specification:</span>
                <span className="text-slate-500">—</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Batch No:</span>
                <input
                  type="text"
                  value={inspectForm.batch_number}
                  onChange={e => setInspectForm({ ...inspectForm, batch_number: e.target.value })}
                  className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800 focus:ring-1 focus:ring-orange-500 focus:outline-none text-xs w-36 text-right font-bold"
                />
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Unit Rate:</span>
                <span className="text-slate-800">{Number(selectedItem.invoice_value ? (selectedItem.invoice_value / selectedItem.quantity) : 5.10).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Expiry Date:</span>
                <input
                  type="date"
                  value={inspectForm.expiry_date}
                  onChange={e => setInspectForm({ ...inspectForm, expiry_date: e.target.value })}
                  className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-700 focus:ring-1 focus:ring-orange-500 focus:outline-none text-xs"
                />
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Bin:</span>
                <span className="text-slate-500">—</span>
              </div>
            </div>

          </div>

          {/* GRN & Supplier block (Grid 2) */}
          {selectedItem.inspection_type === 'Inward' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                📄 GRN & Supplier
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-xs font-semibold">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-500">GRN No:</span>
                    <span className="text-slate-800">{selectedItem.grn_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Supplier:</span>
                    <span className="text-slate-800">{selectedItem.supplier_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">DC No:</span>
                    <span className="text-slate-800">{selectedItem.dc_number || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Invoice Date:</span>
                    <span className="text-slate-800">{selectedItem.invoice_date ? new Date(selectedItem.invoice_date).toLocaleDateString() : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">PO No:</span>
                    <span className="text-slate-800">{selectedItem.po_number || '7642954'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Type:</span>
                    <span className="text-slate-800">Inward</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-500">GRN Date:</span>
                    <span className="text-slate-800">{new Date(selectedItem.grn_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Gate Pass:</span>
                    <span className="text-slate-800">{selectedItem.gp_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Invoice No:</span>
                    <span className="text-slate-800">{selectedItem.invoice_number || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Invoice Value:</span>
                    <span className="text-slate-800">{Number(selectedItem.invoice_value || 510).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sample Size:</span>
                    <span className="text-slate-800">13</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Status:</span>
                    <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[10px]">
                      InProgress
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Form Actions (Pass / Fail + Parameters table) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            
            {/* Visual Check Toggles */}
            <div className="space-y-2.5">
              <h3 className="font-bold text-slate-805 text-xs flex items-center gap-1.5">
                👁️ Overall Visual Check
              </h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setVisualCheck('Pass');
                    setInspectForm(f => ({ ...f, accepted_qty: selectedItem.quantity }));
                  }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold border transition ${
                    visualCheck === 'Pass'
                      ? 'bg-green-600 border-green-600 text-white shadow-sm'
                      : 'border-green-600 text-green-500 hover:bg-green-600/10'
                  }`}
                >
                  ✓ Pass
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVisualCheck('Fail');
                    setInspectForm(f => ({ ...f, accepted_qty: '0' }));
                  }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold border transition ${
                    visualCheck === 'Fail'
                      ? 'bg-red-600 border-red-600 text-white shadow-sm'
                      : 'border-red-500 text-red-500 hover:bg-red-600/10'
                  }`}
                >
                  ✕ Fail
                </button>
              </div>
            </div>

            {/* Quality Parameters checklist (Extra Feature) */}
            <div className="space-y-3 pt-2">
              <h3 className="font-bold text-slate-805 text-xs flex items-center gap-1.5">
                🧪 Quality Parameters Test (Jayashree Standards)
              </h3>
              <div className="overflow-hidden border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <th className="px-4 py-3">QC PARAMETER</th>
                      <th className="px-4 py-3">SPECIFICATION RANGE</th>
                      <th className="px-4 py-3 w-40">TEST VALUE</th>
                      <th className="px-4 py-3 text-center w-24">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium text-slate-700 bg-white">
                    {qcParams.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 font-bold text-slate-800">{p.name}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {p.min !== null && p.max !== null ? `${p.min.toFixed(2)} - ${p.max.toFixed(2)}` :
                           p.min !== null ? `Min ${p.min.toFixed(2)}` : `Max ${p.max.toFixed(2)}`} {p.unit}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Enter value"
                            value={p.value}
                            onChange={e => handleParamValueChange(idx, e.target.value)}
                            className="bg-slate-50 border border-slate-300 text-slate-800 rounded px-2.5 py-1 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none w-full font-bold"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                            p.status === 'Pass' ? 'bg-green-50 text-green-700 border border-green-200' :
                            p.status === 'Fail' ? 'bg-red-50 text-red-700 border border-red-200' :
                            'bg-slate-100 text-slate-400 border border-slate-200'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Inspection Qty entries */}
            <form onSubmit={handleInspectionSubmit} className="space-y-4 pt-4 border-t border-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-bold">
                <div>
                  <label className="block text-slate-500 mb-1">Inspected Qty</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={inspectForm.inspected_qty}
                    onChange={e => setInspectForm({ ...inspectForm, inspected_qty: e.target.value })}
                    className="bg-slate-50 border border-slate-300 text-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 focus:outline-none w-full"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Accepted Qty</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={inspectForm.accepted_qty}
                    onChange={e => {
                      setInspectForm({ ...inspectForm, accepted_qty: e.target.value });
                      const total = parseFloat(inspectForm.inspected_qty || 0);
                      const acc = parseFloat(e.target.value || 0);
                      setVisualCheck(acc === total ? 'Pass' : 'Fail');
                    }}
                    className="bg-slate-50 border border-slate-300 text-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 focus:outline-none w-full font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Rejected Qty</label>
                  <input
                    type="text"
                    disabled
                    value={(parseFloat(inspectForm.inspected_qty || 0) - parseFloat(inspectForm.accepted_qty || 0)).toFixed(2)}
                    className="bg-slate-100 border border-slate-200 text-red-500 font-extrabold rounded-lg px-3 py-2 text-sm w-full"
                  />
                </div>
              </div>

              {/* NC Details - dynamically shown if rejected qty > 0 */}
              {(parseFloat(inspectForm.inspected_qty || 0) - parseFloat(inspectForm.accepted_qty || 0)) > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-4">
                  <h4 className="text-red-700 font-extrabold text-xs flex items-center gap-1">
                    ⚠️ Non-Conformance Details Required
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Defect Type / Code *</label>
                      <input
                        type="text"
                        placeholder="e.g. Contamination, Visual Defect"
                        required
                        value={inspectForm.defect_type}
                        onChange={e => setInspectForm({ ...inspectForm, defect_type: e.target.value })}
                        className="bg-slate-50 border border-slate-300 text-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 focus:outline-none w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Severity *</label>
                      <select
                        value={inspectForm.severity}
                        onChange={e => setInspectForm({ ...inspectForm, severity: e.target.value })}
                        className="bg-slate-50 border border-slate-300 text-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 focus:outline-none w-full"
                      >
                        <option value="Minor">Minor</option>
                        <option value="Major">Major</option>
                        <option value="Critical">Critical</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Defect Description</label>
                    <textarea
                      rows="2"
                      placeholder="Explain details of defect..."
                      value={inspectForm.defect_description}
                      onChange={e => setInspectForm({ ...inspectForm, defect_description: e.target.value })}
                      className="bg-slate-50 border border-slate-300 text-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 focus:outline-none w-full"
                    ></textarea>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-500 text-xs font-bold mb-1">Remarks</label>
                <textarea
                  rows="3"
                  placeholder="Enter remarks..."
                  value={inspectForm.remarks}
                  onChange={e => setInspectForm({ ...inspectForm, remarks: e.target.value })}
                  className="bg-slate-50 border border-slate-300 text-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 focus:outline-none w-full"
                ></textarea>
              </div>

              {/* Form Buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                
                {/* Manager override badge */}
                <button
                  type="button"
                  className="bg-amber-50 text-amber-700 border border-amber-250 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
                >
                  👤 Manager Override (QC-BR-11)
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setViewState('list'); setSelectedItem(null); }}
                    className="border border-slate-300 text-slate-700 hover:bg-slate-50 px-5 py-2.5 rounded-lg text-sm font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-2.5 rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    🚀 Submit Results
                  </button>
                </div>

              </div>

            </form>
          </div>

        </div>
      )}

      {/* ─── WORKFLOW VIEW: NC DETAIL & DISPOSITION Decision ───────── */}
      {viewState === 'nc-detail' && selectedNC && (
        <div className="max-w-4xl mx-auto space-y-6">
          
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <div>
                <h2 className="text-lg font-extrabold text-slate-800">
                  Non-Conformance Detail — {selectedNC.nc_number}
                </h2>
                <p className="text-xs text-slate-400 font-semibold">
                  Review context and apply disposition decision.
                </p>
              </div>
            </div>
            <button
              onClick={() => { setViewState('list'); setSelectedNC(null); }}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold transition"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Queue
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Context details on the left */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Inspection Context Card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="font-extrabold text-slate-800 text-sm mb-4 border-b border-slate-100 pb-2">
                  📝 Inspection Context
                </h3>
                <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-xs font-medium">
                  <div>
                    <p className="text-slate-400">Inspection No</p>
                    <p className="text-slate-800 font-bold mt-0.5">{selectedNC.inspection_number}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Label No</p>
                    <p className="text-slate-800 font-bold mt-0.5">{selectedNC.label_number || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Item</p>
                    <p className="text-slate-800 font-bold mt-0.5">{selectedNC.item_code} - {selectedNC.item_name}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Batch No</p>
                    <p className="text-slate-800 font-bold mt-0.5">{selectedNC.batch_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Accepted Qty</p>
                    <p className="text-green-600 font-bold mt-0.5">{selectedNC.accepted_qty} {selectedNC.unit}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Rejected Qty</p>
                    <p className="text-red-500 font-extrabold mt-0.5">{selectedNC.qty_affected} {selectedNC.unit}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Supplier</p>
                    <p className="text-slate-800 font-bold mt-0.5 truncate">{selectedNC.supplier_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">GRN No</p>
                    <p className="text-slate-800 font-bold mt-0.5">{selectedNC.grn_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Raised On</p>
                    <p className="text-slate-600 font-semibold mt-0.5">
                      {new Date(selectedNC.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Description details */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="font-extrabold text-slate-800 text-sm mb-3 border-b border-slate-100 pb-2">
                  🗒️ Description
                </h3>
                <p className="text-slate-700 text-xs font-semibold leading-relaxed">
                  Defect Type: <span className="text-red-500 font-bold">{selectedNC.defect_type}</span>
                </p>
                <p className="text-slate-600 text-xs mt-2 italic bg-slate-50 p-3 rounded-lg border border-slate-100">
                  "{selectedNC.defect_description || 'No description provided'}"
                </p>
              </div>

            </div>

            {/* Disposition decision form on the right */}
            <div>
              {selectedNC.status === 'Open' ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sticky top-6">
                  <h3 className="font-extrabold text-slate-800 text-sm mb-4 border-b border-slate-100 pb-2">
                    🛠️ Disposition Decision
                  </h3>
                  <form onSubmit={handleNCDispositionSubmit} className="space-y-4">
                    
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-500 mb-2">Disposition Decision *</label>
                      {[
                        { value: 'Use As-Is', label: 'Use As-Is', desc: 'Accept the material despite non-conformance. Status -> Available.' },
                        { value: 'Rework', label: 'Rework', desc: 'Return for rework/repair. Status -> Rework.' },
                        { value: 'Reject', label: 'Reject', desc: 'Reject and move to Quarantine Store.' },
                        { value: 'Return to Supplier', label: 'Return to Supplier', desc: 'Arrange return of material to supplier.' }
                      ].map(d => (
                        <label key={d.value} className="flex items-start gap-2.5 p-2 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer text-xs">
                          <input
                            type="radio"
                            name="disposition"
                            value={d.value}
                            checked={dispositionForm.disposition === d.value}
                            onChange={e => setDispositionForm({ ...dispositionForm, disposition: e.target.value })}
                            className="mt-1 accent-orange-500"
                          />
                          <div>
                            <span className="font-bold text-slate-800 block leading-tight">{d.label}</span>
                            <span className="text-slate-400 text-[10px] mt-0.5 block">{d.desc}</span>
                          </div>
                        </label>
                      ))}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Root Cause *</label>
                      <textarea
                        rows="2"
                        required
                        value={dispositionForm.root_cause}
                        onChange={e => setDispositionForm({ ...dispositionForm, root_cause: e.target.value })}
                        placeholder="Explain root cause..."
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                      ></textarea>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Corrective Action *</label>
                      <textarea
                        rows="2"
                        required
                        value={dispositionForm.corrective_action}
                        onChange={e => setDispositionForm({ ...dispositionForm, corrective_action: e.target.value })}
                        placeholder="Explain corrective action..."
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                      ></textarea>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Remarks</label>
                      <textarea
                        rows="2"
                        value={dispositionForm.remarks}
                        onChange={e => setDispositionForm({ ...dispositionForm, remarks: e.target.value })}
                        placeholder="Enter disposition remarks..."
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                      ></textarea>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs py-2.5 rounded-lg shadow-sm transition disabled:opacity-50 mt-2"
                    >
                      Close NC
                    </button>

                  </form>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-2xl border border-slate-200 shadow-sm p-6 sticky top-6 space-y-4">
                  <h3 className="font-extrabold text-slate-800 text-sm mb-2 border-b border-slate-200 pb-2">
                    🔒 Disposition Recorded
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div>
                      <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Decision</p>
                      <p className="text-orange-500 font-bold mt-0.5">{selectedNC.disposition}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Root Cause</p>
                      <p className="text-slate-700 font-semibold mt-0.5 leading-relaxed bg-white border border-slate-200 rounded p-2.5">
                        {selectedNC.root_cause}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Corrective Action</p>
                      <p className="text-slate-700 font-semibold mt-0.5 leading-relaxed bg-white border border-slate-200 rounded p-2.5">
                        {selectedNC.corrective_action}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Remarks</p>
                      <p className="text-slate-700 mt-0.5 leading-relaxed bg-white border border-slate-200 rounded p-2.5">
                        {selectedNC.remarks || '-'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* ─── WORKFLOW VIEW: INSPECTION DETAIL & PRINT LABELS ────────── */}
      {viewState === 'inspect-detail' && selectedInspectDetail && (
        <div className="max-w-4xl mx-auto space-y-6 text-slate-700">
          
          {/* Form Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-500" />
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  {selectedInspectDetail.inspection_number}
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1">
                ✓ Completed
              </span>
              <button
                onClick={() => { setViewState('list'); setSelectedInspectDetail(null); setIsSplit(false); }}
                className="flex items-center gap-1 border border-slate-300 text-slate-700 hover:bg-slate-50 px-3 py-1.5 rounded-lg text-xs font-bold transition"
              >
                ↰ Queue
              </button>
            </div>
          </div>

          {/* Item Details block (Card 1) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2">
              🛠️ Item Information
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-6 text-xs font-semibold">
              <div>
                <p className="text-slate-400">Item Code</p>
                <p className="text-slate-800 font-bold mt-0.5">{selectedInspectDetail.item_code}</p>
              </div>
              <div>
                <p className="text-slate-400">Item Name</p>
                <p className="text-slate-800 font-bold mt-0.5">{selectedInspectDetail.item_name}</p>
              </div>
              <div>
                <p className="text-slate-400">Drawing No</p>
                <p className="text-slate-500 font-bold mt-0.5">—</p>
              </div>
              <div>
                <p className="text-slate-400">Specification</p>
                <p className="text-slate-500 font-bold mt-0.5">—</p>
              </div>
              <div>
                <p className="text-slate-400">Label No</p>
                <p className="text-orange-500 font-bold mt-0.5">{selectedInspectDetail.label_number || 'N/A'}</p>
              </div>
              <div>
                <p className="text-slate-400">Batch No</p>
                <p className="text-slate-800 font-bold mt-0.5">{selectedInspectDetail.batch_number || '-'}</p>
              </div>
              <div>
                <p className="text-slate-400">Lot Qty</p>
                <p className="text-slate-800 font-bold mt-0.5">
                  {Number(selectedInspectDetail.inspected_qty).toFixed(2)} {selectedInspectDetail.unit}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Unit Rate</p>
                <p className="text-slate-800 font-bold mt-0.5">
                  {selectedInspectDetail.invoice_value 
                    ? Number(selectedInspectDetail.invoice_value / selectedInspectDetail.inspected_qty).toFixed(2)
                    : '5.10'}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Mfg Date</p>
                <p className="text-slate-800 font-bold mt-0.5">
                  {formatDateSafe(selectedInspectDetail.mfg_date)}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Expiry Date</p>
                <p className="text-slate-800 font-bold mt-0.5">
                  {formatDateSafe(selectedInspectDetail.expiry_date)}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Store</p>
                <p className="text-slate-800 font-bold mt-0.5">{selectedInspectDetail.store_name || 'Raw Material Store'}</p>
              </div>
              <div>
                <p className="text-slate-400">Bin</p>
                <p className="text-slate-500 font-bold mt-0.5">—</p>
              </div>
            </div>
          </div>

          {/* GRN & Supplier block (Card 2) */}
          {selectedInspectDetail.inspection_type === 'Inward' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2">
                🏢 GRN & Supplier
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-6 text-xs font-semibold">
                <div>
                  <p className="text-slate-400">GRN No</p>
                  <p className="text-slate-800 font-bold mt-0.5">{selectedInspectDetail.grn_number}</p>
                </div>
                <div>
                  <p className="text-slate-400">GRN Date</p>
                  <p className="text-slate-800 font-bold mt-0.5">
                    {formatDateSafe(selectedInspectDetail.grn_date)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Supplier</p>
                  <p className="text-slate-800 font-bold mt-0.5">{selectedInspectDetail.supplier_name}</p>
                </div>
                <div>
                  <p className="text-slate-400">Gate Pass</p>
                  <p className="text-slate-800 font-bold mt-0.5">{selectedInspectDetail.gp_number || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-400">DC No</p>
                  <p className="text-slate-800 font-bold mt-0.5">{selectedInspectDetail.dc_number || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-400">Invoice No</p>
                  <p className="text-slate-800 font-bold mt-0.5">{selectedInspectDetail.invoice_number || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-400">Invoice Date</p>
                  <p className="text-slate-800 font-bold mt-0.5">
                    {formatDateSafe(selectedInspectDetail.invoice_date)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Invoice Value</p>
                  <p className="text-slate-800 font-bold mt-0.5">
                    {Number(selectedInspectDetail.invoice_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">PO No</p>
                  <p className="text-slate-800 font-bold mt-0.5">{selectedInspectDetail.po_number || '2703700'}</p>
                </div>
                <div>
                  <p className="text-slate-400">Sample Size</p>
                  <p className="text-slate-800 font-bold mt-0.5">{selectedInspectDetail.sample_size || '32'}</p>
                </div>
                <div>
                  <p className="text-slate-400">Type</p>
                  <p className="text-slate-800 font-bold mt-0.5">{selectedInspectDetail.inspection_type}</p>
                </div>
                <div>
                  <p className="text-slate-400">Status</p>
                  <p className="text-slate-800 font-bold mt-0.5">Completed</p>
                </div>
              </div>
            </div>
          )}


          {/* Inspection Results block (Card 3) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2">
              📊 Inspection Results
            </h3>
            <div className="flex flex-wrap items-center gap-6 text-xs font-bold text-slate-650">
              <span>
                Accepted: <span className="text-green-600 font-extrabold text-sm ml-1">
                  {Number(selectedInspectDetail.accepted_qty).toFixed(2)} {selectedInspectDetail.unit}
                </span>
              </span>
              <span className="text-slate-300">|</span>
              <span>
                Rejected: <span className="text-red-500 font-extrabold text-sm ml-1">
                  {Number(selectedInspectDetail.rejected_qty).toFixed(2)} {selectedInspectDetail.unit}
                </span>
              </span>
              <span className="text-slate-300">|</span>
              <span>
                Result: <span className="text-green-600 font-extrabold text-sm ml-1">
                  {selectedInspectDetail.result === 'Accepted' ? 'Pass' : selectedInspectDetail.result}
                </span>
              </span>
            </div>
            {selectedInspectDetail.remarks && (
              <div className="p-3 bg-slate-50 border border-slate-150 rounded-lg text-xs italic text-slate-500">
                Remarks: "{selectedInspectDetail.remarks}"
              </div>
            )}
          </div>

          {/* Print Labels Block (Card 4) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-orange-500" /> Print Labels
            </h3>
            
            <div className="flex flex-wrap items-center gap-6 text-xs font-bold">
              {/* Type Toggle */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPrintType('barcode')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                    printType === 'barcode' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Barcode
                </button>
                <button
                  type="button"
                  onClick={() => setPrintType('qrcode')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                    printType === 'qrcode' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  QR Code
                </button>
              </div>

              {/* Pack Size Entry */}
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Pack Size:</span>
                <input
                  type="number"
                  value={packSize}
                  onChange={e => { setPackSize(e.target.value); setIsSplit(false); }}
                  className="w-20 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-center font-bold focus:ring-1 focus:ring-orange-500 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={Number(packSize) <= 0}
                  onClick={() => setIsSplit(true)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition ${
                    Number(packSize) > 0
                      ? 'border-orange-500 text-orange-600 hover:bg-orange-50 active:bg-orange-100'
                      : 'border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed'
                  }`}
                >
                  Split
                </button>
                {Number(packSize) > 0 && isSplit && (
                  <span className="text-[10px] text-green-600 font-extrabold animate-pulse ml-1">
                    ✓ Split Ready ({Math.ceil(Number(selectedInspectDetail.accepted_qty) / Number(packSize))} labels)
                  </span>
                )}
              </div>

              {/* Print PDF Trigger */}
              <button
                type="button"
                onClick={handlePrintStickerPDF}
                className="ml-auto bg-orange-500 hover:bg-orange-600 text-white font-bold px-5 py-2.5 rounded-lg text-xs shadow-sm transition flex items-center gap-1.5"
              >
                🖨️ Print PDF
              </button>
            </div>
          </div>

        </div>
      )}

      {/* OFFSCREEN LABELS FOR THERMAL PDF PRINTING */}
      {selectedInspectDetail && (
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
          {(() => {
            const total = parseFloat(selectedInspectDetail.accepted_qty || 0);
            const size = parseFloat(packSize || 0);
            let splitStickers = [];
            if (size > 0 && total > 0) {
              let remaining = total;
              let idx = 1;
              while (remaining > 0) {
                const currentQty = Math.min(size, remaining);
                splitStickers.push({
                  index: idx,
                  qty: currentQty,
                  code: selectedInspectDetail.label_number || 'N/A'
                });
                remaining -= currentQty;
                idx++;
              }
            } else {
              splitStickers.push({
                index: 1,
                qty: total,
                code: selectedInspectDetail.label_number || 'N/A'
              });
            }

            return splitStickers.map((sticker) => {
              const mfgText = formatDateSafe(selectedInspectDetail.mfg_date);
              const expText = formatDateSafe(selectedInspectDetail.expiry_date);

              return (
                <div
                  key={sticker.index}
                  id={`sticker-offscreen-${sticker.index}`}
                  className="bg-white text-black p-2 flex flex-col justify-between"
                  style={{ 
                    width: '380px', 
                    height: '190px', 
                    boxSizing: 'border-box',
                    fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                    lineHeight: '1.3'
                  }}
                >
                  {/* Top Header */}
                  <div className="flex justify-between items-end border-b border-slate-200 pb-0.5">
                    <span className="text-[12px] font-bold text-black tracking-tight">MatTrack Pro</span>
                    <span className="text-[9.5px] text-slate-400 font-medium">Available</span>
                  </div>

                  {/* Metadata Table (using table layout to ensure html2canvas compatibility) */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '1px solid #e2e8f0', margin: '4px 0', fontSize: '8.5px', color: '#334155' }}>
                    <tbody>
                      <tr style={{ height: '16px' }}>
                        <td style={{ width: '50%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }}>
                          <span style={{ color: '#64748b' }}>GRN: </span>
                          <span style={{ fontWeight: '600', color: '#0f172a' }}>{selectedInspectDetail.grn_number}</span>
                        </td>
                        <td style={{ width: '50%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }}>
                          <span style={{ color: '#64748b' }}>Batch: </span>
                          <span style={{ fontWeight: '600', color: '#0f172a' }}>{selectedInspectDetail.batch_number || '—'}</span>
                        </td>
                      </tr>
                      <tr style={{ height: '16px' }}>
                        <td style={{ width: '50%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }}>
                          <span style={{ color: '#64748b' }}>Supplier: </span>
                          <span style={{ fontWeight: '600', color: '#0f172a' }}>{selectedInspectDetail.supplier_name}</span>
                        </td>
                        <td style={{ width: '50%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }}>
                          <span style={{ color: '#64748b' }}>Mfg: </span>
                          <span style={{ fontWeight: '600', color: '#0f172a' }}>{mfgText}</span>
                          <span style={{ color: '#64748b', marginLeft: '6px' }}>Exp: </span>
                          <span style={{ fontWeight: '600', color: '#0f172a' }}>{expText}</span>
                        </td>
                      </tr>
                      <tr style={{ height: '16px' }}>
                        <td style={{ width: '50%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }}>
                          <span style={{ fontWeight: '800', color: '#000000', fontSize: '9.2px' }}>QTY: {sticker.qty.toFixed(2)} {selectedInspectDetail.unit}</span>
                        </td>
                        <td style={{ width: '50%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }}>
                          <span style={{ color: '#64748b' }}>Store: </span>
                          <span style={{ fontWeight: '600', color: '#0f172a' }}>{selectedInspectDetail.store_name || 'RMS'}</span>
                          <span style={{ color: '#64748b', marginLeft: '6px' }}>Bin: </span>
                          <span style={{ fontWeight: '600', color: '#0f172a' }}>—</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Code Area (Barcode or QR) */}
                  <div className="flex-1 flex flex-col items-center justify-center pt-1 overflow-hidden">
                    {printType === 'barcode' ? (
                      <div className="flex flex-col items-center justify-center w-full">
                        <Barcode
                          value={sticker.code}
                          width={1.4}
                          height={55}
                          fontSize={0}
                          margin={0}
                        />
                        <span className="text-[8.5px] font-medium text-slate-700 mt-1 tracking-wider">{sticker.code}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <QRCode value={sticker.code} size={50} />
                        <span className="text-[8.5px] font-medium text-slate-700 mt-1 tracking-wider">{sticker.code}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* CAMERA SCANNER MODAL WINDOW */}
      {showScanner && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden text-white">
            
            {/* Custom Scan Line Animation */}
            <style>{`
              @keyframes scanSweep {
                0% { top: 5%; }
                50% { top: 95%; }
                100% { top: 5%; }
              }
            `}</style>

            {/* Ambient Background Glows */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl pointer-events-none"></div>

            {/* Header */}
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-ping"></span>
                <h3 className="font-extrabold text-xs tracking-wider text-slate-100 uppercase">Live Industrial Scanner</h3>
              </div>
              <button 
                onClick={stopScanner} 
                className="bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 p-2 rounded-xl transition duration-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scanner Viewport Container */}
            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 p-1 aspect-square max-w-[300px] mx-auto">
              
              {/* HTML5 Qr Reader Viewport */}
              <div id="qr-reader" className="w-full h-full rounded-xl overflow-hidden"></div>

              {/* High Fidelity Scan Laser Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                <div className="w-full h-full relative border-2 border-green-500/20 rounded-lg">
                  {/* Neon laser sweep */}
                  <div 
                    className="absolute left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-green-400 to-transparent shadow-[0_0_8px_#22c55e]"
                    style={{ animation: 'scanSweep 2s ease-in-out infinite' }}
                  ></div>

                  {/* Corner targets */}
                  <div className="absolute -top-[3px] -left-[3px] w-6 h-6 border-t-4 border-l-4 border-green-500 rounded-tl-md"></div>
                  <div className="absolute -top-[3px] -right-[3px] w-6 h-6 border-t-4 border-r-4 border-green-500 rounded-tr-md"></div>
                  <div className="absolute -bottom-[3px] -left-[3px] w-6 h-6 border-b-4 border-l-4 border-green-500 rounded-bl-md"></div>
                  <div className="absolute -bottom-[3px] -right-[3px] w-6 h-6 border-b-4 border-r-4 border-green-500 rounded-br-md"></div>
                </div>
              </div>

            </div>

            {/* Instruction Footer */}
            <div className="text-center mt-6 relative z-10">
              <p className="text-xs text-slate-355 font-medium tracking-wide">
                Align the Barcode / QR Code within the targets
              </p>
              <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-widest">
                Autodetect Active
              </p>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
