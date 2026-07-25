import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Plus, X, Clock, Calendar, Cpu, User, 
  Trash2, AlertCircle, CheckCircle, Info, RefreshCw
} from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const getAuthHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

const fallbackMachines = [
  { machine_id: 9, machine_code: 'HMP-01', machine_name: 'Hydraulic Moulding Press 1', ideal_cycle_time: 180 },
  { machine_id: 10, machine_code: 'HMP-02', machine_name: 'Hydraulic Moulding Press 2', ideal_cycle_time: 240 },
  { machine_id: 11, machine_code: 'HMP-03', machine_name: 'Hydraulic Moulding Press 3', ideal_cycle_time: 300 },
  { machine_id: 12, machine_code: 'HMP-04', machine_name: 'Hydraulic Moulding Press 4', ideal_cycle_time: 180 },
  { machine_id: 13, machine_code: 'TMP-01', machine_name: 'Transfer Moulding Press 1', ideal_cycle_time: 240 },
  { machine_id: 14, machine_code: 'INJ-01', machine_name: 'Injection Moulding Machine 1', ideal_cycle_time: 300 }
];

const fallbackOperators = [
  { user_id: 1, name: 'Admin', role: 'Admin' },
  { user_id: 3, name: 'Khushi Saini', role: 'Operator' },
  { user_id: 7, name: 'Amit Sharma', role: 'Operator' },
  { user_id: 8, name: 'Rohan Verma', role: 'Operator' },
  { user_id: 9, name: 'Sanjay Dutt', role: 'Operator' },
  { user_id: 10, name: 'Vikram Rathore', role: 'Operator' }
];

export default function ShiftLog() {
  const [logs, setLogs] = useState([]);
  const [machines, setMachines] = useState(fallbackMachines);
  const [operators, setOperators] = useState(fallbackOperators);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [selectedMachineId, setSelectedMachineId] = useState('9');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState('Morning');
  const [plannedTime, setPlannedTime] = useState(480);
  const [operatorId, setOperatorId] = useState('1');
  const [totalParts, setTotalParts] = useState('');
  const [goodParts, setGoodParts] = useState('');
  const [idealCycleTime, setIdealCycleTime] = useState(180);
  
  // Downtime Rows State
  const [downtimeEntries, setDowntimeEntries] = useState([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resLogs, resMachines, resOperators] = await Promise.all([
        axios.get(`${API}/oee/shift-logs`, getAuthHeader()),
        axios.get(`${API}/oee/machines`, getAuthHeader()),
        axios.get(`${API}/oee/operators`, getAuthHeader())
      ]);
      setLogs(resLogs.data);
      if (resMachines.data && resMachines.data.length > 0) {
        setMachines(resMachines.data);
        setSelectedMachineId(resMachines.data[0].machine_id);
      }
      if (resOperators.data && resOperators.data.length > 0) {
        setOperators(resOperators.data);
        setOperatorId(resOperators.data[0].user_id);
      }
    } catch (err) {
      console.error('Error loading shift logs data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedMachineId) {
      const match = machines.find(m => String(m.machine_id) === String(selectedMachineId));
      if (match) {
        let cycleSec = 60;
        if (match.machine_code === 'HMP-01') cycleSec = 180;
        if (match.machine_code === 'HMP-02') cycleSec = 240;
        if (match.machine_code === 'HMP-03') cycleSec = 300;
        if (match.machine_code === 'HMP-04') cycleSec = 180;
        if (match.machine_code === 'TMP-01') cycleSec = 240;
        if (match.machine_code === 'INJ-01') cycleSec = 300;
        setIdealCycleTime(cycleSec);
      }
    }
  }, [selectedMachineId, machines]);

  const totalDowntimeMin = downtimeEntries.reduce((sum, entry) => sum + (Number(entry.duration_minutes) || 0), 0);
  const availableTimeMin = Math.max(0, plannedTime - totalDowntimeMin);
  const total = Number(totalParts) || 0;
  const good = Number(goodParts) || 0;
  
  const availabilityPercent = plannedTime > 0 ? (availableTimeMin / plannedTime) * 100 : 0;
  const idealOutput = idealCycleTime > 0 ? (availableTimeMin * 60) / idealCycleTime : 0;
  
  let performancePercent = 0;
  if (availableTimeMin > 0 && idealOutput > 0) {
    performancePercent = (total / idealOutput) * 100;
  }
  performancePercent = Math.min(performancePercent, 100);

  const qualityPercent = total > 0 ? (good / total) * 100 : 100;
  let oeeScore = (availabilityPercent / 100) * (performancePercent / 100) * (qualityPercent / 100) * 100;
  oeeScore = Math.min(oeeScore, 100);

  const handleAddDowntimeRow = () => {
    setDowntimeEntries([
      ...downtimeEntries,
      { reason_category: 'Machine Breakdown', reason_details: '', start_time: '09:00', end_time: '10:00', duration_minutes: 60 }
    ]);
  };

  const handleRemoveDowntimeRow = (idx) => {
    setDowntimeEntries(downtimeEntries.filter((_, i) => i !== idx));
  };

  const handleDowntimeChange = (idx, field, value) => {
    const updated = [...downtimeEntries];
    updated[idx][field] = value;

    if (field === 'start_time' || field === 'end_time') {
      const start = updated[idx].start_time;
      const end = updated[idx].end_time;
      if (start && end) {
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        let diffMin = (eh * 60 + em) - (sh * 60 + sm);
        if (diffMin < 0) diffMin += 1440;
        updated[idx].duration_minutes = diffMin;
      }
    }
    setDowntimeEntries(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMachineId || totalParts === '' || goodParts === '') {
      alert('Please fill out all production quantity details.');
      return;
    }

    try {
      const payload = {
        machine_id: Number(selectedMachineId),
        log_date: logDate,
        shift,
        planned_time: Number(plannedTime),
        downtime: totalDowntimeMin,
        total_parts: Number(totalParts),
        good_parts: Number(goodParts),
        userId: Number(operatorId),
        downtime_entries: downtimeEntries
      };

      await axios.post(`${API}/oee/shift-logs`, payload, getAuthHeader());
      setIsModalOpen(false);
      
      setTotalParts('');
      setGoodParts('');
      setDowntimeEntries([]);
      
      fetchData();
    } catch (err) {
      console.error('Failed to submit shift log:', err);
      alert('Error saving shift log.');
    }
  };

  const getOeeColor = (score) => {
    if (score >= 85) return 'text-emerald-600';
    if (score >= 65) return 'text-amber-600';
    return 'text-red-650';
  };

  const getRatingBadge = (score) => {
    if (score >= 85) return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (score >= 65) return 'bg-amber-50 text-amber-600 border-amber-100';
    return 'bg-red-50 text-red-600 border-red-100';
  };

  return (
    <div className="bg-[#121212] text-slate-200 min-h-screen p-6 font-sans space-y-6">
      
      {/* HEADER SECTION */}
      <div className="flex justify-between items-center bg-[#1e1e1e] p-4 border border-[#2a2a2a] rounded-xl shadow-md flex-wrap gap-2">
        <div className="space-y-1">
          <h1 className="text-lg font-black text-white">Shift Production Logs</h1>
          <p className="text-slate-400 text-xs font-medium">
            Record end of shift production data and analyze OEE scores
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-[#10b981] hover:bg-[#059669] text-white px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md"
        >
          <Plus className="w-4 h-4" /> New Shift Log
        </button>
      </div>

      {/* SHIFT LOGS TABLE LIST */}
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-4 shadow-lg space-y-4">
        <div className="border-b border-[#2a2a2a] pb-3">
          <span className="text-xs text-white uppercase tracking-wider font-black block">Shift Logs History</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><RefreshCw className="w-6 h-6 animate-spin text-emerald-400" /></div>
        ) : (
          <div className="overflow-x-auto border border-[#2a2a2a] rounded-xl">
            <table className="w-full text-left text-xs font-semibold border-collapse text-slate-200">
              <thead>
                <tr className="border-b border-[#333] text-slate-200 text-xs font-black uppercase bg-[#252525]">
                  <th className="py-3 px-4">Machine</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Shift</th>
                  <th className="py-3 px-4 text-right">Planned Time</th>
                  <th className="py-3 px-4 text-right text-red-400">Downtime</th>
                  <th className="py-3 px-4 text-right">Total Parts</th>
                  <th className="py-3 px-4 text-right text-emerald-400">Good Parts</th>
                  <th className="py-3 px-4 text-right text-red-400">Rejects</th>
                  <th className="py-3 px-4 text-center">OEE Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {logs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-[#252525] border-b border-[#2a2a2a] transition">
                    <td className="py-3.5 px-4 text-white font-black text-xs">{log.machine_code}</td>
                    <td className="py-3.5 px-4 text-slate-300 font-mono text-xs">{new Date(log.log_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                    <td className="py-3.5 px-4 uppercase tracking-wider text-xs font-extrabold text-amber-400">{log.shift}</td>
                    <td className="py-3.5 px-4 text-right text-slate-300 font-mono text-xs">{log.planned_time} min</td>
                    <td className="py-3.5 px-4 text-right text-red-400 font-bold text-xs">{log.downtime || 0} min</td>
                    <td className="py-3.5 px-4 text-right text-white font-extrabold text-xs">{log.total_parts?.toLocaleString()}</td>
                    <td className="py-3.5 px-4 text-right text-emerald-400 font-black text-xs">{log.good_parts?.toLocaleString()}</td>
                    <td className="py-3.5 px-4 text-right text-red-400 font-bold text-xs">{log.rejected_parts || 0}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full border text-xs font-black ${
                        log.oee_score >= 85 ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
                        log.oee_score >= 65 ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' :
                        'bg-red-500/10 text-red-300 border-red-500/30'
                      }`}>
                        {log.oee_score}%
                      </span>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan="9" className="py-8 text-center text-slate-450 italic">No shift logs found. Click "New Shift Log" to add one!</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FORM MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-4xl w-full shadow-2xl p-6 flex flex-col lg:flex-row gap-6 max-h-[90vh] overflow-y-auto">
            
            {/* LEFT COLUMN FORM */}
            <form onSubmit={handleSubmit} className="flex-1 space-y-6 text-slate-600 text-xs font-semibold">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div>
                  <h2 className="font-extrabold text-slate-900 text-base">New Shift Log Entry</h2>
                  <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mt-0.5">Enter shift details & downtime events</p>
                </div>
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-450 hover:text-slate-900"><X className="w-5 h-5" /></button>
              </div>

              {/* SECTION 1 */}
              <div className="space-y-4">
                <span className="text-[10px] text-orange-500 font-extrabold uppercase tracking-wider block">Section 1: Shift Details</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-slate-500 block mb-1">Select Machine</label>
                    <select
                      value={selectedMachineId}
                      onChange={(e) => setSelectedMachineId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 text-slate-950 font-bold"
                    >
                      {machines.map(m => (
                        <option key={m.machine_id} value={m.machine_id}>{m.machine_code} - {m.machine_name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-500 block mb-1">Shift Date</label>
                    <input
                      type="date"
                      value={logDate}
                      onChange={(e) => setLogDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 text-slate-950"
                    />
                  </div>

                  <div>
                    <label className="text-slate-500 block mb-1">Shift</label>
                    <select
                      value={shift}
                      onChange={(e) => setShift(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 text-slate-950 font-bold"
                    >
                      <option value="Morning">Morning Shift</option>
                      <option value="Evening">Evening Shift</option>
                      <option value="Night">Night Shift</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-500 block mb-1">Planned Production Time (Minutes)</label>
                    <input
                      type="number"
                      value={plannedTime}
                      onChange={(e) => setPlannedTime(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 text-slate-950 font-bold"
                      placeholder="e.g. 480"
                    />
                  </div>

                  <div>
                    <label className="text-slate-500 block mb-1">Operator Name / ID</label>
                    <select
                      value={operatorId}
                      onChange={(e) => setOperatorId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 text-slate-950 font-bold"
                    >
                      {operators.map(op => (
                        <option key={op.user_id} value={op.user_id}>{op.name} ({op.role})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 2 */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-orange-500 font-extrabold uppercase tracking-wider">Section 2: Downtime Log Entries</span>
                  <button 
                    type="button"
                    onClick={handleAddDowntimeRow}
                    className="text-orange-655 hover:text-orange-600 text-xxs font-black flex items-center gap-1 border border-orange-500/20 px-2.5 py-1 rounded-lg bg-orange-50/50 hover:bg-orange-50"
                  >
                    + Add Downtime Row
                  </button>
                </div>

                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {downtimeEntries.map((entry, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-slate-50/60 border border-slate-150 p-2.5 rounded-xl">
                      <div className="sm:col-span-3">
                        <select
                          value={entry.reason_category}
                          onChange={(e) => handleDowntimeChange(idx, 'reason_category', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg text-xxs p-1 text-slate-950 font-semibold"
                        >
                          <option value="Machine Breakdown">Machine Breakdown</option>
                          <option value="Planned Maintenance">Planned Maintenance</option>
                          <option value="Mold Changeover">Mould Changeover</option>
                          <option value="No Raw Material">No Material</option>
                          <option value="Power Failure">Power Failure</option>
                          <option value="Other">Other Category</option>
                        </select>
                      </div>
                      
                      <div className="sm:col-span-4">
                        <input
                          type="text"
                          value={entry.reason_details}
                          onChange={(e) => handleDowntimeChange(idx, 'reason_details', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg text-xxs p-1 text-slate-950 placeholder-slate-400"
                          placeholder="e.g. Pump leak details"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <input
                          type="time"
                          value={entry.start_time}
                          onChange={(e) => handleDowntimeChange(idx, 'start_time', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg text-xxs p-1 text-slate-950"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <input
                          type="time"
                          value={entry.end_time}
                          onChange={(e) => handleDowntimeChange(idx, 'end_time', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg text-xxs p-1 text-slate-950"
                        />
                      </div>

                      <button 
                        type="button"
                        onClick={() => handleRemoveDowntimeRow(idx)}
                        className="sm:col-span-1 text-red-500 hover:text-red-600 p-1 flex justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {downtimeEntries.length === 0 && (
                    <div className="text-center text-slate-400 py-3 italic bg-slate-50/20 border border-slate-150 rounded-xl">
                      No downtime events logged this shift. Click "+ Add Downtime Row" if any stopped time occurred.
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 3 */}
              <div className="space-y-4 pt-3 border-t border-slate-100">
                <span className="text-[10px] text-orange-500 font-extrabold uppercase tracking-wider block">Section 3: Production Quantities</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-slate-500 block mb-1">Total Parts Produced</label>
                    <input
                      type="number"
                      value={totalParts}
                      onChange={(e) => setTotalParts(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 text-slate-950 font-bold"
                      placeholder="e.g. 480"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-slate-500 block mb-1">Good Parts (Ok Parts)</label>
                    <input
                      type="number"
                      value={goodParts}
                      onChange={(e) => setGoodParts(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 text-slate-950 font-bold"
                      placeholder="e.g. 475"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-slate-500 block mb-1">Ideal Cycle Time (Seconds)</label>
                    <input
                      type="number"
                      value={idealCycleTime}
                      onChange={(e) => setIdealCycleTime(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 text-slate-950 font-bold"
                      placeholder="e.g. 60"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-white hover:bg-slate-50 border border-slate-200 px-5 py-2 rounded-xl font-bold transition text-slate-650"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-xl font-black transition shadow-md shadow-orange-500/10"
                >
                  Save Shift Log
                </button>
              </div>
            </form>

            {/* RIGHT COLUMN: LIVE OEE PREVIEW CARD */}
            <div className="w-full lg:w-[320px] bg-slate-50 border border-slate-200 p-5 rounded-2xl flex flex-col justify-between space-y-4 shadow-inner">
              <div className="border-b border-slate-200 pb-2">
                <h3 className="text-xxs uppercase tracking-widest font-black text-slate-450">Live OEE Calculation Preview</h3>
              </div>

              <div className="space-y-4 text-xxs font-bold text-slate-500">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Planned Time:</span>
                    <span className="text-slate-900 font-extrabold">{plannedTime} min</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Downtime:</span>
                    <span className="text-red-600 font-extrabold">{totalDowntimeMin} min</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200">
                    <span className="text-slate-600">Available Time:</span>
                    <span className="text-slate-900 font-black">{availableTimeMin} min</span>
                  </div>
                </div>

                {/* A Breakdown */}
                <div className="bg-white border border-slate-150 p-2.5 rounded-xl flex items-center justify-between shadow-xs">
                  <div>
                    <span className="text-slate-400 text-[8px] uppercase tracking-wider block font-sans">Availability</span>
                    <span className="text-xs text-slate-900 font-black block mt-0.5">
                      {availabilityPercent.toFixed(1)}%
                    </span>
                  </div>
                  {availabilityPercent >= 85 ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-amber-500" />}
                </div>

                {/* P Breakdown */}
                <div className="bg-white border border-slate-150 p-2.5 rounded-xl flex items-center justify-between shadow-xs">
                  <div>
                    <span className="text-slate-400 text-[8px] uppercase tracking-wider block font-sans">Performance</span>
                    <span className="text-xs text-slate-900 font-black block mt-0.5">
                      {performancePercent.toFixed(1)}%
                    </span>
                    <span className="text-[8px] text-slate-400 block mt-0.5">
                      Ideal Output: {Math.round(idealOutput)} parts
                    </span>
                  </div>
                  {performancePercent >= 85 ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-amber-500" />}
                </div>

                {/* Q Breakdown */}
                <div className="bg-white border border-slate-150 p-2.5 rounded-xl flex items-center justify-between shadow-xs">
                  <div>
                    <span className="text-slate-400 text-[8px] uppercase tracking-wider block font-sans">Quality</span>
                    <span className="text-xs text-slate-900 font-black block mt-0.5">
                      {qualityPercent.toFixed(1)}%
                    </span>
                    <span className="text-[8px] text-slate-400 block mt-0.5">
                      Rejections: {Math.max(0, total - good)} parts
                    </span>
                  </div>
                  {qualityPercent >= 95 ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-650" />}
                </div>
              </div>

              {/* Final OEE Score Preview */}
              <div className={`p-4 border rounded-xl text-center space-y-1 ${
                oeeScore >= 85 ? 'bg-emerald-50 border-emerald-100' :
                oeeScore >= 65 ? 'bg-amber-50 border-amber-100' :
                'bg-red-50 border-red-100'
              }`}>
                <span className="text-[9px] uppercase tracking-widest font-black text-slate-500 block">Calculated OEE</span>
                <span className={`text-3xl font-black block ${getOeeColor(oeeScore)}`}>
                  {oeeScore ? oeeScore.toFixed(1) : '0.0'}%
                </span>
                <span className={`text-[8px] font-black uppercase tracking-wider mt-0.5 block ${getOeeColor(oeeScore)}`}>
                  {oeeScore >= 85 ? '🟢 World Class' : oeeScore >= 65 ? '🟡 Average' : '🔴 Poor'}
                </span>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
