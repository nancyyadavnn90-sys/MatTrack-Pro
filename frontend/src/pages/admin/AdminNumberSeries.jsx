import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Hash, Edit2, X, RefreshCw } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const getAuthHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function AdminNumberSeries() {
  const navigate = useNavigate();
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    document_type: '', prefix: '', current_number: 1, next_number: 2,
    digit_length: 5, include_year: true, year_format: '2627', reset_yearly: true
  });

  const fetchSeries = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/admin/number-series`, getAuthHeader());
      setSeries(res.data);
    } catch (err) {
      console.error('Failed to load number series:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeries();
  }, []);

  const handleOpenEdit = (s) => {
    setEditingItem(s);
    setFormData({ ...s });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API}/admin/number-series/${editingItem.series_id}`, formData, getAuthHeader());
      setIsModalOpen(false);
      fetchSeries();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update number series');
    }
  };

  const formatPreview = (item) => {
    const numPadded = String(item.next_number || 1).padStart(item.digit_length || 5, '0');
    if (item.include_year) {
      return `${item.prefix}/${item.year_format || '2627'}/${numPadded}`;
    }
    return `${item.prefix}/${numPadded}`;
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
            <Hash className="w-5 h-5 text-emerald-500" />
            <div>
              <h1 className="text-lg font-black text-white">Number Series Configuration</h1>
              <p className="text-[10px] text-slate-400">Configure auto-numbering format for all documents</p>
            </div>
          </div>
        </div>
      </div>

      {/* NUMBER SERIES TABLE (Matches Page 8) */}
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="flex justify-center py-12"><RefreshCw className="w-8 h-8 animate-spin text-emerald-500" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-semibold border-collapse text-slate-300">
              <thead className="bg-[#161616] text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-[#2a2a2a]">
                <tr>
                  <th className="py-3 px-4">DOCUMENT</th>
                  <th className="py-3 px-4">PREFIX</th>
                  <th className="py-3 px-4">CURRENT NUMBER</th>
                  <th className="py-3 px-4">NEXT NUMBER</th>
                  <th className="py-3 px-4">RESET YEARLY</th>
                  <th className="py-3 px-4">FORMAT PREVIEW</th>
                  <th className="py-3 px-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {series.map(s => (
                  <tr key={s.series_id} className="hover:bg-[#252525]">
                    <td className="py-3 px-4 font-black text-white">{s.document_type}</td>
                    <td className="py-3 px-4 font-bold text-emerald-400">{s.prefix}</td>
                    <td className="py-3 px-4 text-slate-300 font-mono">{s.current_number}</td>
                    <td className="py-3 px-4 text-amber-400 font-mono font-extrabold">{s.next_number}</td>
                    <td className="py-3 px-4 text-slate-400">{s.reset_yearly ? 'Yes' : 'No'}</td>
                    <td className="py-3 px-4">
                      <span className="bg-[#121212] text-emerald-400 border border-emerald-500/30 font-mono text-[11px] px-2.5 py-1 rounded font-bold">
                        {formatPreview(s)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => handleOpenEdit(s)} className="p-1.5 bg-[#121212] hover:bg-[#333] border border-[#333] rounded-md text-emerald-400 transition" title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EDIT NUMBER SERIES MODAL (Matches Page 8) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#1e1e1e] border border-[#333] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#2a2a2a] pb-3">
              <h2 className="text-base font-black text-white">Edit Number Series</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs font-semibold text-slate-300">
              <div>
                <label className="block mb-1 text-slate-400 text-[11px]">Document Type</label>
                <input type="text" disabled value={formData.document_type} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-slate-500 font-bold opacity-60" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Prefix *</label>
                  <input type="text" required value={formData.prefix} onChange={(e) => setFormData({ ...formData, prefix: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-bold" />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Digit Length</label>
                  <input type="number" value={formData.digit_length} onChange={(e) => setFormData({ ...formData, digit_length: Number(e.target.value) })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Current Number</label>
                  <input type="number" value={formData.current_number} onChange={(e) => setFormData({ ...formData, current_number: Number(e.target.value), next_number: Number(e.target.value) + 1 })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium" />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Year Format</label>
                  <select value={formData.year_format} onChange={(e) => setFormData({ ...formData, year_format: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-bold">
                    <option value="2627">2627 (Financial Year)</option>
                    <option value="2026">2026 (Calendar Year)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="text-xs font-bold text-white">Include Year in Number</label>
                <input type="checkbox" checked={formData.include_year} onChange={(e) => setFormData({ ...formData, include_year: e.target.checked })} className="w-4 h-4 rounded border-[#333] text-emerald-500 bg-[#121212]" />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white">Reset on New Year (1st April)</label>
                <input type="checkbox" checked={formData.reset_yearly} onChange={(e) => setFormData({ ...formData, reset_yearly: e.target.checked })} className="w-4 h-4 rounded border-[#333] text-emerald-500 bg-[#121212]" />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-[#2a2a2a]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-[#2a2a2a] text-slate-300 rounded-lg hover:bg-[#333] font-bold">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-[#10b981] hover:bg-[#059669] text-white rounded-lg font-black shadow-lg shadow-emerald-500/10">Save Series</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
