import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Activity, BarChart2, Calendar, Clock, 
  Settings, AlertTriangle, CheckCircle, Info, 
  ChevronRight, RefreshCw, Cpu
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, BarChart, 
  Bar, ComposedChart
} from 'recharts';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const getAuthHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

export default function OEEDashboard() {
  const navigate = useNavigate();
  const [machinesData, setMachinesData] = useState([]);
  const [plantSummary, setPlantSummary] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [paretoData, setParetoData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resDash, resPlant, resTrend, resPareto] = await Promise.all([
        axios.get(`${API}/oee/dashboard`, getAuthHeader()),
        axios.get(`${API}/oee/dashboard/plant`, getAuthHeader()),
        axios.get(`${API}/oee/dashboard/trend`, getAuthHeader()),
        axios.get(`${API}/oee/downtime/pareto`, getAuthHeader())
      ]);

      setMachinesData(resDash.data);
      setPlantSummary(resPlant.data);
      setTrendData(resTrend.data);
      setParetoData(resPareto.data);
    } catch (err) {
      console.error('Error fetching OEE dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (machineId, newStatus) => {
    try {
      await axios.put(`${API}/oee/machine/${machineId}/status`, { status: newStatus }, getAuthHeader());
      // Re-fetch data
      fetchData();
    } catch (err) {
      console.error('Failed to update machine status:', err);
      alert('Error updating machine status');
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const getOeeColor = (score) => {
    if (score >= 85) return 'text-emerald-600';
    if (score >= 65) return 'text-amber-600';
    return 'text-red-650';
  };

  const getOeeBg = (score) => {
    if (score >= 85) return 'border-l-4 border-l-emerald-500';
    if (score >= 65) return 'border-l-4 border-l-amber-500';
    return 'border-l-4 border-l-red-500';
  };

  const getStatusColor = (status) => {
    if (status === 'Running') return 'bg-green-500';
    if (status === 'Idle') return 'bg-amber-500';
    if (status === 'Maintenance' || status === 'Breakdown') return 'bg-red-500';
    return 'bg-slate-400';
  };

  if (loading && !plantSummary) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 text-slate-800">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-10 h-10 animate-spin text-orange-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Loading OEE Dashboard...</span>
        </div>
      </div>
    );
  }

  const shiftComparison = [
    { shift: 'Morning', running: '5 of 6', avgOee: '78.4%', totalParts: '2,450', goodParts: '2,425', rejected: '25', status: 'warning' },
    { shift: 'Evening', running: '4 of 6', avgOee: '71.2%', totalParts: '1,980', goodParts: '1,960', rejected: '20', status: 'warning' },
    { shift: 'Night', running: '3 of 6', avgOee: '65.8%', totalParts: '1,450', goodParts: '1,435', rejected: '15', status: 'danger' }
  ];

  // Generate dynamic live alerts based on machinesData
  const generateLiveAlerts = () => {
    const alerts = [];
    
    machinesData.forEach(m => {
      // 1. Red Alert: OEE critically below 65%
      if (m.oee < 65) {
        alerts.push({
          type: 'red',
          text: `${m.machine_code} OEE is critically low at ${m.oee}% — below the 65% poor operational boundary today.`
        });
      }
      // 2. Amber Alert: Performance below 85%
      else if (m.performance < 85) {
        alerts.push({
          type: 'amber',
          text: `${m.machine_code} Performance at ${m.performance}% — machine is running below standard cycle speed.`
        });
      }
      // 3. Green Alert: OEE above world class 85%
      else if (m.oee >= 85) {
        alerts.push({
          type: 'green',
          text: `${m.machine_code} achieved a world-class OEE of ${m.oee}% today!`
        });
      }
    });

    // 4. Default Notice if no specific alerts
    if (alerts.length === 0) {
      alerts.push({
        type: 'green',
        text: 'All machines are operating within normal parameters. Overall plant OEE is stable.'
      });
    }

    return alerts;
  };

  const activeAlerts = generateLiveAlerts();

  return (
    <div className="bg-[#121212] text-slate-200 min-h-screen p-6 font-sans space-y-6">
      
      {/* 1. PLANT OEE SUMMARY BANNER (Sleek Dark Theme) */}
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest">
            <Activity className="w-4 h-4 text-emerald-400" /> OEE Monitoring Dashboard
          </div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            Plant OEE Summary <span className="text-xs text-slate-400 font-semibold">• Today, {plantSummary?.date}</span>
          </h1>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-6 md:gap-12 flex-1 md:flex-initial text-center md:text-left justify-items-center">
          <div className="space-y-1">
            <span className="text-slate-400 text-[9px] font-bold block uppercase tracking-wider">Plant OEE</span>
            <span className={`text-2xl font-black block ${plantSummary?.plantOee >= 85 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {plantSummary?.plantOee}%
            </span>
            <span className="text-[9px] font-black text-amber-500 uppercase tracking-wide block">
              {plantSummary?.plantOee < 85 ? '⚠️ Below Target' : '✅ World Class'}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 text-[9px] font-bold block uppercase tracking-wider">Availability</span>
            <span className="text-xl font-black text-white block">{plantSummary?.availability}%</span>
            <span className="text-[9px] font-black text-green-400 uppercase tracking-wide block">✅ Good</span>
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 text-[9px] font-bold block uppercase tracking-wider">Performance</span>
            <span className="text-xl font-black text-white block">{plantSummary?.performance}%</span>
            <span className="text-[9px] font-black text-amber-500 uppercase tracking-wide block">⚠️ Improve</span>
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 text-[9px] font-bold block uppercase tracking-wider">Quality</span>
            <span className="text-xl font-black text-white block">{plantSummary?.quality}%</span>
            <span className="text-[9px] font-black text-green-400 uppercase tracking-wide block">✅ Good</span>
          </div>

          <div className="space-y-1 col-span-2 sm:col-span-1">
            <span className="text-slate-400 text-[9px] font-bold block uppercase tracking-wider">Shift</span>
            <span className="text-base font-black text-orange-500 block mt-1 uppercase tracking-wider">
              {plantSummary?.shift}
            </span>
          </div>
        </div>
      </div>

      {/* 2. MACHINE OEE CARDS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        {machinesData.map(m => (
          <div 
            key={m.machine_id}
            className={`bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between space-y-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${getOeeBg(m.oee)}`}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm tracking-wide">{m.machine_code}</h3>
                <span className="text-slate-400 text-[8px] font-bold uppercase tracking-wider">{m.machine_type} Press</span>
              </div>
              <select
                value={m.status}
                onChange={(e) => handleStatusChange(m.machine_id, e.target.value)}
                className={`text-[8px] font-extrabold uppercase bg-slate-50 px-2 py-0.5 rounded-full border border-slate-150 focus:outline-none cursor-pointer ${
                  m.status === 'Running' ? 'text-green-600 border-green-200' :
                  m.status === 'Idle' ? 'text-amber-600 border-amber-250' :
                  'text-red-650 border-red-200'
                }`}
              >
                <option value="Running">🟢 Running</option>
                <option value="Idle">🟡 Idle</option>
                <option value="Maintenance">🔴 Maint</option>
                <option value="Breakdown">🔴 Break</option>
              </select>
            </div>

            <div className="text-center py-2">
              <span className={`text-3xl font-black ${getOeeColor(m.oee)}`}>{m.oee}%</span>
              <span className={`text-[8px] font-black block tracking-widest mt-0.5 ${getOeeColor(m.oee)}`}>
                {m.category}
              </span>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xxs font-bold text-slate-500">
              <div className="flex justify-between items-center">
                <span>Availability</span>
                <span className={m.availability >= 85 ? 'text-emerald-600' : 'text-slate-600'}>{m.availability}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Performance</span>
                <span className={m.performance >= 85 ? 'text-emerald-600' : 'text-amber-600'}>{m.performance}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Quality</span>
                <span className={m.quality >= 95 ? 'text-emerald-600' : 'text-red-600'}>{m.quality}%</span>
              </div>
            </div>

            <button 
              onClick={() => navigate(`/oee/machine/${m.machine_id}`)}
              className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 py-1.5 rounded-lg text-[9px] font-extrabold transition flex items-center justify-center gap-1 border border-slate-200"
            >
              Machine Details <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* BENCHMARK SUB-BAR */}
      <div className="flex items-center justify-center py-1 bg-slate-100 border border-slate-200 rounded-xl text-[9px] text-slate-400 font-extrabold tracking-widest uppercase">
        ─── Target World Class Benchmark: 85% OEE ───
      </div>

      {/* 3. OEE TREND & PARETO CHARTS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* Weekly Trend Line Chart */}
        <div className="bg-white border border-slate-200/85 p-5 rounded-2xl shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <span className="text-[10px] text-slate-900 uppercase tracking-widest font-extrabold block">Weekly OEE Trend (Line Chart)</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} fontWeight="bold" />
                <YAxis domain={[40, 100]} stroke="#94a3b8" fontSize={10} fontWeight="bold" />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', color: '#0f172a', fontSize: '11px' }} />
                <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 'bold' }} />
                
                {/* Benchmark Reference Line */}
                <Line type="monotone" dataKey="Benchmark" stroke="#f43f5e" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={false} />
                
                <Line type="monotone" dataKey="Plant OEE" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="HMP-01" stroke="#22c55e" strokeWidth={1.5} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="HMP-02" stroke="#f59e0b" strokeWidth={1.5} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="HMP-03" stroke="#ef4444" strokeWidth={1.5} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Downtime Pareto Composed Chart */}
        <div className="bg-white border border-slate-200/85 p-5 rounded-2xl shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <span className="text-[10px] text-slate-900 uppercase tracking-widest font-extrabold block">Downtime Pareto Chart (Bar Chart)</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={paretoData} margin={{ top: 10, right: -10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                <XAxis dataKey="reason" stroke="#94a3b8" fontSize={8} fontWeight="bold" />
                <YAxis yAxisId="left" stroke="#94a3b8" fontSize={10} fontWeight="bold" label={{ value: 'Minutes', angle: -90, position: 'insideLeft', style: { fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' } }} />
                <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={10} fontWeight="bold" domain={[0, 100]} unit="%" />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', color: '#0f172a', fontSize: '11px' }} />
                <Bar yAxisId="left" dataKey="minutes" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={25} />
                <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* 4. SHIFT WISE COMPARISON TABLE */}
      <div className="bg-white border border-slate-200/85 p-5 rounded-2xl shadow-sm space-y-4">
        <div className="border-b border-slate-100 pb-2">
          <span className="text-[10px] text-slate-900 uppercase tracking-widest font-extrabold block">Shift-Wise Comparison Table</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xxs font-semibold border-collapse text-slate-500">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 text-[9px] font-black uppercase">
                <th className="pb-3">Shift</th>
                <th className="pb-3">Machines Running</th>
                <th className="pb-3 text-right">Avg OEE</th>
                <th className="pb-3 text-right">Total Parts</th>
                <th className="pb-3 text-right">Good Parts</th>
                <th className="pb-3 text-right">Rejected</th>
                <th className="pb-3 text-center">OEE Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shiftComparison.map((sc, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="py-3.5 text-slate-900 font-extrabold uppercase tracking-wider">{sc.shift}</td>
                  <td className="py-3.5 text-slate-700">{sc.running}</td>
                  <td className="py-3.5 text-right text-slate-900 font-bold">{sc.avgOee}</td>
                  <td className="py-3.5 text-right text-slate-650">{sc.totalParts}</td>
                  <td className="py-3.5 text-right text-slate-700">{sc.goodParts}</td>
                  <td className="py-3.5 text-right text-red-500">{sc.rejected}</td>
                  <td className="py-3.5 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                      sc.status === 'success' ? 'bg-green-500/10 text-green-600 border border-green-500/20' : 
                      sc.status === 'warning' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' : 
                      'bg-red-500/10 text-red-650 border border-red-500/20'
                    }`}>
                      {sc.status === 'success' ? '✅ Good' : sc.status === 'warning' ? '🟡 Avg' : '⚠️ Poor'}
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50/80 border-t-2 border-slate-200 font-bold text-slate-900">
                <td className="py-3.5 uppercase">Total Today</td>
                <td className="py-3.5">—</td>
                <td className="py-3.5 text-right text-amber-600 font-bold">71.8%</td>
                <td className="py-3.5 text-right text-slate-700">5,880</td>
                <td className="py-3.5 text-right text-slate-700">5,820</td>
                <td className="py-3.5 text-right text-red-650">60</td>
                <td className="py-3.5 text-center">
                  <span className="bg-amber-500/10 text-amber-600 border border-amber-500/20 px-2 py-0.5 rounded-full text-[9px] font-black uppercase">
                    🟡 Average
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. LIVE ALERTS SECTION */}
      <div className="bg-white border border-slate-200/85 p-5 rounded-2xl shadow-sm space-y-3">
        <div className="border-b border-slate-100 pb-2 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          <span className="text-[10px] text-slate-900 uppercase tracking-widest font-extrabold block">Live OEE Alerts</span>
        </div>

        <div className="space-y-2.5 text-xxs font-bold">
          {activeAlerts.map((alert, idx) => (
            <div 
              key={idx} 
              className={`flex items-center gap-2 p-3 border rounded-xl ${
                alert.type === 'red' ? 'text-red-750 bg-red-50 border-red-100' :
                alert.type === 'amber' ? 'text-amber-700 bg-amber-50 border-amber-100' :
                'text-emerald-700 bg-emerald-50 border-emerald-100'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full block ${
                alert.type === 'red' ? 'bg-red-500' :
                alert.type === 'amber' ? 'bg-amber-500' :
                'bg-green-500'
              }`}></span>
              <span>{alert.text}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
