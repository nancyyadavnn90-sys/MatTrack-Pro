import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Package, PackageOpen, ClipboardCheck, Factory, BarChart3, Truck, 
  AlertTriangle, ChevronRight, Boxes, CheckSquare
} from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const getAuthHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function Dashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const [summary, setSummary] = useState({
    activeBatches: 12, plantOee: 78.5, pendingQc: 3, lowStock: 2, dispatchDue: 4,
    activeWorkOrders: 5, wipBatches: 12, wipStuckBatches: 1, partsToday: 5880, rejectionRate: 1.02,
    qcHoldItems: 3, openNcs: 2, lowStockItems: 2, expiringSoon: 5,
    fgStockReady: 48500, pendingDispatch: 4, dispatchedToday: 6750
  });

  const [oeeMachines, setOeeMachines] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [stockAlerts, setStockAlerts] = useState([]);

  const fetchDashboardData = async () => {
    try {
      const [resSum, resOee, resWo, resAlt, resStk] = await Promise.all([
        axios.get(`${API}/dashboard/summary`, getAuthHeader()).catch(() => ({ data: summary })),
        axios.get(`${API}/dashboard/oee-summary`, getAuthHeader()).catch(() => ({ data: [] })),
        axios.get(`${API}/dashboard/work-orders`, getAuthHeader()).catch(() => ({ data: [] })),
        axios.get(`${API}/dashboard/alerts`, getAuthHeader()).catch(() => ({ data: [] })),
        axios.get(`${API}/dashboard/stock-alerts`, getAuthHeader()).catch(() => ({ data: [] }))
      ]);

      if (resSum.data) setSummary(resSum.data);
      if (resOee.data?.length) setOeeMachines(resOee.data);
      if (resWo.data?.length) setWorkOrders(resWo.data);
      if (resAlt.data?.length) setAlerts(resAlt.data);
      if (resStk.data?.length) setStockAlerts(resStk.data);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    }
  };

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchDashboardData();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getShiftDetails = (now) => {
    const h = now.getHours();
    const m = now.getMinutes();
    const timeVal = h + m / 60;

    if (timeVal >= 9 && timeVal < 18) {
      return { name: 'Morning Shift', hours: '09:00 AM – 06:00 PM' };
    } else if (timeVal >= 19 || timeVal < 5) {
      return { name: 'Night Shift', hours: '07:00 PM – 05:00 AM' };
    } else if (timeVal >= 5 && timeVal < 9) {
      return { name: 'Early Morning Shift', hours: '05:00 AM – 09:00 AM' };
    } else {
      return { name: 'Evening Shift', hours: '06:00 PM – 07:00 PM' };
    }
  };

  const currentShift = getShiftDetails(currentTime);
  const formattedTime = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const userRole = user.role || 'Admin';
  const isAdminOrManager = userRole === 'Admin' || userRole === 'System Administrator' || userRole === 'Manager';
  const isOperator = userRole === 'Operator';
  const isQuality = userRole === 'QCInspector' || userRole === 'QCManager';
  const isStore = userRole === 'StoreUser' || userRole === 'StoreManager';
  const isDispatch = userRole === 'DispatchUser';

  return (
    <div className="bg-[#121212] text-slate-200 min-h-screen p-6 font-sans space-y-6">
      
      {/* TOP WELCOME BANNER (Sleek Dark Theme) */}
      <div className="bg-gradient-to-r from-[#1e1e1e] via-[#1a1a1a] to-[#141414] border border-[#2a2a2a] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2a2a2a] pb-4">
          <div>
            <h1 className="text-xl font-black text-white tracking-wide">
              {getGreeting()}, {user.name || 'Nancy Yadav'} 👋
            </h1>
            <p className="text-xs text-emerald-400 font-bold mt-0.5">
              Jayashree Polymers (India) Pvt. Ltd. <span className="text-slate-500 mx-2">|</span> {currentShift.name} ({currentShift.hours})
            </p>
          </div>
          <div className="text-right space-y-0.5">
            <div className="text-xs font-black text-emerald-400 font-mono tracking-wider">
              ⏱️ {formattedTime}
            </div>
            <div className="text-[11px] font-bold text-slate-400">
              {currentTime.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>

        {/* 5 LIVE SUMMARY COUNTERS */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
          <div className="bg-[#121212] border border-[#2a2a2a] p-3 rounded-xl">
            <p className="text-[10px] font-black uppercase text-slate-400">Active Batches</p>
            <p className="text-xl font-black text-emerald-400 mt-0.5">{summary.activeBatches}</p>
          </div>
          <div className="bg-[#121212] border border-[#2a2a2a] p-3 rounded-xl">
            <p className="text-[10px] font-black uppercase text-slate-400">Plant OEE</p>
            <p className="text-xl font-black text-amber-400 mt-0.5">{summary.plantOee}%</p>
          </div>
          <div className="bg-[#121212] border border-[#2a2a2a] p-3 rounded-xl">
            <p className="text-[10px] font-black uppercase text-slate-400">Pending QC</p>
            <p className="text-xl font-black text-purple-400 mt-0.5">{summary.pendingQc}</p>
          </div>
          <div className="bg-[#121212] border border-[#2a2a2a] p-3 rounded-xl">
            <p className="text-[10px] font-black uppercase text-slate-400">Low Stock</p>
            <p className="text-xl font-black text-red-400 mt-0.5">{summary.lowStock}</p>
          </div>
          <div className="bg-[#121212] border border-[#2a2a2a] p-3 rounded-xl">
            <p className="text-[10px] font-black uppercase text-slate-400">Dispatch Due</p>
            <p className="text-xl font-black text-blue-400 mt-0.5">{summary.dispatchDue}</p>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS ROW (6 Buttons) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <button onClick={() => navigate('/gate-pass')} className="bg-[#1e1e1e] hover:bg-[#252525] border border-[#2a2a2a] hover:border-emerald-500/50 p-3.5 rounded-xl flex flex-col items-center justify-center text-center space-y-1.5 transition shadow-md group">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition"><Package className="w-5 h-5" /></div>
          <span className="text-xs font-bold text-white group-hover:text-emerald-400">New Gate Pass</span>
        </button>

        <button onClick={() => navigate('/grn')} className="bg-[#1e1e1e] hover:bg-[#252525] border border-[#2a2a2a] hover:border-emerald-500/50 p-3.5 rounded-xl flex flex-col items-center justify-center text-center space-y-1.5 transition shadow-md group">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 group-hover:scale-110 transition"><PackageOpen className="w-5 h-5" /></div>
          <span className="text-xs font-bold text-white group-hover:text-blue-400">New GRN</span>
        </button>

        <button onClick={() => navigate('/quality')} className="bg-[#1e1e1e] hover:bg-[#252525] border border-[#2a2a2a] hover:border-emerald-500/50 p-3.5 rounded-xl flex flex-col items-center justify-center text-center space-y-1.5 transition shadow-md group relative">
          <span className="absolute top-2 right-2 bg-purple-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{summary.pendingQc}</span>
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 group-hover:scale-110 transition"><ClipboardCheck className="w-5 h-5" /></div>
          <span className="text-xs font-bold text-white group-hover:text-purple-400">QC Queue</span>
        </button>

        <button onClick={() => navigate('/production')} className="bg-[#1e1e1e] hover:bg-[#252525] border border-[#2a2a2a] hover:border-emerald-500/50 p-3.5 rounded-xl flex flex-col items-center justify-center text-center space-y-1.5 transition shadow-md group">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-110 transition"><Factory className="w-5 h-5" /></div>
          <span className="text-xs font-bold text-white group-hover:text-amber-400">New Work Order</span>
        </button>

        <button onClick={() => navigate('/oee/shift-log')} className="bg-[#1e1e1e] hover:bg-[#252525] border border-[#2a2a2a] hover:border-emerald-500/50 p-3.5 rounded-xl flex flex-col items-center justify-center text-center space-y-1.5 transition shadow-md group">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition"><BarChart3 className="w-5 h-5" /></div>
          <span className="text-xs font-bold text-white group-hover:text-emerald-400">Log OEE Entry</span>
        </button>

        <button onClick={() => navigate('/dispatch')} className="bg-[#1e1e1e] hover:bg-[#252525] border border-[#2a2a2a] hover:border-emerald-500/50 p-3.5 rounded-xl flex flex-col items-center justify-center text-center space-y-1.5 transition shadow-md group">
          <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400 group-hover:scale-110 transition"><Truck className="w-5 h-5" /></div>
          <span className="text-xs font-bold text-white group-hover:text-teal-400">New Dispatch</span>
        </button>
      </div>

      {/* PROCESS FLOW TRACKER */}
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-5 shadow-lg space-y-3">
        <h2 className="text-xs font-black uppercase text-slate-400 tracking-wider">TODAY'S OPERATIONS PROCESS FLOW</h2>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
          {[
            { stage: 'Gate Pass', count: '3 today', status: '✅', color: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/5', path: '/gate-pass' },
            { stage: 'GRN', count: '2 today', status: '✅', color: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/5', path: '/grn' },
            { stage: 'Store', count: 'In Stock', status: '✅', color: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/5', path: '/inventory' },
            { stage: 'Quality', count: '3 pending', status: '⚠️', color: 'border-amber-500/40 text-amber-400 bg-amber-500/5', path: '/quality' },
            { stage: 'Production', count: '5 WOs', status: '🔵', color: 'border-blue-500/40 text-blue-400 bg-blue-500/5', path: '/production' },
            { stage: 'WIP', count: '12 batches', status: '🔵', color: 'border-blue-500/40 text-blue-400 bg-blue-500/5', path: '/wip' },
            { stage: 'FG', count: '3 ready', status: '✅', color: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/5', path: '/fg-receipt' },
            { stage: 'Dispatch', count: '4 pending', status: '⏳', color: 'border-slate-500/40 text-slate-300 bg-slate-500/5', path: '/dispatch' }
          ].map((item, idx) => (
            <div 
              key={idx}
              onClick={() => navigate(item.path)}
              className={`p-3 rounded-xl border ${item.color} cursor-pointer hover:scale-105 transition shadow-sm space-y-1 text-center`}
            >
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-extrabold">{item.stage}</span>
                <span>{item.status}</span>
              </div>
              <p className="text-[11px] font-bold">{item.count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* KPI CARDS (3 ROWS × 4 CARDS = 12 CARDS) */}
      <div className="space-y-4">
        {(isAdminOrManager || isOperator) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div onClick={() => navigate('/production')} className="bg-[#1e1e1e] border border-[#2a2a2a] hover:border-emerald-500/40 p-4 rounded-2xl shadow-md cursor-pointer transition space-y-2">
              <p className="text-[10px] font-black uppercase text-slate-400">Active Work Orders</p>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-white">{summary.activeWorkOrders}</span>
                <span className="text-[11px] font-bold text-emerald-400 flex items-center">↑ 2 from yest.</span>
              </div>
            </div>

            <div onClick={() => navigate('/wip')} className="bg-[#1e1e1e] border border-[#2a2a2a] hover:border-emerald-500/40 p-4 rounded-2xl shadow-md cursor-pointer transition space-y-2">
              <p className="text-[10px] font-black uppercase text-slate-400">WIP Batches</p>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-white">{summary.wipBatches}</span>
                <span className="text-[11px] font-bold text-amber-400">{summary.wipStuckBatches} stuck ⚠️</span>
              </div>
            </div>

            <div onClick={() => navigate('/production')} className="bg-[#1e1e1e] border border-[#2a2a2a] hover:border-emerald-500/40 p-4 rounded-2xl shadow-md cursor-pointer transition space-y-2">
              <p className="text-[10px] font-black uppercase text-slate-400">Parts Produced Today</p>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-white">{summary.partsToday?.toLocaleString()}</span>
                <span className="text-[11px] font-bold text-emerald-400">↑ 12% vs yest</span>
              </div>
            </div>

            <div onClick={() => navigate('/quality')} className="bg-[#1e1e1e] border border-[#2a2a2a] hover:border-emerald-500/40 p-4 rounded-2xl shadow-md cursor-pointer transition space-y-2">
              <p className="text-[10px] font-black uppercase text-slate-400">Rejection Rate</p>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-emerald-400">{summary.rejectionRate}%</span>
                <span className="text-[11px] font-bold text-emerald-400">↓ Good ✅</span>
              </div>
            </div>
          </div>
        )}

        {(isAdminOrManager || isQuality || isStore) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div onClick={() => navigate('/quality')} className="bg-[#1e1e1e] border border-[#2a2a2a] hover:border-emerald-500/40 p-4 rounded-2xl shadow-md cursor-pointer transition space-y-2">
              <p className="text-[10px] font-black uppercase text-slate-400">QC Hold Items</p>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-purple-400">{summary.qcHoldItems}</span>
                <span className="text-[11px] font-bold text-purple-400">Needs attention</span>
              </div>
            </div>

            <div onClick={() => navigate('/quality')} className="bg-[#1e1e1e] border border-[#2a2a2a] hover:border-emerald-500/40 p-4 rounded-2xl shadow-md cursor-pointer transition space-y-2">
              <p className="text-[10px] font-black uppercase text-slate-400">Open NCs</p>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-red-400">{summary.openNcs}</span>
                <span className="text-[11px] font-bold text-red-400">2 Major 1 Minor</span>
              </div>
            </div>

            <div onClick={() => navigate('/inventory')} className="bg-[#1e1e1e] border border-[#2a2a2a] hover:border-emerald-500/40 p-4 rounded-2xl shadow-md cursor-pointer transition space-y-2">
              <p className="text-[10px] font-black uppercase text-slate-400">Low Stock Items</p>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-amber-400">{summary.lowStockItems}</span>
                <span className="text-[11px] font-bold text-amber-400">Below reorder</span>
              </div>
            </div>

            <div onClick={() => navigate('/inventory')} className="bg-[#1e1e1e] border border-[#2a2a2a] hover:border-emerald-500/40 p-4 rounded-2xl shadow-md cursor-pointer transition space-y-2">
              <p className="text-[10px] font-black uppercase text-slate-400">Expiring Soon</p>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-white">{summary.expiringSoon}</span>
                <span className="text-[11px] font-bold text-slate-400">Within 30 days</span>
              </div>
            </div>
          </div>
        )}

        {(isAdminOrManager || isDispatch) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div onClick={() => navigate('/fg-receipt')} className="bg-[#1e1e1e] border border-[#2a2a2a] hover:border-emerald-500/40 p-4 rounded-2xl shadow-md cursor-pointer transition space-y-2">
              <p className="text-[10px] font-black uppercase text-slate-400">FG Stock Ready</p>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-emerald-400">{summary.fgStockReady?.toLocaleString()} pcs</span>
                <span className="text-[11px] font-bold text-slate-400">For Hero/Honda</span>
              </div>
            </div>

            <div onClick={() => navigate('/dispatch')} className="bg-[#1e1e1e] border border-[#2a2a2a] hover:border-emerald-500/40 p-4 rounded-2xl shadow-md cursor-pointer transition space-y-2">
              <p className="text-[10px] font-black uppercase text-slate-400">Pending Dispatch</p>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-blue-400">{summary.pendingDispatch}</span>
                <span className="text-[11px] font-bold text-blue-400">Honda + Hero</span>
              </div>
            </div>

            <div onClick={() => navigate('/oee')} className="bg-[#1e1e1e] border border-[#2a2a2a] hover:border-emerald-500/40 p-4 rounded-2xl shadow-md cursor-pointer transition space-y-2">
              <p className="text-[10px] font-black uppercase text-slate-400">Plant OEE</p>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-amber-400">{summary.plantOee}%</span>
                <span className="text-[11px] font-bold text-amber-400">⚠️ Below 85%</span>
              </div>
            </div>

            <div onClick={() => navigate('/dispatch')} className="bg-[#1e1e1e] border border-[#2a2a2a] hover:border-emerald-500/40 p-4 rounded-2xl shadow-md cursor-pointer transition space-y-2">
              <p className="text-[10px] font-black uppercase text-slate-400">Dispatched Today</p>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-white">{summary.dispatchedToday?.toLocaleString()} pcs</span>
                <span className="text-[11px] font-bold text-emerald-400">To Honda ✅</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MAIN CONTENT AREA — TWO COLUMNS (60% LEFT, 40% RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        
        {/* LEFT COLUMN (60%) */}
        <div className="lg:col-span-6 space-y-6">

          {/* WIDGET 1: MINI WIP KANBAN BOARD */}
          {(isAdminOrManager || isOperator) && (
            <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex justify-between items-center border-b border-[#2a2a2a] pb-3">
                <h2 className="text-xs font-black uppercase text-white tracking-wider">MINI WIP KANBAN BOARD</h2>
                <button onClick={() => navigate('/wip')} className="text-xs font-extrabold text-emerald-400 hover:underline flex items-center gap-1">
                  View Full Board <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[
                  { stage: 'MIXING', count: 2, batch: 'B/042', item: 'EPDM', time: '2h 15m', status: 'bg-emerald-500/20 text-emerald-400' },
                  { stage: 'MOULDING', count: 7, batch: 'B/038', item: 'Seal', time: '3h 20m', status: 'bg-amber-500/20 text-amber-400' },
                  { stage: 'CURING', count: 5, batch: 'B/034', item: 'Tube', time: '5h 30m', status: 'bg-red-500/20 text-red-400' },
                  { stage: 'TRIMMING', count: 3, batch: 'B/031', item: 'Seal', time: '1h 00m', status: 'bg-emerald-500/20 text-emerald-400' },
                  { stage: 'INSPECTION', count: 2, batch: 'B/029', item: 'Hold', time: 'QC Hold', status: 'bg-purple-500/20 text-purple-400' },
                  { stage: 'FINISHED', count: 3, batch: 'B/026', item: 'Done', time: 'Done', status: 'bg-emerald-500/20 text-emerald-400' }
                ].map((col, idx) => (
                  <div key={idx} className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-2 space-y-2 text-center">
                    <div className="flex justify-between items-center text-[9px] font-black text-slate-400">
                      <span>{col.stage}</span>
                      <span className="bg-[#1e1e1e] px-1 rounded">{col.count}</span>
                    </div>
                    <div className={`p-2 rounded-lg ${col.status} border border-white/5 space-y-0.5 text-left`}>
                      <p className="text-[10px] font-black">{col.batch}</p>
                      <p className="text-[9px] opacity-80">{col.item}</p>
                      <p className="text-[8px] font-mono">{col.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WIDGET 2: OEE MACHINE STATUS BARS */}
          {(isAdminOrManager || isOperator) && (
            <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex justify-between items-center border-b border-[#2a2a2a] pb-3">
                <h2 className="text-xs font-black uppercase text-white tracking-wider">MACHINE OEE STATUS — TODAY</h2>
                <button onClick={() => navigate('/oee')} className="text-xs font-extrabold text-emerald-400 hover:underline flex items-center gap-1">
                  View OEE Dashboard <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3 font-mono text-xs">
                {(oeeMachines.length ? oeeMachines : [
                  { code: 'HMP-01', name: 'Hydraulic Press 1', oee: 88, status: 'Good' },
                  { code: 'HMP-02', name: 'Hydraulic Press 2', oee: 71, status: 'Average' },
                  { code: 'HMP-03', name: 'Hydraulic Press 3', oee: 58, status: 'Poor' },
                  { code: 'TMP-01', name: 'Transfer Press 1', oee: 83, status: 'Average' },
                  { code: 'INJ-01', name: 'Injection Machine 1', oee: 91, status: 'Excellent' }
                ]).map(m => (
                  <div key={m.code} className="space-y-1">
                    <div className="flex justify-between items-center text-[11px] font-sans">
                      <span className="font-extrabold text-white">{m.code}</span>
                      <div className="flex items-center gap-2 font-bold">
                        <span className={m.oee >= 85 ? 'text-emerald-400' : m.oee >= 70 ? 'text-amber-400' : 'text-red-400'}>{m.oee}%</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase ${m.oee >= 85 ? 'bg-emerald-500/10 text-emerald-400' : m.oee >= 70 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>{m.status}</span>
                      </div>
                    </div>
                    <div className="w-full bg-[#121212] border border-[#2a2a2a] rounded-full h-2 overflow-hidden relative">
                      <div className={`h-full ${m.oee >= 85 ? 'bg-emerald-500' : m.oee >= 70 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${m.oee}%` }}></div>
                      <div className="absolute top-0 bottom-0 left-[85%] w-0.5 bg-emerald-400 shadow-sm" title="85% World Class Benchmark"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WIDGET 3: ACTIVE WORK ORDERS TABLE */}
          {(isAdminOrManager || isOperator) && (
            <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex justify-between items-center border-b border-[#2a2a2a] pb-3">
                <h2 className="text-xs font-black uppercase text-white tracking-wider">WORK ORDERS IN PROGRESS</h2>
                <button onClick={() => navigate('/production')} className="text-xs font-extrabold text-emerald-400 hover:underline flex items-center gap-1">
                  View All Work Orders <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-semibold text-slate-300">
                  <thead className="text-[10px] text-slate-400 uppercase font-black border-b border-[#2a2a2a]">
                    <tr>
                      <th className="py-2.5 px-3">WO NUMBER</th>
                      <th className="py-2.5 px-3">PRODUCT</th>
                      <th className="py-2.5 px-3">CUSTOMER</th>
                      <th className="py-2.5 px-3">PROGRESS</th>
                      <th className="py-2.5 px-3">DUE DATE</th>
                      <th className="py-2.5 px-3 text-right">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a2a2a]">
                    {(workOrders.length ? workOrders : [
                      { wo_number: 'WO/2026/008', product: 'Engine Grommet A', customer: 'Honda HMSI', progress: 24, due_date: '15 Jul', status: 'On Track' },
                      { wo_number: 'WO/2026/009', product: 'Oil Seal B', customer: 'Hero MotoCorp', progress: 10, due_date: '18 Jul', status: 'On Track' },
                      { wo_number: 'WO/2026/007', product: 'Door Seal', customer: 'Yamaha Motors', progress: 0, due_date: '12 Jul', status: 'Overdue' }
                    ]).map(wo => (
                      <tr key={wo.wo_number} className="hover:bg-[#252525]">
                        <td className="py-2.5 px-3 font-bold text-white">{wo.wo_number}</td>
                        <td className="py-2.5 px-3 text-slate-300">{wo.product}</td>
                        <td className="py-2.5 px-3 text-slate-400">{wo.customer}</td>
                        <td className="py-2.5 px-3">
                          <div className="w-24 bg-[#121212] rounded-full h-1.5 overflow-hidden border border-[#333]">
                            <div className="bg-emerald-500 h-full" style={{ width: `${wo.progress}%` }}></div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 font-mono">{wo.due_date}</td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            wo.status === 'Overdue' ? 'bg-red-500/10 text-red-400 border border-red-500/30' : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                          }`}>
                            {wo.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN (40%) */}
        <div className="lg:col-span-4 space-y-6">

          {/* WIDGET 4: LIVE ALERTS PANEL */}
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-5 shadow-lg space-y-3">
            <div className="flex justify-between items-center border-b border-[#2a2a2a] pb-2">
              <h2 className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-400" /> ACTIVE ALERTS
              </h2>
            </div>

            <div className="space-y-2">
              {(alerts.length ? alerts : [
                { id: 1, type: 'critical', title: 'Batch B/26/034 stuck at Curing 5.5h', action: 'View Batch', link: '/wip', time: '2 mins ago' },
                { id: 2, type: 'critical', title: 'HMP-03 OEE at 58% — 3 days in a row', action: 'View Machine', link: '/oee', time: '1 hour ago' },
                { id: 3, type: 'warning', title: '3 QC items pending — overdue 2 hours', action: 'View QC Queue', link: '/quality', time: '2 hours ago' }
              ]).map(alt => (
                <div key={alt.id} className={`p-3 rounded-xl border text-xs font-semibold space-y-1 transition ${
                  alt.type === 'critical' ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className="font-black text-[10px] uppercase tracking-wider">{alt.type}</span>
                    <span className="text-[9px] text-slate-500">{alt.time}</span>
                  </div>
                  <p className="text-white font-bold text-[11px]">{alt.title}</p>
                  <button onClick={() => navigate(alt.link)} className="text-[10px] font-extrabold text-emerald-400 hover:underline block pt-0.5">
                    → [{alt.action}]
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* WIDGET 5: PENDING ACTIONS PANEL */}
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-5 shadow-lg space-y-3">
            <h2 className="text-xs font-black uppercase text-white tracking-wider border-b border-[#2a2a2a] pb-2 flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4 text-emerald-400" /> YOUR PENDING TASKS
            </h2>

            <div className="space-y-2 text-xs font-semibold">
              <div onClick={() => navigate('/quality')} className="p-3 bg-[#141414] hover:bg-[#252525] border border-[#2a2a2a] rounded-xl flex items-center justify-between cursor-pointer transition">
                <span className="text-slate-300">QC Inspections Pending</span>
                <span className="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2.5 py-0.5 rounded-full text-xs font-black">{summary.pendingQc}</span>
              </div>
              <div onClick={() => navigate('/dispatch')} className="p-3 bg-[#141414] hover:bg-[#252525] border border-[#2a2a2a] rounded-xl flex items-center justify-between cursor-pointer transition">
                <span className="text-slate-300">Dispatch Orders Ready</span>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-xs font-black">{summary.pendingDispatch}</span>
              </div>
            </div>
          </div>

          {/* WIDGET 8: LOW STOCK ALERTS PANEL */}
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-5 shadow-lg space-y-3">
            <h2 className="text-xs font-black uppercase text-amber-400 tracking-wider border-b border-[#2a2a2a] pb-2 flex items-center gap-1.5">
              <Boxes className="w-4 h-4" /> LOW STOCK ALERTS
            </h2>

            <div className="space-y-2">
              {(stockAlerts.length ? stockAlerts : [
                { item_name: 'Raw Rubber EPDM 3550', current_qty: 45, reorder_level: 100, unit: 'kg' },
                { item_name: 'Carbon Black N330', current_qty: 28, reorder_level: 50, unit: 'kg' }
              ]).map((stk, idx) => (
                <div key={idx} className="p-3 bg-[#141414] border border-amber-500/30 rounded-xl space-y-1 text-xs">
                  <div className="flex justify-between font-bold text-white">
                    <span>{stk.item_name}</span>
                    <span className="text-amber-400">{stk.current_qty} {stk.unit}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">Reorder Level: {stk.reorder_level} {stk.unit}</p>
                  <button onClick={() => navigate('/inventory')} className="text-[10px] font-extrabold text-amber-400 hover:underline block pt-0.5">
                    → [View Stock]
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}