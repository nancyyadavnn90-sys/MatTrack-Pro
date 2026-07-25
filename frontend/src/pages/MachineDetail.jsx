import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  ArrowLeft, Cpu, Settings, Calendar, 
  Clock, Activity, AlertTriangle, CheckCircle, RefreshCw
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const getAuthHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

export default function MachineDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [metadata, setMetadata] = useState(null);
  const [shiftHistory, setShiftHistory] = useState([]);
  const [downtimeHistory, setDowntimeHistory] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMachineDetails = async () => {
      try {
        setLoading(true);
        const [resDetails, resTrend] = await Promise.all([
          axios.get(`${API}/oee/machine/${id}`, getAuthHeader()),
          axios.get(`${API}/oee/machine/${id}/trend`, getAuthHeader())
        ]);

        setMetadata(resDetails.data.metadata);
        setShiftHistory(resDetails.data.shiftHistory);
        setDowntimeHistory(resDetails.data.downtimeHistory);
        setTrendData(resTrend.data);
      } catch (err) {
        console.error('Failed to load machine detail:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMachineDetails();
  }, [id]);

  const getOeeColor = (score) => {
    if (score >= 85) return 'text-emerald-600';
    if (score >= 65) return 'text-amber-600';
    return 'text-red-650';
  };

  const getOeeBg = (score) => {
    if (score >= 85) return 'bg-emerald-50 border-emerald-100 text-emerald-800';
    if (score >= 65) return 'bg-amber-55 border-amber-100 text-amber-800';
    return 'bg-red-50 border-red-100 text-red-800';
  };

  if (loading && !metadata) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 text-slate-800">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-10 h-10 animate-spin text-orange-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Loading Machine Details...</span>
        </div>
      </div>
    );
  }

  const todayOee = shiftHistory.length > 0 ? Number(shiftHistory[0].oee_score) : 71;
  const todayAvail = shiftHistory.length > 0 ? Number(shiftHistory[0].availability) : 85;
  const todayPerf = shiftHistory.length > 0 ? Number(shiftHistory[0].performance) : 84;
  const todayQual = shiftHistory.length > 0 ? Number(shiftHistory[0].quality) : 99;

  const mouldsRun = [
    { mouldCode: 'MLD/03', product: 'Engine Grommet', shots: '4,500 shots', lastUsed: 'Today' },
    { mouldCode: 'MLD/07', product: 'Oil Seal B', shots: '2,800 shots', lastUsed: 'Yesterday' }
  ];

  return (
    <div className="bg-slate-50/50 text-slate-800 min-h-screen p-6 font-sans space-y-6">
      
      {/* HEADER NAVIGATION */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/oee')}
          className="bg-white hover:bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 transition shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="space-y-1">
          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest block font-sans">Machine Performance Card</span>
          <h1 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-orange-500" /> {metadata.machine_code} — {metadata.machine_name}
          </h1>
        </div>
      </div>

      {/* METADATA INFO BANNER */}
      <div className="bg-white border border-slate-200 p-5 rounded-2xl grid grid-cols-2 md:grid-cols-4 gap-6 text-xs font-semibold text-slate-500 shadow-sm">
        <div>
          <span className="text-slate-400 text-xxs block">Platen Size</span>
          <span className="text-slate-900 font-extrabold block mt-0.5">
            {metadata.platen_length || 500} × {metadata.platen_width || 500} mm
          </span>
        </div>
        <div>
          <span className="text-slate-400 text-xxs block">Press Capacity</span>
          <span className="text-slate-900 font-extrabold block mt-0.5">
            {metadata.capacity_tons || 150} Ton
          </span>
        </div>
        <div>
          <span className="text-slate-400 text-xxs block">Ideal Cycle Time</span>
          <span className="text-slate-900 font-extrabold block mt-0.5">
            {Math.round(metadata.ideal_cycle_time / 60) || 4} min per shot
          </span>
        </div>
        <div>
          <span className="text-slate-400 text-xxs block">Operational Status</span>
          <span className="text-emerald-600 font-extrabold block mt-0.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 block"></span> Running
          </span>
        </div>
      </div>

      {/* TODAY'S OEE BREAKDOWN CARD */}
      <div className={`border p-6 rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-6 shadow-sm ${getOeeBg(todayOee)}`}>
        <div className="space-y-1 text-center sm:text-left">
          <span className="text-slate-500 text-xxs block">Today's OEE</span>
          <span className="text-3xl font-black text-slate-900 block">{todayOee}%</span>
          <span className={`text-[9px] font-black uppercase tracking-wide block ${getOeeColor(todayOee)}`}>
            {todayOee >= 85 ? '🟢 Good' : todayOee >= 65 ? '🟡 Average' : '🔴 Poor'}
          </span>
        </div>

        <div className="space-y-1 text-center sm:text-left">
          <span className="text-slate-500 text-xxs block">Availability</span>
          <span className="text-2xl font-black text-slate-900 block">{todayAvail}%</span>
          <span className="text-[9px] font-black text-green-600 uppercase tracking-wide block">✅ Good</span>
        </div>

        <div className="space-y-1 text-center sm:text-left">
          <span className="text-slate-500 text-xxs block">Performance</span>
          <span className="text-2xl font-black text-slate-900 block">{todayPerf}%</span>
          <span className="text-[9px] font-black text-amber-600 uppercase tracking-wide block">⚠️ Improve</span>
        </div>

        <div className="space-y-1 text-center sm:text-left">
          <span className="text-slate-500 text-xxs block">Quality</span>
          <span className="text-2xl font-black text-slate-900 block">{todayQual}%</span>
          <span className="text-[9px] font-black text-green-600 uppercase tracking-wide block">✅ Good</span>
        </div>
      </div>

      {/* CHARTS & MOULDS ROW */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* 7-Day Line Chart */}
        <div className="xl:col-span-2 bg-white border border-slate-200/85 p-5 rounded-2xl shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-extrabold block">7-Day OEE Trend</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} fontWeight="bold" />
                <YAxis domain={[40, 100]} stroke="#94a3b8" fontSize={10} fontWeight="bold" />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', color: '#0f172a', fontSize: '11px' }} />
                <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 'bold' }} />
                <Line type="monotone" dataKey="Benchmark" stroke="#f43f5e" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={false} />
                <Line type="monotone" dataKey="oee" name="OEE Score" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Moulds Compatibility registry */}
        <div className="bg-white border border-slate-200/85 p-5 rounded-2xl shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-extrabold block">Moulds run on this machine</span>
          </div>
          
          <div className="space-y-3">
            {mouldsRun.map((m, idx) => (
              <div key={idx} className="bg-slate-50 border border-slate-150 p-4 rounded-xl space-y-2 text-xxs font-bold text-slate-500">
                <div className="flex justify-between items-center">
                  <span className="text-slate-900 text-xs font-black">{m.mouldCode}</span>
                  <span className="bg-white border border-slate-200 text-[8px] text-orange-600 font-extrabold uppercase px-2 py-0.5 rounded-full">
                    {m.lastUsed}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Product Part:</span>
                  <span className="text-slate-700">{m.product}</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-slate-200/60">
                  <span>Shots This Month:</span>
                  <span className="text-slate-900 font-extrabold">{m.shots}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* HISTORY TABLES */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* Downtime History Table */}
        <div className="bg-white border border-slate-200/85 p-5 rounded-2xl shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-extrabold block">Downtime Logs History</span>
            <button 
              onClick={() => navigate('/oee/shift-log')}
              className="text-[9px] font-black text-orange-500 hover:text-orange-600 uppercase tracking-wider transition"
            >
              View Full History →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xxs font-semibold border-collapse text-slate-500">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-[9px] font-black uppercase">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Shift</th>
                  <th className="pb-2">Downtime Reason</th>
                  <th className="pb-2 text-right">Duration</th>
                  <th className="pb-2">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {downtimeHistory.map((d, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2.5 font-bold text-slate-900">
                      {new Date(d.log_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="py-2.5 uppercase tracking-wider text-[9px] font-black text-slate-600">{d.shift}</td>
                    <td className="py-2.5 text-amber-600 font-bold">{d.reason_category}</td>
                    <td className="py-2.5 text-right font-black text-slate-900">{d.duration_minutes} min</td>
                    <td className="py-2.5 text-slate-450 max-w-[120px] truncate">{d.reason_details || 'N/A'}</td>
                  </tr>
                ))}
                {downtimeHistory.length === 0 && (
                  <tr>
                    <td colSpan="5" className="py-4 text-center text-slate-450 italic">No downtime history logged.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Shift Logs History Table */}
        <div className="bg-white border border-slate-200/85 p-5 rounded-2xl shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-extrabold block">Shift Logs History</span>
            <button 
              onClick={() => navigate('/oee/shift-log')}
              className="text-[9px] font-black text-orange-500 hover:text-orange-600 uppercase tracking-wider transition"
            >
              View Full History →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xxs font-semibold border-collapse text-slate-500">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-[9px] font-black uppercase">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Shift</th>
                  <th className="pb-2 text-right">Planned</th>
                  <th className="pb-2 text-right">Downtime</th>
                  <th className="pb-2 text-right">Good Parts</th>
                  <th className="pb-2 text-center">OEE Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shiftHistory.map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2.5 font-bold text-slate-900">
                      {new Date(s.log_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="py-2.5 uppercase tracking-wider text-[9px] font-black text-slate-600">{s.shift}</td>
                    <td className="py-2.5 text-right">{s.planned_time} min</td>
                    <td className="py-2.5 text-right text-red-650">{s.downtime || 0} min</td>
                    <td className="py-2.5 text-right">{s.good_parts?.toLocaleString()}</td>
                    <td className="py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black ${getRatingBadge(s.oee_score)}`}>
                        {s.oee_score}%
                      </span>
                    </td>
                  </tr>
                ))}
                {shiftHistory.length === 0 && (
                  <tr>
                    <td colSpan="6" className="py-4 text-center text-slate-450 italic">No shift log history found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}

const getRatingBadge = (score) => {
  if (score >= 85) return 'bg-emerald-50 text-emerald-600 border-emerald-100';
  if (score >= 65) return 'bg-amber-50 text-amber-600 border-amber-100';
  return 'bg-red-50 text-red-600 border-red-100';
};
