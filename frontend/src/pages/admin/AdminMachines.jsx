import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Cpu, Plus, Edit2, X, RefreshCw } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const getAuthHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function AdminMachines() {
  const navigate = useNavigate();
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState(null);
  const [formData, setFormData] = useState({
    machine_code: '', machine_name: '', machine_type: 'Compression', capacity_tons: 150,
    platen_length: 500, platen_width: 500, daylights: 1, heating_type: 'Electric',
    max_temp: 200, max_pressure: 200, ideal_cycle_time_mins: 5.0, planned_hours_per_shift: 8.0,
    location: 'Shop Floor Bay 1', status: 'Running'
  });

  const fetchMachines = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/admin/machines`, getAuthHeader());
      setMachines(res.data);
    } catch (err) {
      console.error('Failed to load machines:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMachines();
  }, []);

  const handleOpenCreate = () => {
    setEditingMachine(null);
    setFormData({
      machine_code: `HMP-0${machines.length + 1}`, machine_name: '', machine_type: 'Compression', capacity_tons: 150,
      platen_length: 500, platen_width: 500, daylights: 1, heating_type: 'Electric',
      max_temp: 200, max_pressure: 200, ideal_cycle_time_mins: 5.0, planned_hours_per_shift: 8.0,
      location: 'Shop Floor Bay 1', status: 'Running'
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (m) => {
    setEditingMachine(m);
    setFormData({ ...m });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.machine_code || !formData.machine_name) return alert('Code and name required.');

    try {
      if (editingMachine) {
        await axios.put(`${API}/admin/machines/${editingMachine.machine_id}`, formData, getAuthHeader());
      } else {
        await axios.post(`${API}/admin/machines`, formData, getAuthHeader());
      }
      setIsModalOpen(false);
      fetchMachines();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save machine');
    }
  };

  const getStatusDot = (st) => {
    switch (st) {
      case 'Running': return <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block shadow-sm shadow-emerald-400/50"></span>;
      case 'Idle': return <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block shadow-sm shadow-amber-400/50"></span>;
      case 'Maintenance': case 'Under Maintenance': return <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block shadow-sm shadow-orange-500/50"></span>;
      case 'Breakdown': return <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block shadow-sm shadow-red-500/50"></span>;
      default: return <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>;
    }
  };

  return (
    <div className="bg-[#121212] text-slate-200 min-h-screen p-6 font-sans space-y-6">
      
      {/* HEADER */}
      <div className="flex justify-between items-center border-b border-[#2a2a2a] pb-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/admin')}
            className="flex items-center gap-1 bg-[#1e1e1e] hover:bg-[#282828] text-emerald-500 px-3 py-1.5 rounded-lg text-xs font-bold transition border border-[#333]"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Admin
          </button>
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-emerald-500" />
            <div>
              <h1 className="text-lg font-black text-white">Machine Master</h1>
              <p className="text-[10px] text-slate-400">Configure all production machines</p>
            </div>
          </div>
        </div>

        <button 
          onClick={handleOpenCreate}
          className="bg-[#10b981] hover:bg-[#059669] text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/10"
        >
          <Plus className="w-4 h-4" /> New Machine
        </button>
      </div>

      {/* MACHINES TABLE (Matches Page 5) */}
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="flex justify-center py-12"><RefreshCw className="w-8 h-8 animate-spin text-emerald-500" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-semibold border-collapse text-slate-300">
              <thead className="bg-[#161616] text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-[#2a2a2a]">
                <tr>
                  <th className="py-3 px-4">CODE</th>
                  <th className="py-3 px-4">MACHINE NAME</th>
                  <th className="py-3 px-4">TYPE</th>
                  <th className="py-3 px-4">CAPACITY</th>
                  <th className="py-3 px-4">PLATEN SIZE</th>
                  <th className="py-3 px-4">IDEAL CYCLE TIME</th>
                  <th className="py-3 px-4 text-center">STATUS</th>
                  <th className="py-3 px-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {machines.map(m => (
                  <tr key={m.machine_id} className="hover:bg-[#252525]">
                    <td className="py-3 px-4 font-black text-emerald-400">{m.machine_code}</td>
                    <td className="py-3 px-4 font-extrabold text-white">{m.machine_name}</td>
                    <td className="py-3 px-4 text-slate-300">{m.machine_type || 'Compression'}</td>
                    <td className="py-3 px-4 text-slate-400">{m.capacity_tons || 150} Ton</td>
                    <td className="py-3 px-4 text-slate-400">{m.platen_length || 450}×{m.platen_width || 450} mm</td>
                    <td className="py-3 px-4 text-amber-400 font-extrabold">{m.ideal_cycle_time_mins || 5} min</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#121212] border border-[#333] text-white">
                        {getStatusDot(m.status)}
                        {m.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => handleOpenEdit(m)} className="p-1.5 bg-[#121212] hover:bg-[#333] border border-[#333] rounded-md text-emerald-400 transition" title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {machines.length === 0 && (
                  <tr><td colSpan="8" className="py-8 text-center text-slate-500 italic">No machines found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MACHINE FORM MODAL (Matches Page 5) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#1e1e1e] border border-[#333] rounded-2xl p-6 w-full max-w-xl shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#2a2a2a] pb-3">
              <h2 className="text-base font-black text-white">{editingMachine ? 'Edit Machine' : 'Create New Machine'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs font-semibold text-slate-300">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Machine Code *</label>
                  <input type="text" required placeholder="HMP-01" value={formData.machine_code} onChange={(e) => setFormData({ ...formData, machine_code: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-bold" />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Machine Name *</label>
                  <input type="text" required placeholder="Hydraulic Moulding Press 1" value={formData.machine_name} onChange={(e) => setFormData({ ...formData, machine_name: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Machine Type *</label>
                  <select value={formData.machine_type} onChange={(e) => setFormData({ ...formData, machine_type: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-bold">
                    <option value="Compression">Compression</option>
                    <option value="Transfer">Transfer</option>
                    <option value="Injection">Injection</option>
                    <option value="Internal Mixer">Internal Mixer</option>
                    <option value="Open Mill">Open Mill</option>
                    <option value="Kneader">Kneader</option>
                    <option value="Extruder">Extruder</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Capacity (Tons)</label>
                  <input type="number" value={formData.capacity_tons} onChange={(e) => setFormData({ ...formData, capacity_tons: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Platen Length (mm)</label>
                  <input type="number" value={formData.platen_length} onChange={(e) => setFormData({ ...formData, platen_length: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium" />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Platen Width (mm)</label>
                  <input type="number" value={formData.platen_width} onChange={(e) => setFormData({ ...formData, platen_width: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium" />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Daylights</label>
                  <input type="number" value={formData.daylights} onChange={(e) => setFormData({ ...formData, daylights: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-[#161616] p-3 rounded-xl border border-amber-500/30">
                <div>
                  <label className="block mb-1 text-amber-400 text-[11px] font-black">Ideal Cycle Time (minutes) *</label>
                  <input type="number" step="0.1" required value={formData.ideal_cycle_time_mins} onChange={(e) => setFormData({ ...formData, ideal_cycle_time_mins: e.target.value })} className="w-full bg-[#121212] border border-amber-500 rounded-lg p-2 text-white font-extrabold" />
                  <p className="text-[9px] text-slate-400 mt-1">CRITICAL FOR OEE CALCULATION</p>
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Planned Hours / Shift</label>
                  <input type="number" step="0.1" value={formData.planned_hours_per_shift} onChange={(e) => setFormData({ ...formData, planned_hours_per_shift: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Heating Type</label>
                  <select value={formData.heating_type} onChange={(e) => setFormData({ ...formData, heating_type: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-bold">
                    <option value="Electric">Electric</option>
                    <option value="Steam">Steam</option>
                    <option value="Oil">Oil</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Location</label>
                  <input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium" />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-slate-400 text-[11px]">Status *</label>
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-bold">
                  <option value="Running">🟢 Running</option>
                  <option value="Idle">🟡 Idle</option>
                  <option value="Maintenance">🟠 Under Maintenance</option>
                  <option value="Breakdown">🔴 Breakdown</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-[#2a2a2a]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-[#2a2a2a] text-slate-300 rounded-lg hover:bg-[#333] font-bold">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-[#10b981] hover:bg-[#059669] text-white rounded-lg font-black shadow-lg shadow-emerald-500/10">Save Machine</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
