import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Factory, ClipboardList, Play, RotateCw, Printer, Camera, Plus, Trash2, 
  Save, AlertTriangle, FileText, ShieldCheck, Eye, ArrowLeft, RefreshCw
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { QRCodeCanvas as QRCode } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return {
    headers: { Authorization: `Bearer ${token}` }
  };
};

export default function Production() {
  const [activeTab, setActiveTab] = useState('workorders'); // 'workorders', 'bom', 'routing', 'mrn', 'shopfloor'
  const [loading, setLoading] = useState(false);

  // Common lists
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [boms, setBoms] = useState([]);
  const [mrns, setMrns] = useState([]);
  
  // Dashboard & Shop Floor live states
  const [shopFloorData, setShopFloorData] = useState({
    active_work_orders: [],
    machines: [],
    summary: { total_produced: 0, total_rejected: 0, reject_percent: '0.0', completed_today: 0, in_progress_count: 0 }
  });

  // Filter states
  const [woFilters, setWoFilters] = useState({ status: 'All', customer_id: 'All', product_id: 'All', search: '', start_date: '', end_date: '' });
  const [mrnFilters, setMrnFilters] = useState({ status: 'All', wo_id: 'All', start_date: '', end_date: '' });

  // Modals & Details sub-views
  const [selectedWO, setSelectedWO] = useState(null);
  const [showNewWOModal, setShowNewWOModal] = useState(false);
  const [showNewBOMModal, setShowNewBOMModal] = useState(false);
  const [showNewRoutingModal, setShowNewRoutingModal] = useState(false);
  const [showNewMRNModal, setShowNewMRNModal] = useState(false);
  const [selectedMRN, setSelectedMRN] = useState(null);
  const [selectedBOM, setSelectedBOM] = useState(null);
  const [selectedRouting, setSelectedRouting] = useState(null);

  // Form states
  const [newWO, setNewWO] = useState({ item_id: '', customer_id: '', planned_qty: '', planned_start: '', planned_end: '', priority: 'Medium', remarks: '', releaseDirectly: false });
  const [newBOM, setNewBOM] = useState({ finished_item_id: '', version: 'v1', effective_from: '', status: 'Active', items: [] });
  const [newRouting, setNewRouting] = useState({ item_id: '', stages: [] });
  const [newMRN, setNewMRN] = useState({ wo_id: '', required_by_date: '', remarks: '' });
  
  // BOM Check & stock checks during WO creation
  const [checkedBOM, setCheckedBOM] = useState(null); // { bom_id, version, items: [...] }
  const [bomError, setBomError] = useState('');

  // New MRN Creation State
  const [mrnSelectedWO, setMrnSelectedWO] = useState(null);

  // Store Keeper issue states (Batch)
  const [mrnItemIssues, setMrnItemIssues] = useState({}); // { [mrn_item_id]: { qty: '', barcode: '', selected: false, item_id: X } }
  const [highlightedItemId, setHighlightedItemId] = useState(null);
  const [scannedBarcode, setScannedBarcode] = useState('');

  // Camera scanner states
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [activeScannerTarget, setActiveScannerTarget] = useState(null);
  const html5QrCodeRef = useRef(null);

  // Stats Counters
  const [woStats, setWoStats] = useState({ total: 0, inProgress: 0, completedMonth: 0, overdue: 0 });

  // Notifications/Alert alerts helper
  const [alert, setAlert] = useState(null);
  const showAlert = (message, type = 'info') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
  };

  useEffect(() => {
    fetchCommonData();
    fetchWorkOrders();
    fetchBOMs();
    fetchMRNs();
    fetchShopFloor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    calculateWOStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrders]);

  // ─── API DATA FETCHERS ────────────────────────────────────────────

  const fetchCommonData = async () => {
    try {
      const itemsRes = await axios.get(`${API}/inventory/items`, getAuthHeader());
      setItems(itemsRes.data);

      const custRes = await axios.get(`${API}/production/customers`, getAuthHeader());
      setCustomers(custRes.data);
    } catch (err) {
      console.error('Failed to fetch common lists:', err);
    }
  };

  const fetchWorkOrders = async () => {
    setLoading(true);
    try {
      const { status, customer_id, product_id, search, start_date, end_date } = woFilters;
      const res = await axios.get(`${API}/production/work-orders`, {
        headers: getAuthHeader().headers,
        params: { status, customer_id, product_id, search, start_date, end_date }
      });
      setWorkOrders(res.data);
    } catch (err) {
      showAlert('Failed to fetch work orders.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchBOMs = async () => {
    try {
      const res = await axios.get(`${API}/production/bom`, getAuthHeader());
      setBoms(res.data);
    } catch (err) {
      console.error('Failed to fetch BOMs:', err);
    }
  };

  const fetchMRNs = async () => {
    try {
      const { status, wo_id, start_date, end_date } = mrnFilters;
      const res = await axios.get(`${API}/production/mrn`, {
        headers: getAuthHeader().headers,
        params: { status, wo_id, start_date, end_date }
      });
      setMrns(res.data);
    } catch (err) {
      console.error('Failed to fetch MRNs:', err);
    }
  };

  const fetchShopFloor = async () => {
    try {
      const res = await axios.get(`${API}/production/shop-floor`, getAuthHeader());
      setShopFloorData(res.data);
    } catch (err) {
      console.error('Failed to fetch shop floor live dashboard:', err);
    }
  };

  const calculateWOStats = () => {
    const total = workOrders.length;
    const inProgress = workOrders.filter(w => w.status === 'In Progress').length;
    const completedMonth = workOrders.filter(w => w.status === 'Completed').length;
    const overdue = workOrders.filter(w => {
      if (w.status === 'Completed' || w.status === 'Cancelled') return false;
      return new Date(w.planned_end) < new Date();
    }).length;

    setWoStats({ total, inProgress, completedMonth, overdue });
  };

  // ─── ACTION HANDLERS ──────────────────────────────────────────────

  const handleWOProductChange = async (itemId) => {
    setNewWO(prev => ({ ...prev, item_id: itemId }));
    setCheckedBOM(null);
    setBomError('');
    if (!itemId) return;

    try {
      const res = await axios.get(`${API}/production/bom/finished/${itemId}`, getAuthHeader());
      setCheckedBOM(res.data);
    } catch (err) {
      setBomError(err.response?.data?.message || 'No active BOM found. Please create a BOM first.');
      setCheckedBOM(null);
    }
  };

  const handleCreateWorkOrder = async (e) => {
    e.preventDefault();
    if (!newWO.item_id || !newWO.customer_id || !newWO.planned_qty || !newWO.planned_start || !newWO.planned_end) {
      return showAlert('Please fill all mandatory fields.', 'error');
    }
    if (!checkedBOM) {
      return showAlert('An active Bill of Materials (BOM) is required to release a work order.', 'error');
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API}/production/work-orders`, {
        ...newWO,
        bom_id: checkedBOM.bom_id
      }, getAuthHeader());

      showAlert(res.data.message || 'Work Order created successfully!', 'success');
      setShowNewWOModal(false);
      setNewWO({ item_id: '', customer_id: '', planned_qty: '', planned_start: '', planned_end: '', priority: 'Medium', remarks: '', releaseDirectly: false });
      setCheckedBOM(null);
      fetchWorkOrders();
    } catch (err) {
      showAlert(err.response?.data?.message || 'Failed to create Work Order.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReleaseWO = async (id) => {
    try {
      const res = await axios.put(`${API}/production/work-orders/${id}/release`, {}, getAuthHeader());
      showAlert(res.data.message || 'Work Order released successfully!', 'success');
      setSelectedWO(null); // Goes back to Work Order list!
      fetchWorkOrders();
    } catch (err) {
      showAlert('Failed to release work order.', 'error');
    }
  };

  const handleCancelWO = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this Work Order?')) return;
    try {
      const res = await axios.put(`${API}/production/work-orders/${id}/cancel`, {}, getAuthHeader());
      showAlert(res.data.message || 'Work Order cancelled successfully!', 'success');
      setSelectedWO(null);
      fetchWorkOrders();
    } catch (err) {
      showAlert('Failed to cancel work order.', 'error');
    }
  };

  const handleOpenWODetails = async (id) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/production/work-orders/${id}`, getAuthHeader());
      setSelectedWO(res.data);
    } catch (err) {
      showAlert('Failed to load Work Order details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // BOM Actions
  const handleAddBOMRow = () => {
    setNewBOM(prev => ({
      ...prev,
      items: [...prev.items, { raw_material_id: '', quantity: '', unit: 'kg', scrap_percent: 0 }]
    }));
  };

  const handleRemoveBOMRow = (idx) => {
    setNewBOM(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  const handleBOMRowChange = (idx, field, value) => {
    const updated = [...newBOM.items];
    updated[idx][field] = value;
    setNewBOM(prev => ({ ...prev, items: updated }));
  };

  const handleCreateBOM = async (e) => {
    e.preventDefault();
    if (!newBOM.finished_item_id || newBOM.items.length === 0) {
      return showAlert('Please select product and add at least 1 raw material.', 'error');
    }

    setLoading(true);
    try {
      await axios.post(`${API}/production/bom`, newBOM, getAuthHeader());
      showAlert('BOM version created successfully!', 'success');
      setShowNewBOMModal(false);
      setNewBOM({ finished_item_id: '', version: 'v1', effective_from: '', status: 'Active', items: [] });
      fetchBOMs();
    } catch (err) {
      showAlert('Failed to create BOM.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Routing actions
  const handleAddRoutingRow = () => {
    setNewRouting(prev => ({
      ...prev,
      stages: [...prev.stages, { stage_name: '', machine_type: '', standard_time_minutes: '', max_time_minutes: '' }]
    }));
  };

  const handleRemoveRoutingRow = (idx) => {
    setNewRouting(prev => ({
      ...prev,
      stages: prev.stages.filter((_, i) => i !== idx)
    }));
  };

  const handleRoutingRowChange = (idx, field, value) => {
    const updated = [...newRouting.stages];
    updated[idx][field] = value;
    setNewRouting(prev => ({ ...prev, stages: updated }));
  };

  const handleCreateRouting = async (e) => {
    e.preventDefault();
    if (!newRouting.item_id || newRouting.stages.length === 0) {
      return showAlert('Please select product and define stage routing template.', 'error');
    }

    setLoading(true);
    try {
      await axios.post(`${API}/production/routing`, newRouting, getAuthHeader());
      showAlert('Routing template saved successfully!', 'success');
      setShowNewRoutingModal(false);
      setNewRouting({ item_id: '', stages: [] });
    } catch (err) {
      showAlert('Failed to save routing template.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // MRN Actions
  const handleMRNWOChange = async (woId) => {
    setNewMRN(prev => ({ ...prev, wo_id: woId }));
    setMrnSelectedWO(null);
    if (!woId) return;

    try {
      const res = await axios.get(`${API}/production/work-orders/${woId}`, getAuthHeader());
      setMrnSelectedWO(res.data);
    } catch (err) {
      showAlert('Failed to load Work Order details for MRN.', 'error');
    }
  };

  const handleMRNWOScan = (scannedText) => {
    const matched = workOrders.find(w => w.wo_number.trim().toLowerCase() === scannedText.trim().toLowerCase());
    if (matched) {
      handleMRNWOChange(matched.wo_id);
      showAlert(`Work Order ${matched.wo_number} loaded successfully via barcode scan!`, 'success');
    } else {
      showAlert(`Work Order barcode '${scannedText}' not found.`, 'error');
    }
  };

  const handleRaiseMRN = async (e) => {
    e.preventDefault();
    if (!newMRN.wo_id || !newMRN.required_by_date) {
      return showAlert('Work order and required date are required.', 'error');
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API}/production/mrn`, newMRN, getAuthHeader());
      showAlert(res.data.message || 'Material Requisition Note raised successfully!', 'success');
      setShowNewMRNModal(false);
      setNewMRN({ wo_id: '', required_by_date: '', remarks: '' });
      setMrnSelectedWO(null);
      fetchMRNs();
      if (selectedWO) {
        handleOpenWODetails(selectedWO.wo_id);
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'Failed to raise MRN.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenMRNDetails = async (id, startIssuing = false) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/production/mrn/${id}`, getAuthHeader());
      setSelectedMRN(res.data);
      setScannedBarcode('');
      setHighlightedItemId(null);

      // Initialize batch issues state
      const initialIssues = {};
      res.data.items.forEach(item => {
        const pending = Math.max(0, parseFloat(item.required_qty) - parseFloat(item.issued_qty || 0));
        initialIssues[item.mrn_item_id] = {
          qty: pending > 0 ? pending : 0,
          barcode: item.issued_barcode || '',
          selected: pending > 0,
          item_id: item.item_id
        };
      });
      setMrnItemIssues(initialIssues);

    } catch (err) {
      showAlert('Failed to retrieve MRN details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Scan & Match Row helper
  const handleBarcodeLookup = (code) => {
    if (!code || !selectedMRN) return;
    const trimmedCode = code.trim();
    setScannedBarcode(trimmedCode);

    // Parse barcode: BC-[ItemCode]-[Batch] e.g. BC-RM001-001 -> RM001
    const parts = trimmedCode.split('-');
    if (parts.length < 2) {
      return showAlert('Invalid barcode structure. Expected: BC-[ItemCode]-[Batch]', 'error');
    }

    const itemCode = parts[1];
    
    // Find matching item in MRN
    const matched = selectedMRN.items.find(it => it.item_code === itemCode);
    if (!matched) {
      return showAlert(`Material code ${itemCode} is not required in this MRN.`, 'error');
    }

    setHighlightedItemId(matched.mrn_item_id);
    
    // Check row and auto-assign scanned barcode
    setMrnItemIssues(prev => ({
      ...prev,
      [matched.mrn_item_id]: {
        ...prev[matched.mrn_item_id],
        barcode: trimmedCode,
        selected: true
      }
    }));

    showAlert(`Material identified: ${matched.item_name}. Highlighted and checked!`, 'success');
  };

  // Issue checked items batch
  const handleIssueSelected = async () => {
    if (!selectedMRN) return;
    const list = [];
    Object.keys(mrnItemIssues).forEach(mrn_item_id => {
      const issue = mrnItemIssues[mrn_item_id];
      if (issue.selected && parseFloat(issue.qty) > 0) {
        list.push({
          mrn_item_id: parseInt(mrn_item_id),
          item_id: issue.item_id,
          quantity: parseFloat(issue.qty),
          barcode: issue.barcode || 'MANUAL'
        });
      }
    });

    if (list.length === 0) {
      return showAlert('Please select at least one material with an issue quantity to submit.', 'error');
    }

    setLoading(true);
    try {
      const res = await axios.put(`${API}/production/mrn/${selectedMRN.mrn_id}/issue-batch`, { issues: list }, getAuthHeader());
      showAlert(res.data.message || 'Selected materials successfully issued!', 'success');
      handleOpenMRNDetails(selectedMRN.mrn_id, true);
    } catch (err) {
      showAlert(err.response?.data?.message || 'Failed to issue materials.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Issue all items batch
  const handleIssueAll = async () => {
    if (!selectedMRN) return;
    const list = [];
    selectedMRN.items.forEach(item => {
      const pending = Math.max(0, parseFloat(item.required_qty) - parseFloat(item.issued_qty || 0));
      if (pending > 0) {
        list.push({
          mrn_item_id: item.mrn_item_id,
          item_id: item.item_id,
          quantity: pending,
          barcode: `BC-${item.item_code}-001` // auto-generates target item code barcode e.g. BC-RM001-001
        });
      }
    });

    if (list.length === 0) {
      return showAlert('All items are already fully issued.', 'info');
    }

    setLoading(true);
    try {
      const res = await axios.put(`${API}/production/mrn/${selectedMRN.mrn_id}/issue-batch`, { issues: list }, getAuthHeader());
      showAlert(res.data.message || 'All materials issued successfully!', 'success');
      handleOpenMRNDetails(selectedMRN.mrn_id, true);
    } catch (err) {
      showAlert('Failed to issue all materials.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseMRN = async (id) => {
    setLoading(true);
    try {
      const res = await axios.put(`${API}/production/mrn/${id}/close`, {}, getAuthHeader());
      showAlert(res.data.message || 'MRN closed successfully!', 'success');
      fetchMRNs();
      setSelectedMRN(null);
    } catch (err) {
      showAlert('Failed to close MRN.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Webcam Camera scanner methods
  const handleOpenCamera = (target) => {
    setActiveScannerTarget(target);
    setShowCameraModal(true);
    setTimeout(() => startCameraScanner(), 300);
  };

  const startCameraScanner = () => {
    html5QrCodeRef.current = new Html5Qrcode('qr-reader');
    html5QrCodeRef.current.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        handleCameraScanSuccess(decodedText);
      },
      (errorMessage) => {
        // ignore scan log noises
      }
    ).catch(err => console.error('Camera start failure:', err));
  };

  const handleCameraScanSuccess = (decodedText) => {
    stopCameraScanner();
    setShowCameraModal(false);

    if (activeScannerTarget === 'mrn-issue') {
      handleBarcodeLookup(decodedText);
    } else if (activeScannerTarget === 'wo-mrn-scan') {
      handleMRNWOScan(decodedText);
    } else if (activeScannerTarget === 'wo-lookup') {
      // Scan WO QR code
      const parts = decodedText.split('/');
      const woId = parts[parts.length - 1];
      if (woId && !isNaN(woId)) {
        setActiveTab('workorders');
        handleOpenWODetails(woId);
      } else {
        // Try matching by raw code string
        const matched = workOrders.find(w => w.wo_number.trim().toLowerCase() === decodedText.trim().toLowerCase());
        if (matched) {
          setActiveTab('workorders');
          handleOpenWODetails(matched.wo_id);
        } else {
          showAlert(`Scanned barcode '${decodedText}' is not a valid Work Order.`, 'error');
        }
      }
    }
  };

  const stopCameraScanner = () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      html5QrCodeRef.current.stop().then(() => {
        html5QrCodeRef.current = null;
      }).catch(e => console.error(e));
    }
  };

  const handleCloseCamera = () => {
    stopCameraScanner();
    setShowCameraModal(false);
  };

  // Text-based progress bar generator
  const renderTextProgressBar = (produced, planned) => {
    const pct = planned > 0 ? Math.min(100, Math.round((produced / planned) * 100)) : 0;
    const blocks = Math.round(pct / 5); // 20 character width bar
    const filled = '█'.repeat(blocks);
    const empty = '░'.repeat(20 - blocks);
    return `[${filled}${empty}] ${pct}% Complete`;
  };

  // PDF Printing layout for Work Order sheet
  const handlePrintWorkOrder = () => {
    const element = document.getElementById('printable-wo-sheet');
    html2canvas(element, { scale: 2 }).then(canvas => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`Work_Order_${selectedWO.wo_number.replace(/\//g, '_')}.pdf`);
    });
  };

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      {alert && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-in slide-in-from-top duration-300 font-extrabold text-xs uppercase tracking-wide border ${
          alert.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' :
          alert.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'
        }`}>
          <div className="w-2.5 h-2.5 rounded-full animate-ping bg-current"></div>
          {alert.message}
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Factory className="w-6 h-6 text-orange-500" />
            Production Planning & Shop Floor
          </h1>
          <p className="text-slate-400 text-xs mt-0.5 font-bold font-mono">Manage work orders, bills of materials, routings, material requisitions, and live factory tracking.</p>
        </div>

        {/* Dynamic header actions */}
        <div className="flex gap-2">
          {activeTab === 'workorders' && !selectedWO && (
            <div className="flex gap-2">
              <button
                onClick={() => handleOpenCamera('wo-lookup')}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow-md text-xs"
                title="Scan WO QR code to instantly open it"
              >
                <Camera className="w-4 h-4 text-orange-500" />
                Scan WO QR
              </button>
              <button
                onClick={() => setShowNewWOModal(true)}
                className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow-md text-xs"
              >
                <Plus className="w-4 h-4" />
                New Work Order
              </button>
            </div>
          )}
          {activeTab === 'bom' && (
            <button
              onClick={() => setShowNewBOMModal(true)}
              className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow-md text-xs"
            >
              <Plus className="w-4 h-4" />
              New BOM
            </button>
          )}
          {activeTab === 'routing' && (
            <button
              onClick={() => setShowNewRoutingModal(true)}
              className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow-md text-xs"
            >
              <Plus className="w-4 h-4" />
              New Routing Template
            </button>
          )}
          {activeTab === 'mrn' && !selectedMRN && (
            <button
              onClick={() => {
                setMrnSelectedWO(null);
                setNewMRN({ wo_id: '', required_by_date: '', remarks: '' });
                setShowNewMRNModal(true);
              }}
              className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow-md text-xs"
            >
              <Plus className="w-4 h-4" />
              New Requisition (MRN)
            </button>
          )}
          {activeTab === 'shopfloor' && (
            <button
              onClick={fetchShopFloor}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow-md text-xs"
            >
              <RefreshCw className="w-4 h-4 text-orange-500 animate-spin" />
              Refresh Dashboard
            </button>
          )}
        </div>
      </div>

      {/* Tabs list switchers */}
      <div className="flex border-b border-slate-200 bg-white border rounded-2xl p-1.5 shadow-sm overflow-x-auto gap-1">
        {[
          { key: 'workorders', label: 'Work Orders', count: workOrders.length },
          { key: 'bom', label: 'Bill of Materials (BOM)', count: boms.length },
          { key: 'routing', label: 'Routing Templates' },
          { key: 'mrn', label: 'Store Requests (MRN)', count: mrns.filter(m=>m.status==='Pending').length },
          { key: 'shopfloor', label: 'Shop Floor Live' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setSelectedWO(null);
              setSelectedMRN(null);
            }}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-extrabold transition whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-orange-55 text-orange-600 border border-orange-200/55'
                : 'text-slate-555 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`px-1.5 py-0.5 text-[9px] rounded-full font-black ${
                activeTab === tab.key ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-550'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB AREA 1: WORK ORDERS */}
      {activeTab === 'workorders' && (
        <div className="space-y-6">
          {/* Stats Summary cards */}
          {!selectedWO && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { title: 'Total Work Orders', val: woStats.total, color: 'border-slate-200 text-slate-800' },
                { title: 'In Progress Orders', val: woStats.inProgress, color: 'border-orange-200 text-orange-600 bg-orange-50/20' },
                { title: 'Completed This Month', val: woStats.completedMonth, color: 'border-green-200 text-green-600 bg-green-50/20' },
                { title: 'Overdue Delivery', val: woStats.overdue, color: 'border-red-200 text-red-600 bg-red-50/20' }
              ].map((card, i) => (
                <div key={i} className={`bg-white border rounded-2xl p-5 shadow-sm flex flex-col justify-between ${card.color}`}>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide block">{card.title}</span>
                  <span className="text-2xl font-black mt-2 block">{card.val}</span>
                </div>
              ))}
            </div>
          )}

          {/* List panel */}
          {!selectedWO ? (
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              {/* Filter grid */}
              <div className="p-6 border-b border-slate-200 bg-slate-50/50 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 text-xs font-semibold text-slate-650">
                <div>
                  <label className="block text-slate-400 uppercase text-[9px] font-black mb-1">Status</label>
                  <select
                    className="w-full bg-white border border-slate-350 rounded-xl p-2 font-bold text-slate-700"
                    value={woFilters.status}
                    onChange={e => setWoFilters(prev => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="All">All Statuses</option>
                    <option value="Draft">Draft</option>
                    <option value="Released">Released</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 uppercase text-[9px] font-black mb-1">Customer</label>
                  <select
                    className="w-full bg-white border border-slate-350 rounded-xl p-2 font-bold text-slate-700"
                    value={woFilters.customer_id}
                    onChange={e => setWoFilters(prev => ({ ...prev, customer_id: e.target.value }))}
                  >
                    <option value="All">All Customers</option>
                    {customers.map(c => (
                      <option key={c.customer_id} value={c.customer_id}>{c.customer_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 uppercase text-[9px] font-black mb-1">Product</label>
                  <select
                    className="w-full bg-white border border-slate-350 rounded-xl p-2 font-bold text-slate-700"
                    value={woFilters.product_id}
                    onChange={e => setWoFilters(prev => ({ ...prev, product_id: e.target.value }))}
                  >
                    <option value="All">All Products</option>
                    {items.filter(it => it.category === 'Finished Good').map(it => (
                      <option key={it.item_id} value={it.item_id}>{it.item_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 uppercase text-[9px] font-black mb-1">From Date</label>
                  <input
                    type="date"
                    className="w-full bg-white border border-slate-350 rounded-xl p-2 font-bold text-slate-700"
                    value={woFilters.start_date}
                    onChange={e => setWoFilters(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-slate-400 uppercase text-[9px] font-black mb-1">To Date</label>
                  <input
                    type="date"
                    className="w-full bg-white border border-slate-350 rounded-xl p-2 font-bold text-slate-700"
                    value={woFilters.end_date}
                    onChange={e => setWoFilters(prev => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>

                <div className="flex items-end gap-1">
                  <button
                    onClick={fetchWorkOrders}
                    className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition text-xs shadow-md"
                  >
                    Filter
                  </button>
                  <button
                    onClick={() => {
                      setWoFilters({ status: 'All', customer_id: 'All', product_id: 'All', search: '', start_date: '', end_date: '' });
                      setTimeout(() => fetchWorkOrders(), 100);
                    }}
                    className="py-2 px-3 border border-slate-300 hover:bg-slate-100 rounded-xl font-bold transition text-xs"
                    title="Clear Filters"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Work Orders Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-semibold text-slate-750 text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-extrabold uppercase text-[9px] tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">WO Number</th>
                      <th className="px-6 py-3.5">Product</th>
                      <th className="px-6 py-3.5">Customer</th>
                      <th className="px-6 py-3.5 text-center">Planned Qty</th>
                      <th className="px-6 py-3.5 text-center">Produced Qty</th>
                      <th className="px-6 py-3.5">Progress</th>
                      <th className="px-6 py-3.5">Delivery Due</th>
                      <th className="px-6 py-3.5">Priority</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan="10" className="px-6 py-12 text-center text-slate-400">
                          <RotateCw className="w-8 h-8 animate-spin mx-auto text-slate-300" />
                          <p className="mt-2 font-bold">Retrieving Work Orders queue...</p>
                        </td>
                      </tr>
                    ) : workOrders.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="px-6 py-12 text-center text-slate-400">
                          <ClipboardList className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                          <p className="font-bold text-slate-600">No Work Orders found</p>
                        </td>
                      </tr>
                    ) : (
                      workOrders.map(wo => {
                        const pct = wo.planned_qty > 0 ? Math.min(100, Math.round((wo.produced_qty || 0) / wo.planned_qty * 100)) : 0;
                        return (
                          <tr key={wo.wo_id} className="hover:bg-slate-55 transition">
                            <td className="px-6 py-4">
                              <button
                                type="button"
                                onClick={() => handleOpenWODetails(wo.wo_id)}
                                className="font-extrabold text-orange-600 hover:text-orange-700 hover:underline text-[12px]"
                              >
                                {wo.wo_number}
                              </button>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-extrabold text-slate-805">{wo.item_name}</div>
                              <div className="text-[10px] text-slate-405 font-mono">Code: {wo.item_code}</div>
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-600">{wo.customer_name || '-'}</td>
                            <td className="px-6 py-4 text-center font-black text-slate-850">{wo.planned_qty.toLocaleString()}</td>
                            <td className="px-6 py-4 text-center font-black text-slate-855">{wo.produced_qty ? wo.produced_qty.toLocaleString() : 0}</td>
                            <td className="px-6 py-4">
                              <div className="w-24">
                                <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold mb-1">
                                  <span>Progress</span>
                                  <span>{pct}%</span>
                                </div>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-green-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }}></div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 font-extrabold text-slate-755">{wo.planned_end ? new Date(wo.planned_end).toLocaleDateString() : 'N/A'}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                wo.priority === 'High' ? 'bg-red-50 text-red-650 border border-red-100' :
                                wo.priority === 'Medium' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-slate-100 text-slate-550'
                              }`}>
                                {wo.priority}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                wo.status === 'Draft' ? 'bg-slate-100 text-slate-550 border border-slate-205' :
                                wo.status === 'Released' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                wo.status === 'In Progress' ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                                wo.status === 'Completed' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'
                              }`}>
                                {wo.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenWODetails(wo.wo_id)}
                                  className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 transition"
                                  title="View Work Order"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                {wo.status === 'Draft' && (
                                  <button
                                    onClick={() => handleReleaseWO(wo.wo_id)}
                                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold transition shadow-sm"
                                  >
                                    Release
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* DETAILED WORK ORDER SUB-VIEW */
            <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm animate-in fade-in duration-200">
              <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                <button
                  onClick={() => { setSelectedWO(null); fetchWorkOrders(); }}
                  className="flex items-center gap-1.5 text-slate-500 hover:text-slate-850 font-extrabold text-xs transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to List
                </button>
                <div className="flex gap-2">
                  {selectedWO.status === 'Draft' && (
                    <button
                      onClick={() => handleReleaseWO(selectedWO.wo_id)}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition text-xs shadow-md"
                    >
                      Release Order
                    </button>
                  )}
                  {selectedWO.status !== 'Cancelled' && selectedWO.status !== 'Completed' && (
                    <button
                      onClick={() => handleCancelWO(selectedWO.wo_id)}
                      className="px-3.5 py-1.5 bg-red-55 border border-red-200 text-red-650 rounded-xl font-bold transition text-xs"
                    >
                      Cancel Order
                    </button>
                  )}
                  <button
                    onClick={handlePrintWorkOrder}
                    className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-50 rounded-xl font-bold transition text-xs flex items-center gap-1"
                  >
                    <Printer className="w-4 h-4 text-orange-500" />
                    Print sheet
                  </button>
                </div>
              </div>

              {/* Printable sheet container */}
              <div id="printable-wo-sheet" className="space-y-6 bg-white p-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-black text-slate-800">{selectedWO.wo_number}</h2>
                    <p className="text-slate-400 text-xs mt-0.5 font-bold font-mono">Jayashree Polymers — Work Order Document</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border border-orange-200 ${
                    selectedWO.status === 'Draft' ? 'bg-slate-50 text-slate-500 border-slate-200' :
                    selectedWO.status === 'Released' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                    selectedWO.status === 'In Progress' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                    selectedWO.status === 'Completed' ? 'bg-green-50 text-green-655 border-green-200' : 'bg-red-50 text-red-600 border-red-200'
                  }`}>
                    {selectedWO.status}
                  </span>
                </div>

                {/* Section 1: WO Info Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold text-slate-755 bg-slate-50/50 border border-slate-200 p-5 rounded-2xl">
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase font-black block mb-1">Product</span>
                    <strong className="font-extrabold text-slate-800 text-xs block">{selectedWO.item_name}</strong>
                    <span className="text-[10px] text-slate-400 font-bold font-mono">Code: {selectedWO.item_code}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase font-black block mb-1">Customer</span>
                    <strong className="font-extrabold text-slate-800 text-xs block">{selectedWO.customer_name || '-'}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase font-black block mb-1">Quantities</span>
                    <span className="font-extrabold text-slate-800 text-xs block">Planned: {selectedWO.planned_qty.toLocaleString()} Pcs</span>
                    <span className="text-[10px] text-green-655 font-black block">Produced: {(selectedWO.produced_qty || 0).toLocaleString()} Pcs</span>
                    <span className="text-[10px] text-slate-400 font-bold block">Pending: {Math.max(0, selectedWO.planned_qty - (selectedWO.produced_qty || 0)).toLocaleString()} Pcs</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase font-black block mb-1">Timeline & Priority</span>
                    <span className="font-extrabold text-slate-800 text-xs block">Start: {selectedWO.actual_start ? new Date(selectedWO.actual_start).toLocaleDateString() : (selectedWO.planned_start ? new Date(selectedWO.planned_start).toLocaleDateString() : 'N/A')}</span>
                    <span className="text-[10px] text-slate-400 font-bold block">End: {selectedWO.planned_end ? new Date(selectedWO.planned_end).toLocaleDateString() : 'N/A'}</span>
                    <span className="text-[10px] font-black text-red-600 block">Priority: {selectedWO.priority}</span>
                  </div>
                </div>

                {/* Section 1: Progress bar */}
                <div className="space-y-2 border border-slate-200 p-5 rounded-2xl">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                    <span className="font-mono text-slate-700 font-bold">
                      {renderTextProgressBar(selectedWO.produced_qty || 0, selectedWO.planned_qty)}
                    </span>
                    <span className="font-black text-sm text-green-655">
                      {selectedWO.planned_qty > 0 ? Math.min(100, Math.round(((selectedWO.produced_qty || 0) / selectedWO.planned_qty) * 100)) : 0}% Complete
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold font-mono">{(selectedWO.produced_qty || 0).toLocaleString()} of {selectedWO.planned_qty.toLocaleString()} pieces produced.</p>
                  {selectedWO.remarks && <p className="text-[10px] text-slate-655 bg-slate-50 rounded-lg p-2.5 font-bold border border-slate-200">Remarks: {selectedWO.remarks}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Section 2: BOM Details Table */}
                  <div className="border border-slate-200 rounded-2xl p-5 space-y-4">
                    <h3 className="font-extrabold text-slate-850 text-xs uppercase tracking-wide flex items-center gap-1">
                      <FileText className="w-4 h-4 text-orange-500" />
                      Section 2 — BOM Details
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px] font-semibold text-slate-755 border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-extrabold uppercase text-[8.5px]">
                          <tr>
                            <th className="px-3 py-2">Material</th>
                            <th className="px-3 py-2 text-right">Required Qty</th>
                            <th className="px-3 py-2 text-right">Issued Qty</th>
                            <th className="px-3 py-2 text-right">Pending</th>
                            <th className="px-3 py-2 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedWO.bom_items?.length === 0 ? (
                            <tr>
                              <td colSpan="5" className="px-3 py-4 text-center text-slate-400">No materials linked to this Work Order's BOM.</td>
                            </tr>
                          ) : (
                            selectedWO.bom_items?.map((item, idx) => (
                              <tr key={idx}>
                                <td className="px-3 py-2.5 font-extrabold text-slate-850">{item.item_name}</td>
                                <td className="px-3 py-2.5 text-right font-bold">{parseFloat(item.required_qty).toFixed(2)} {item.material_unit}</td>
                                <td className="px-3 py-2.5 text-right font-bold text-green-700">{parseFloat(item.issued_qty || 0).toFixed(2)} {item.material_unit}</td>
                                <td className="px-3 py-2.5 text-right font-bold">{parseFloat(item.pending_qty || 0).toFixed(2)} {item.material_unit}</td>
                                <td className="px-3 py-2.5 text-center">
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border ${
                                    item.item_status === 'Issued' ? 'bg-green-50 border-green-200 text-green-700' :
                                    item.item_status === 'Partial' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-100 text-slate-550 border-slate-205'
                                  }`}>
                                    {item.item_status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Section 3: MRN List Table */}
                  <div className="border border-slate-200 rounded-2xl p-5 space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-extrabold text-slate-850 text-xs uppercase tracking-wide flex items-center gap-1">
                        <ClipboardList className="w-4 h-4 text-orange-500" />
                        Section 3 — MRN List
                      </h3>
                      {(selectedWO.status === 'Released' || selectedWO.status === 'In Progress') && (
                        <button
                          onClick={() => {
                            setMrnSelectedWO(selectedWO);
                            setNewMRN({ wo_id: selectedWO.wo_id, required_by_date: '', remarks: '' });
                            setShowNewMRNModal(true);
                          }}
                          className="px-2 py-1 bg-slate-900 hover:bg-slate-805 text-white rounded text-[10px] font-extrabold shadow-sm transition"
                        >
                          + Raise New MRN
                        </button>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px] font-semibold text-slate-750 border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-extrabold uppercase text-[8.5px]">
                          <tr>
                            <th className="px-3 py-2">MRN No</th>
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Items</th>
                            <th className="px-3 py-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedWO.mrns?.length === 0 ? (
                            <tr>
                              <td colSpan="5" className="px-3 py-4 text-center text-slate-400">No material requests raised yet.</td>
                            </tr>
                          ) : (
                            selectedWO.mrns?.map(m => (
                              <tr key={m.mrn_id}>
                                <td className="px-3 py-2.5 font-extrabold text-orange-605">{m.mrn_number}</td>
                                <td className="px-3 py-2.5">{new Date(m.created_at).toLocaleDateString()}</td>
                                <td className="px-3 py-2.5">
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border ${
                                    m.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                    m.status === 'Partially Issued' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-green-50 text-green-600 border-green-200'
                                  }`}>
                                    {m.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 max-w-[130px] truncate font-bold font-mono" title={m.items_summary}>{m.items_summary || '-'}</td>
                                <td className="px-3 py-2.5 text-right">
                                  <div className="flex justify-end gap-1">
                                    <button
                                      onClick={() => handleOpenMRNDetails(m.mrn_id, false)}
                                      className="p-0.5 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800"
                                      title="View"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                    {m.status !== 'Issued' && (
                                      <button
                                        onClick={() => handleOpenMRNDetails(m.mrn_id, true)}
                                        className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-855 text-white rounded text-[9px] font-bold shadow-sm"
                                        title="Issue"
                                      >
                                        Issue
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Section 4: Moulding Job Cards */}
                <div className="border border-slate-200 rounded-2xl p-5 space-y-4">
                  <h3 className="font-extrabold text-slate-855 text-xs uppercase tracking-wide flex items-center gap-1.5">
                    <Factory className="w-4.5 h-4.5 text-orange-500" />
                    Section 4 — Moulding Job Cards
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] font-semibold text-slate-755 border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-extrabold uppercase text-[8.5px]">
                        <tr>
                          <th className="px-3 py-2">Job Card No</th>
                          <th className="px-3 py-2">Machine</th>
                          <th className="px-3 py-2">Mould</th>
                          <th className="px-3 py-2 text-right">Planned Qty</th>
                          <th className="px-3 py-2 text-right">Produced</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedWO.job_cards?.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="px-3 py-4 text-center text-slate-400">No job cards created against this WO in Moulding module.</td>
                          </tr>
                        ) : (
                          selectedWO.job_cards?.map(jc => (
                            <tr key={jc.jc_id}>
                              <td className="px-3 py-2.5 font-extrabold text-slate-800">{jc.jc_number}</td>
                              <td className="px-3 py-2.5 font-bold">{jc.machine_name}</td>
                              <td className="px-3 py-2.5 font-bold">{jc.mould_name}</td>
                              <td className="px-3 py-2.5 text-right font-bold">{jc.planned_qty.toLocaleString()}</td>
                              <td className="px-3 py-2.5 text-right font-black text-slate-855">{(jc.produced_qty || 0).toLocaleString()}</td>
                              <td className="px-3 py-2.5">
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border ${
                                  jc.status === 'Pending' ? 'bg-slate-50 text-slate-500 border-slate-200' :
                                  jc.status === 'In Progress' ? 'bg-orange-50 border border-orange-200 text-orange-700' : 'bg-green-50 border border-green-200 text-green-700'
                                }`}>
                                  {jc.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section 5: FQC Inspections */}
                <div className="border border-slate-200 rounded-2xl p-5 space-y-4">
                  <h3 className="font-extrabold text-slate-855 text-xs uppercase tracking-wide flex items-center gap-1.5">
                    <ShieldCheck className="w-4.5 h-4.5 text-orange-500" />
                    Section 5 — Final Quality Checks (FQC)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] font-semibold text-slate-755 border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-extrabold uppercase text-[8.5px]">
                        <tr>
                          <th className="px-3 py-2">FQC Number</th>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2 text-right">Inspected</th>
                          <th className="px-3 py-2 text-right">Accepted</th>
                          <th className="px-3 py-2 text-right">Rejected</th>
                          <th className="px-3 py-2">Inspector</th>
                          <th className="px-3 py-2">FG Label</th>
                          <th className="px-3 py-2">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedWO.fqc_inspections?.length === 0 ? (
                          <tr>
                            <td colSpan="8" className="px-3 py-4 text-center text-slate-400">No Final Quality Check reports linked to this WO.</td>
                          </tr>
                        ) : (
                          selectedWO.fqc_inspections?.map(fqc => (
                            <tr key={fqc.fqc_id}>
                              <td className="px-3 py-2.5 font-extrabold text-slate-800">{fqc.fqc_number}</td>
                              <td className="px-3 py-2.5 font-bold">{new Date(fqc.inspection_date).toLocaleDateString()}</td>
                              <td className="px-3 py-2.5 text-right font-bold">{fqc.inspected_qty}</td>
                              <td className="px-3 py-2.5 text-right font-black text-green-600">{fqc.accepted_qty}</td>
                              <td className="px-3 py-2.5 text-right font-black text-red-650">{fqc.rejected_qty}</td>
                              <td className="px-3 py-2.5 font-bold">{fqc.inspector_name}</td>
                              <td className="px-3 py-2.5 font-mono text-slate-500">{fqc.label_number || '—'}</td>
                              <td className="px-3 py-2.5">
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border ${
                                  fqc.result === 'Approved' ? 'bg-green-50 border border-green-200 text-green-700' :
                                  fqc.result === 'Rejected' ? 'bg-red-50 border border-red-200 text-red-700' :
                                  'bg-amber-50 border border-amber-200 text-amber-700'
                                }`}>
                                  {fqc.result}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* QR code stamp for print */}
                <div className="flex justify-between items-end border-t border-slate-200 pt-6">
                  <div className="text-[10px] text-slate-400 space-y-1">
                    <p>Remarks: {selectedWO.remarks || 'None'}</p>
                    <p>Created on: {new Date(selectedWO.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-col items-center">
                    <QRCode value={`${window.location.origin}/production/work-orders/${selectedWO.wo_id}`} size={70} />
                    <span className="text-[8px] text-slate-455 uppercase font-black tracking-wide mt-1">Scan to inspect WO</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB AREA 2: BILL OF MATERIALS (BOM) */}
      {activeTab === 'bom' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-extrabold text-xs text-slate-805 uppercase tracking-wider">Product Bills of Materials (BOM)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-semibold text-slate-700 text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-extrabold uppercase text-[9px] tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Product Name</th>
                    <th className="px-6 py-3.5">Item Code</th>
                    <th className="px-6 py-3.5">BOM Version</th>
                    <th className="px-6 py-3.5 text-center">No. of Materials</th>
                    <th className="px-6 py-3.5">Effective From</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {boms.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                        <FileText className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                        <p className="font-bold text-slate-600">No BOMs registered yet</p>
                      </td>
                    </tr>
                  ) : (
                    boms.map(bom => (
                      <tr key={bom.bom_id} className="hover:bg-slate-50/50 transition">
                        <td className="px-6 py-4 font-extrabold text-slate-800">{bom.item_name}</td>
                        <td className="px-6 py-4 font-bold text-slate-500">{bom.item_code}</td>
                        <td className="px-6 py-4 font-extrabold text-orange-600">{bom.version}</td>
                        <td className="px-6 py-4 text-center font-bold">{bom.item_count} items</td>
                        <td className="px-6 py-4 text-slate-600">{bom.effective_from ? new Date(bom.effective_from).toLocaleDateString() : '-'}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            bom.status === 'Active' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-slate-100 text-slate-550'
                          }`}>
                            {bom.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={async () => {
                                try {
                                  const res = await axios.get(`${API}/production/bom/finished/${bom.finished_item_id}`, getAuthHeader());
                                  setSelectedBOM(res.data);
                                } catch (err) {
                                  showAlert('Failed to retrieve BOM items.', 'error');
                                }
                              }}
                              className="px-3 py-1.5 border border-slate-300 hover:bg-slate-105 rounded-xl font-extrabold text-[10.5px] transition flex items-center gap-1 shadow-sm"
                            >
                              <Eye className="w-3.5 h-3.5 text-orange-500" />
                              View / Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB AREA 3: ROUTINGS */}
      {activeTab === 'routing' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
              <h3 className="font-extrabold text-xs text-slate-805 uppercase tracking-wider">Product Sequence Routings</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-semibold text-slate-700 text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-extrabold uppercase text-[9px] tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Product Name</th>
                    <th className="px-6 py-3.5">Item Code</th>
                    <th className="px-6 py-3.5 text-center">Total Stages</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.filter(i => i.category === 'Finished Good').map(it => (
                    <tr key={it.item_id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4 font-extrabold text-slate-800">{it.item_name}</td>
                      <td className="px-6 py-4 font-bold text-slate-500">{it.item_code}</td>
                      <td className="px-6 py-4 text-center font-bold">
                        {it.item_code === 'FG002' ? '6 stages' : '6 stages'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-green-50 text-green-600 border border-green-100">
                          Active
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end">
                          <button
                            onClick={async () => {
                              try {
                                const res = await axios.get(`${API}/production/routing/${it.item_id}`, getAuthHeader());
                                setSelectedRouting({ item: it, stages: res.data });
                              } catch (err) {
                                showAlert('Failed to load routing steps.', 'error');
                              }
                            }}
                            className="px-3 py-1.5 border border-slate-300 hover:bg-slate-105 rounded-xl font-extrabold text-[10.5px] transition flex items-center gap-1 shadow-sm"
                          >
                            <Eye className="w-3.5 h-3.5 text-orange-500" />
                            View / Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB AREA 4: MATERIAL REQUISITION (MRN) */}
      {activeTab === 'mrn' && (
        <div className="space-y-6">
          {!selectedMRN ? (
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-slate-200 bg-slate-50/50 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-semibold text-slate-650">
                <div>
                  <label className="block text-slate-400 uppercase text-[9px] font-black mb-1">Status</label>
                  <select
                    className="w-full bg-white border border-slate-350 rounded-xl p-2 font-bold text-slate-700"
                    value={mrnFilters.status}
                    onChange={e => setMrnFilters(prev => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="All">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Partially Issued">Partially Issued</option>
                    <option value="Issued">Issued</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 uppercase text-[9px] font-black mb-1">Work Order</label>
                  <select
                    className="w-full bg-white border border-slate-350 rounded-xl p-2 font-bold text-slate-700"
                    value={mrnFilters.wo_id}
                    onChange={e => setMrnFilters(prev => ({ ...prev, wo_id: e.target.value }))}
                  >
                    <option value="All">All Work Orders</option>
                    {workOrders.map(w => (
                      <option key={w.wo_id} value={w.wo_id}>{w.wo_number}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 uppercase text-[9px] font-black mb-1">From Date</label>
                  <input
                    type="date"
                    className="w-full bg-white border border-slate-350 rounded-xl p-2 font-bold text-slate-700"
                    value={mrnFilters.start_date}
                    onChange={e => setMrnFilters(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>

                <div className="flex items-end gap-1">
                  <button
                    onClick={fetchMRNs}
                    className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition text-xs shadow-md"
                  >
                    Filter
                  </button>
                  <button
                    onClick={() => {
                      setMrnFilters({ status: 'All', wo_id: 'All', start_date: '', end_date: '' });
                      setTimeout(() => fetchMRNs(), 100);
                    }}
                    className="py-2 px-3 border border-slate-300 hover:bg-slate-105 rounded-xl font-bold transition text-xs"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* MRN Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-semibold text-slate-750 text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-extrabold uppercase text-[9px] tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">MRN Number</th>
                      <th className="px-6 py-3.5">Work Order</th>
                      <th className="px-6 py-3.5">Product Item</th>
                      <th className="px-6 py-3.5">Requested By</th>
                      <th className="px-6 py-3.5">Required By</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mrns.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                          <ClipboardList className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                          <p className="font-bold text-slate-600">No Material Requisition Notes (MRN) found</p>
                        </td>
                      </tr>
                    ) : (
                      mrns.map(m => (
                        <tr key={m.mrn_id} className="hover:bg-slate-50/50 transition">
                          <td className="px-6 py-4 font-black text-orange-600">{m.mrn_number}</td>
                          <td className="px-6 py-4 font-bold text-slate-755">{m.wo_number}</td>
                          <td className="px-6 py-4 font-extrabold text-slate-800">{m.item_name}</td>
                          <td className="px-6 py-4 text-slate-600">{m.requested_by_name || 'Production Supervisor'}</td>
                          <td className="px-6 py-4 text-slate-600">{m.required_by_date ? new Date(m.required_by_date).toLocaleDateString() : '-'}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                              m.status === 'Pending' ? 'bg-amber-50 border-amber-200 text-amber-600' :
                              m.status === 'Partially Issued' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-green-50 border-green-200 text-green-600'
                            }`}>
                              {m.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenMRNDetails(m.mrn_id, false)}
                                className="px-3 py-1.5 border border-slate-300 hover:bg-slate-105 rounded-xl font-extrabold text-[10.5px] transition flex items-center gap-1 shadow-sm"
                                title="View details"
                              >
                                <Eye className="w-3.5 h-3.5 text-orange-500" />
                                View / Issue
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* PAGE 10 — MRN ISSUE SCREEN (Store Keeper Cockpit) */
            <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm animate-in fade-in duration-200">
              <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                <button
                  onClick={() => { setSelectedMRN(null); fetchMRNs(); }}
                  className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 font-extrabold text-xs transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to MRNs List
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCloseMRN(selectedMRN.mrn_id)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition text-xs shadow-md"
                  >
                    Close MRN
                  </button>
                </div>
              </div>

              {/* MRN Info header */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-black block mb-1">MRN Number</span>
                  <strong className="text-slate-800 font-extrabold text-sm block">{selectedMRN.mrn_number}</strong>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-black block mb-1">Work Order</span>
                  <strong className="text-slate-800 font-extrabold block">{selectedMRN.wo_number}</strong>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-black block mb-1">Requested By</span>
                  <span className="text-slate-800 font-bold block">{selectedMRN.requested_by_name || 'Production Supervisor'}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-black block mb-1">Required By</span>
                  <span className="text-slate-800 font-bold block">{selectedMRN.required_by_date ? new Date(selectedMRN.required_by_date).toLocaleDateString() : '-'}</span>
                </div>
                <div className="flex flex-col justify-center">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border text-center ${
                    selectedMRN.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                    selectedMRN.status === 'Partially Issued' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-green-50 text-green-600 border-green-200'
                  }`}>
                    {selectedMRN.status}
                  </span>
                </div>
              </div>

              {/* Scanner section at top */}
              <div className="bg-slate-900 text-white p-6 rounded-2xl space-y-4 shadow-inner border border-slate-850">
                <h4 className="font-extrabold text-orange-500 text-xs uppercase tracking-wide flex items-center gap-1.5">
                  <Camera className="w-5 h-5 text-orange-500" />
                  🔍 Scan material barcode
                </h4>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Scan barcode (e.g. BC-RM001-001) or press enter..."
                    className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 font-mono font-bold uppercase text-xs focus:outline-none focus:border-orange-500"
                    value={scannedBarcode}
                    onChange={e => setScannedBarcode(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleBarcodeLookup(scannedBarcode);
                      }
                    }}
                  />
                  <button
                    onClick={() => handleOpenCamera('mrn-issue')}
                    className="px-5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-md text-xs transition"
                  >
                    <Camera className="w-4 h-4" />
                    Open Scanner
                  </button>
                </div>
              </div>

              {/* Materials Issue Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs font-semibold text-slate-705 border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-extrabold uppercase text-[9px] tracking-wider">
                    <tr>
                      <th className="px-4 py-3.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={Object.values(mrnItemIssues).length > 0 && Object.values(mrnItemIssues).every(v => v.selected)}
                          onChange={e => {
                            const updated = { ...mrnItemIssues };
                            Object.keys(updated).forEach(k => {
                              updated[k].selected = e.target.checked;
                            });
                            setMrnItemIssues(updated);
                          }}
                        />
                      </th>
                      <th className="px-6 py-3.5">Item</th>
                      <th className="px-6 py-3.5 text-center">Required Qty</th>
                      <th className="px-6 py-3.5 text-center">Available</th>
                      <th className="px-6 py-3.5 text-center">Issued Qty</th>
                      <th className="px-6 py-3.5">Barcode Scanned</th>
                      <th className="px-6 py-3.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedMRN.items?.map(it => {
                      const pending = Math.max(0, parseFloat(it.required_qty) - parseFloat(it.issued_qty || 0));
                      const isShort = it.stock_qty < pending;
                      const issueState = mrnItemIssues[it.mrn_item_id] || { qty: 0, barcode: '', selected: false };
                      const isHighlighted = highlightedItemId === it.mrn_item_id;

                      return (
                        <tr 
                          key={it.mrn_item_id} 
                          className={`transition ${isHighlighted ? 'bg-orange-50/75 border-l-4 border-orange-500' : 'hover:bg-slate-50/50'}`}
                        >
                          <td className="px-4 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={issueState.selected}
                              onChange={e => {
                                setMrnItemIssues(prev => ({
                                  ...prev,
                                  [it.mrn_item_id]: { ...prev[it.mrn_item_id], selected: e.target.checked }
                                }));
                              }}
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-extrabold text-slate-805">{it.item_name}</div>
                            <div className="text-[10px] text-slate-405 font-mono">Code: {it.item_code}</div>
                          </td>
                          <td className="px-6 py-4 text-center font-black text-slate-800">{parseFloat(it.required_qty).toFixed(2)} {it.unit}</td>
                          <td className={`px-6 py-4 text-center font-black ${isShort ? 'text-red-655' : 'text-slate-800'}`}>
                            {parseFloat(it.stock_qty).toFixed(2)} {it.unit}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <input
                              type="number"
                              step="any"
                              className={`w-24 bg-white border border-slate-350 p-1.5 rounded-lg text-center font-black text-slate-800 focus:ring-1 focus:ring-orange-500 focus:outline-none ${
                                isHighlighted ? 'bg-orange-100/50 border-orange-400' : ''
                              }`}
                              value={issueState.qty}
                              onChange={e => {
                                setMrnItemIssues(prev => ({
                                  ...prev,
                                  [it.mrn_item_id]: { ...prev[it.mrn_item_id], qty: e.target.value }
                                }));
                              }}
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[10.5px] font-bold text-slate-700 bg-slate-100 border px-2 py-0.5 rounded-lg">
                                {issueState.barcode || 'NO BARCODE'}
                              </span>
                              {issueState.barcode && <span className="text-green-655 font-bold">✅</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {pending === 0 ? (
                              <span className="text-green-600 font-extrabold">✅ Issued</span>
                            ) : it.issued_qty > 0 ? (
                              <span className="text-blue-600 font-extrabold">⚠️ Partial</span>
                            ) : (
                              <span className="text-amber-600 font-extrabold">Pending</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Action buttons at bottom */}
              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  onClick={handleIssueSelected}
                  disabled={loading}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition shadow-md"
                >
                  Issue Selected
                </button>
                <button
                  onClick={handleIssueAll}
                  disabled={loading}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs transition shadow-md"
                >
                  Issue All
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB AREA 5: SHOP FLOOR LIVE VIEW */}
      {activeTab === 'shopfloor' && (
        <div className="space-y-6">
          {/* Today's shift summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: 'Total Produced Today', val: `${shopFloorData.summary.total_produced.toLocaleString()} Pcs`, color: 'border-slate-200 text-slate-855' },
              { title: 'Total Rejected Today', val: `${shopFloorData.summary.total_rejected.toLocaleString()} Pcs`, color: 'border-red-200 text-red-655 bg-red-50/10' },
              { title: 'Defect Rejection Rate', val: `${shopFloorData.summary.reject_percent}%`, color: 'border-red-200 text-red-700 bg-red-50/10' },
              { title: 'Completed Today', val: `${shopFloorData.summary.completed_today} Work Orders`, color: 'border-green-200 text-green-600 bg-green-50/10' }
            ].map((card, i) => (
              <div key={i} className={`bg-white border rounded-2xl p-5 shadow-sm flex flex-col justify-between ${card.color}`}>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide block">{card.title}</span>
                <span className="text-xl font-black mt-2 block">{card.val}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Active Work Orders */}
            <div className="lg:col-span-1 bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-orange-500" />
                Active planning queue
              </h3>
              <div className="space-y-3">
                {shopFloorData.active_work_orders.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">No active released work orders on shop floor.</p>
                ) : (
                  shopFloorData.active_work_orders.map(wo => {
                    const pct = wo.planned_qty > 0 ? Math.min(100, Math.round((wo.produced_qty || 0) / wo.planned_qty * 100)) : 0;
                    const isOverdue = new Date(wo.planned_end) < new Date();
                    return (
                      <div 
                        key={wo.wo_id}
                        className={`border rounded-2xl p-4 space-y-3 transition hover:shadow-md ${
                          isOverdue ? 'border-red-350 bg-red-50/5' :
                          wo.status === 'In Progress' ? 'border-orange-200 bg-orange-50/5' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <strong className="text-slate-855 text-xs block font-black">{wo.wo_number}</strong>
                            <span className="text-[10.5px] text-slate-400 font-bold block">{wo.item_name} ({wo.customer_name})</span>
                          </div>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                            wo.status === 'In Progress' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {wo.status}
                          </span>
                        </div>

                        {/* Progress */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                            <span>{wo.produced_qty || 0} / {wo.planned_qty} Pcs</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                          <span>Priority: <strong className="text-slate-600 font-black">{wo.priority}</strong></span>
                          <span>Due: {wo.planned_end ? new Date(wo.planned_end).toLocaleDateString() : 'N/A'}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Machine statuses */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
                <Factory className="w-4 h-4 text-orange-500" />
                Moulding Press Shop Floor Status
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {shopFloorData.machines.map(mac => (
                  <div key={mac.machine_id} className="border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm hover:border-slate-350 transition">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <span className="font-black text-slate-800 text-xs block">{mac.machine_name}</span>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                        mac.machine_status === 'Active' && mac.jc_number ? 'bg-green-105 text-green-705 bg-green-55' :
                        mac.machine_status === 'Active' ? 'bg-amber-105 text-amber-755 bg-amber-50' : 'bg-red-105 text-red-755 bg-red-50'
                      }`}>
                        {mac.machine_status === 'Active' && mac.jc_number ? '● Running' :
                         mac.machine_status === 'Active' ? 'Idle' : 'Breakdown'}
                      </span>
                    </div>

                    {mac.jc_number ? (
                      <div className="space-y-2 text-xs font-semibold text-slate-700">
                        <div className="flex justify-between">
                          <span className="text-slate-405 text-[10.5px]">Running Job:</span>
                          <strong className="text-slate-800 font-extrabold">{mac.jc_number}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-405 text-[10.5px]">Product:</span>
                          <span className="text-slate-800 font-extrabold text-right truncate max-w-[120px]">{mac.running_product}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-405 text-[10.5px]">Completed parts:</span>
                          <span className="text-slate-800 font-black">{mac.good_parts_count || 0} / {mac.planned_qty} Pcs</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-20 text-slate-400 text-xs">
                        No active moulding job assigned
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: NEW WORK ORDER */}
      {showNewWOModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Plan New Production Work Order</h3>
              <button onClick={() => { setShowNewWOModal(false); setCheckedBOM(null); setBomError(''); }} className="text-slate-400 hover:text-slate-600 font-extrabold text-sm transition">✕</button>
            </div>
            
            <form onSubmit={handleCreateWorkOrder} className="p-6 space-y-6 text-xs font-semibold text-slate-700">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-455 uppercase text-[9.5px] font-bold mb-1">Finished Product *</label>
                  <select
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800 focus:outline-none focus:border-orange-500"
                    value={newWO.item_id}
                    onChange={e => handleWOProductChange(e.target.value)}
                  >
                    <option value="">-- Select Product --</option>
                    {items.filter(it => it.category === 'Finished Good').map(it => (
                      <option key={it.item_id} value={it.item_id}>{it.item_name} ({it.item_code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-455 uppercase text-[9.5px] font-bold mb-1">Customer / Client *</label>
                  <select
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800 focus:outline-none focus:border-orange-500"
                    value={newWO.customer_id}
                    onChange={e => setNewWO(prev => ({ ...prev, customer_id: e.target.value }))}
                  >
                    <option value="">-- Select Customer --</option>
                    {customers.map(c => (
                      <option key={c.customer_id} value={c.customer_id}>{c.customer_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-455 uppercase text-[9.5px] font-bold mb-1">Planned Quantity *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 5000 pieces"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800 focus:outline-none focus:border-orange-500"
                    value={newWO.planned_qty}
                    onChange={e => setNewWO(prev => ({ ...prev, planned_qty: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-slate-455 uppercase text-[9.5px] font-bold mb-1">Order Priority</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800 focus:outline-none focus:border-orange-500"
                    value={newWO.priority}
                    onChange={e => setNewWO(prev => ({ ...prev, priority: e.target.value }))}
                  >
                    <option value="Low">Low Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="High">High Priority</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-455 uppercase text-[9.5px] font-bold mb-1">Planned Start Date *</label>
                  <input
                    type="date"
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-855 focus:outline-none focus:border-orange-500"
                    value={newWO.planned_start}
                    onChange={e => setNewWO(prev => ({ ...prev, planned_start: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-slate-455 uppercase text-[9.5px] font-bold mb-1">Planned Delivery Due Date *</label>
                  <input
                    type="date"
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-855 focus:outline-none focus:border-orange-500"
                    value={newWO.planned_end}
                    onChange={e => setNewWO(prev => ({ ...prev, planned_end: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-455 uppercase text-[9.5px] font-bold mb-1">Remarks & Special Instructions</label>
                <textarea
                  rows="2"
                  placeholder="Enter any customer packaging, trimming tolerances, or testing instructions..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:border-orange-500"
                  value={newWO.remarks}
                  onChange={e => setNewWO(prev => ({ ...prev, remarks: e.target.value }))}
                ></textarea>
              </div>

              {/* BOM Stock Preview Check */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                <span className="text-[9px] uppercase font-black tracking-wide text-slate-400 block">BOM Stock check verification</span>
                {bomError && <p className="text-red-655 font-extrabold text-[11px] flex items-center gap-1"><AlertTriangle className="w-4 h-4"/> {bomError}</p>}
                {checkedBOM && (
                  <div className="space-y-3">
                    <p className="text-[11px] text-green-700 font-extrabold flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4 text-green-600" />
                      BOM Found — Version {checkedBOM.version} — Active ✅
                    </p>
                    <div className="overflow-x-auto max-h-40 overflow-y-auto">
                      <table className="w-full text-left text-[10px] font-semibold text-slate-700">
                        <thead className="bg-slate-100 text-slate-400 font-extrabold uppercase text-[8px]">
                          <tr>
                            <th className="p-2">Material</th>
                            <th className="p-2 text-right">Required (Total)</th>
                            <th className="p-2 text-right">Available Stock</th>
                            <th className="p-2 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {checkedBOM.items?.map((it, i) => {
                            const planned = parseFloat(newWO.planned_qty || 0);
                            const totalReq = parseFloat(it.net_qty_per_unit || it.quantity || 0) * planned;
                            const isOk = it.stock_qty >= totalReq;
                            return (
                              <tr key={i}>
                                <td className="p-2 font-extrabold text-slate-800">{it.item_name}</td>
                                <td className="p-2 text-right font-bold">{totalReq.toFixed(2)} {it.material_unit}</td>
                                <td className="p-2 text-right font-bold">{parseFloat(it.stock_qty).toFixed(2)} {it.material_unit}</td>
                                <td className="p-2 text-center font-black">
                                  {isOk ? <span className="text-green-655">✅ OK</span> : <span className="text-red-655">❌ Short</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowNewWOModal(false); setCheckedBOM(null); setBomError(''); }}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-55 rounded-xl font-bold transition text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={() => setNewWO(prev => ({ ...prev, releaseDirectly: false }))}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold rounded-xl transition text-xs"
                >
                  Save as Draft
                </button>
                <button
                  type="submit"
                  onClick={() => setNewWO(prev => ({ ...prev, releaseDirectly: true }))}
                  disabled={loading || !checkedBOM}
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl transition shadow-md text-xs flex items-center gap-1"
                >
                  <Play className="w-4 h-4" />
                  Release Work Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: NEW BOM */}
      {showNewBOMModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Create Bill of Materials (BOM)</h3>
              <button onClick={() => setShowNewBOMModal(false)} className="text-slate-400 hover:text-slate-600 font-extrabold text-sm transition">✕</button>
            </div>
            
            <form onSubmit={handleCreateBOM} className="p-6 space-y-6 text-xs font-semibold text-slate-700">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="col-span-2">
                  <label className="block text-slate-455 uppercase text-[9.5px] font-bold mb-1">Finished Product Item *</label>
                  <select
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800 focus:outline-none focus:border-orange-500"
                    value={newBOM.finished_item_id}
                    onChange={e => setNewBOM(prev => ({ ...prev, finished_item_id: e.target.value }))}
                  >
                    <option value="">-- Choose FG Item --</option>
                    {items.filter(it => it.category === 'Finished Good').map(it => (
                      <option key={it.item_id} value={it.item_id}>{it.item_name} ({it.item_code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-455 uppercase text-[9.5px] font-bold mb-1">BOM Version</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800"
                    value={newBOM.version}
                    onChange={e => setNewBOM(prev => ({ ...prev, version: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-slate-455 uppercase text-[9.5px] font-bold mb-1">Effective Date</label>
                  <input
                    type="date"
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-850"
                    value={newBOM.effective_from}
                    onChange={e => setNewBOM(prev => ({ ...prev, effective_from: e.target.value }))}
                  />
                </div>
              </div>

              {/* Dynamic raw materials mapper */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wide">Raw materials composition grid</h4>
                  <button
                    type="button"
                    onClick={handleAddBOMRow}
                    className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[10px] font-extrabold transition shadow-sm"
                  >
                    + Add Material Row
                  </button>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs font-semibold text-slate-700 border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-extrabold uppercase text-[8.5px]">
                      <tr>
                        <th className="px-4 py-2 w-10">Sr</th>
                        <th className="px-4 py-2">Select Material</th>
                        <th className="px-4 py-2 w-28">Qty per piece</th>
                        <th className="px-4 py-2 w-20">Unit</th>
                        <th className="px-4 py-2 w-24">Scrap %</th>
                        <th className="px-4 py-2 w-28">Net Qty</th>
                        <th className="px-4 py-2 w-10 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {newBOM.items.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="px-4 py-6 text-center text-slate-400">No materials added yet. Click "+ Add Material Row" above.</td>
                        </tr>
                      ) : (
                        newBOM.items.map((row, idx) => {
                          const scrap = parseFloat(row.scrap_percent || 0);
                          const qty = parseFloat(row.quantity || 0);
                          const netQty = (qty + (qty * scrap / 100)).toFixed(4);
                          return (
                            <tr key={idx}>
                              <td className="px-4 py-2 font-bold">{idx + 1}</td>
                              <td className="px-4 py-2">
                                <select
                                  required
                                  className="w-full bg-white border border-slate-300 rounded-lg p-1.5 font-bold focus:outline-none"
                                  value={row.raw_material_id}
                                  onChange={e => handleBOMRowChange(idx, 'raw_material_id', e.target.value)}
                                >
                                  <option value="">-- Choose Raw material --</option>
                                  {items.filter(it => it.category === 'Raw Material').map(it => (
                                    <option key={it.item_id} value={it.item_id}>{it.item_name} ({it.item_code})</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="number"
                                  step="any"
                                  required
                                  placeholder="0.00"
                                  className="w-full bg-white border border-slate-300 rounded-lg p-1.5 font-extrabold text-slate-800 text-center"
                                  value={row.quantity}
                                  onChange={e => handleBOMRowChange(idx, 'quantity', e.target.value)}
                                />
                              </td>
                              <td className="px-4 py-2">
                                <select
                                  className="w-full bg-white border border-slate-300 rounded-lg p-1.5 font-bold"
                                  value={row.unit}
                                  onChange={e => handleBOMRowChange(idx, 'unit', e.target.value)}
                                >
                                  <option value="kg">kg</option>
                                  <option value="gm">gm</option>
                                  <option value="ltr">ltr</option>
                                  <option value="ml">ml</option>
                                  <option value="nos">nos</option>
                                </select>
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  className="w-full bg-white border border-slate-300 rounded-lg p-1.5 font-extrabold text-slate-850 text-center"
                                  value={row.scrap_percent}
                                  onChange={e => handleBOMRowChange(idx, 'scrap_percent', e.target.value)}
                                />
                              </td>
                              <td className="px-4 py-2 font-black text-slate-800 text-center">{netQty} {row.unit}</td>
                              <td className="px-4 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBOMRow(idx)}
                                  className="p-1 hover:bg-red-50 text-red-500 rounded transition"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewBOMModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-55 rounded-xl font-bold transition text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition shadow-md text-xs flex items-center gap-1"
                >
                  <Save className="w-4 h-4" />
                  Save BOM Recipe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: NEW ROUTING */}
      {showNewRoutingModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Create Routing Template</h3>
              <button onClick={() => setShowNewRoutingModal(false)} className="text-slate-400 hover:text-slate-600 font-extrabold text-sm transition">✕</button>
            </div>
            
            <form onSubmit={handleCreateRouting} className="p-6 space-y-6 text-xs font-semibold text-slate-700">
              <div>
                <label className="block text-slate-455 uppercase text-[9.5px] font-bold mb-1">Select Finished Product *</label>
                <select
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800 focus:outline-none focus:border-orange-500"
                  value={newRouting.item_id}
                  onChange={e => setNewRouting(prev => ({ ...prev, item_id: e.target.value }))}
                >
                  <option value="">-- Choose Product --</option>
                  {items.filter(it => it.category === 'Finished Good').map(it => (
                    <option key={it.item_id} value={it.item_id}>{it.item_name} ({it.item_code})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wide">Sequence of stages templates</h4>
                  <button
                    type="button"
                    onClick={handleAddRoutingRow}
                    className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[10px] font-extrabold transition shadow-sm"
                  >
                    + Add Routing Step
                  </button>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs font-semibold text-slate-700 border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-extrabold uppercase text-[8.5px]">
                      <tr>
                        <th className="px-4 py-2 w-10">Order</th>
                        <th className="px-4 py-2">Stage Name</th>
                        <th className="px-4 py-2">Machine/Station</th>
                        <th className="px-4 py-2 w-28 text-center">Std Time (min)</th>
                        <th className="px-4 py-2 w-28 text-center">Max Time (min)</th>
                        <th className="px-4 py-2 w-10 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {newRouting.stages.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="px-4 py-6 text-center text-slate-400 font-bold">No routing stages defined. Click "+ Add Routing Step".</td>
                        </tr>
                      ) : (
                        newRouting.stages.map((row, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 text-slate-800 font-black">{idx + 1}</td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                required
                                placeholder="e.g. Compounding/Mixing"
                                className="w-full bg-white border border-slate-300 rounded-lg p-1.5 font-bold"
                                value={row.stage_name}
                                onChange={e => handleRoutingRowChange(idx, 'stage_name', e.target.value)}
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                placeholder="e.g. Internal Mixer"
                                className="w-full bg-white border border-slate-300 rounded-lg p-1.5"
                                value={row.machine_type}
                                onChange={e => handleRoutingRowChange(idx, 'machine_type', e.target.value)}
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="number"
                                min="1"
                                placeholder="mins"
                                className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-center font-extrabold text-slate-800"
                                value={row.standard_time_minutes}
                                onChange={e => handleRoutingRowChange(idx, 'standard_time_minutes', e.target.value)}
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="number"
                                min="1"
                                placeholder="mins"
                                className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-center font-extrabold text-slate-800"
                                value={row.max_time_minutes}
                                onChange={e => handleRoutingRowChange(idx, 'max_time_minutes', e.target.value)}
                              />
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveRoutingRow(idx)}
                                className="p-1 hover:bg-red-50 text-red-500 rounded transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewRoutingModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-xl font-bold transition text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition shadow-md text-xs flex items-center gap-1"
                >
                  <Save className="w-4 h-4" />
                  Save Routing Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: NEW MRN WITH MATERIALS CHECKLIST */}
      {showNewMRNModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Raise Material Requisition (MRN)</h3>
              <button onClick={() => { setShowNewMRNModal(false); setMrnSelectedWO(null); }} className="text-slate-400 hover:text-slate-600 font-extrabold text-sm transition">✕</button>
            </div>
            
            <form onSubmit={handleRaiseMRN} className="p-6 space-y-6 text-xs font-semibold text-slate-700">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 flex items-end gap-2">
                  <div className="flex-1">
                    <label className="block text-slate-455 uppercase text-[9.5px] font-bold mb-1">Work Order *</label>
                    <select
                      required
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800 focus:outline-none focus:border-orange-500"
                      value={newMRN.wo_id}
                      onChange={e => handleMRNWOChange(e.target.value)}
                    >
                      <option value="">-- Select Work Order --</option>
                      {workOrders.filter(w => w.status === 'Released' || w.status === 'In Progress').map(w => (
                        <option key={w.wo_id} value={w.wo_id}>{w.wo_number} — {w.item_name} ({w.customer_name})</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenCamera('wo-mrn-scan')}
                    className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-md text-xs transition h-[40px]"
                    title="Scan WO Barcode"
                  >
                    <Camera className="w-4 h-4 text-orange-500" />
                    Scan WO
                  </button>
                </div>

                <div className="col-span-2">
                  <label className="block text-slate-455 uppercase text-[9.5px] font-bold mb-1">Required By Date *</label>
                  <input
                    type="date"
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-855 focus:outline-none focus:border-orange-500"
                    value={newMRN.required_by_date}
                    onChange={e => setNewMRN(prev => ({ ...prev, required_by_date: e.target.value }))}
                  />
                </div>
              </div>

              {/* Materials Table auto-filled from BOM */}
              {mrnSelectedWO && (
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                  <span className="text-[9px] uppercase font-black tracking-wide text-slate-400 block">Materials Checklist (Calculated from active BOM)</span>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] font-semibold text-slate-700">
                      <thead className="bg-slate-100 text-slate-400 font-extrabold uppercase text-[8px]">
                        <tr>
                          <th className="p-2">Item</th>
                          <th className="p-2 text-right">Required Qty</th>
                          <th className="p-2 text-right">Available Stock</th>
                          <th className="p-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {mrnSelectedWO.bom_items?.map((it, i) => (
                          <tr key={i}>
                            <td className="p-2 font-extrabold text-slate-800">{it.item_name}</td>
                            <td className="p-2 text-right font-bold">{it.required_qty.toFixed(2)} {it.material_unit}</td>
                            <td className={`p-2 text-right font-bold ${!it.is_available ? 'text-red-655' : 'text-slate-800'}`}>{it.available_stock.toFixed(2)} {it.material_unit}</td>
                            <td className="p-2 text-center font-black">
                              {it.is_available ? (
                                <span className="text-green-600">✅ OK</span>
                              ) : (
                                <span className="text-red-600">❌ Short</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-455 uppercase text-[9.5px] font-bold mb-1">Remarks</label>
                <textarea
                  rows="2"
                  placeholder="Notes for store keeper (delivery point, packaging)..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:border-orange-500"
                  value={newMRN.remarks}
                  onChange={e => setNewMRN(prev => ({ ...prev, remarks: e.target.value }))}
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowNewMRNModal(false); setMrnSelectedWO(null); }}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-55 rounded-xl font-bold transition text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition shadow-md text-xs flex items-center gap-1"
                >
                  <Save className="w-4 h-4" />
                  Submit MRN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: WEBCAM CAMERA SCANNER View */}
      {showCameraModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-orange-500" />
                Live Camera Barcode Scanner
              </h3>
              <button
                type="button"
                onClick={handleCloseCamera}
                className="text-slate-400 hover:text-slate-600 font-extrabold text-sm transition"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-[10px] text-slate-455 text-center font-bold uppercase">
                Align the barcode/QR code inside the viewfinder
              </p>
              <div id="qr-reader" className="w-full bg-slate-100 rounded-2xl overflow-hidden border border-slate-200"></div>
              <button
                type="button"
                onClick={handleCloseCamera}
                className="w-full py-2.5 border border-slate-55 hover:bg-slate-50 text-slate-755 font-bold rounded-xl transition text-[11px]"
              >
                Cancel Scanning
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: BOM Recipe viewer */}
      {selectedBOM && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">BOM Composition: {selectedBOM.item_name}</h3>
              <button onClick={() => setSelectedBOM(null)} className="text-slate-400 hover:text-slate-600 font-extrabold text-sm transition">✕</button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-700 bg-slate-50 p-3 rounded-xl border">
                <span>Version: <strong className="text-orange-600">{selectedBOM.version}</strong></span>
                <span>Effective: {selectedBOM.effective_from ? new Date(selectedBOM.effective_from).toLocaleDateString() : '-'}</span>
                <span>Status: <strong className="text-green-600 uppercase">{selectedBOM.status}</strong></span>
              </div>
              
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs font-semibold text-slate-700 border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-extrabold uppercase text-[8.5px]">
                    <tr>
                      <th className="px-4 py-2">Material</th>
                      <th className="px-4 py-2">Item Code</th>
                      <th className="px-4 py-2 text-right">Qty/Piece</th>
                      <th className="px-4 py-2 text-center">Scrap %</th>
                      <th className="px-4 py-2 text-right">Net Qty/Piece</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedBOM.items?.map((it, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2.5 font-extrabold text-slate-800">{it.item_name}</td>
                        <td className="px-4 py-2.5 font-bold text-slate-500">{it.item_code}</td>
                        <td className="px-4 py-2.5 text-right">{parseFloat(it.quantity).toFixed(4)} {it.unit}</td>
                        <td className="px-4 py-2.5 text-center">{parseFloat(it.scrap_percent).toFixed(1)}%</td>
                        <td className="px-4 py-2.5 text-right font-black text-slate-800">{parseFloat(it.net_qty_per_unit).toFixed(4)} {it.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action buttons inside View/Edit BOM */}
              <div className="flex justify-end gap-2 border-t pt-4">
                <button
                  onClick={() => {
                    setNewBOM({
                      finished_item_id: selectedBOM.finished_item_id,
                      version: `v${parseInt(selectedBOM.version.replace('v', '') || '1') + 1}`,
                      effective_from: new Date().toISOString().slice(0, 10),
                      status: 'Active',
                      items: selectedBOM.items.map(it => ({
                        raw_material_id: it.raw_material_id,
                        quantity: it.quantity,
                        unit: it.unit,
                        scrap_percent: it.scrap_percent
                      }))
                    });
                    setSelectedBOM(null);
                    setShowNewBOMModal(true);
                  }}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-extrabold rounded-xl transition text-xs shadow-md"
                >
                  Create New Version (Edit)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: Routing Template steps viewer */}
      {selectedRouting && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Routing Template: {selectedRouting.item.item_name}</h3>
              <button onClick={() => setSelectedRouting(null)} className="text-slate-400 hover:text-slate-600 font-extrabold text-sm transition">✕</button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs font-semibold text-slate-700 border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-extrabold uppercase text-[8.5px]">
                    <tr>
                      <th className="px-4 py-2 w-10">Step</th>
                      <th className="px-4 py-2">Operation Stage</th>
                      <th className="px-4 py-2">Machine/Station</th>
                      <th className="px-4 py-2 text-center">Std Time</th>
                      <th className="px-4 py-2 text-center">Max Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedRouting.stages?.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-4 py-6 text-center text-slate-400">No routing stages defined for this product.</td>
                      </tr>
                    ) : (
                      selectedRouting.stages?.map((st, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2.5 font-black text-slate-800">{st.stage_order}</td>
                          <td className="px-4 py-2.5 font-extrabold text-slate-800">{st.stage_name}</td>
                          <td className="px-4 py-2.5 font-bold text-slate-500">{st.machine_type || '-'}</td>
                          <td className="px-4 py-2.5 text-center">{st.standard_time_minutes ? `${st.standard_time_minutes} min` : '-'}</td>
                          <td className="px-4 py-2.5 text-center text-red-655 font-bold">{st.max_time_minutes ? `${st.max_time_minutes} min` : '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Action buttons inside View/Edit Routing */}
              <div className="flex justify-end gap-2 border-t pt-4">
                <button
                  onClick={() => {
                    setNewRouting({
                      item_id: selectedRouting.item.item_id,
                      stages: selectedRouting.stages.map(st => ({
                        stage_name: st.stage_name,
                        machine_type: st.machine_type,
                        standard_time_minutes: st.standard_time_minutes,
                        max_time_minutes: st.max_time_minutes,
                        stage_order: st.stage_order
                      }))
                    });
                    setSelectedRouting(null);
                    setShowNewRoutingModal(true);
                  }}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-extrabold rounded-xl transition text-xs shadow-md"
                >
                  Edit Routing Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
