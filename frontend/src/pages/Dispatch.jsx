import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  Search, Eye, X, ArrowLeft, Plus, Camera, Printer,
  Truck, CheckCircle, Play, ClipboardCheck,
  Check
} from 'lucide-react';
import jsPDF from 'jspdf';
import { QRCodeCanvas as QRCode } from 'qrcode.react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const getAuthHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

const CUSTOMER_ADDRESSES = {
  'Hero MotoCorp': 'Plot 25, Sector 3, IMT Manesar, Gurugram, Haryana - 122050',
  'Honda HMSI': 'Plot 1, Sector 3, IMT Manesar, Gurugram, Haryana - 122050',
  'Yamaha Motors': 'Plot 14, Udyog Vihar, Greater Noida, Uttar Pradesh - 201306'
};

export default function Dispatch() {
  const [activeView, setActiveView] = useState('list'); // 'list', 'create', 'detail'
  const [loading, setLoading] = useState(false);
  const [editOrderId, setEditOrderId] = useState(null);

  // Lists & Stats
  const [dispatchOrders, setDispatchOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerStock, setCustomerStock] = useState([]); // FG stock available for chosen customer
  const [stats, setStats] = useState({
    total_dispatches: 0,
    pending_pdi: 0,
    ready_to_dispatch: 0,
    dispatched_today: 0
  });

  // Filters & selection
  const [filterText, setFilterText] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null); // for detail view

  // Scanner states
  const [showScanner, setShowScanner] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const scannerRef = useRef(null);

  // New Dispatch Order Form state (3 steps)
  const [currentStep, setCurrentStep] = useState(1);
  const [customer_id, setCustomerId] = useState('');
  const [dispatch_date, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [vehicle_number, setVehicleNumber] = useState('');
  const [driver_name, setDriverName] = useState('');
  const [transporter, setTransporter] = useState('');
  const [po_number, setPoNumber] = useState('');
  const [delivery_address, setDeliveryAddress] = useState('');
  const [remarks, setRemarks] = useState('');
  const [itemsList, setItemsList] = useState([]); // array of { item_id, wo_id, qty, unit, item_code, item_name, fgr_number, available_stock }

  // PDI checklist form state
  const [showPdiForm, setShowPdiForm] = useState(false);
  const [pdiInspector, setPdiInspector] = useState('');
  const [pdiSampleSize, setPdiSampleSize] = useState('20');
  const [pdiCheckpoints, setPdiCheckpoints] = useState([
    { label: 'Part identification correct', desc: 'Product code matches spec', result: 'Pass' },
    { label: 'Quantity per box correct', desc: '100 pcs per box standard', result: 'Pass' },
    { label: 'Label on box correct', desc: 'Customer label present', result: 'Pass' },
    { label: 'No visual defects', desc: '0 defects in sample', result: 'Pass' },
    { label: 'Hardness check', desc: '60 ± 5 Shore A', result: 'Pass' },
    { label: 'Dimensional check', desc: 'As per technical drawing', result: 'Pass' },
    { label: 'Packaging condition', desc: 'No box damages', result: 'Pass' },
    { label: 'Part marking', desc: 'As per customer spec', result: 'Pass' }
  ]);
  const [pdiOverallResult, setPdiOverallResult] = useState('Passed'); // 'Passed' or 'Failed'
  const [pdiRemarks, setPdiRemarks] = useState('');

  // Scan & Load Checklist State
  const [showScanLoadSection, setShowScanLoadSection] = useState(false);

  useEffect(() => {
    fetchDispatchOrders();
    fetchStats();
    fetchCustomers();
  }, []);

  // Fetch Finished Goods stock when customer is chosen
  useEffect(() => {
    if (customer_id) {
      fetchCustomerStock(customer_id);
      
      // Auto-populate customer address
      const matchedCust = customers.find(c => c.customer_id.toString() === customer_id);
      if (matchedCust) {
        // Match Hero, Honda, Yamaha keyword
        const name = matchedCust.customer_name;
        let addr = 'Plot No 14, Phase III, IMT Manesar, Haryana';
        if (name.includes('Hero')) addr = CUSTOMER_ADDRESSES['Hero MotoCorp'];
        else if (name.includes('Honda')) addr = CUSTOMER_ADDRESSES['Honda HMSI'];
        else if (name.includes('Yamaha')) addr = CUSTOMER_ADDRESSES['Yamaha Motors'];
        setDeliveryAddress(addr);
      }
    } else {
      setCustomerStock([]);
      setDeliveryAddress('');
    }
  }, [customer_id, customers]);

  // API Callers
  const fetchDispatchOrders = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/dispatch`, getAuthHeader());
      setDispatchOrders(res.data);
    } catch (err) {
      console.error('Error fetching dispatches:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API}/dispatch/stats`, getAuthHeader());
      setStats(res.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await axios.get(`${API}/dispatch/customers`, getAuthHeader());
      setCustomers(res.data);
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
  };

  const fetchCustomerStock = async (custId) => {
    try {
      const res = await axios.get(`${API}/dispatch/fg-stock/${custId}`, getAuthHeader());
      setCustomerStock(res.data);
    } catch (err) {
      console.error('Error fetching customer stock:', err);
    }
  };

  // Add Item to loading list
  const handleItemQtyChange = (stockItem, qtyVal) => {
    const qty = parseFloat(qtyVal);
    
    setItemsList(prev => {
      const existingIdx = prev.findIndex(item => item.fgr_number === stockItem.fgr_number && item.item_id === stockItem.item_id);
      const updated = [...prev];

      if (isNaN(qty) || qty <= 0) {
        // Remove item if blank or zero
        if (existingIdx !== -1) {
          updated.splice(existingIdx, 1);
        }
      } else {
        const itemObj = {
          item_id: stockItem.item_id,
          wo_id: stockItem.wo_id,
          qty: qty,
          unit: stockItem.unit || 'Nos',
          item_code: stockItem.item_code,
          item_name: stockItem.item_name,
          fgr_number: stockItem.fgr_number,
          available_stock: stockItem.available_stock
        };

        if (existingIdx !== -1) {
          updated[existingIdx] = itemObj;
        } else {
          updated.push(itemObj);
        }
      }
      return updated;
    });
  };

  // Submit New Dispatch Order Form
  const handleCreateDispatchOrder = async () => {
    if (!customer_id) return alert('Customer is required.');
    if (itemsList.length === 0) return alert('Please enter dispatch quantities for at least one item.');

    setLoading(true);
    try {
      const payload = {
        customer_id: parseInt(customer_id),
        dispatch_date,
        vehicle_number,
        driver_name,
        transporter,
        po_number,
        remarks: remarks || `Order for ${po_number || 'logistics'}`,
        pdi_status: 'Pending',
        status: 'Draft',
        items: itemsList
      };

      if (editOrderId) {
        await axios.put(`${API}/dispatch/${editOrderId}`, payload, getAuthHeader());
        alert('Dispatch Order draft updated successfully!');
      } else {
        const res = await axios.post(`${API}/dispatch`, payload, getAuthHeader());
        alert(`Dispatch Order ${res.data.do_number} created in Draft status. PDI task generated.`);
      }
      
      handleResetForm();
      fetchDispatchOrders();
      fetchStats();
      setActiveView('list');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to complete dispatch order');
    } finally {
      setLoading(false);
    }
  };

  const handleResetForm = () => {
    setCurrentStep(1);
    setCustomerId('');
    setVehicleNumber('');
    setDriverName('');
    setTransporter('');
    setPoNumber('');
    setRemarks('');
    setItemsList([]);
    setEditOrderId(null);
  };

  // View Single Dispatch details
  const viewOrderDetails = async (id) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/dispatch/${id}`, getAuthHeader());
      setSelectedOrder(res.data);
      setShowPdiForm(false);
      setShowScanLoadSection(false);
      setActiveView('detail');
    } catch (err) {
      alert('Failed to load dispatch details');
    } finally {
      setLoading(false);
    }
  };

  // PDI Form Handlers
  const handleCheckpointChange = (index, value) => {
    setPdiCheckpoints(prev => {
      const updated = [...prev];
      updated[index].result = value;
      
      // Auto recommend overall Fail if any checkpoint fails
      const hasFailed = updated.some(c => c.result === 'Fail');
      setPdiOverallResult(hasFailed ? 'Failed' : 'Passed');
      return updated;
    });
  };

  const submitPdiResults = async () => {
    if (!pdiInspector.trim()) return alert('Inspector name is required');
    
    setLoading(true);
    try {
      const payload = {
        pdi_date: new Date().toISOString().split('T')[0],
        inspector_name: pdiInspector,
        result: pdiOverallResult,
        remarks: pdiRemarks || `Inspected ${pdiSampleSize} pcs. Result: ${pdiOverallResult}`
      };

      await axios.put(`${API}/dispatch/${selectedOrder.do_id}/pdi`, payload, getAuthHeader());
      alert(`PDI results submitted. Status updated to ${pdiOverallResult === 'Passed' ? 'Ready to Dispatch' : 'PDI Failed'}`);
      
      // Reload order details
      viewOrderDetails(selectedOrder.do_id);
      fetchStats();
      fetchDispatchOrders();
    } catch (err) {
      alert('Failed to submit PDI checks');
    } finally {
      setLoading(false);
    }
  };

  const handleEditDraft = async (order) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/dispatch/${order.do_id}`, getAuthHeader());
      const fullOrder = res.data;
      
      setEditOrderId(fullOrder.do_id);
      setCustomerId(fullOrder.customer_id.toString());
      setDispatchDate(fullOrder.dispatch_date.split('T')[0]);
      setVehicleNumber(fullOrder.vehicle_number || '');
      setDriverName(fullOrder.driver_name || '');
      setTransporter(fullOrder.transporter || '');
      setPoNumber(fullOrder.po_number || '');
      setRemarks(fullOrder.remarks || '');
      
      setItemsList(fullOrder.items.map(item => ({
        item_id: item.item_id,
        wo_id: item.wo_id,
        qty: item.qty,
        unit: item.unit || 'Nos',
        item_code: item.item_code,
        item_name: item.item_name,
        fgr_number: item.fgr_number || 'N/A',
        available_stock: item.qty
      })));
      
      setCurrentStep(1);
      setActiveView('create');
    } catch (err) {
      alert('Failed to load draft for editing');
    } finally {
      setLoading(false);
    }
  };

  // ─── SCAN AND LOAD LOGIC ──────────────────────────────────
  const startLoadingScanner = () => {
    setShowScanner(true);
    setTimeout(() => {
      const html5QrCode = new Html5Qrcode('loading-qr-reader');
      scannerRef.current = html5QrCode;
      html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleScanLoadItem(decodedText);
          stopLoadingScanner();
        },
        () => {}
      ).catch(err => {
        alert('Scanner load failed. Allow camera permission.');
        setShowScanner(false);
      });
    }, 300);
  };

  const stopLoadingScanner = () => {
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

  const handleScanLoadItem = async (code) => {
    if (!code) return;
    let barcodeString = code.trim();

    if (code.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(code);
        barcodeString = parsed.inspection || parsed.label || barcodeString;
      } catch (e) {}
    }

    try {
      const res = await axios.put(`${API}/dispatch/${selectedOrder.do_id}/scan-load`, { barcode: barcodeString }, getAuthHeader());
      alert(res.data.message);
      viewOrderDetails(selectedOrder.do_id);
    } catch (err) {
      alert(err.response?.data?.message || 'Verification failed. Wrong item or barcode.');
    }
  };

  // Close Shipment & Generate Gate Pass
  const handleCloseShipment = async () => {
    if (!selectedOrder.vehicle_number) return alert('Vehicle number must be registered before closing shipment.');

    setLoading(true);
    try {
      const res = await axios.put(`${API}/dispatch/${selectedOrder.do_id}/close`, {}, getAuthHeader());
      alert(`Shipment Closed! Outward Gate Pass ${res.data.gp_number} created. FG Stock deducted.`);
      
      viewOrderDetails(selectedOrder.do_id);
      fetchStats();
      fetchDispatchOrders();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to close shipment');
    } finally {
      setLoading(false);
    }
  };

  // Mark Delivered
  const handleMarkDelivered = async () => {
    setLoading(true);
    try {
      await axios.put(`${API}/dispatch/${selectedOrder.do_id}/delivered`, {}, getAuthHeader());
      alert('Dispatch Order marked as Delivered.');
      
      viewOrderDetails(selectedOrder.do_id);
      fetchStats();
      fetchDispatchOrders();
    } catch (err) {
      alert('Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  // Generate Delivery Challan PDF
  const generateChallanPDF = (order) => {
    if (!order) return;
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Border and Header frame
      doc.setDrawColor(255, 107, 0); // Orange
      doc.setLineWidth(1);
      doc.rect(5, 5, 200, 287);

      // Header Banner
      doc.setFillColor(255, 107, 0);
      doc.rect(5, 5, 200, 25, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('JAYASHREE POLYMERS (INDIA) PVT. LTD.', 10, 15);
      doc.setFontSize(8);
      doc.setFont('Helvetica', 'normal');
      doc.text('IMT Manesar, Gurugram, Haryana | GSTIN: 06AAACJ1234F1Z5', 10, 22);

      // Challan Title
      doc.setTextColor(50, 50, 50);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('DELIVERY CHALLAN', 10, 42);
      doc.line(10, 45, 200, 45);

      // Left Column - Bill to
      doc.setFontSize(9);
      doc.text('BILL TO / SHIP TO:', 10, 54);
      doc.setFont('Helvetica', 'bold');
      doc.text(order.customer_name, 10, 60);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      const matchedAddr = CUSTOMER_ADDRESSES[order.customer_name] || 'Plot No 14, Sector 3, IMT Manesar, Haryana';
      doc.text(doc.splitTextToSize(matchedAddr, 85), 10, 65);

      // Right Column - Metadata info box
      doc.rect(110, 50, 90, 32);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('CHALLAN LOGISTICS INFO', 113, 56);
      doc.setFont('Helvetica', 'normal');
      doc.text(`DC No:        ${order.do_number}`, 113, 62);
      doc.text(`Date:         ${formatDate(order.dispatch_date)}`, 113, 67);
      doc.text(`Vehicle No:   ${order.vehicle_number || '—'}`, 113, 72);
      doc.text(`Driver Name:  ${order.driver_name || '—'}`, 113, 77);

      // Table Header
      doc.setLineWidth(0.3);
      doc.setDrawColor(180, 180, 180);
      doc.setFillColor(245, 245, 245);
      doc.rect(10, 92, 190, 8, 'F');
      
      doc.setFont('Helvetica', 'bold');
      doc.text('S.No', 13, 97);
      doc.text('Part Code', 25, 97);
      doc.text('Product Part Name', 55, 97);
      doc.text('Work Order Ref', 125, 97);
      doc.text('FGR Ref', 155, 97);
      doc.text('Qty (Nos)', 185, 97);

      let y = 107;
      doc.setFont('Helvetica', 'normal');
      order.items.forEach((item, index) => {
        doc.text(String(index + 1), 13, y);
        doc.text(item.item_code || '—', 25, y);
        doc.text(item.item_name || '—', 55, y);
        doc.text(item.wo_number || 'N/A', 125, y);
        doc.text(item.fgr_number || 'N/A', 155, y);
        doc.text(parseFloat(item.qty).toLocaleString(), 185, y);
        doc.line(10, y + 2, 200, y + 2);
        y += 8;
      });

      // Summation
      const totalPieces = order.items.reduce((sum, item) => sum + parseFloat(item.qty), 0);
      doc.setFont('Helvetica', 'bold');
      doc.text('Total Qty (Pieces):', 125, y + 4);
      doc.text(totalPieces.toLocaleString(), 185, y + 4);

      // QR Code
      const qrCanvas = document.getElementById('do-challan-qr');
      if (qrCanvas) {
        const qrDataUrl = qrCanvas.toDataURL('image/jpeg', 1.0);
        doc.addImage(qrDataUrl, 'JPEG', 10, y + 10, 30, 30);
      }

      doc.setFontSize(7.5);
      doc.setFont('Helvetica', 'normal');
      doc.text('Scan Challan QR code at gate security for exit authorization', 10, y + 45);

      // Signatures
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('Dispatched By: __________', 10, 270);
      doc.text('Received By (Driver): __________', 75, 270);
      doc.text('Customer Authorized Sign: __________', 135, 270);

      // Save PDF
      doc.save(`Delivery_Challan_${order.do_number.replace(/\//g, '_')}.pdf`);
    } catch (e) {
      console.error(e);
      alert('Error producing Challan PDF.');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Draft': return 'bg-slate-500/10 text-slate-400 border border-slate-500/30 font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase';
      case 'PDI Pending': return 'bg-amber-500/10 text-amber-400 border border-amber-500/30 font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase';
      case 'PDI Failed': return 'bg-red-500/10 text-red-400 border border-red-500/30 font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase';
      case 'Ready to Dispatch': return 'bg-blue-500/10 text-blue-400 border border-blue-500/30 font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase';
      case 'Dispatched': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase';
      case 'Delivered': return 'bg-emerald-500 text-white font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase';
      default: return 'bg-slate-800 text-slate-400 font-bold text-[10px] px-2.5 py-0.5 rounded-full uppercase';
    }
  };

  // Checks if all items in dispatch are loaded
  const isFullyLoaded = selectedOrder && selectedOrder.items && selectedOrder.items.every(item => item.loaded_qty >= item.qty);

  return (
    <div className="bg-[#121212] text-slate-200 min-h-screen p-6 font-sans space-y-6">
      
      {/* ──────────────────────────────────────────────────────── */}
      {/* 1. VIEW STATE: DISPATCH ORDERS LIST PAGE */}
      {/* ──────────────────────────────────────────────────────── */}
      {activeView === 'list' && (
        <>
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2a2a2a] pb-4">
            <div>
              <h1 className="text-lg font-black text-white tracking-wide flex items-center gap-2">
                <Truck className="w-6 h-6 text-emerald-400" /> Dispatch Orders
              </h1>
              <p className="text-slate-400 text-xs font-medium mt-0.5">
                Manage finished goods dispatch to Hero, Honda and Yamaha
              </p>
            </div>

            <button
              onClick={() => {
                handleResetForm();
                setActiveView('create');
              }}
              className="flex items-center gap-1.5 bg-[#10b981] text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-[#059669] transition shadow-lg shadow-emerald-500/10"
            >
              <Plus className="w-4 h-4" /> New Dispatch Order
            </button>
          </div>

          {/* 4 Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#1e1e1e] p-4 rounded-xl border border-[#2a2a2a] shadow-md flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Total Dispatches</p>
                <p className="text-2xl font-black text-white mt-1">{stats.total_dispatches}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#121212] border border-[#2a2a2a] flex items-center justify-center text-lg text-slate-300">📋</div>
            </div>

            <div className="bg-[#1e1e1e] p-4 rounded-xl border border-[#2a2a2a] shadow-md flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Pending PDI</p>
                <p className="text-2xl font-black text-amber-400 mt-1">{stats.pending_pdi}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-lg text-amber-400">🔎</div>
            </div>

            <div className="bg-[#1e1e1e] p-4 rounded-xl border border-[#2a2a2a] shadow-md flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Ready to Dispatch</p>
                <p className="text-2xl font-black text-blue-400 mt-1">{stats.ready_to_dispatch}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-lg text-blue-400">🚚</div>
            </div>

            <div className="bg-[#1e1e1e] p-4 rounded-xl border border-[#2a2a2a] shadow-md flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Dispatched Today</p>
                <p className="text-2xl font-black text-emerald-400 mt-1">{stats.dispatched_today}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-lg text-emerald-400">✅</div>
            </div>
          </div>

          {/* Pending Alert Banner */}
          {stats.ready_to_dispatch > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-semibold text-amber-300">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-lg flex-shrink-0">🚚</div>
                <div>
                  <h4 className="text-sm font-bold text-orange-850">{stats.ready_to_dispatch} orders ready for dispatch — vehicles pending</h4>
                  <p className="text-orange-750 text-xs mt-0.5">PDI passed — load vehicle and close shipment.</p>
                </div>
              </div>
            </div>
          )}

          {/* Main Table */}
          <div className="bg-[#1e1e1e] rounded-xl border border-[#2a2a2a] shadow-lg overflow-hidden space-y-2 p-4">
            <div className="pb-3 border-b border-[#2a2a2a] flex items-center justify-between">
              <span className="text-white font-black text-xs uppercase tracking-wider">Active Dispatch Orders</span>
              <div className="relative">
                <Search className="absolute left-3 top-2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter dispatches..."
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
                    <th className="py-3.5 px-4">DO Number</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4 font-mono">Vehicle No</th>
                    <th className="py-3.5 px-4 text-right">Items Lines</th>
                    <th className="py-3.5 px-4 text-right text-emerald-400">Total Qty</th>
                    <th className="py-3.5 px-4">Dispatch Date</th>
                    <th className="py-3.5 px-4 text-center">PDI Status</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2a2a] text-xs">
                  {dispatchOrders
                    .filter(d => !filterText || d.do_number.toLowerCase().includes(filterText.toLowerCase()) || d.customer_name.toLowerCase().includes(filterText.toLowerCase()) || d.vehicle_number?.toLowerCase().includes(filterText.toLowerCase()))
                    .map(d => (
                      <tr
                        key={d.do_id}
                        onClick={() => viewOrderDetails(d.do_id)}
                        className="hover:bg-[#252525] border-b border-[#2a2a2a] cursor-pointer transition font-medium"
                      >
                        <td className="py-3.5 px-4 font-extrabold text-emerald-400">{d.do_number}</td>
                        <td className="py-3.5 px-4 font-extrabold text-white">{d.customer_name}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-300 font-bold">{d.vehicle_number || '—'}</td>
                        <td className="py-3.5 px-4 text-right text-slate-300">{d.item_lines} lines</td>
                        <td className="py-3.5 px-4 text-right font-black text-white">{parseFloat(d.total_pieces).toLocaleString()} Pcs</td>
                        <td className="py-3.5 px-4 text-slate-300 font-mono">{formatDate(d.dispatch_date)}</td>
                        <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            d.pdi_status === 'Passed' ? 'bg-green-50 text-green-700 border-green-200' :
                            d.pdi_status === 'Failed' ? 'bg-red-50 text-red-700 border-red-200' :
                            'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {d.pdi_status || 'Pending'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(d.status)}`}>
                            {d.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => viewOrderDetails(d.do_id)}
                              className="p-1 text-orange-500 hover:text-orange-700 hover:bg-slate-100 rounded transition"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {d.status === 'Draft' && (
                              <button
                                onClick={() => handleEditDraft(d)}
                                className="px-2.5 py-1 bg-orange-50 hover:bg-orange-500 text-orange-600 hover:text-white rounded text-[10px] font-bold border border-orange-100 transition"
                              >
                                Edit Draft
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  {dispatchOrders.length === 0 && (
                    <tr>
                      <td colSpan="9" className="py-8 text-center text-slate-400 font-semibold">
                        No dispatch orders created yet.
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
      {/* 2. VIEW STATE: NEW DISPATCH ORDER (3 STEPS) */}
      {/* ──────────────────────────────────────────────────────── */}
      {activeView === 'create' && (
        <div className="space-y-6 max-w-4xl mx-auto animate-fadeIn">
          {/* Back Action Bar */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setActiveView('list');
                handleResetForm();
              }}
              className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-xs font-bold transition"
            >
              <ArrowLeft className="w-4 h-4" /> Cancel & Exit
            </button>
            <div className="h-4 w-px bg-slate-300"></div>
            <span className="text-slate-500 text-xs font-bold">New Dispatch Order</span>
          </div>

          {/* Step Indicator Header */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            {[
              { step: 1, label: 'Customer & Vehicle' },
              { step: 2, label: 'Select Items' },
              { step: 3, label: 'Review & Submit' }
            ].map(s => (
              <div key={s.step} className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xxs font-black border ${
                  currentStep === s.step ? 'bg-orange-500 text-white border-orange-500' :
                  currentStep > s.step ? 'bg-green-500 text-white border-green-500' :
                  'bg-slate-100 text-slate-400 border-slate-200'
                }`}>
                  {currentStep > s.step ? '✓' : s.step}
                </span>
                <span className={`text-[10px] font-bold hidden md:inline ${currentStep === s.step ? 'text-slate-800' : 'text-slate-405'}`}>{s.label}</span>
                {s.step < 3 && <div className="h-0.5 w-16 bg-slate-150 hidden md:block"></div>}
              </div>
            ))}
          </div>

          {/* STEP 1: CUSTOMER & VEHICLE DETAILS */}
          {currentStep === 1 && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Step 1 — Customer and Vehicle Details</h3>
                <p className="text-slate-450 text-xxs mt-0.5">Select recipient manufacturer and logistics vehicle properties</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold text-slate-700">
                <div>
                  <label className="text-xxs text-slate-450 font-bold block mb-1">Customer *</label>
                  <select
                    value={customer_id}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                    required
                  >
                    <option value="">-- Choose Customer --</option>
                    {customers.map(c => (
                      <option key={c.customer_id} value={c.customer_id}>{c.customer_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xxs text-slate-455 font-bold block mb-1">Dispatch Date *</label>
                  <input
                    type="date"
                    value={dispatch_date}
                    onChange={(e) => setDispatchDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-xxs text-slate-455 font-bold block mb-1">Vehicle Number *</label>
                  <input
                    type="text"
                    placeholder="e.g. HR26AK9900"
                    value={vehicle_number}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-bold uppercase focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-xxs text-slate-455 font-bold block mb-1">Driver Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Rajesh Kumar"
                    value={driver_name}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-xxs text-slate-455 font-bold block mb-1">Transporter Agency *</label>
                  <input
                    type="text"
                    placeholder="e.g. Blue Dart Logistics"
                    value={transporter}
                    onChange={(e) => setTransporter(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-xxs text-slate-455 font-bold block mb-1">Customer PO Reference Number</label>
                  <input
                    type="text"
                    placeholder="e.g. HMSI-PO-2026-0089"
                    value={po_number}
                    onChange={(e) => setPoNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xxs text-slate-455 font-bold block mb-1">Delivery Address (Auto-filled)</label>
                  <textarea
                    rows="2"
                    value={delivery_address}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none bg-slate-50 text-slate-655 font-normal"
                    disabled
                  ></textarea>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  disabled={!customer_id || !vehicle_number || !driver_name || !transporter}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-6 py-2.5 rounded-lg transition disabled:bg-slate-100 disabled:text-slate-400"
                >
                  Continue to Select Items
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: SELECT ITEMS TO DISPATCH */}
          {currentStep === 2 && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Step 2 — Select Items to Dispatch</h3>
                <p className="text-slate-450 text-xxs mt-0.5">Enter dispatch quantities from available finished goods stock for this customer</p>
              </div>

              {/* Customer Stock Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-xxs font-bold uppercase bg-slate-50/50">
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3">WO Number</th>
                      <th className="py-2.5 px-3">FGR Reference</th>
                      <th className="py-2.5 px-3 text-right">Available stock</th>
                      <th className="py-2.5 px-3 text-right">Dispatch quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
                    {customerStock.map((stockItem) => {
                      const addedItem = itemsList.find(i => i.fgr_number === stockItem.fgr_number && i.item_id === stockItem.item_id);
                      const currentVal = addedItem ? addedItem.qty : '';

                      return (
                        <tr key={stockItem.fgr_number} className="hover:bg-slate-50/50">
                          <td className="py-3.5 px-3">
                            <span className="font-bold text-slate-800 block">{stockItem.item_name}</span>
                            <span className="text-[10px] text-slate-400 block font-mono">{stockItem.item_code}</span>
                          </td>
                          <td className="py-3.5 px-3 font-semibold text-slate-500">{stockItem.wo_number}</td>
                          <td className="py-3.5 px-3 font-mono text-slate-655 font-bold">{stockItem.fgr_number}</td>
                          <td className="py-3.5 px-3 text-right font-bold text-slate-655">{parseFloat(stockItem.available_stock).toLocaleString()} Pcs</td>
                          <td className="py-3.5 px-3 text-right">
                            <div className="flex justify-end items-center gap-2">
                              <input
                                type="number"
                                placeholder="0"
                                value={currentVal}
                                onChange={(e) => handleItemQtyChange(stockItem, e.target.value)}
                                className={`px-2.5 py-1 bg-white border rounded-lg text-xs font-black text-right w-24 focus:outline-none focus:ring-1 ${
                                  parseFloat(currentVal) > parseFloat(stockItem.available_stock)
                                    ? 'border-red-500 text-red-500 focus:ring-red-500'
                                    : 'border-slate-200 text-slate-800 focus:ring-orange-500'
                                }`}
                              />
                            </div>
                            {parseFloat(currentVal) > parseFloat(stockItem.available_stock) && (
                              <span className="text-[10px] text-red-500 block font-bold mt-0.5">Exceeds stock!</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {customerStock.length === 0 && (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-slate-400 bg-slate-50/50 font-bold italic">
                          No finished goods stock available in store for this customer.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Summary Stats */}
              <div className="p-4 border border-slate-150 rounded-xl bg-slate-50 flex items-center justify-between text-xs font-bold text-slate-600">
                <span>Total Items: {itemsList.length} products</span>
                <span className="text-orange-600 text-sm">
                  Total Qty: {itemsList.reduce((sum, i) => sum + parseFloat(i.qty || 0), 0).toLocaleString()} pieces
                </span>
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
                  onClick={() => {
                    // Check if any quantity exceeds stock
                    const exceeds = itemsList.some(i => parseFloat(i.qty) > parseFloat(i.available_stock));
                    if (exceeds) {
                      alert('Some dispatch quantities exceed available stock levels. Please correct.');
                      return;
                    }
                    setCurrentStep(3);
                  }}
                  disabled={itemsList.length === 0}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-6 py-2.5 rounded-lg transition disabled:bg-slate-150 disabled:text-slate-400"
                >
                  Continue to Review
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW AND SUBMIT */}
          {currentStep === 3 && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Step 3 — Review and Submit Loading Slip</h3>
                <p className="text-slate-450 text-xxs mt-0.5">Double check details before creating draft loading slip</p>
              </div>

              <div className="border border-slate-200 rounded-xl p-5 space-y-4 text-xs font-semibold text-slate-700 bg-slate-50/50">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-400 text-xxs block">Recipient Customer</span>
                    <span className="text-slate-800 font-extrabold block mt-0.5">
                      {customers.find(c => c.customer_id.toString() === customer_id)?.customer_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xxs block">Vehicle Number</span>
                    <span className="text-slate-800 font-bold block mt-0.5 uppercase">{vehicle_number}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xxs block">Driver Name</span>
                    <span className="text-slate-800 font-bold block mt-0.5">{driver_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xxs block">Transporter Agency</span>
                    <span className="text-slate-800 font-bold block mt-0.5">{transporter}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-150">
                  <span className="text-slate-400 text-xxs block mb-2">Items to Dispatch</span>
                  <div className="space-y-1.5">
                    {itemsList.map((item, i) => (
                      <div key={i} className="flex justify-between items-center text-xxs">
                        <span>{item.item_name} ({item.item_code}) — FGR Ref: <strong>{item.fgr_number}</strong></span>
                        <strong className="text-slate-800">{parseFloat(item.qty).toLocaleString()} Nos</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xxs text-slate-450 font-bold block mb-1">Remarks / Loading Instructions</label>
                <textarea
                  rows="2"
                  placeholder="Enter logistics notes, package quantities, or customer specific details..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none"
                ></textarea>
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
                  onClick={handleCreateDispatchOrder}
                  disabled={loading}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-8 py-2.5 rounded-lg transition shadow-md"
                >
                  {loading ? 'Submitting...' : 'Create Dispatch Order'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────── */}
      {/* 3. VIEW STATE: DISPATCH ORDER DETAIL PAGE */}
      {/* ──────────────────────────────────────────────────────── */}
      {activeView === 'detail' && selectedOrder && (
        <div className="space-y-6 max-w-4xl mx-auto animate-fadeIn">
          {/* Action Back Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setActiveView('list');
                  setSelectedOrder(null);
                  fetchDispatchOrders();
                  fetchStats();
                }}
                className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-xs font-bold transition"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Log
              </button>
              <div className="h-4 w-px bg-slate-300"></div>
              <span className="text-slate-800 font-bold text-xs">DO Ref: {selectedOrder.do_number}</span>
            </div>

            <span className={`px-3 py-1 rounded-full text-xxs font-black border uppercase ${getStatusColor(selectedOrder.status)}`}>
              {selectedOrder.status}
            </span>
          </div>

          {/* Status Timeline */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-around text-center text-xs font-bold text-slate-655">
            {[
              { id: 'Draft', label: 'Created' },
              { id: 'PDI Pending', label: 'PDI checks' },
              { id: 'Ready to Dispatch', label: 'Authorized' },
              { id: 'Dispatched', label: 'Dispatched' },
              { id: 'Delivered', label: 'Delivered' }
            ].map((step, idx) => {
              const orderStatus = selectedOrder.status;
              const isPast = (orderStatus === 'Delivered') ||
                             (orderStatus === 'Dispatched' && step.id !== 'Delivered') ||
                             (orderStatus === 'Ready to Dispatch' && !['Dispatched', 'Delivered'].includes(step.id)) ||
                             (orderStatus === 'PDI Pending' && ['Draft', 'PDI Pending'].includes(step.id)) ||
                             (orderStatus === 'Draft' && step.id === 'Draft') ||
                             (orderStatus === 'PDI Failed' && step.id === 'Draft');

              const isCurrent = orderStatus === step.id || (orderStatus === 'PDI Failed' && step.id === 'PDI Pending');

              return (
                <div key={step.id} className="flex items-center gap-1.5 flex-1 justify-center">
                  <div className="flex flex-col items-center">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xxs border font-black ${
                      isPast ? 'bg-green-500 text-white border-green-500' :
                      isCurrent ? 'bg-orange-500 text-white border-orange-500 animate-pulse' :
                      'bg-slate-50 text-slate-400 border-slate-200'
                    }`}>
                      {isPast ? '✓' : idx + 1}
                    </span>
                    <span className={`text-[10px] mt-1 block uppercase tracking-wider ${isCurrent ? 'text-orange-500' : isPast ? 'text-green-600' : 'text-slate-400'}`}>
                      {step.label}
                    </span>
                  </div>
                  {idx < 4 && <div className={`h-0.5 flex-1 max-w-[40px] hidden md:block ${isPast ? 'bg-green-500' : 'bg-slate-100'}`}></div>}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Left Column: Details & Checklist */}
            <div className="md:col-span-2 space-y-6">
              
              {/* Order Details card */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-extrabold text-slate-800 text-sm border-b border-slate-100 pb-2">Order Information</h3>
                
                <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-700">
                  <div>
                    <span className="text-slate-400 text-xxs block">Customer</span>
                    <span className="text-slate-800 font-extrabold block mt-0.5">{selectedOrder.customer_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xxs block">Vehicle Number</span>
                    <span className="text-slate-800 font-bold block mt-0.5 uppercase">{selectedOrder.vehicle_number || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xxs block">Driver Name</span>
                    <span className="text-slate-800 font-bold block mt-0.5">{selectedOrder.driver_name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xxs block">Transporter Agency</span>
                    <span className="text-slate-800 font-bold block mt-0.5">{selectedOrder.transporter || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xxs block">Dispatch Date</span>
                    <span className="text-slate-800 font-bold block mt-0.5">{formatDate(selectedOrder.dispatch_date)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xxs block">PO Reference Number</span>
                    <span className="text-slate-800 font-bold block mt-0.5">{selectedOrder.po_number || 'N/A'}</span>
                  </div>
                </div>

                {selectedOrder.remarks && (
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-xxs text-slate-655 italic">
                    Remarks: "{selectedOrder.remarks}"
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-extrabold text-slate-800 text-sm border-b border-slate-100 pb-2">Dispatch Items Payload</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 text-xxs font-bold uppercase bg-slate-50/50">
                        <th className="py-2 px-3">Part Code</th>
                        <th className="py-2 px-3">Product Name</th>
                        <th className="py-2 px-3 text-right">Order Qty</th>
                        <th className="py-2 px-3 text-right text-green-700">Loaded Qty</th>
                        <th className="py-2 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold text-xxs">
                      {selectedOrder.items.map((item, idx) => {
                        const isLoaded = item.loaded_qty >= item.qty;
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 font-semibold text-slate-500">{item.item_code}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-800">{item.item_name}</td>
                            <td className="py-2.5 px-3 text-right">{parseFloat(item.qty).toLocaleString()} Nos</td>
                            <td className="py-2.5 px-3 text-right font-black text-green-700">{parseFloat(item.loaded_qty || 0).toLocaleString()} Nos</td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                isLoaded ? 'bg-green-50 text-green-700 border border-green-200' :
                                item.loaded_qty > 0 ? 'bg-amber-50 text-amber-700 border border-amber-250 animate-pulse' :
                                'bg-slate-50 text-slate-400 border border-slate-150'
                              }`}>
                                {isLoaded ? 'Fully Loaded' : item.loaded_qty > 0 ? 'Partial' : 'Pending'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* PDI checklist input form (shown when PDI Pending) */}
              {showPdiForm && (
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 animate-fadeIn">
                  <h3 className="font-extrabold text-slate-800 text-sm border-b border-slate-100 pb-2">Pre-Dispatch Inspection Checklist</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold text-slate-700">
                    <div>
                      <label className="text-xxs text-slate-450 font-bold block mb-1">Inspector Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Ramesh QA Inspector"
                        value={pdiInspector}
                        onChange={(e) => setPdiInspector(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xxs text-slate-455 font-bold block mb-1">Sample Size checked (pcs)</label>
                      <input
                        type="number"
                        value={pdiSampleSize}
                        onChange={(e) => setPdiSampleSize(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto pt-2">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 text-xxs font-bold uppercase bg-slate-50/50">
                          <th className="py-2 px-3">Check Point</th>
                          <th className="py-2 px-3">Standard Requirement</th>
                          <th className="py-2 px-3 text-right">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xxs font-semibold">
                        {pdiCheckpoints.map((cp, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/30">
                            <td className="py-2.5 px-3 font-bold text-slate-700">{cp.label}</td>
                            <td className="py-2.5 px-3 text-slate-455">{cp.desc}</td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex justify-end gap-1.5">
                                {['Pass', 'Fail'].map(resOpt => (
                                  <button
                                    key={resOpt}
                                    type="button"
                                    onClick={() => handleCheckpointChange(idx, resOpt)}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                                      cp.result === resOpt
                                        ? resOpt === 'Pass'
                                          ? 'bg-green-500 border-green-500 text-white'
                                          : 'bg-red-500 border-red-500 text-white'
                                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                    }`}
                                  >
                                    {resOpt}
                                  </button>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="pt-2">
                    <label className="text-xxs text-slate-450 font-bold block mb-1">Check Remarks</label>
                    <textarea
                      rows="2"
                      placeholder="Add inspection notes..."
                      value={pdiRemarks}
                      onChange={(e) => setPdiRemarks(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none"
                    ></textarea>
                  </div>

                  <div className="p-4 rounded-xl border flex items-center justify-between text-xs font-bold bg-slate-550/10">
                    <span>Overall PDI recommendation:</span>
                    <span className={pdiOverallResult === 'Passed' ? 'text-green-600' : 'text-red-500'}>
                      {pdiOverallResult === 'Passed' ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setShowPdiForm(false)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={submitPdiResults}
                      disabled={loading}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-lg text-xs font-bold transition"
                    >
                      {loading ? 'Submitting...' : 'Complete PDI Check'}
                    </button>
                  </div>
                </div>
              )}

              {/* Scan & Load Box Scanning Section */}
              {showScanLoadSection && selectedOrder.status === 'Ready to Dispatch' && (
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 animate-fadeIn">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <h3 className="font-extrabold text-slate-800 text-sm">Scan Box Barcode to Load</h3>
                    <span className="text-[10px] bg-blue-50 border border-blue-150 text-blue-600 px-2 py-0.5 rounded font-black">
                      LOADING IN PROGRESS
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Scan or type Box Sticker label (e.g. FQC/2026/00001)..."
                        value={scanInput}
                        onChange={(e) => setScanInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (handleScanLoadItem(scanInput), setScanInput(''))}
                        className="pl-9 pr-3 py-2.5 w-full bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={startLoadingScanner}
                      className="bg-orange-500 hover:bg-orange-600 text-white p-2.5 rounded-lg transition"
                      title="Open Camera"
                    >
                      <Camera className="w-4.5 h-4.5" />
                    </button>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xxs text-slate-500 leading-relaxed font-semibold">
                    💡 Scan each approved finished box label. The system will match it against the order items, verify the quantities, and update loading progress dynamically.
                  </div>
                </div>
              )}

            </div>

            {/* Right Column: PDF print, GP reference and Actions */}
            <div className="space-y-6">
              
              {/* Actions Card */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-extrabold text-slate-800 text-sm border-b border-slate-100 pb-2">Shipment Actions</h3>
                
                <div className="flex flex-col gap-2 pt-1 text-xs font-bold text-center">
                  
                  {/* Status: Draft -> Start PDI button */}
                  {selectedOrder.status === 'Draft' && (
                    <button
                      onClick={async () => {
                        setLoading(true);
                        try {
                          await axios.put(`${API}/dispatch/${selectedOrder.do_id}/pdi`, { result: 'Pending', inspector_name: 'System Log' }, getAuthHeader());
                          alert('Inspection pending task created.');
                          viewOrderDetails(selectedOrder.do_id);
                        } catch (err) {
                          alert('Failed to start PDI');
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Play className="w-4.5 h-4.5" /> Start PDI checks
                    </button>
                  )}

                  {/* Status: PDI Pending -> Complete PDI button */}
                  {(selectedOrder.status === 'PDI Pending' || selectedOrder.status === 'PDI Failed') && !showPdiForm && (
                    <button
                      onClick={() => {
                        setPdiInspector('');
                        setPdiRemarks('');
                        setShowPdiForm(true);
                      }}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <ClipboardCheck className="w-4.5 h-4.5" /> Complete PDI Form
                    </button>
                  )}

                  {/* Status: Ready to Dispatch -> Scan & Load, and Close shipment buttons */}
                  {selectedOrder.status === 'Ready to Dispatch' && (
                    <>
                      {!showScanLoadSection && (
                        <button
                          onClick={() => setShowScanLoadSection(true)}
                          className="w-full bg-slate-700 hover:bg-slate-850 text-white py-3 rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <Camera className="w-4.5 h-4.5" /> Scan & Load Vehicle
                        </button>
                      )}

                      <button
                        onClick={handleCloseShipment}
                        disabled={!isFullyLoaded || loading}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm disabled:bg-slate-150 disabled:text-slate-400"
                      >
                        <Check className="w-4.5 h-4.5" /> Close Shipment (Gate Out)
                      </button>
                    </>
                  )}

                  {/* Status: Dispatched -> Mark Delivered */}
                  {selectedOrder.status === 'Dispatched' && (
                    <button
                      onClick={handleMarkDelivered}
                      disabled={loading}
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <CheckCircle className="w-4.5 h-4.5" /> Mark Delivered
                    </button>
                  )}

                  {/* Print Delivery Challan */}
                  {(selectedOrder.status === 'Ready to Dispatch' || selectedOrder.status === 'Dispatched' || selectedOrder.status === 'Delivered') && (
                    <button
                      onClick={() => generateChallanPDF(selectedOrder)}
                      className="w-full bg-orange-50 hover:bg-orange-500 text-orange-600 hover:text-white border border-orange-100 transition py-2.5 rounded-lg flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Printer className="w-4 h-4" /> Print Delivery Challan PDF
                    </button>
                  )}

                </div>
              </div>

              {/* Linked Outward Gate Pass Detail card */}
              {selectedOrder.outward_gp_number && (
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="font-extrabold text-slate-800 text-sm border-b border-slate-100 pb-2">Outward Gate Pass</h3>
                  
                  <div className="border border-orange-150 p-4 rounded-xl bg-slate-50/50 text-xs font-semibold text-slate-700 space-y-2">
                    <div>Outward GP Ref: <strong>{selectedOrder.outward_gp_number}</strong></div>
                    <div>Vehicle: <strong className="uppercase">{selectedOrder.vehicle_number}</strong></div>
                    <div>Status: <strong className="text-green-600">{selectedOrder.gate_pass_status || 'Open'}</strong></div>
                    
                    <div className="flex justify-center pt-2">
                      <QRCode
                        id="do-challan-qr"
                        value={JSON.stringify({
                          type: 'GP_OUTWARD',
                          gp_number: selectedOrder.outward_gp_number,
                          do_number: selectedOrder.do_number,
                          vehicle: selectedOrder.vehicle_number,
                          qty: selectedOrder.items.reduce((sum, item) => sum + parseFloat(item.qty), 0)
                        })}
                        size={100}
                        level="M"
                        includeMargin={true}
                      />
                    </div>
                  </div>
                </div>
              )}

            </div>

          </div>
        </div>
      )}

      {/* Camera scanner reader modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xxs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-xl max-w-sm w-full border border-slate-200 shadow-2xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-800 text-sm">Scan Sticker Barcode</span>
              <button onClick={stopLoadingScanner} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <div id="loading-qr-reader" className="w-full h-64 bg-slate-100 rounded-lg overflow-hidden border border-slate-250"></div>
            <p className="text-slate-405 text-xxs text-center">Centering box sticker barcode / QR code automatically triggers validation.</p>
          </div>
        </div>
      )}

      {/* Hidden QR Code Canvas for PDF Challan slip generation */}
      {selectedOrder && (
        <div style={{ display: 'none' }}>
          <QRCode
            id="do-challan-qr"
            value={JSON.stringify({
              type: 'GP_OUTWARD',
              gp_number: selectedOrder.outward_gp_number || 'GP/PENDING/00000',
              do_number: selectedOrder.do_number,
              vehicle: selectedOrder.vehicle_number,
              qty: selectedOrder.items.reduce((sum, item) => sum + parseFloat(item.qty), 0)
            })}
            size={128}
          />
        </div>
      )}

    </div>
  );
}
