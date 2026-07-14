import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Activity, Cpu, Layers, Clipboard, 
  Archive, RefreshCw, BarChart2
} from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const getAuthHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

export default function Dashboard() {
  const user = JSON.parse(localStorage.getItem('user'));
  const [stats, setStats] = useState({
    active_wos: 0,
    wip_batches: 0,
    oee_today: '76.4%',
    pending_dispatches: 0,
    machines: [],
    recent_inspections: [],
    active_wos_progress: [],
    store_inventory: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/dashboard/stats`, getAuthHeader());
      setStats(res.data);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const getMachineStatusBadge = (status) => {
    switch (status) {
      case 'Running':
        return 'bg-green-500 text-white';
      case 'Idle':
        return 'bg-amber-500 text-white';
      case 'Maintenance':
        return 'bg-red-500 text-white';
      default:
        return 'bg-slate-400 text-white';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="space-y-6">
      
      {/* Welcome Banner */}
      <div className="flex justify-between items-center bg-gradient-to-r from-slate-900 to-slate-800 p-6 rounded-2xl shadow-sm text-white border border-slate-700">
        <div>
          <h1 className="text-2xl font-black tracking-tight">
            Welcome back, {user?.name || 'Operator'}! 👋
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Central Command Centre • Jayashree Polymers Pvt Ltd
          </p>
        </div>
        <button 
          onClick={fetchStats}
          className="p-2 hover:bg-slate-700/50 rounded-lg text-slate-400 hover:text-white transition flex items-center gap-1.5 text-xs font-bold"
          title="Refresh dashboard"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Updating...' : 'Reload'}
        </button>
      </div>

      {/* Core KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xxs font-bold uppercase tracking-wider">Active Work Orders</p>
            <p className="text-2xl font-black text-slate-800 mt-1">
              {loading ? '...' : stats.active_wos}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-150 flex items-center justify-center text-slate-500 shadow-inner">
            <Clipboard className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xxs font-bold uppercase tracking-wider">WIP Batches (Mixing)</p>
            <p className="text-2xl font-black text-slate-800 mt-1">
              {loading ? '...' : stats.wip_batches}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-150 flex items-center justify-center text-slate-500 shadow-inner">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xxs font-bold uppercase tracking-wider">Avg OEE Today</p>
            <p className="text-2xl font-black text-orange-500 mt-1">
              {loading ? '...' : stats.oee_today}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500 shadow-inner">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xxs font-bold uppercase tracking-wider">Pending Dispatches</p>
            <p className="text-2xl font-black text-slate-800 mt-1">
              {loading ? '...' : stats.pending_dispatches}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-150 flex items-center justify-center text-slate-500 shadow-inner">
            <BarChart2 className="w-5 h-5" />
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Work Order Progress & Stores */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Active Work Orders progress */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-extrabold text-slate-800 text-sm border-b border-slate-100 pb-2">Active Work Orders Progress</h3>
            
            <div className="space-y-4">
              {stats.active_wos_progress && stats.active_wos_progress.map((wo, i) => {
                const percent = wo.planned_qty > 0 
                  ? Math.min(Math.round((wo.produced_qty / wo.planned_qty) * 100), 100) 
                  : 0;

                return (
                  <div key={i} className="space-y-1.5 text-xs font-semibold">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-extrabold text-slate-800">{wo.wo_number}</span>
                        <span className="text-slate-405 ml-2 font-normal">({wo.item_name})</span>
                      </div>
                      <span className="text-slate-500 font-bold">{percent}% ({wo.produced_qty}/{wo.planned_qty} Pcs)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-orange-500 h-2 rounded-full transition-all duration-500" 
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
              {(!stats.active_wos_progress || stats.active_wos_progress.length === 0) && (
                <p className="text-slate-400 text-xs italic text-center py-4">No active work orders currently scheduled.</p>
              )}
            </div>
          </div>

          {/* Recent Quality Inspections list */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-extrabold text-slate-800 text-sm border-b border-slate-100 pb-2">Recent Quality Inspections (Final QC)</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-xxs font-bold uppercase bg-slate-50/50">
                    <th className="py-2 px-3">FQC Number</th>
                    <th className="py-2 px-3">WO Number</th>
                    <th className="py-2 px-3">Product</th>
                    <th className="py-2 px-3 text-right">Inspected Qty</th>
                    <th className="py-2 px-3 text-center">Result</th>
                    <th className="py-2 px-3">Inspection Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xxs font-semibold text-slate-700">
                  {stats.recent_inspections && stats.recent_inspections.map((qc, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-bold text-slate-800">{qc.fqc_number}</td>
                      <td className="py-2.5 px-3 text-slate-550">{qc.wo_number}</td>
                      <td className="py-2.5 px-3 text-slate-800">{qc.item_name}</td>
                      <td className="py-2.5 px-3 text-right">{parseFloat(qc.inspected_qty).toLocaleString()} Pcs</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black border ${
                          qc.result === 'Approved' ? 'bg-green-50 border-green-200 text-green-700' :
                          qc.result === 'Rejected' ? 'bg-red-50 border-red-200 text-red-700' :
                          'bg-amber-50 border-amber-200 text-amber-700'
                        }`}>
                          {qc.result}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-405">{formatDate(qc.created_at)}</td>
                    </tr>
                  ))}
                  {(!stats.recent_inspections || stats.recent_inspections.length === 0) && (
                    <tr>
                      <td colSpan="6" className="py-6 text-center text-slate-400 italic">No recent inspections done.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Column: Machines status & Store positions */}
        <div className="space-y-6">
          
          {/* Machines list monitor */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-extrabold text-slate-800 text-sm border-b border-slate-100 pb-2 flex items-center gap-2">
              <Cpu className="w-4.5 h-4.5 text-orange-500" /> Machine Status Monitor
            </h3>

            <div className="grid grid-cols-1 gap-2.5">
              {stats.machines && stats.machines.map((mac, i) => (
                <div key={i} className="flex justify-between items-center p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition text-xs font-semibold text-slate-700">
                  <div>
                    <span className="font-bold text-slate-800 block">{mac.machine_name}</span>
                    <span className="text-[10px] text-slate-405 block font-mono">{mac.machine_code} ({mac.machine_type})</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black ${getMachineStatusBadge(mac.status)}`}>
                    {mac.status}
                  </span>
                </div>
              ))}
              {(!stats.machines || stats.machines.length === 0) && (
                <p className="text-slate-400 text-xs italic text-center py-4">No machines loaded in system.</p>
              )}
            </div>
          </div>

          {/* Store Inventory totals */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-extrabold text-slate-800 text-sm border-b border-slate-100 pb-2 flex items-center gap-2">
              <Archive className="w-4.5 h-4.5 text-orange-500" /> Store Stock Balances
            </h3>

            <div className="grid grid-cols-1 gap-2.5">
              {stats.store_inventory && stats.store_inventory.map((store, i) => (
                <div key={i} className="flex justify-between items-center p-3 rounded-lg border border-slate-200 text-xs font-bold">
                  <div>
                    <span className="text-slate-800 block">{store.store_name}</span>
                    <span className="text-[10px] text-slate-455 block font-normal">{store.store_type}</span>
                  </div>
                  <span className="text-slate-700 text-sm font-black">
                    {parseFloat(store.total_qty).toLocaleString()} Pcs
                  </span>
                </div>
              ))}
              {(!stats.store_inventory || stats.store_inventory.length === 0) && (
                <p className="text-slate-400 text-xs italic text-center py-4">No stock inventory tracked.</p>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}