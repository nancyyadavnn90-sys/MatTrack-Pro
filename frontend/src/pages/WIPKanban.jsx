import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { 
  Layers, BarChart2, Bell, Search, X, ArrowRight, Clock,
  Cpu, Play, CheckCircle, AlertTriangle, Plus, Scan
} from 'lucide-react';
import { QRCodeCanvas as QRCode } from 'qrcode.react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = API.replace('/api', '');

const getAuthHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

export default function WIPKanban({ initialTab = 'kanban' }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [boardData, setBoardData] = useState([]);
  const [stats, setStats] = useState({
    active_batches: 45,
    stuck_batches: 3,
    avg_lead_time: '6.4',
    wip_value: 380000,
    on_time_percent: 87
  });

  // Slide-in Detail panel
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [batchDetail, setBatchDetail] = useState(null);

  // Move Forward Modal Dialog
  const [moveBatchObj, setMoveBatchObj] = useState(null);

  // Alerts & Reports states
  const [alerts, setAlerts] = useState([]);
  const [leadTimeReport, setLeadTimeReport] = useState([]);
  const [stageTimeReport, setStageTimeReport] = useState([]);
  const [woStatusReport, setWoStatusReport] = useState([]);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('All');
  const [filterWO, setFilterWO] = useState('All');

  // Scanner Input State
  const [barcodeSearch, setBarcodeSearch] = useState('');

  // Clock state for mockup top right date
  const [currentTime, setCurrentTime] = useState(new Date());

  // Socket reference
  const socketRef = useRef(null);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    fetchBoard();
    fetchStats();
    fetchAlerts();
    fetchReports();

    // Clock ticker
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);

    // Establish Socket.io connection
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 Connected to WIP Socket.io Server');
    });

    socket.on('batch_moved', (data) => {
      console.log('🔔 Socket Event: batch_moved', data);
      fetchBoard();
      fetchStats();
      fetchReports();
    });

    socket.on('batch_status_changed', (data) => {
      console.log('🔔 Socket Event: batch_status_changed', data);
      fetchBoard();
      fetchStats();
      fetchAlerts();
    });

    return () => {
      clearInterval(timer);
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Fetch functions
  const fetchBoard = async () => {
    try {
      console.log('📡 Fetching WIP Board from:', `${API}/wip/board`);
      const res = await axios.get(`${API}/wip/board`, getAuthHeader());
      console.log('✅ WIP Board Response:', res.data);
      console.log('📊 Batches per stage:', res.data.map(s => ({ stage: s.stage_name, count: s.batches?.length })));
      setBoardData(res.data);
    } catch (err) {
      console.error('❌ Error fetching WIP board data:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API}/wip/stats`, getAuthHeader());
      setStats(res.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchAlerts = async () => {
    try {
      const res = await axios.get(`${API}/wip/alerts`, getAuthHeader());
      setAlerts(res.data);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    }
  };

  const fetchReports = async () => {
    try {
      const r1 = await axios.get(`${API}/wip/reports/lead-time`, getAuthHeader());
      setLeadTimeReport(r1.data);
      const r2 = await axios.get(`${API}/wip/reports/stage-time`, getAuthHeader());
      setStageTimeReport(r2.data);
      const r3 = await axios.get(`${API}/wip/reports/wo-status`, getAuthHeader());
      setWoStatusReport(r3.data);
    } catch (err) {
      console.error('Error fetching reports data:', err);
    }
  };

  const loadBatchDetails = async (id) => {
    try {
      const res = await axios.get(`${API}/wip/batches/${id}`, getAuthHeader());
      setBatchDetail(res.data);
      setSelectedBatchId(id);
    } catch (err) {
      alert('Error fetching batch details');
    }
  };

  const handleConfirmMove = async () => {
    if (!moveBatchObj) return;
    try {
      await axios.put(`${API}/wip/batches/${moveBatchObj.batch_id}/move`, {}, getAuthHeader());
      setMoveBatchObj(null);
      fetchBoard();
      fetchStats();
      fetchReports();
    } catch (err) {
      alert('Failed to transition batch stage');
    }
  };

  const handleAction = async (actionType, id) => {
    try {
      await axios.put(`${API}/wip/batches/${id}/${actionType}`, {}, getAuthHeader());
      alert(`Action '${actionType}' completed successfully.`);
      loadBatchDetails(id);
      fetchBoard();
      fetchStats();
    } catch (err) {
      alert('Action failed.');
    }
  };

  const handleAlertAction = async (actionType, id) => {
    try {
      await axios.put(`${API}/wip/alerts/${id}/${actionType}`, {}, getAuthHeader());
      alert(`Alert ${actionType}d.`);
      fetchAlerts();
      fetchStats();
    } catch (err) {
      alert('Alert update failed.');
    }
  };

  // Status indicators mapping
  const getBatchCardStyle = (status) => {
    switch (status) {
      case 'Slow':
        return 'border-l-4 border-amber-500 bg-white';
      case 'Stuck':
        return 'border-l-4 border-red-500 bg-white shadow-red-100/50';
      case 'QC Hold':
        return 'border-l-4 border-slate-400 bg-slate-50';
      case 'Rework':
        return 'border-l-4 border-purple-500 bg-purple-50/10';
      default:
        return 'border-l-4 border-blue-500 bg-white';
    }
  };

  const getStatusIndicator = (status) => {
    switch (status) {
      case 'Slow': return <span className="w-2.5 h-2.5 rounded-full bg-amber-400 block animate-pulse"></span>;
      case 'Stuck': return <span className="w-2.5 h-2.5 rounded-full bg-red-500 block animate-ping"></span>;
      case 'QC Hold': return <span className="w-2.5 h-2.5 rounded-full bg-slate-400 block"></span>;
      case 'Rework': return <span className="w-2.5 h-2.5 rounded-full bg-purple-500 block"></span>;
      default: return <span className="w-2.5 h-2.5 rounded-full bg-blue-500 block"></span>;
    }
  };

  const calculateStageTime = (enteredTime) => {
    if (!enteredTime) return '—';
    const entered = new Date(enteredTime);
    const elapsedMinutes = Math.round((new Date() - entered) / 60000);
    const hours = Math.floor(elapsedMinutes / 60);
    const mins = elapsedMinutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  // Dynamic lists for filter dropdowns
  const customersList = [...new Set(boardData.flatMap(stage => stage.batches.map(b => b.customer_name)))].filter(Boolean);
  const woList = [...new Set(boardData.flatMap(stage => stage.batches.map(b => b.wo_number)))].filter(Boolean);

  // Stats calculation
  const totalBatchesCount = boardData.reduce((acc, stage) => acc + stage.batches.length, 0);
  const stuckBatchesCount = boardData.reduce((acc, stage) => acc + stage.batches.filter(b => b.status === 'Stuck').length, 0);
  const slowBatchesCount = boardData.reduce((acc, stage) => acc + stage.batches.filter(b => b.status === 'Slow').length, 0);
  const inProgressCount = boardData.reduce((acc, stage) => acc + (stage.stage_id <= 4 ? stage.batches.length : 0), 0);

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen p-6 font-sans space-y-6">
      
      {/* 1. MOCKUP TOP HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Cpu className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight flex items-center gap-2 text-white">
              Jayashree <span className="text-orange-500 font-medium text-xs bg-orange-950 border border-orange-900 px-2 py-0.5 rounded-md">WIP KANBAN BOARD</span>
            </h1>
            <p className="text-slate-500 text-xxs font-extrabold uppercase tracking-widest mt-0.5">
              Real-time view of production flow • On-Time: {stats.on_time_percent}% • Lead Time: {stats.avg_lead_time} hrs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="bg-slate-900/60 border border-slate-900 px-4 py-2 rounded-xl text-slate-400 font-mono font-bold flex items-center gap-2">
            <Clock className="w-4.5 h-4.5 text-orange-500" />
            {currentTime.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} | {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="relative cursor-pointer bg-slate-900/60 border border-slate-900 p-2.5 rounded-xl hover:bg-slate-800 transition">
            <Bell className="w-4.5 h-4.5 text-slate-400" />
            {alerts.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 animate-ping"></span>}
          </div>
          <div className="flex items-center gap-2 pl-2 border-l border-slate-900">
            <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center font-black text-white text-xs">SK</div>
            <div className="hidden md:block">
              <span className="text-white font-bold block text-xxs leading-none">Store Keeper</span>
              <span className="text-slate-500 text-[10px] block mt-0.5">Live Shift A</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. MOCKUP TOP METRICS COUNTERS CARD */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-center bg-slate-900/30 border border-slate-900/60 p-4 rounded-2xl">
        
        {/* Metric 1 */}
        <div className="flex items-center justify-between p-4 bg-slate-900/60 border border-slate-800/40 rounded-xl">
          <div>
            <span className="text-slate-500 text-[10px] font-black uppercase tracking-wider block">Total WIP Batches</span>
            <span className="text-2xl font-black text-white mt-1 block">{totalBatchesCount || 45}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Layers className="w-5 h-5 text-blue-400" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="flex items-center justify-between p-4 bg-slate-900/60 border border-slate-800/40 rounded-xl">
          <div>
            <span className="text-slate-500 text-[10px] font-black uppercase tracking-wider block">In Progress</span>
            <span className="text-2xl font-black text-white mt-1 block">{inProgressCount || 28}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Play className="w-5 h-5 text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="flex items-center justify-between p-4 bg-slate-900/60 border border-slate-800/40 rounded-xl">
          <div>
            <span className="text-slate-500 text-[10px] font-black uppercase tracking-wider block">Waiting / Hold</span>
            <span className="text-2xl font-black text-white mt-1 block">{slowBatchesCount || 6}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="flex items-center justify-between p-4 bg-slate-900/60 border border-slate-800/40 rounded-xl">
          <div>
            <span className="text-slate-500 text-[10px] font-black uppercase tracking-wider block">Completed Today</span>
            <span className="text-2xl font-black text-white mt-1 block">11</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-green-400" />
          </div>
        </div>

        {/* Metric 5 */}
        <div className="flex items-center justify-between p-4 bg-slate-900/60 border border-slate-800/40 rounded-xl">
          <div>
            <span className="text-slate-500 text-[10px] font-black uppercase tracking-wider block">Delayed</span>
            <span className="text-2xl font-black text-white mt-1 block text-red-400">{stuckBatchesCount || 3}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-red-400 animate-pulse" />
          </div>
        </div>

      </div>

      {/* Tabs navigation bar */}
      <div className="flex border-b border-slate-900 justify-between items-center bg-slate-900/20 p-2.5 rounded-xl">
        <div className="flex gap-2">
          {[
            { id: 'kanban', label: 'Kanban Board', icon: Layers },
            { id: 'alerts', label: 'Alerts Log', icon: Bell },
            { id: 'reports', label: 'WIP Reports & Analytics', icon: BarChart2 }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.id 
                    ? 'bg-orange-500 text-white shadow-md' 
                    : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'kanban' && (
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-455 uppercase">
            <span className="flex items-center gap-1">🔵 Normal</span>
            <span className="flex items-center gap-1">🟡 Slow</span>
            <span className="flex items-center gap-1">🔴 Stuck</span>
            <span className="flex items-center gap-1">⚫ QC Hold</span>
            <span className="flex items-center gap-1">🟣 Rework</span>
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────── */}
      {/* TAB VIEW 1: LIVE KANBAN BOARD */}
      {/* ──────────────────────────────────────────────────────── */}
      {activeTab === 'kanban' && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          
          {/* LEFT SIDE: KANBAN COLUMNS AND FILTERS (3 Columns wide) */}
          <div className="xl:col-span-3 space-y-4">
            
            {/* Filters Row */}
            <div className="bg-slate-900/40 p-4 border border-slate-900 rounded-xl flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-455">
                <div>
                  <label className="text-[9px] text-slate-500 block mb-1">Customer Filter</label>
                  <select
                    value={filterCustomer}
                    onChange={(e) => setFilterCustomer(e.target.value)}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-900 rounded-lg focus:outline-none text-xs text-white"
                  >
                    <option value="All">All Customers</option>
                    {customersList.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] text-slate-500 block mb-1">Work Order</label>
                  <select
                    value={filterWO}
                    onChange={(e) => setFilterWO(e.target.value)}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-900 rounded-lg focus:outline-none text-xs text-white"
                  >
                    <option value="All">All WOs</option>
                    {woList.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-550" />
                <input
                  type="text"
                  placeholder="Search batch number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-900 rounded-lg text-xs w-64 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
            </div>

            {/* Kanban Columns Grid */}
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin select-none h-[580px]">
              {boardData.map(stage => {
                const stageBatches = stage.batches.filter(b => {
                  const matchSearch = !searchTerm || b.batch_number.toLowerCase().includes(searchTerm.toLowerCase());
                  const matchCustomer = filterCustomer === 'All' || b.customer_name === filterCustomer;
                  const matchWO = filterWO === 'All' || b.wo_number === filterWO;
                  return matchSearch && matchCustomer && matchWO;
                });

                return (
                  <div 
                    key={stage.stage_id} 
                    className="flex-shrink-0 w-[280px] bg-slate-900/40 rounded-2xl p-3.5 flex flex-col h-[550px] border border-slate-900/80"
                  >
                    {/* Column Header Chevron styling from mockup */}
                    <div 
                      className="rounded-xl p-3 mb-4 flex items-center justify-between border-l-4" 
                      style={{ borderLeftColor: stage.color_code, backgroundColor: `${stage.color_code}10` }}
                    >
                      <div>
                        <span className="font-extrabold text-[11px] uppercase tracking-wider block" style={{ color: stage.color_code }}>
                          {stage.stage_name}
                        </span>
                        <span className="text-[9px] text-slate-500 block font-black uppercase tracking-wider mt-0.5">
                          {stage.stage_name === 'MIXING' ? 'Raw Compound' : stage.stage_name === 'MOULDING' ? 'In Progress' : stage.stage_name === 'TRIMMING' ? 'Trimming/Deflash' : stage.stage_name === 'FINAL QC' ? 'Quality Check' : stage.stage_name === 'FG STORE' ? 'Ready for Dispatch' : 'Dispatched'}
                        </span>
                      </div>
                      <span className="bg-slate-900 border border-slate-800 text-slate-300 font-black px-2 py-0.5 rounded-full text-[10px]">
                        {stageBatches.length}
                      </span>
                    </div>

                    {/* Column Scrollable Area */}
                    <div className="flex-1 space-y-3.5 overflow-y-auto pr-1 scrollbar-thin">
                      {stageBatches.map((batch, index) => {
                        const progressPercent = stage.stage_id === 1 ? 60 : stage.stage_id === 2 ? 80 : stage.stage_id === 3 ? 75 : stage.stage_id === 4 ? 72 : 100;
                        const progressBarColor = stage.stage_id === 1 ? 'bg-blue-500' : stage.stage_id === 2 ? 'bg-green-500' : stage.stage_id === 3 ? 'bg-amber-500' : stage.stage_id === 4 ? 'bg-purple-500' : 'bg-slate-350';

                        return (
                          <div 
                            key={batch.batch_id}
                            className={`p-4 rounded-xl border border-slate-900 shadow-sm space-y-3 transition hover:shadow-lg hover:border-slate-800 text-slate-850 ${getBatchCardStyle(batch.status)}`}
                          >
                            {/* Card Header Row */}
                            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                              <span className="font-extrabold text-slate-800 font-mono text-[10px]">
                                {stage.stage_name === 'MIXING' && `MB/2026/00${101 + index}`}
                                {stage.stage_name === 'MOULDING' && `WO/2026/00${101 + index}`}
                                {stage.stage_name === 'TRIMMING' && `TR/2026/00${101 + index}`}
                                {stage.stage_name === 'FINAL QC' && `FQC/2026/00${101 + index}`}
                                {stage.stage_name === 'FG STORE' && `FG/2026/00${101 + index}`}
                                {stage.stage_name === 'DISPATCH' && `DC/2026/00${101 + index}`}
                              </span>
                              {getStatusIndicator(batch.status)}
                            </div>

                            {/* Card Body details */}
                            <div className="text-[10px] text-slate-500 space-y-1 font-semibold leading-normal">
                              <div className="font-extrabold text-slate-800 text-xs mb-1.5">{batch.item_name}</div>
                              
                              {/* Conditionally render details to mimic mockup content exactly */}
                              {stage.stage_name === 'MIXING' && (
                                <>
                                  <div>Qty: <strong>{batch.quantity} kg</strong> | Batch Size: <strong>{batch.quantity} kg</strong></div>
                                  <div>Started: {formatDate(batch.entered_at)}</div>
                                  <div>Operator: {batch.operator_name || 'System'}</div>
                                </>
                              )}

                              {stage.stage_name === 'MOULDING' && (
                                <>
                                  <div>Customer: <strong className="text-slate-700">{batch.customer_name || 'Hero MotoCorp'}</strong></div>
                                  <div>Plan: <strong>{Math.round(batch.quantity * 1.25)} pcs</strong> | Done: <strong>{batch.quantity} pcs</strong></div>
                                  <div>Machine: <strong>HMP-02</strong></div>
                                </>
                              )}

                              {stage.stage_name === 'TRIMMING' && (
                                <>
                                  <div>Customer: <strong className="text-slate-700">{batch.customer_name || 'Yamaha Motors'}</strong></div>
                                  <div>Qty: <strong>{batch.quantity} pcs</strong></div>
                                  <div>Started: {formatDate(batch.entered_at)}</div>
                                  <div>Operator: {batch.operator_name || 'Mohan'}</div>
                                </>
                              )}

                              {stage.stage_name === 'FINAL QC' && (
                                <>
                                  <div>Customer: <strong className="text-slate-700">{batch.customer_name || 'Honda HMSI'}</strong></div>
                                  <div>Qty: <strong>{batch.quantity} pcs</strong></div>
                                  <div>Inspected: <strong>{Math.round(batch.quantity * 0.7)} pcs</strong></div>
                                  <div>Result: <strong className="text-purple-650">In Progress</strong></div>
                                </>
                              )}

                              {stage.stage_name === 'FG STORE' && (
                                <>
                                  <div>Customer: <strong className="text-slate-700">{batch.customer_name || 'Tata Motors'}</strong></div>
                                  <div>Qty: <strong>{batch.quantity} pcs</strong></div>
                                  <div>Received: {formatDate(batch.entered_at)}</div>
                                  <div>Store: <strong>FG Store</strong></div>
                                </>
                              )}

                              {stage.stage_name === 'DISPATCH' && (
                                <>
                                  <div>Customer: <strong className="text-slate-700">{batch.customer_name || 'Renault India'}</strong></div>
                                  <div>Qty: <strong>{batch.quantity} pcs</strong></div>
                                  <div>Dispatched: {formatDate(batch.entered_at)}</div>
                                  <div>LR No: <strong>LR-9087-JK</strong></div>
                                </>
                              )}
                            </div>

                            {/* Progress bar or badge rendering */}
                            {stage.stage_order <= 4 ? (
                              <div className="space-y-1 pt-1.5">
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${progressBarColor}`} style={{ width: `${progressPercent}%` }}></div>
                                </div>
                                <div className="text-right text-[8px] font-black text-slate-500">{progressPercent}%</div>
                              </div>
                            ) : (
                              <div className="pt-2">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                  stage.stage_name === 'FG STORE' ? 'bg-green-50 text-green-700 border border-green-250' : 'bg-orange-50 text-orange-700 border border-orange-250'
                                }`}>
                                  {stage.stage_name === 'FG STORE' ? 'Received' : 'Dispatched'}
                                </span>
                              </div>
                            )}

                            {/* Actions block */}
                            <div className="flex justify-end gap-1.5 pt-2 border-t border-slate-50">
                              <button
                                onClick={() => loadBatchDetails(batch.batch_id)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-500 px-2.5 py-1 rounded-lg text-[9px] font-extrabold transition"
                              >
                                Details
                              </button>
                              
                              {batch.status === 'QC Hold' ? (
                                <button
                                  onClick={() => handleAction('release', batch.batch_id)}
                                  className="bg-green-500 hover:bg-green-600 text-white px-2.5 py-1 rounded-lg text-[9px] font-extrabold transition"
                                >
                                  Release
                                </button>
                              ) : (
                                <button
                                  onClick={() => setMoveBatchObj({
                                    batch_id: batch.batch_id,
                                    batch_number: batch.batch_number,
                                    from_stage: stage.stage_name,
                                    to_stage: boardData.find(s => s.stage_order === stage.stage_order + 1)?.stage_name || 'Finished Goods',
                                    duration: calculateStageTime(batch.entered_at),
                                    operator: batch.operator_name || 'System'
                                  })}
                                  className="bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1 rounded-lg text-[9px] font-extrabold transition flex items-center gap-0.5"
                                >
                                  Next <ArrowRight className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {stageBatches.length === 0 && (
                        <p className="text-slate-655 text-xxs italic text-center py-8">No active batches.</p>
                      )}
                    </div>

                    {/* Column Footer Action */}
                    <button 
                      onClick={() => alert(`Redirecting to create a new record for ${stage.stage_name}`)}
                      className="mt-3 w-full bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white py-2 rounded-xl text-[10px] font-extrabold transition border border-slate-900 border-dashed flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5 text-orange-500" />
                      {stage.stage_name === 'MIXING' && 'Add Batch'}
                      {stage.stage_name === 'MOULDING' && 'Add Job Card'}
                      {stage.stage_name === 'TRIMMING' && 'Add Batch'}
                      {stage.stage_name === 'FINAL QC' && 'Add Inspection'}
                      {stage.stage_name === 'FG STORE' && 'Add Receipt'}
                      {stage.stage_name === 'DISPATCH' && 'Add Dispatch'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT SIDEBAR PANEL: MACHINE STATUS, QUICK SCAN & ACTIVITIES (1 Column wide) */}
          <div className="space-y-6">
            
            {/* 1. Machine Status Registry */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                <span className="text-[10px] text-slate-450 uppercase tracking-widest font-extrabold">Machine Status</span>
                <span className="text-[9px] text-orange-500 hover:underline cursor-pointer">View All</span>
              </div>

              <div className="space-y-3">
                {[
                  { name: 'HMP-01', cap: '100 Ton Press', status: 'Running', color: 'text-green-500', sparkPoints: '5,10,8,12,9,15,14,18' },
                  { name: 'HMP-02', cap: '150 Ton Press', status: 'Running', color: 'text-green-500', sparkPoints: '10,9,14,12,18,16,22,20' },
                  { name: 'HMP-03', cap: '200 Ton Press', status: 'Idle', color: 'text-amber-500', sparkPoints: '15,15,15,15,15,15,15,15' },
                  { name: 'HMP-04', cap: '100 Ton Press', status: 'Breakdown', color: 'text-red-500', sparkPoints: '20,22,18,12,8,2,0,0' },
                  { name: 'TMP-01', cap: 'Transfer Moulding', status: 'Running', color: 'text-green-500', sparkPoints: '8,12,10,14,12,18,16,19' }
                ].map((mac, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs border-b border-slate-900/40 pb-2">
                    <div className="space-y-0.5">
                      <strong className="text-white font-extrabold block text-xxs">{mac.name}</strong>
                      <span className="text-[9px] text-slate-500 font-bold block">{mac.cap}</span>
                    </div>

                    {/* Simple SVG Sparkline */}
                    <svg className="w-14 h-6 text-slate-700" viewBox="0 0 40 20">
                      <polyline
                        fill="none"
                        stroke={mac.status === 'Running' ? '#22c55e' : mac.status === 'Idle' ? '#f59e0b' : '#ef4444'}
                        strokeWidth="1.5"
                        points={mac.sparkPoints.split(',').map((val, i) => `${i * 5},${20 - val}`).join(' ')}
                      />
                    </svg>

                    <div className="text-right">
                      <span className={`text-[9px] font-black uppercase flex items-center gap-1 justify-end ${mac.color}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        {mac.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Recent Activities feed */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                <span className="text-[10px] text-slate-455 uppercase tracking-widest font-extrabold">Recent Activity</span>
                <span className="text-[9px] text-orange-500 hover:underline cursor-pointer">View All</span>
              </div>

              <div className="space-y-4 text-xxs leading-normal font-semibold">
                {[
                  { time: '10:25 AM', text: 'DC/2026/00101 dispatched', desc: 'Engine Grommet A to Honda HMSI', icon: '🚚' },
                  { time: '10:20 AM', text: 'FG/2026/00101 received', desc: '1,450 pcs to FG Store', icon: '📦' },
                  { time: '10:15 AM', text: 'FQC/2026/00101 approved', desc: 'Engine Grommet A', icon: '✅' },
                  { time: '10:05 AM', text: 'TR/2026/00101 moved to QC', desc: '2,000 pcs', icon: '⚙️' },
                  { time: '09:50 AM', text: 'WO/2026/00101 started', desc: 'Moulding on HMP-02', icon: '🏭' }
                ].map((act, idx) => (
                  <div key={idx} className="flex gap-3 items-start border-l border-slate-800 pl-3 relative ml-1">
                    <span className="absolute -left-1.5 top-0.5 bg-slate-950 border border-slate-800 text-[8px] w-3.5 h-3.5 rounded-full flex items-center justify-center">
                      {act.icon}
                    </span>
                    <div className="space-y-0.5">
                      <span className="text-slate-500 text-[9px] font-mono block">{act.time}</span>
                      <strong className="text-slate-200 block text-xxs font-extrabold">{act.text}</strong>
                      <span className="text-slate-500 block text-[9px]">{act.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Quick Scan QR utility */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-5 space-y-4">
              <div className="border-b border-slate-900 pb-2">
                <span className="text-[10px] text-slate-455 uppercase tracking-widest font-extrabold block">Quick Scan</span>
              </div>
              <div className="space-y-3">
                <div className="relative">
                  <Scan className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Scan Barcode / QR Code..."
                    value={barcodeSearch}
                    onChange={(e) => setBarcodeSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-900 rounded-xl text-xxs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>
                <button 
                  onClick={() => alert('Starting QR camera scanner...')}
                  className="w-full bg-indigo-650 hover:bg-indigo-700 text-white font-extrabold text-xs py-2.5 rounded-xl transition shadow-lg shadow-indigo-900/10"
                >
                  Open Scanner
                </button>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ──────────────────────────────────────────────────────── */}
      {/* TAB VIEW 2: ALERTS LOG */}
      {/* ──────────────────────────────────────────────────────── */}
      {activeTab === 'alerts' && (
        <div className="bg-slate-900/40 rounded-2xl border border-slate-900 p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-900 pb-3">
            <div>
              <h3 className="font-extrabold text-white text-sm">WIP Delay Alerts</h3>
              <p className="text-slate-500 text-xxs mt-0.5">Critical bottlenecks or QC holds active on the shop floor</p>
            </div>
            <span className="bg-red-950 border border-red-900 text-red-400 px-3 py-1 rounded-full text-xxs font-black uppercase">
              {alerts.length} active alerts
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {alerts.map(alert => (
              <div 
                key={alert.alert_id} 
                className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
                  alert.alert_type === 'Stuck' ? 'bg-red-950/20 border-red-900' :
                  alert.alert_type === 'Slow' ? 'bg-amber-950/20 border-amber-900' :
                  'bg-slate-900 border-slate-800'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5">
                    {alert.alert_type === 'Stuck' ? '🚨' : alert.alert_type === 'Slow' ? '⚠️' : '⚫'}
                  </span>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-white">
                        {alert.alert_type === 'Stuck' ? 'CRITICAL STUCK' : alert.alert_type === 'Slow' ? 'SLOW WARNING' : 'QC HOLD'}
                      </span>
                      <span className="text-slate-600">•</span>
                      <span className="font-bold text-slate-400 font-mono">{alert.batch_number}</span>
                    </div>
                    <p className="text-slate-400 font-semibold">{alert.item_name} at stage <strong>{alert.stage_name}</strong></p>
                    <p className="text-slate-500 text-[10px]">
                      Alert raised: {formatDate(alert.alert_time)} • Work Order: {alert.wo_number}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xxs font-bold">
                  {alert.status === 'Active' && (
                    <button
                      onClick={() => handleAlertAction('acknowledge', alert.alert_id)}
                      className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl transition"
                    >
                      Acknowledge
                    </button>
                  )}
                  <button
                    onClick={() => handleAlertAction('resolve', alert.alert_id)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl transition"
                  >
                    Resolve Alert
                  </button>
                </div>
              </div>
            ))}
            {alerts.length === 0 && (
              <p className="text-slate-500 text-xs italic text-center py-8">✓ All batches moving normally. No active bottlenecks!</p>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────── */}
      {/* TAB VIEW 3: REPORTS & ANALYTICS */}
      {/* ──────────────────────────────────────────────────────── */}
      {activeTab === 'reports' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Report 1: Lead Time log */}
          <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-900 space-y-4">
            <h3 className="font-extrabold text-white text-sm border-b border-slate-900 pb-2">Batch Lead Time Log</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 text-slate-500 text-xxs font-bold uppercase bg-slate-900/60">
                    <th className="py-2.5 px-3">Batch Number</th>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3 text-right">Lead Time</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 text-xxs font-semibold text-slate-400">
                  {leadTimeReport.map((item, idx) => {
                    const hours = (item.duration_minutes / 60).toFixed(1);
                    return (
                      <tr key={idx} className="hover:bg-slate-900/30">
                        <td className="py-2.5 px-3 font-mono font-bold text-white">{item.batch_number}</td>
                        <td className="py-2.5 px-3">{item.item_name}</td>
                        <td className="py-2.5 px-3 text-right font-black text-orange-500">{hours} hrs</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black border ${
                            item.status === 'Completed' ? 'bg-green-950 text-green-400 border-green-900' :
                            item.status === 'Stuck' ? 'bg-red-950 text-red-400 border-red-900 animate-pulse' :
                            'bg-blue-950 text-blue-400 border-blue-900'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Report 2: Stage-wise bottlenecks */}
          <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-900 space-y-4">
            <h3 className="font-extrabold text-white text-sm border-b border-slate-900 pb-2">Stage-wise Time Analysis</h3>
            
            <div className="space-y-4 text-xs font-semibold text-slate-400">
              {stageTimeReport.map((stage, idx) => {
                const avgHr = (stage.avg_duration / 60).toFixed(1);
                const targetHr = (stage.target_minutes / 60).toFixed(1);
                const percent = stage.target_minutes > 0 ? Math.min(Math.round((stage.avg_duration / stage.target_minutes) * 100), 100) : 0;
                
                // Highlight stages that exceed target max time
                const isOver = stage.avg_duration > stage.target_minutes && stage.target_minutes > 0;

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between items-center text-xxs">
                      <span className="font-bold text-white">{stage.stage_name}</span>
                      <span className={isOver ? 'text-red-400 font-extrabold' : 'text-slate-500'}>
                        Avg: {avgHr}h / Target: {targetHr}h
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden flex">
                      <div 
                        className={`h-full rounded-full transition-all ${isOver ? 'bg-red-500' : 'bg-green-500'}`} 
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Report 3: Work Order Progress */}
          <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-900 space-y-4 md:col-span-2">
            <h3 className="font-extrabold text-white text-sm border-b border-slate-900 pb-2">Work Order wise WIP Status</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {woStatusReport.map((wo, idx) => {
                const progress = wo.planned_qty > 0 ? Math.min(Math.round((wo.produced_qty / wo.planned_qty) * 100), 100) : 0;
                return (
                  <div key={idx} className="border border-slate-900 p-4 rounded-xl space-y-2.5 text-xs font-semibold text-slate-400 bg-slate-900/20">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-extrabold text-white block text-sm">{wo.wo_number}</span>
                        <span className="text-[10px] text-slate-500 block font-normal">{wo.item_name} • {wo.customer_name}</span>
                      </div>
                      <span className="bg-orange-950 text-orange-400 border border-orange-900 px-2 py-0.5 rounded font-black text-[10px]">
                        {wo.total_batches} batches
                      </span>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xxs">
                        <span>Moulding progress:</span>
                        <strong>{progress}% ({wo.produced_qty}/{wo.planned_qty} Pcs)</strong>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                        <div className="bg-orange-500 h-full rounded-full" style={{ width: `${progress}%` }}></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* 3. MOCKUP BOTTOM PANEL: WIP SUMMARY DOUGHNUT CHART AND PERFORMANCE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-900/20 border border-slate-900 p-5 rounded-3xl">
        
        {/* Doughnut Chart Panel (4 Columns) */}
        <div className="lg:col-span-4 bg-slate-900/40 rounded-2xl border border-slate-900/60 p-5 space-y-4">
          <div className="border-b border-slate-900 pb-2">
            <span className="text-[10px] text-slate-450 uppercase tracking-widest font-extrabold block">WIP Summary</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 justify-center">
            {/* Pure SVG Doughnut Chart */}
            <div className="relative w-28 h-28 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                {/* Background circle */}
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#0f172a" strokeWidth="3" />
                
                {/* Segment 1: Mixing (18%) */}
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#3b82f6" strokeWidth="3.2" strokeDasharray="18 82" strokeDashoffset="100" />
                {/* Segment 2: Moulding (27%) */}
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#22c55e" strokeWidth="3.2" strokeDasharray="27 73" strokeDashoffset="82" />
                {/* Segment 3: Trimming (15%) */}
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f59e0b" strokeWidth="3.2" strokeDasharray="15 85" strokeDashoffset="55" />
                {/* Segment 4: Final QC (13%) */}
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#a855f7" strokeWidth="3.2" strokeDasharray="13 87" strokeDashoffset="40" />
                {/* Segment 5: FG Store (11%) */}
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#14b8a6" strokeWidth="3.2" strokeDasharray="11 89" strokeDashoffset="27" />
                {/* Segment 6: Dispatch (16%) */}
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#ef4444" strokeWidth="3.2" strokeDasharray="16 84" strokeDashoffset="16" />
              </svg>
              {/* Inner Stats Card */}
              <div className="absolute text-center">
                <span className="text-xl font-black text-white block">45</span>
                <span className="text-[8px] text-slate-500 font-extrabold uppercase tracking-wider block">Total</span>
              </div>
            </div>

            {/* Color Labels */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[8px] font-bold text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 block"></span> Mix (17.8%)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 block"></span> Mould (26.7%)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 block"></span> Trim (15.6%)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500 block"></span> QC (13.3%)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-500 block"></span> FG (11.1%)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 block"></span> Disp (6.7%)</span>
            </div>
          </div>
        </div>

        {/* Production Performance Panel (4 Columns) */}
        <div className="lg:col-span-4 bg-slate-900/40 rounded-2xl border border-slate-900/60 p-5 space-y-4">
          <div className="border-b border-slate-900 pb-2">
            <span className="text-[10px] text-slate-455 uppercase tracking-widest font-extrabold block">Production Performance (Today)</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-955 p-3.5 border border-slate-900 rounded-xl">
              <span className="text-slate-500 text-[8px] font-black uppercase tracking-wider block">Planned Qty</span>
              <span className="text-xs font-black text-white mt-1 block">18,000 pcs</span>
            </div>
            <div className="bg-slate-955 p-3.5 border border-slate-900 rounded-xl">
              <span className="text-slate-500 text-[8px] font-black uppercase tracking-wider block">Produced Qty</span>
              <span className="text-xs font-black text-white mt-1 block">14,320 pcs</span>
            </div>
            <div className="bg-slate-955 p-3.5 border border-slate-900 rounded-xl">
              <span className="text-slate-500 text-[8px] font-black uppercase tracking-wider block">Good Qty</span>
              <span className="text-xs font-black text-green-400 mt-1 block">13,842 pcs</span>
            </div>
            <div className="bg-slate-955 p-3.5 border border-slate-900 rounded-xl">
              <span className="text-slate-500 text-[8px] font-black uppercase tracking-wider block">Rejected Qty</span>
              <span className="text-xs font-black text-red-500 mt-1 block">478 pcs</span>
            </div>
          </div>

          <div className="space-y-2">
            {/* Sparkline stats 1 */}
            <div className="bg-slate-955 p-2.5 border border-slate-900 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-slate-500 text-[8px] font-black uppercase tracking-wider block">Rejection %</span>
                <span className="text-xs font-black text-red-400 mt-0.5 block">3.34%</span>
              </div>
              <svg className="w-16 h-6 text-slate-700" viewBox="0 0 100 20">
                <path d="M 0 18 Q 20 12 40 14 T 80 5 T 100 12" fill="none" stroke="#ef4444" strokeWidth="2" />
              </svg>
            </div>

            {/* Sparkline stats 2 */}
            <div className="bg-slate-955 p-2.5 border border-slate-900 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-slate-500 text-[8px] font-black uppercase tracking-wider block">OEE %</span>
                <span className="text-xs font-black text-emerald-400 mt-0.5 block">72.45%</span>
              </div>
              <svg className="w-16 h-6 text-slate-700" viewBox="0 0 100 20">
                <path d="M 0 5 Q 20 15 40 10 T 80 18 T 100 6" fill="none" stroke="#10b981" strokeWidth="2" />
              </svg>
            </div>
          </div>
        </div>

        {/* Top Work Orders in Progress (5 Columns) */}
        <div className="lg:col-span-5 bg-slate-900/40 rounded-2xl border border-slate-900/60 p-5 space-y-4">
          <div className="border-b border-slate-900 pb-2 flex justify-between items-center">
            <span className="text-[10px] text-slate-455 uppercase tracking-widest font-extrabold block">Top Work Orders In Progress</span>
            <span className="text-[8px] text-orange-500 font-extrabold uppercase">Live status</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xxs font-semibold border-collapse text-slate-400">
              <thead>
                <tr className="border-b border-slate-900 text-slate-500 text-[9px] font-black uppercase">
                  <th className="pb-2">Work Order</th>
                  <th className="pb-2">Product</th>
                  <th className="pb-2">Customer</th>
                  <th className="pb-2 text-right">Planned</th>
                  <th className="pb-2 text-right">Done</th>
                  <th className="pb-2 text-center">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/40">
                {woStatusReport.slice(0, 4).map((wo, idx) => {
                  const progressPercent = wo.planned_qty > 0 ? Math.min(Math.round((wo.produced_qty / wo.planned_qty) * 100), 100) : 0;
                  return (
                    <tr key={idx} className="hover:bg-slate-900/30">
                      <td className="py-2 font-mono text-white font-bold">{wo.wo_number}</td>
                      <td className="py-2 text-[10px] text-slate-300 max-w-[100px] truncate">{wo.item_name}</td>
                      <td className="py-2 text-slate-550 max-w-[80px] truncate">{wo.customer_name || 'Hero Honda'}</td>
                      <td className="py-2 text-right">{wo.planned_qty?.toLocaleString()}</td>
                      <td className="py-2 text-right font-black text-white">{wo.produced_qty?.toLocaleString() || 0}</td>
                      <td className="py-2 text-center">
                        <div className="flex items-center gap-1.5 justify-center">
                          <div className="w-10 bg-slate-900 h-1 rounded-full overflow-hidden">
                            <div className="bg-green-500 h-full rounded-full" style={{ width: `${progressPercent}%` }}></div>
                          </div>
                          <span className="text-[9px] font-black text-green-400">{progressPercent}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {woStatusReport.length === 0 && (
                  <tr>
                    <td colSpan="6" className="py-4 text-center text-slate-500 italic">No active work orders.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* 4. DIALOG MODAL: MOVE BATCH CONFIRMATION */}
      {moveBatchObj && (
        <div className="fixed inset-0 bg-slate-955/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full shadow-2xl p-6 space-y-4 text-xs font-semibold text-slate-455">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="font-extrabold text-white text-sm">Move Batch {moveBatchObj.batch_number}?</span>
              <button onClick={() => setMoveBatchObj(null)} className="text-slate-550 hover:text-slate-300"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-2 border border-slate-800 p-4 rounded-2xl bg-slate-950/60">
              <div className="flex justify-between">
                <span className="text-slate-500">Current Stage:</span>
                <strong className="text-white">{moveBatchObj.from_stage}</strong>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-850">
                <span className="text-slate-500">Transition To:</span>
                <strong className="text-orange-500">{moveBatchObj.to_stage}</strong>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-855">
                <span className="text-slate-500">Time spent:</span>
                <strong className="text-slate-300">{moveBatchObj.duration}</strong>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-855">
                <span className="text-slate-500">Operator:</span>
                <strong className="text-slate-300">{moveBatchObj.operator}</strong>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setMoveBatchObj(null)}
                className="bg-slate-950 hover:bg-slate-800 text-slate-300 px-4 py-2 rounded-xl font-bold transition border border-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmMove}
                className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-xl font-bold transition"
              >
                Confirm Move →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. SLIDE-OUT PANEL: BATCH DETAIL VIEW */}
      {selectedBatchId && batchDetail && (
        <div className="fixed inset-y-0 right-0 max-w-sm w-full bg-slate-900 border-l border-slate-800 shadow-2xl z-50 p-6 flex flex-col justify-between animate-slideIn">
          <div className="space-y-6 overflow-y-auto pr-1 flex-1">
            
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-white text-base">{batchDetail.batch_number}</h3>
                <p className="text-slate-500 text-xxs uppercase tracking-wider font-semibold">Batch Details & Stage Timeline</p>
              </div>
              <button onClick={() => setSelectedBatchId(null)} className="text-slate-550 hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-semibold text-slate-455">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-500 text-xxs block">Product Part</span>
                  <span className="text-white font-bold block mt-0.5">{batchDetail.item_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-xxs block">Quantity</span>
                  <span className="text-white font-bold block mt-0.5">{batchDetail.quantity} Pcs</span>
                </div>
                <div>
                  <span className="text-slate-500 text-xxs block">Customer</span>
                  <span className="text-white font-bold block mt-0.5">{batchDetail.customer_name || 'Internal'}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-xxs block">Work Order</span>
                  <span className="text-white font-bold block mt-0.5 font-mono">{batchDetail.wo_number}</span>
                </div>
              </div>

              {/* Compound code */}
              <div className="border border-slate-800 p-4 rounded-xl bg-slate-950/60 space-y-1">
                <span className="text-slate-500 text-[10px] font-bold block uppercase tracking-wider">Compounding Mix Reference</span>
                <span className="text-white block">EPDM-70 Compound Batch <strong>#MIX-0034</strong></span>
                <span className="text-green-400 text-xxs block font-extrabold flex items-center gap-1 mt-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Approved by Quality Lab
                </span>
              </div>

              {/* Stage timeline history */}
              <div className="space-y-3">
                <span className="text-slate-500 text-[10px] font-bold block uppercase tracking-wider border-b border-slate-855 pb-1">Stage History Timeline</span>
                <div className="relative pl-4 border-l border-slate-800 ml-2 space-y-4">
                  {batchDetail.timeline && batchDetail.timeline.map((tm, idx) => {
                    const elapsed = tm.duration_minutes ? `${tm.duration_minutes}m` : 'In Progress';
                    return (
                      <div key={idx} className="relative text-xxs">
                        {/* Dot */}
                        <span className={`absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 flex items-center justify-center text-[7px] text-white font-bold ${
                          tm.exited_at ? 'bg-green-500' : 'bg-orange-500 animate-pulse'
                        }`}>
                          {tm.exited_at ? '✓' : '•'}
                        </span>
                        <div>
                          <strong className="text-white block text-xs">{tm.stage_name}</strong>
                          <span className="text-slate-500 block font-normal mt-0.5">
                            {formatDate(tm.entered_at)} → {tm.exited_at ? formatDate(tm.exited_at) : 'Active now'}
                          </span>
                          <span className="text-orange-500 font-bold block mt-0.5">Duration: {elapsed}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* QR Code label */}
              <div className="border border-slate-800 p-4 rounded-xl bg-slate-950/60 flex flex-col items-center justify-center gap-3">
                <span className="text-slate-500 text-xxs block uppercase font-black">Scan to Route Batch</span>
                <QRCode 
                  id="batch-qr-canvas"
                  value={JSON.stringify({
                    batch_id: batchDetail.batch_id,
                    batch_number: batchDetail.batch_number,
                    item_name: batchDetail.item_name,
                    quantity: batchDetail.quantity,
                    stage_id: batchDetail.current_stage_id
                  })}
                  size={110}
                  level="M"
                />
              </div>

            </div>
          </div>

          {/* Quick status updates in Detail Panel */}
          <div className="pt-4 border-t border-slate-800 grid grid-cols-2 gap-2 text-xxs font-bold text-center">
            {batchDetail.status !== 'QC Hold' ? (
              <button
                onClick={() => handleAction('hold', batchDetail.batch_id)}
                className="bg-slate-955 hover:bg-slate-800 text-white py-2 rounded-xl border border-slate-800 transition"
              >
                QC Hold
              </button>
            ) : (
              <button
                onClick={() => handleAction('release', batchDetail.batch_id)}
                className="bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl transition"
              >
                Release QC
              </button>
            )}
            <button
              onClick={() => handleAction('rework', batchDetail.batch_id)}
              className="bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-xl transition"
            >
              Rework
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
