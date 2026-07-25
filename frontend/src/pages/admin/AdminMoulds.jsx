import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Component, Plus, Edit2, X, RefreshCw, AlertTriangle } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const getAuthHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function AdminMoulds() {
  const navigate = useNavigate();
  const [moulds, setMoulds] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMould, setEditingMould] = useState(null);
  const [formData, setFormData] = useState({
    mould_code: '', mould_name: '', product_name: '', mould_type: 'Compression', cavities: 4,
    total_shots_allowed: 500000, current_shots_used: 0, mould_material: 'P20 Steel', weight_kg: 150,
    platen_length: 450, platen_width: 450, height_mm: 250, compatible_machines: 'HMP-01, HMP-02',
    maintenance_threshold: 480000, status: 'Available'
  });

  const fetchMoulds = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/admin/moulds`, getAuthHeader());
      setMoulds(res.data);
    } catch (err) {
      console.error('Failed to load moulds:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMoulds();
  }, []);

  const handleOpenCreate = () => {
    setEditingMould(null);
    setFormData({
      mould_code: `MLD-0${moulds.length + 1}`, mould_name: '', product_name: 'Engine Grommet Type A', mould_type: 'Compression', cavities: 4,
      total_shots_allowed: 500000, current_shots_used: 0, mould_material: 'P20 Steel', weight_kg: 150,
      platen_length: 450, platen_width: 450, height_mm: 250, compatible_machines: 'HMP-01, HMP-02',
      maintenance_threshold: 480000, status: 'Available'
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (m) => {
    setEditingMould(m);
    setFormData({ ...m });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.mould_code || !formData.mould_name) return alert('Mould code and name are required.');

    try {
      if (editingMould) {
        await axios.put(`${API}/admin/moulds/${editingMould.mould_id}`, formData, getAuthHeader());
      } else {
        await axios.post(`${API}/admin/moulds`, formData, getAuthHeader());
      }
      setIsModalOpen(false);
      fetchMoulds();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save mould');
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
            <Component className="w-5 h-5 text-emerald-500" />
            <h1 className="text-lg font-black text-white">Mould / Tool Master</h1>
          </div>
        </div>

        <button 
          onClick={handleOpenCreate}
          className="bg-[#10b981] hover:bg-[#059669] text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/10"
        >
          <Plus className="w-4 h-4" /> New Mould
        </button>
      </div>

      {/* MOULDS TABLE (Matches Page 7) */}
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="flex justify-center py-12"><RefreshCw className="w-8 h-8 animate-spin text-emerald-500" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-semibold border-collapse text-slate-300">
              <thead className="bg-[#161616] text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-[#2a2a2a]">
                <tr>
                  <th className="py-3 px-4">CODE</th>
                  <th className="py-3 px-4">MOULD NAME</th>
                  <th className="py-3 px-4">PRODUCT</th>
                  <th className="py-3 px-4">TYPE</th>
                  <th className="py-3 px-4">CAVITIES</th>
                  <th className="py-3 px-4">SHOTS USED / ALLOWED</th>
                  <th className="py-3 px-4 text-center">MAINTENANCE DUE</th>
                  <th className="py-3 px-4 text-center">STATUS</th>
                  <th className="py-3 px-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {moulds.map(m => {
                  const isMaintenanceDue = m.current_shots_used >= (m.maintenance_threshold || 480000);

                  return (
                    <tr key={m.mould_id} className="hover:bg-[#252525]">
                      <td className="py-3 px-4 font-black text-emerald-400">{m.mould_code}</td>
                      <td className="py-3 px-4 font-extrabold text-white">{m.mould_name}</td>
                      <td className="py-3 px-4 text-slate-300">{m.product_name || '—'}</td>
                      <td className="py-3 px-4 text-slate-400">{m.mould_type || 'Compression'}</td>
                      <td className="py-3 px-4 text-slate-200 font-extrabold">{m.cavities || 4}</td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <span className="text-[11px] font-extrabold text-white">
                            {m.current_shots_used?.toLocaleString()} / {m.total_shots_allowed?.toLocaleString()}
                          </span>
                          <div className="w-32 bg-[#121212] rounded-full h-1.5 overflow-hidden border border-[#333]">
                            <div 
                              className={`h-full ${isMaintenanceDue ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                              style={{ width: `${Math.min(100, ((m.current_shots_used || 0) / (m.total_shots_allowed || 500000)) * 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isMaintenanceDue ? (
                          <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">
                            <AlertTriangle className="w-3 h-3" /> Yes ⚠️
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px] font-bold">No</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          m.status === 'Available' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                          m.status === 'In Use' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button onClick={() => handleOpenEdit(m)} className="p-1.5 bg-[#121212] hover:bg-[#333] border border-[#333] rounded-md text-emerald-400 transition" title="Edit">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {moulds.length === 0 && (
                  <tr><td colSpan="9" className="py-8 text-center text-slate-500 italic">No moulds found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MOULD FORM MODAL (Matches Page 7) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#1e1e1e] border border-[#333] rounded-2xl p-6 w-full max-w-xl shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#2a2a2a] pb-3">
              <h2 className="text-base font-black text-white">{editingMould ? 'Edit Mould' : 'Create New Mould'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs font-semibold text-slate-300">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Mould Code *</label>
                  <input type="text" required placeholder="MLD-01" value={formData.mould_code} onChange={(e) => setFormData({ ...formData, mould_code: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-bold" />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Mould Name *</label>
                  <input type="text" required placeholder="Engine Grommet Mould A" value={formData.mould_name} onChange={(e) => setFormData({ ...formData, mould_name: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Product / Item *</label>
                  <input type="text" placeholder="Engine Grommet Type A" value={formData.product_name} onChange={(e) => setFormData({ ...formData, product_name: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium" />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Mould Type *</label>
                  <select value={formData.mould_type} onChange={(e) => setFormData({ ...formData, mould_type: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-bold">
                    <option value="Compression">Compression</option>
                    <option value="Transfer">Transfer</option>
                    <option value="Injection">Injection</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Cavities *</label>
                  <input type="number" required value={formData.cavities} onChange={(e) => setFormData({ ...formData, cavities: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium" />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Total Allowed *</label>
                  <input type="number" required value={formData.total_shots_allowed} onChange={(e) => setFormData({ ...formData, total_shots_allowed: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium" />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Shots Used</label>
                  <input type="number" value={formData.current_shots_used} onChange={(e) => setFormData({ ...formData, current_shots_used: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Mould Material</label>
                  <select value={formData.mould_material} onChange={(e) => setFormData({ ...formData, mould_material: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-bold">
                    <option value="P20 Steel">P20 Steel</option>
                    <option value="H13 Steel">H13 Steel</option>
                    <option value="Aluminium">Aluminium</option>
                    <option value="EN31 Steel">EN31 Steel</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Maint Threshold (shots)</label>
                  <input type="number" value={formData.maintenance_threshold} onChange={(e) => setFormData({ ...formData, maintenance_threshold: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium" />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-slate-400 text-[11px]">Compatible Machines</label>
                <input type="text" placeholder="HMP-01, HMP-02" value={formData.compatible_machines} onChange={(e) => setFormData({ ...formData, compatible_machines: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium" />
              </div>

              <div>
                <label className="block mb-1 text-slate-400 text-[11px]">Status *</label>
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-bold">
                  <option value="Available">Available</option>
                  <option value="In Use">In Use</option>
                  <option value="Under Maintenance">Under Maintenance</option>
                  <option value="Condemned">Condemned</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-[#2a2a2a]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-[#2a2a2a] text-slate-300 rounded-lg hover:bg-[#333] font-bold">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-[#10b981] hover:bg-[#059669] text-white rounded-lg font-black shadow-lg shadow-emerald-500/10">Save Mould</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
