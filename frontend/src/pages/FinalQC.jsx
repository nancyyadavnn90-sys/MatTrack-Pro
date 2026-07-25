import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Search, Camera, X, ArrowLeft, AlertTriangle, ShieldAlert,
  ShieldCheck, Printer, Plus, Eye, Trash2
} from 'lucide-react';
import jsPDF from 'jspdf';
import { QRCodeCanvas as QRCode } from 'qrcode.react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const getAuthHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

export default function FinalQC() {
  const [loading, setLoading] = useState(false);
  const [activeView, setViewState] = useState('list'); // 'list', 'inspect-form', 'inspect-detail', 'label-preview'
  
  // Data lists
  const [inspections, setInspections] = useState([]);
  const [pendingWOs, setPendingWOs] = useState([]);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'history'
  const [stats, setStats] = useState({
    total_checked: 0,
    approved_count: 0,
    rejected_count: 0,
    hold_count: 0,
    passRate: 100
  });

  // Filters & selection
  const [filterText, setFilterText] = useState('');
  const [selectedInspection, setSelectedInspection] = useState(null);

  // New Inspection Wizard State
  const [currentStep, setCurrentStep] = useState(1);
  
  // Step 1: Work Order Search
  const [woSearchInput, setWoSearchInput] = useState('');
  const [selectedWO, setSelectedWO] = useState(null);
  const [woSearchError, setWoSearchError] = useState('');

  // Step 2: Inspection Setup
  const [totalQty, setTotalQty] = useState('');
  const [inspectionMethod, setInspectionMethod] = useState('100% Inspection'); // '100% Inspection' or 'Sampling'
  const [sampleSize, setSampleSize] = useState('');
  const [aqlLevel, setAqlLevel] = useState('1.0');
  const [inspectionDate] = useState(new Date().toISOString().split('T')[0]);

  // Step 3: Inspection Parameters
  const defaultParams = [
    { name: 'Inner Diameter', spec: '12.5 ± 0.2 mm', actual: '12.5', status: 'Pass' },
    { name: 'Outer Diameter', spec: '18.0 ± 0.3 mm', actual: '18.0', status: 'Pass' },
    { name: 'Height/Thickness', spec: '8.0 ± 0.2 mm', actual: '8.0', status: 'Pass' },
    { name: 'Hardness (Shore A)', spec: '60 ± 5', actual: '60', status: 'Pass' },
    { name: 'Weight (gm)', spec: '4.5 ± 0.2', actual: '4.5', status: 'Pass' },
    { name: 'Visual — Flash', spec: '0 pieces', actual: 'Pass', status: 'Pass', isVisual: true },
    { name: 'Visual — Short Fill', spec: '0 pieces', actual: 'Pass', status: 'Pass', isVisual: true },
    { name: 'Visual — Blow Hole', spec: '0 pieces', actual: 'Pass', status: 'Pass', isVisual: true },
    { name: 'Visual — Surface Crack', spec: '0 pieces', actual: 'Pass', status: 'Pass', isVisual: true },
    { name: 'Part Marking', spec: 'Present', actual: 'Pass', status: 'Pass', isVisual: true },
    { name: 'Colour', spec: 'Black', actual: 'Pass', status: 'Pass', isVisual: true }
  ];
  const [qcParams, setQcParams] = useState(defaultParams);
  
  // Custom parameters addition
  const [customParamName, setCustomParamName] = useState('');
  const [customParamSpec, setCustomParamSpec] = useState('');

  // Step 4: Quantities
  const [acceptedQty, setAcceptedQty] = useState('');
  const [rejectedQty, setRejectedQty] = useState(0);

  // Step 5: Overall Result
  const [overallResult, setOverallResult] = useState('Approved'); // 'Approved', 'Rejected', 'On Hold'
  const [remarks, setRemarks] = useState('');

  // FG Barcode label response
  const [generatedLabel, setGeneratedLabel] = useState(null);

  // Camera scanner states
  const [showScanner, setShowScanner] = useState(false);
  const scannerRef = useRef(null);

  useEffect(() => {
    fetchInspections();
    fetchPendingWOs();
    fetchStats();
  }, []);

  const fetchPendingWOs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/final-qc/pending`, getAuthHeader());
      setPendingWOs(res.data);
    } catch (err) {
      console.error('Error fetching pending FQC:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartInspectPending = (wo) => {
    handleResetWizard();
    setSelectedWO(wo);
    setWoSearchInput(wo.wo_number);
    setTotalQty(wo.pending_qty.toString());
    setAcceptedQty(wo.pending_qty.toString());
    setRejectedQty(0);
    setCurrentStep(2); // Jump directly to setup, skip link WO search
    setViewState('inspect-form');
  };

  // Fetch Inspections List
  const fetchInspections = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/final-qc/inspections`, getAuthHeader());
      setInspections(res.data);
    } catch (err) {
      console.error('Error fetching inspections:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Dashboard Stats
  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API}/final-qc/stats`, getAuthHeader());
      setStats(res.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  // Step 1: Link Work Order Search
  const handleWOSearch = async () => {
    if (!woSearchInput.trim()) return;
    setWoSearchError('');
    setSelectedWO(null);
    setLoading(true);
    try {
      const res = await axios.get(`${API}/final-qc/work-orders?wo_number=${encodeURIComponent(woSearchInput.trim())}`, getAuthHeader());
      if (res.data && res.data.length > 0) {
        const wo = res.data[0];
        setSelectedWO(wo);
        setTotalQty(wo.produced_qty.toString());
        setAcceptedQty(wo.produced_qty.toString());
        setRejectedQty(0);
      } else {
        setWoSearchError('Work Order not found or has no moulding production entries yet.');
      }
    } catch (err) {
      setWoSearchError('Error searching for Work Order.');
    } finally {
      setLoading(false);
    }
  };

  // Camera scanner for Work Order QR/Barcode
  const startScanner = () => {
    setShowScanner(true);
    setTimeout(() => {
      const html5QrCode = new Html5Qrcode('fqc-qr-reader');
      scannerRef.current = html5QrCode;
      html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          setWoSearchInput(decodedText);
          stopScanner();
          // Trigger search directly after scan
          setTimeout(() => {
            const btn = document.getElementById('wo-search-btn');
            if (btn) btn.click();
          }, 200);
        },
        () => {}
      ).catch(err => {
        console.error('Camera access error:', err);
        alert('Could not start camera scanner. Check permissions.');
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

  // Step 3: Parameter Table Actions
  const handleParamValueChange = (index, value) => {
    setQcParams(prev => {
      const updated = [...prev];
      updated[index].actual = value;
      // Auto-validate status for standard measurements
      const paramName = updated[index].name.toLowerCase();
      if (paramName.includes('inner diameter') || paramName.includes('id')) {
        const val = parseFloat(value);
        updated[index].status = (!isNaN(val) && val >= 12.3 && val <= 12.7) ? 'Pass' : 'Fail';
      } else if (paramName.includes('outer diameter') || paramName.includes('od')) {
        const val = parseFloat(value);
        updated[index].status = (!isNaN(val) && val >= 17.7 && val <= 18.3) ? 'Pass' : 'Fail';
      } else if (paramName.includes('height') || paramName.includes('thickness')) {
        const val = parseFloat(value);
        updated[index].status = (!isNaN(val) && val >= 7.8 && val <= 8.2) ? 'Pass' : 'Fail';
      } else if (paramName.includes('hardness')) {
        const val = parseFloat(value);
        updated[index].status = (!isNaN(val) && val >= 55 && val <= 65) ? 'Pass' : 'Fail';
      } else if (paramName.includes('weight')) {
        const val = parseFloat(value);
        updated[index].status = (!isNaN(val) && val >= 4.3 && val <= 4.7) ? 'Pass' : 'Fail';
      }
      return updated;
    });
  };

  const handleVisualChange = (index, status) => {
    setQcParams(prev => {
      const updated = [...prev];
      updated[index].actual = status;
      updated[index].status = status;
      return updated;
    });
  };

  const handleAddCustomParam = () => {
    if (!customParamName.trim()) return;
    const newParam = {
      name: customParamName.trim(),
      spec: customParamSpec.trim() || 'Custom spec',
      actual: '',
      status: 'Pass',
      isCustom: true
    };
    setQcParams(prev => [...prev, newParam]);
    setCustomParamName('');
    setCustomParamSpec('');
  };

  const handleDeleteParam = (index) => {
    setQcParams(prev => prev.filter((_, i) => i !== index));
  };

  const failedParamsCount = qcParams.filter(p => p.status === 'Fail').length;

  // Step 4: Quantities Auto-Calculation
  const handleAcceptedQtyChange = (val) => {
    setAcceptedQty(val);
    const acceptedVal = parseFloat(val);
    const totalVal = parseFloat(totalQty);
    if (!isNaN(acceptedVal) && !isNaN(totalVal)) {
      const diff = Math.max(0, totalVal - acceptedVal);
      setRejectedQty(diff);
      
      // Auto-set Result to Rejected if rejection percentage is very high, or if parameter failed
      const rejectionPercent = (diff / totalVal) * 100;
      if (rejectionPercent > 5 || failedParamsCount > 0) {
        setOverallResult('Rejected');
      }
    }
  };

  const handleTotalQtyChange = (val) => {
    setTotalQty(val);
    const totalVal = parseFloat(val);
    const acceptedVal = parseFloat(acceptedQty);
    if (!isNaN(totalVal) && !isNaN(acceptedVal)) {
      const diff = Math.max(0, totalVal - acceptedVal);
      setRejectedQty(diff);
    }
  };

  const rejectionRate = parseFloat(totalQty) > 0 
    ? ((rejectedQty / parseFloat(totalQty)) * 100).toFixed(2) 
    : '0.00';

  // Step 5: Submit Inspection
  const handleSubmitInspection = async () => {
    if (!selectedWO) return;
    if (!totalQty || parseFloat(totalQty) <= 0) {
      alert('Total inspection quantity must be positive.');
      return;
    }
    if (acceptedQty === '') {
      alert('Accepted quantity is required.');
      return;
    }
    if (overallResult === 'Approved' && failedParamsCount > 0) {
      alert('Cannot Approve inspection when quality parameters have failed! Please reject or place on hold.');
      return;
    }

    setLoading(true);
    try {
      // Map parameter values to database columns
      const getParamVal = (name) => {
        const p = qcParams.find(param => param.name.toLowerCase().includes(name.toLowerCase()));
        return p ? p.actual : 'N/A';
      };

      const payload = {
        wo_id: selectedWO.wo_id,
        item_id: selectedWO.item_id,
        inspected_qty: parseFloat(totalQty),
        accepted_qty: parseFloat(acceptedQty),
        rejected_qty: parseFloat(rejectedQty),
        result: overallResult,
        remarks: remarks || 'Visual checks completed',
        defect_type: failedParamsCount > 0 ? 'QC parameter failure' : 'N/A',
        defect_description: remarks || 'Inspection checks',
        severity: 'Major',
        // Map 11 parameters
        param_id: getParamVal('Inner Diameter'),
        param_od: getParamVal('Outer Diameter'),
        param_height: getParamVal('Height/Thickness'),
        param_hardness: getParamVal('Hardness'),
        param_weight: getParamVal('Weight'),
        param_flash: getParamVal('Flash'),
        param_short_mould: getParamVal('Short Fill'),
        param_tensile: getParamVal('Blow Hole'),
        param_surface: getParamVal('Surface Crack'),
        param_elongation: getParamVal('Marking'),
        param_colour: getParamVal('Colour')
      };

      const res = await axios.post(`${API}/final-qc/inspections`, payload, getAuthHeader());
      const data = res.data;

      if (overallResult === 'Approved') {
        // Load generated label preview page
        setGeneratedLabel({
          product: selectedWO.item_name,
          customer: selectedWO.customer_name || 'N/A',
          wo: selectedWO.wo_number,
          inspection: data.fqc_number,
          accepted: parseFloat(acceptedQty),
          date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
          qrValue: JSON.stringify({
            type: 'FG',
            wo: selectedWO.wo_number,
            product: selectedWO.item_name,
            customer: selectedWO.customer_name || 'N/A',
            qty: parseFloat(acceptedQty),
            inspection: data.fqc_number,
            date: new Date().toISOString().split('T')[0]
          })
        });
        setViewState('label-preview');
      } else {
        alert(`Final QC submitted successfully. Result: ${overallResult}.${overallResult === 'Rejected' ? ' NC Report automatically created.' : ''}`);
        // Reset form & reload list
        handleResetWizard();
        fetchInspections();
        fetchPendingWOs();
        fetchStats();
        setViewState('list');
      }

    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit inspection');
    } finally {
      setLoading(false);
    }
  };

  const handleResetWizard = () => {
    setCurrentStep(1);
    setWoSearchInput('');
    setSelectedWO(null);
    setWoSearchError('');
    setTotalQty('');
    setAcceptedQty('');
    setRejectedQty(0);
    setQcParams(defaultParams);
    setOverallResult('Approved');
    setRemarks('');
    setGeneratedLabel(null);
  };

  // View Single Inspection Details
  const handleViewInspection = async (inspection) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/final-qc/inspections/${inspection.fqc_id}`, getAuthHeader());
      setSelectedInspection(res.data);
      setViewState('inspect-detail');
    } catch (err) {
      alert('Failed to load inspection details');
    } finally {
      setLoading(false);
    }
  };

  // Generate PDF of FG Label
  const downloadLabelPDF = (label) => {
    if (!label) return;
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [100, 75] // Sticker size 100mm x 75mm
      });

      // Border frame
      doc.setDrawColor(255, 107, 0); // Jayashree Orange
      doc.setLineWidth(1.5);
      doc.rect(2, 2, 96, 71);

      // Header Banner
      doc.setFillColor(255, 107, 0);
      doc.rect(2, 2, 96, 12, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('JAYASHREE POLYMERS PVT LTD', 5, 8);
      doc.setFontSize(7.5);
      doc.text('APPROVED FG STATUS', 65, 8);

      // Label details
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(8);
      doc.text(`Product:       ${label.product}`, 5, 22);
      doc.text(`Customer:     ${label.customer}`, 5, 28);
      doc.text(`Work Order:   ${label.wo}`, 5, 34);
      doc.text(`Inspection:   ${label.inspection}`, 5, 40);
      doc.setFont('Helvetica', 'bold');
      doc.text(`Qty Accepted: ${label.accepted} Pcs`, 5, 48);
      doc.setFont('Helvetica', 'normal');
      doc.text(`Pass Date:    ${label.date}`, 5, 54);

      // Draw QR Code on PDF (using simple vector lines or library fallback, or print text details)
      // Since it's a sticker label, we can add a text note. If a canvas exists, we can draw it.
      const canvas = document.getElementById('label-qr-canvas');
      if (canvas) {
        const qrDataUrl = canvas.toDataURL('image/jpeg', 1.0);
        doc.addImage(qrDataUrl, 'JPEG', 65, 18, 28, 28);
      }

      doc.setFontSize(6.5);
      doc.setTextColor(120, 120, 120);
      doc.text('Scan label QR code to register FG Receipt', 5, 68);

      doc.save(`FG_Sticker_${label.inspection.replace(/\//g, '_')}.pdf`);
    } catch (e) {
      console.error(e);
      alert('Error downloading sticker PDF.');
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
      {/* 1. VIEW STATE: FINAL QC LIST PAGE */}
      {/* ──────────────────────────────────────────────────────── */}
      {activeView === 'list' && (
        <>
          {/* Top Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2a2a2a] pb-4">
            <div>
              <h1 className="text-lg font-black text-white tracking-wide flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-emerald-400" /> Final QC Inspections
              </h1>
              <p className="text-slate-400 text-xs font-medium mt-0.5">
                Final quality check before FG store
              </p>
            </div>

            <button
              onClick={() => {
                handleResetWizard();
                setViewState('inspect-form');
              }}
              className="flex items-center gap-1.5 bg-emerald-600 text-white px-5 py-2.5 rounded-lg text-xs font-bold hover:bg-emerald-700 transition shadow-sm self-start md:self-auto"
            >
              <Plus className="w-4 h-4" /> New Final QC
            </button>
          </div>

          {/* 4 Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#1e1e1e] p-4 rounded-xl border border-[#2a2a2a] shadow-md flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Total Inspections</p>
                <p className="text-2xl font-black text-white mt-1">{stats.total_checked}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#121212] border border-[#2a2a2a] flex items-center justify-center text-lg text-slate-300">📋</div>
            </div>

            <div className="bg-[#1e1e1e] p-4 rounded-xl border border-[#2a2a2a] shadow-md flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Approved</p>
                <p className="text-2xl font-black text-emerald-400 mt-1">{stats.approved_count}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-lg text-emerald-400">✅</div>
            </div>

            <div className="bg-[#1e1e1e] p-4 rounded-xl border border-[#2a2a2a] shadow-md flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Rejected</p>
                <p className="text-2xl font-black text-red-400 mt-1">{stats.rejected_count}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-lg text-red-400">❌</div>
            </div>

            <div className="bg-[#1e1e1e] p-4 rounded-xl border border-[#2a2a2a] shadow-md flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">On Hold</p>
                <p className="text-2xl font-black text-amber-400 mt-1">{stats.hold_count}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-lg text-amber-400">⏸️</div>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-[#1e1e1e] rounded-xl border border-[#2a2a2a] shadow-lg overflow-hidden space-y-3 p-4">
            
            {/* Tabs Selector */}
            <div className="flex justify-between items-center border-b border-[#2a2a2a] pb-3 flex-wrap gap-2">
              <div className="flex bg-[#121212] p-1 rounded-xl border border-[#2a2a2a]">
                <button
                  onClick={() => setActiveTab('pending')}
                  className={`py-1.5 px-4 text-xs font-bold rounded-lg transition flex items-center gap-2 ${
                    activeTab === 'pending'
                      ? 'bg-[#10b981] text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Pending FQC
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                    {pendingWOs.length}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`py-1.5 px-4 text-xs font-bold rounded-lg transition flex items-center gap-2 ${
                    activeTab === 'history'
                      ? 'bg-[#10b981] text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Inspection History
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#252525] text-slate-300">
                    {inspections.length}
                  </span>
                </button>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2" />
                <input
                  type="text"
                  placeholder={activeTab === 'pending' ? "Search pending WOs..." : "Search inspections..."}
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="pl-9 pr-3 py-1.5 bg-[#121212] border border-[#3a3a3a] rounded-xl text-xs w-64 text-white focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>
            </div>

            <div className="overflow-x-auto border border-[#2a2a2a] rounded-xl">
              {activeTab === 'pending' ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#333] text-slate-200 text-xs font-black uppercase tracking-wider bg-[#252525]">
                      <th className="py-3 px-4">Work Order</th>
                      <th className="py-3 px-4">Product Part</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4 text-right">Planned Qty</th>
                      <th className="py-3 px-4 text-right text-amber-400">Produced (Moulding)</th>
                      <th className="py-3 px-4 text-right text-emerald-400">QC Checked</th>
                      <th className="py-3 px-4 text-right text-white">Pending FQC</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a2a2a] text-xs">
                    {pendingWOs
                      .filter(wo => !filterText || wo.wo_number.toLowerCase().includes(filterText.toLowerCase()) || wo.item_name.toLowerCase().includes(filterText.toLowerCase()) || (wo.customer_name && wo.customer_name.toLowerCase().includes(filterText.toLowerCase())))
                      .map(wo => (
                        <tr key={wo.wo_id} className="hover:bg-[#252525] border-b border-[#2a2a2a] transition">
                          <td className="py-3.5 px-4 font-black text-emerald-400">{wo.wo_number}</td>
                          <td className="py-3.5 px-4 font-extrabold text-white">{wo.item_name}</td>
                          <td className="py-3.5 px-4 font-bold text-slate-300">{wo.customer_name || 'N/A'}</td>
                          <td className="py-3.5 px-4 text-right font-mono text-slate-300">{parseFloat(wo.planned_qty).toLocaleString()}</td>
                          <td className="py-3.5 px-4 text-right font-black text-amber-400">{parseFloat(wo.produced_qty).toLocaleString()}</td>
                          <td className="py-3.5 px-4 text-right font-black text-emerald-400">{parseFloat(wo.inspected_qty).toLocaleString()}</td>
                          <td className="py-3.5 px-4 text-right font-black text-amber-300">
                            <span className="bg-amber-500/10 px-2 py-1 rounded border border-amber-500/30">
                              {parseFloat(wo.pending_qty).toLocaleString()} {wo.unit}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleStartInspectPending(wo)}
                              className="px-3.5 py-1.5 bg-[#10b981] hover:bg-[#059669] text-white font-black text-xs rounded-lg transition shadow-md"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))}
                    {pendingWOs.length === 0 && (
                      <tr>
                        <td colSpan="8" className="py-8 text-center text-slate-400 font-semibold italic">
                          No Work Orders pending Final QC.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-xxs font-bold uppercase tracking-wider bg-slate-50/50">
                      <th className="py-3.5 px-4">Inspection No</th>
                      <th className="py-3.5 px-4">Work Order</th>
                      <th className="py-3.5 px-4">Product</th>
                      <th className="py-3.5 px-4">Customer</th>
                      <th className="py-3.5 px-4 text-right">Total Qty</th>
                      <th className="py-3.5 px-4 text-right text-green-700">Accepted</th>
                      <th className="py-3.5 px-4 text-right text-red-650">Rejected</th>
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4 text-center">Result</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {inspections
                      .filter(i => !filterText || i.fqc_number.toLowerCase().includes(filterText.toLowerCase()) || i.wo_number.toLowerCase().includes(filterText.toLowerCase()) || i.item_name.toLowerCase().includes(filterText.toLowerCase()) || (i.customer_name && i.customer_name.toLowerCase().includes(filterText.toLowerCase())))
                      .map(i => (
                        <tr
                          key={i.fqc_id}
                          onClick={() => handleViewInspection(i)}
                          className="hover:bg-slate-50/80 cursor-pointer transition"
                        >
                          <td className="py-4 px-4 font-bold text-slate-800">{i.fqc_number}</td>
                          <td className="py-4 px-4 font-bold text-slate-550">{i.wo_number}</td>
                          <td className="py-4 px-4 text-slate-700 font-semibold">{i.item_name}</td>
                          <td className="py-4 px-4 text-slate-500 font-medium">{i.customer_name || 'N/A'}</td>
                          <td className="py-4 px-4 text-right font-semibold text-slate-655">{parseFloat(i.inspected_qty).toLocaleString()}</td>
                          <td className="py-4 px-4 text-right font-black text-green-700">{parseFloat(i.accepted_qty).toLocaleString()}</td>
                          <td className="py-4 px-4 text-right font-black text-red-650">{parseFloat(i.rejected_qty).toLocaleString()}</td>
                          <td className="py-4 px-4 text-slate-500">{formatDate(i.inspection_date)}</td>
                          <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              i.result === 'Approved' ? 'bg-green-50 text-green-700 border border-green-200' :
                              i.result === 'Rejected' ? 'bg-red-50 text-red-700 border border-red-200' :
                              'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {i.result}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleViewInspection(i)}
                              className="p-1 text-orange-500 hover:text-orange-700 hover:bg-slate-100 rounded-lg transition"
                            >
                              <Eye className="w-4.5 h-4.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    {inspections.length === 0 && (
                      <tr>
                        <td colSpan="10" className="py-8 text-center text-slate-400 font-semibold">
                          No quality inspections performed yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* ──────────────────────────────────────────────────────── */}
      {/* 2. VIEW STATE: NEW INSPECTION FORM (5 STEPS) */}
      {/* ──────────────────────────────────────────────────────── */}
      {activeView === 'inspect-form' && (
        <div className="space-y-6 max-w-4xl mx-auto animate-fadeIn">
          {/* Back Action Bar */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setViewState('list');
                handleResetWizard();
              }}
              className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-xs font-bold transition"
            >
              <ArrowLeft className="w-4 h-4" /> Cancel & Exit
            </button>
            <div className="h-4 w-px bg-slate-300"></div>
            <span className="text-slate-500 text-xs font-bold">New QC Inspection Wizard</span>
          </div>

          {/* Step Indicator Top Header */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            {[
              { step: 1, label: 'Link WO' },
              { step: 2, label: 'Setup' },
              { step: 3, label: 'Parameters' },
              { step: 4, label: 'Decision' },
              { step: 5, label: 'Result' }
            ].map(s => (
              <div key={s.step} className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xxs font-black border ${
                  currentStep === s.step ? 'bg-orange-500 text-white border-orange-500' :
                  currentStep > s.step ? 'bg-green-500 text-white border-green-500' :
                  'bg-slate-100 text-slate-450 border-slate-200'
                }`}>
                  {currentStep > s.step ? '✓' : s.step}
                </span>
                <span className={`text-[10px] font-bold hidden md:inline ${currentStep === s.step ? 'text-slate-800' : 'text-slate-400'}`}>{s.label}</span>
                {s.step < 5 && <div className="h-0.5 w-8 md:w-16 bg-slate-100 hidden md:block"></div>}
              </div>
            ))}
          </div>

          {/* STEP 1: LINK WORK ORDER */}
          {currentStep === 1 && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Step 1 — Link Work Order</h3>
                <p className="text-slate-450 text-xxs mt-0.5">Search and link the mould production card for inspection</p>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-455" />
                  <input
                    type="text"
                    placeholder="Enter Work Order No. (e.g. WO/2026/00104)"
                    value={woSearchInput}
                    onChange={(e) => setWoSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleWOSearch()}
                    className="w-full pl-10 pr-3 py-2.5 border border-slate-250 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>
                <button
                  type="button"
                  id="wo-search-btn"
                  onClick={handleWOSearch}
                  className="bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold px-5 py-2.5 rounded-lg transition"
                >
                  Search
                </button>
                <button
                  type="button"
                  onClick={startScanner}
                  className="bg-orange-500 hover:bg-orange-600 text-white p-2.5 rounded-lg transition"
                  title="Scan WO Barcode"
                >
                  <Camera className="w-4.5 h-4.5" />
                </button>
              </div>

              {woSearchError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs font-semibold">
                  ⚠️ {woSearchError}
                </div>
              )}

              {selectedWO && (
                <div className="bg-green-50 border border-green-200 p-5 rounded-xl space-y-4 animate-fadeIn">
                  <span className="text-[10px] bg-green-500 text-white font-extrabold px-2 py-0.5 rounded uppercase">✓ Connected</span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold text-slate-700">
                    <div>
                      <span className="text-slate-400 text-xxs block">Work Order Number</span>
                      <span className="text-slate-800 font-bold block mt-1">{selectedWO.wo_number}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-xxs block">Product Name</span>
                      <span className="text-slate-800 font-bold block mt-1">{selectedWO.item_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-xxs block">Customer</span>
                      <span className="text-slate-800 font-bold block mt-1">{selectedWO.customer_name || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-xxs block">Produced Qty (Moulding)</span>
                      <span className="text-slate-800 font-bold block mt-1">{selectedWO.produced_qty} {selectedWO.unit}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  disabled={!selectedWO}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-6 py-2.5 rounded-lg transition disabled:bg-slate-100 disabled:text-slate-400"
                >
                  Continue to Setup
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: INSPECTION SETUP */}
          {currentStep === 2 && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Step 2 — Inspection Setup</h3>
                <p className="text-slate-450 text-xxs mt-0.5">Select sample size and automotive Acceptable Quality Levels (AQL)</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs font-semibold text-slate-700">
                <div>
                  <label className="text-xxs text-slate-450 font-bold block mb-1">Total Quantity to Inspect *</label>
                  <input
                    type="number"
                    value={totalQty}
                    onChange={(e) => handleTotalQtyChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-xxs text-slate-450 font-bold block mb-1">Inspection Method *</label>
                  <select
                    value={inspectionMethod}
                    onChange={(e) => setInspectionMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                  >
                    <option value="100% Inspection">100% Inspection</option>
                    <option value="Sampling">Sampling Checks</option>
                  </select>
                </div>

                {inspectionMethod === 'Sampling' && (
                  <div>
                    <label className="text-xxs text-slate-450 font-bold block mb-1">Sample Size (checked parts) *</label>
                    <input
                      type="number"
                      placeholder="e.g. 50"
                      value={sampleSize}
                      onChange={(e) => setSampleSize(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="text-xxs text-slate-450 font-bold block mb-1">AQL Level *</label>
                  <select
                    value={aqlLevel}
                    onChange={(e) => setAqlLevel(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                  >
                    <option value="0.65">0.65 (Critical parts)</option>
                    <option value="1.0">1.0 (Standard Hero/Honda)</option>
                    <option value="1.5">1.5 (General visual)</option>
                    <option value="2.5">2.5 (Packaging checks)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xxs text-slate-450 font-bold block mb-1">Inspection Date</label>
                  <input
                    type="date"
                    value={inspectionDate}
                    className="w-full px-3 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded-lg focus:outline-none"
                    disabled
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-655 font-bold text-xs px-5 py-2.5 rounded-lg transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  disabled={!totalQty || parseFloat(totalQty) <= 0}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-6 py-2.5 rounded-lg transition"
                >
                  Continue to Checklist
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: QUALITY CHECKLIST PARAMETERS TABLE */}
          {currentStep === 3 && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm">Step 3 — Quality Inspection Checklist</h3>
                  <p className="text-slate-450 text-xxs mt-0.5">Measure parameters and record visual checks</p>
                </div>
                {failedParamsCount > 0 && (
                  <span className="text-[10px] bg-red-50 border border-red-200 text-red-650 px-2 py-0.5 rounded font-black">
                    {failedParamsCount} FAILED PARAMETERS
                  </span>
                )}
              </div>

              {failedParamsCount > 0 && (
                <div className="bg-amber-50 border border-amber-250 p-4 rounded-lg flex items-center gap-3 text-xxs text-amber-800 font-bold">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <span>
                    {failedParamsCount} parameters failed specifications. The Overall Result MUST be set to Rejected or On Hold in Step 5.
                  </span>
                </div>
              )}

              {/* Parameter Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-xxs font-bold uppercase tracking-wider bg-slate-50/50">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Quality Parameter</th>
                      <th className="py-2.5 px-3">Specifications</th>
                      <th className="py-2.5 px-3">Actual Value</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {qcParams.map((param, index) => (
                      <tr
                        key={index}
                        className={`transition ${param.status === 'Fail' ? 'bg-red-50/70 hover:bg-red-50' : 'hover:bg-slate-50/50'}`}
                      >
                        <td className="py-3 px-3 font-semibold text-slate-450">{index + 1}</td>
                        <td className="py-3 px-3 font-bold text-slate-700">{param.name}</td>
                        <td className="py-3 px-3 font-semibold text-slate-500">{param.spec}</td>
                        
                        <td className="py-3 px-3">
                          {param.isVisual ? (
                            <div className="flex items-center gap-2">
                              {['Pass', 'Fail'].map(opt => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => handleVisualChange(index, opt)}
                                  className={`px-3 py-1 rounded text-xxs font-bold border transition ${
                                    param.actual === opt
                                      ? opt === 'Pass'
                                        ? 'bg-green-500 text-white border-green-500'
                                        : 'bg-red-500 text-white border-red-500'
                                      : 'bg-white text-slate-655 border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={param.actual}
                              onChange={(e) => handleParamValueChange(index, e.target.value)}
                              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold w-28 focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                            param.status === 'Pass' ? 'bg-green-50 text-green-700 border-green-200' :
                            'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            {param.status}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteParam(index)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-500 transition"
                          >
                            <Trash2 className="w-4.5 h-4.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add Custom Parameter form */}
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-end gap-3">
                <div className="flex-1">
                  <label className="text-xxs text-slate-450 font-bold block mb-1">Add Quality Parameter Checkpoint</label>
                  <input
                    type="text"
                    placeholder="e.g. Surface Crack / Bursting Test"
                    value={customParamName}
                    onChange={(e) => setCustomParamName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none"
                  />
                </div>
                <div className="w-64">
                  <label className="text-xxs text-slate-450 font-bold block mb-1">Specifications</label>
                  <input
                    type="text"
                    placeholder="e.g. No visual surface cracks"
                    value={customParamSpec}
                    onChange={(e) => setCustomParamSpec(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddCustomParam}
                  className="bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-lg transition"
                >
                  Add Parameter
                </button>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-655 font-bold text-xs px-5 py-2.5 rounded-lg transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-6 py-2.5 rounded-lg transition"
                >
                  Continue to Decision
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: QUANTITY DECISION */}
          {currentStep === 4 && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Step 4 — Quantity Decision</h3>
                <p className="text-slate-450 text-xxs mt-0.5">Determine accepted and rejected quantities based on checked samples</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="border border-slate-200 p-4 rounded-xl bg-slate-50 text-slate-700">
                  <span className="text-slate-400 text-xxs font-bold uppercase tracking-wider block">Total Quantity</span>
                  <span className="text-2xl font-black block mt-2">{totalQty} Pcs</span>
                </div>

                <div className="border border-green-200 p-4 rounded-xl bg-green-50/20 text-green-700">
                  <span className="text-green-600 text-xxs font-bold uppercase tracking-wider block">Accepted Quantity *</span>
                  <input
                    type="number"
                    value={acceptedQty}
                    onChange={(e) => handleAcceptedQtyChange(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-green-200 rounded-lg text-lg font-black text-green-700 focus:outline-none focus:ring-1 focus:ring-green-500 mt-2"
                  />
                </div>

                <div className="border border-red-200 p-4 rounded-xl bg-red-50/20 text-red-700">
                  <span className="text-red-500 text-xxs font-bold uppercase tracking-wider block">Rejected Quantity (Auto)</span>
                  <span className="text-2xl font-black block mt-2 text-red-600">{rejectedQty} Pcs</span>
                </div>
              </div>

              <div className="p-5 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-slate-400 text-xxs font-bold uppercase tracking-wider block">Calculated Rejection Rate</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className={`text-2xl font-black ${parseFloat(rejectionRate) > 5 ? 'text-red-500' : 'text-green-600'}`}>
                      {rejectionRate}%
                    </span>
                    <span className="text-slate-400 text-[10px] font-bold">of total batch parts</span>
                  </div>
                </div>
                
                {parseFloat(rejectionRate) > 5 ? (
                  <div className="bg-red-50 border border-red-150 p-3 rounded-lg text-xxs text-red-700 font-bold max-w-sm">
                    ⚠️ Rejection rate exceeds 5%! System advises overall result should be set to Rejected or On Hold.
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-150 p-3 rounded-lg text-xxs text-green-700 font-semibold">
                    ✓ Rejection rate lies within automotive safety bounds (&lt; 5%).
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-655 font-bold text-xs px-5 py-2.5 rounded-lg transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Set default result to Rejected if parameters failed
                    if (failedParamsCount > 0 && overallResult === 'Approved') {
                      setOverallResult('Rejected');
                    }
                    setCurrentStep(5);
                  }}
                  disabled={acceptedQty === ''}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-6 py-2.5 rounded-lg transition"
                >
                  Continue to Result
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: OVERALL RESULT */}
          {currentStep === 5 && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Step 5 — Overall Inspection Result</h3>
                <p className="text-slate-455 text-xxs mt-0.5">Determine the final inspection outcome. Approved parts are prepared for dispatch</p>
              </div>

              {failedParamsCount > 0 && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-center gap-3 text-xxs text-red-700 font-bold">
                  <ShieldAlert className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <span>
                    Cannot approve this batch! {failedParamsCount} parameters failed specs. Please select REJECTED or ON HOLD.
                  </span>
                </div>
              )}

              {/* 3 Result Selection Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  type="button"
                  disabled={failedParamsCount > 0}
                  onClick={() => setOverallResult('Approved')}
                  className={`p-6 rounded-xl border-2 text-center transition flex flex-col items-center justify-center gap-2 ${
                    overallResult === 'Approved'
                      ? 'bg-green-50 border-green-500 text-green-700'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 disabled:bg-slate-50 disabled:border-slate-150 disabled:text-slate-300'
                  }`}
                >
                  <span className="text-2xl">✅</span>
                  <span className="font-black text-sm block">APPROVED</span>
                  <span className="text-[10px] font-semibold text-slate-400">Parts go to FG store</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOverallResult('Rejected')}
                  className={`p-6 rounded-xl border-2 text-center transition flex flex-col items-center justify-center gap-2 ${
                    overallResult === 'Rejected'
                      ? 'bg-red-50 border-red-500 text-red-700'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-2xl">❌</span>
                  <span className="font-black text-sm block">REJECTED</span>
                  <span className="text-[10px] font-semibold text-slate-400">NC auto-created</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOverallResult('On Hold')}
                  className={`p-6 rounded-xl border-2 text-center transition flex flex-col items-center justify-center gap-2 ${
                    overallResult === 'On Hold'
                      ? 'bg-amber-50 border-amber-500 text-amber-700'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-2xl">⏸️</span>
                  <span className="font-black text-sm block">ON HOLD</span>
                  <span className="text-[10px] font-semibold text-slate-400">Senior review needed</span>
                </button>
              </div>

              <div>
                <label className="text-xxs text-slate-450 font-bold block mb-1">Inspector Remarks *</label>
                <textarea
                  rows="3"
                  placeholder="Enter detailed observations, measurement notes, or rework comments..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none"
                  required
                ></textarea>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-655 font-bold text-xs px-5 py-2.5 rounded-lg transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmitInspection}
                  disabled={loading}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-8 py-2.5 rounded-lg transition shadow-md"
                >
                  {loading ? 'Submitting...' : 'Submit Final QC'}
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ──────────────────────────────────────────────────────── */}
      {/* 3. VIEW STATE: INSPECT DETAIL VIEW */}
      {/* ──────────────────────────────────────────────────────── */}
      {activeView === 'inspect-detail' && selectedInspection && (
        <div className="space-y-6 max-w-4xl mx-auto animate-fadeIn">
          {/* Action Back bar */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setViewState('list');
                setSelectedInspection(null);
              }}
              className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-xs font-bold transition"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Log
            </button>
            <div className="h-4 w-px bg-slate-300"></div>
            <span className="text-slate-500 text-xs font-bold">FQC Report {selectedInspection.fqc_number}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Left Col - Details and parameters */}
            <div className="md:col-span-2 space-y-6">
              
              {/* Header card info */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-extrabold text-slate-855 text-base">{selectedInspection.fqc_number}</h3>
                    <p className="text-slate-400 text-xxs">Inspected on {formatDate(selectedInspection.inspection_date)}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    selectedInspection.result === 'Approved' ? 'bg-green-50 text-green-700 border-green-200' :
                    selectedInspection.result === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                    'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {selectedInspection.result}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-700">
                  <div>
                    <span className="text-slate-450 text-[10px] block">Linked Work Order</span>
                    <span className="text-slate-800 font-bold block mt-0.5">{selectedInspection.wo_number}</span>
                  </div>
                  <div>
                    <span className="text-slate-455 text-[10px] block">Customer</span>
                    <span className="text-slate-800 font-bold block mt-0.5">{selectedInspection.customer_name || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-455 text-[10px] block">Product Part</span>
                    <span className="text-slate-800 font-bold block mt-0.5">{selectedInspection.item_name} ({selectedInspection.item_code})</span>
                  </div>
                  <div>
                    <span className="text-slate-455 text-[10px] block">Inspected By</span>
                    <span className="text-slate-800 font-bold block mt-0.5">{selectedInspection.inspector_name}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-center">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-150">
                    <span className="text-slate-400 text-[9px] font-bold block uppercase">Total Qty</span>
                    <span className="text-sm font-bold text-slate-800 block mt-0.5">{parseFloat(selectedInspection.inspected_qty)}</span>
                  </div>
                  <div className="bg-green-50/20 p-2.5 rounded-lg border border-green-150">
                    <span className="text-green-500 text-[9px] font-bold block uppercase">Accepted</span>
                    <span className="text-sm font-bold text-green-700 block mt-0.5">{parseFloat(selectedInspection.accepted_qty)}</span>
                  </div>
                  <div className="bg-red-50/20 p-2.5 rounded-lg border border-red-150">
                    <span className="text-red-500 text-[9px] font-bold block uppercase">Rejected</span>
                    <span className="text-sm font-bold text-red-650 block mt-0.5">{parseFloat(selectedInspection.rejected_qty)}</span>
                  </div>
                </div>

                {selectedInspection.remarks && (
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xxs text-slate-655 italic">
                    Remarks: "{selectedInspection.remarks}"
                  </div>
                )}
              </div>

              {/* Parameter Table details */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <h3 className="font-extrabold text-slate-800 text-sm">Quality Parameters Log</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 text-xxs font-bold uppercase bg-slate-50/50">
                        <th className="py-2 px-3">Quality Parameter</th>
                        <th className="py-2 px-3">Actual Value Checked</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xxs font-semibold">
                      {[
                        { name: 'Inner Diameter', val: selectedInspection.param_id },
                        { name: 'Outer Diameter', val: selectedInspection.param_od },
                        { name: 'Height/Thickness', val: selectedInspection.param_height },
                        { name: 'Hardness (Shore A)', val: selectedInspection.param_hardness },
                        { name: 'Weight (gm)', val: selectedInspection.param_weight },
                        { name: 'Visual — Flash', val: selectedInspection.param_flash },
                        { name: 'Visual — Short Fill', val: selectedInspection.param_short_mould },
                        { name: 'Visual — Blow Hole', val: selectedInspection.param_tensile },
                        { name: 'Visual — Surface Crack', val: selectedInspection.param_surface },
                        { name: 'Part Marking', val: selectedInspection.param_elongation },
                        { name: 'Colour', val: selectedInspection.param_colour }
                      ].map((p, idx) => (
                        <tr key={idx} className={p.val === 'Fail' ? 'bg-red-50/50 text-red-700' : ''}>
                          <td className="py-2.5 px-3 font-bold text-slate-700">{p.name}</td>
                          <td className="py-2.5 px-3 font-mono">{p.val || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Right Col - QR Label Sticker */}
            <div>
              {selectedInspection.result === 'Approved' && (
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="font-extrabold text-slate-800 text-sm border-b border-slate-100 pb-2">FG Barcode Label</h3>
                  
                  {/* Sticker frame preview */}
                  <div className="border border-orange-200 p-4 rounded-xl bg-slate-50 space-y-4 text-xs">
                    <div className="border-b border-orange-100 pb-2 flex justify-between items-center text-orange-655 font-bold">
                      <span>JAYASHREE POLYMERS</span>
                      <span className="text-[10px] bg-green-500 text-white font-extrabold px-1.5 py-0.5 rounded">PASSED</span>
                    </div>

                    <div className="space-y-1.5 text-slate-700 font-semibold">
                      <div>Product: <strong className="text-slate-855 font-black">{selectedInspection.item_name}</strong></div>
                      <div>Customer: <strong>{selectedInspection.customer_name || 'N/A'}</strong></div>
                      <div>Work Order: <strong>{selectedInspection.wo_number}</strong></div>
                      <div>Inspection: <strong>{selectedInspection.fqc_number}</strong></div>
                      <div>Qty Approved: <strong className="text-green-700">{parseFloat(selectedInspection.accepted_qty)} Pcs</strong></div>
                      <div>Date: <strong>{formatDate(selectedInspection.inspection_date)}</strong></div>
                    </div>

                    <div className="flex justify-center pt-2">
                      <QRCode
                        id="label-qr-canvas"
                        value={JSON.stringify({
                          type: 'FG',
                          wo: selectedInspection.wo_number,
                          product: selectedInspection.item_name,
                          customer: selectedInspection.customer_name || 'N/A',
                          qty: parseFloat(selectedInspection.accepted_qty),
                          inspection: selectedInspection.fqc_number,
                          date: selectedInspection.inspection_date?.split('T')[0]
                        })}
                        size={85}
                        level="M"
                        includeMargin={true}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => downloadLabelPDF({
                      product: selectedInspection.item_name,
                      customer: selectedInspection.customer_name || 'N/A',
                      wo: selectedInspection.wo_number,
                      inspection: selectedInspection.fqc_number,
                      accepted: parseFloat(selectedInspection.accepted_qty),
                      date: formatDate(selectedInspection.inspection_date)
                    })}
                    className="w-full bg-orange-50 hover:bg-orange-500 text-orange-600 hover:text-white border border-orange-150 font-bold text-xs py-2.5 rounded-lg transition flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Printer className="w-4 h-4" /> Download FG Sticker PDF
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────── */}
      {/* 4. VIEW STATE: APPROVED FG LABEL STICKER PREVIEW */}
      {/* ──────────────────────────────────────────────────────── */}
      {activeView === 'label-preview' && generatedLabel && (
        <div className="space-y-6 max-w-md mx-auto text-center animate-fadeIn py-8">
          <div className="w-14 h-14 bg-green-100 border border-green-200 text-green-600 rounded-full flex items-center justify-center text-3xl mx-auto shadow-inner">✓</div>
          <div>
            <h2 className="text-xl font-black text-slate-800">Inspection Approved!</h2>
            <p className="text-slate-455 text-xs mt-1">Sticker label generated successfully. Attach this sticker on the finished box.</p>
          </div>

          {/* Sticker layout */}
          <div className="bg-white p-5 rounded-xl border border-orange-200 shadow-xl space-y-4 text-left text-xs text-slate-700">
            <div className="border-b border-orange-200 pb-2 flex justify-between items-center text-orange-655 font-bold">
              <span>JAYASHREE POLYMERS PVT LTD</span>
              <span className="text-[10px] bg-green-500 text-white font-extrabold px-1.5 py-0.5 rounded uppercase">Passed</span>
            </div>

            <div className="space-y-1.5 font-semibold">
              <div>Product: <strong className="text-slate-855 font-black">{generatedLabel.product}</strong></div>
              <div>Customer: <strong>{generatedLabel.customer}</strong></div>
              <div>Work Order: <strong>{generatedLabel.wo}</strong></div>
              <div>Inspection: <strong>{generatedLabel.inspection}</strong></div>
              <div>Qty Approved: <strong className="text-green-700">{generatedLabel.accepted} Pcs</strong></div>
              <div>Pass Date: <strong>{generatedLabel.date}</strong></div>
            </div>

            <div className="flex justify-center pt-2">
              <QRCode
                id="label-qr-canvas"
                value={generatedLabel.qrValue}
                size={110}
                level="M"
                includeMargin={true}
              />
            </div>
            <p className="text-center text-slate-400 text-[10px] font-semibold">Scan this barcode to receive into stores</p>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={() => downloadLabelPDF(generatedLabel)}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs py-3 rounded-lg transition shadow-md flex items-center justify-center gap-1.5"
            >
              <Printer className="w-4.5 h-4.5" /> Download FG Sticker PDF
            </button>
            
            <button
              onClick={() => {
                setViewState('list');
                handleResetWizard();
                fetchInspections();
                fetchStats();
              }}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-lg transition"
            >
              Back to List
            </button>
          </div>
        </div>
      )}

      {/* WO camera scanner modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xxs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-xl max-w-sm w-full border border-slate-200 shadow-2xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-800 text-sm">Scan Work Order Barcode</span>
              <button onClick={stopScanner} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <div id="fqc-qr-reader" className="w-full h-64 bg-slate-100 rounded-lg overflow-hidden border border-slate-250"></div>
            <p className="text-slate-400 text-xxs text-center">Center the Work Order slip barcode/QR inside the frame to scan.</p>
          </div>
        </div>
      )}

    </div>
  );
}
