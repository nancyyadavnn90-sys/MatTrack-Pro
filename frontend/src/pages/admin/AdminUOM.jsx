import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Ruler, Plus, Check, X, RefreshCw } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const getAuthHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function AdminUOM() {
  const navigate = useNavigate();
  const [uoms, setUoms] = useState([]);
  const [loading, setLoading] = useState(true);

  // New UOM inline bar
  const [isAdding, setIsAdding] = useState(false);
  const [newUom, setNewUom] = useState({ uom_code: '', uom_name: '' });

  const fetchUoms = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/admin/uom`, getAuthHeader());
      setUoms(res.data);
    } catch (err) {
      console.error('Failed to load UOMs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUoms();
  }, []);

  const handleSaveUom = async (e) => {
    e.preventDefault();
    if (!newUom.uom_code || !newUom.uom_name) return alert('Code and name are required.');

    try {
      await axios.post(`${API}/admin/uom`, newUom, getAuthHeader());
      setIsAdding(false);
      setNewUom({ uom_code: '', uom_name: '' });
      fetchUoms();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add UOM');
    }
  };

  return (
    <div className="bg-[#121212] text-slate-200 min-h-screen p-6 font-sans space-y-6">
      
      {/* TOP HEADER */}
      <div className="flex justify-between items-center border-b border-[#2a2a2a] pb-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/admin')}
            className="flex items-center gap-1 bg-[#1e1e1e] hover:bg-[#282828] text-emerald-500 px-3 py-1.5 rounded-lg text-xs font-bold transition border border-[#333]"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Admin
          </button>
          <div className="flex items-center gap-2">
            <Ruler className="w-5 h-5 text-emerald-500" />
            <h1 className="text-lg font-black text-white">Units of Measure</h1>
          </div>
        </div>

        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-[#10b981] hover:bg-[#059669] text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/10"
        >
          <Plus className="w-4 h-4" /> New UOM
        </button>
      </div>

      {/* INLINE NEW UOM BAR (Matches Page 2 & 3) */}
      {isAdding && (
        <form onSubmit={handleSaveUom} className="bg-[#1e1e1e] p-4 rounded-xl border border-emerald-500/50 flex flex-col sm:flex-row items-center gap-3 shadow-lg">
          <input
            type="text" placeholder="Code (e.g. PCS)" value={newUom.uom_code}
            onChange={(e) => setNewUom({ ...newUom, uom_code: e.target.value })}
            className="w-32 bg-[#121212] border border-[#333] rounded-lg p-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
            required
          />
          <input
            type="text" placeholder="Description (e.g. Pieces)" value={newUom.uom_name}
            onChange={(e) => setNewUom({ ...newUom, uom_name: e.target.value })}
            className="flex-1 bg-[#121212] border border-[#333] rounded-lg p-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
            required
          />

          <div className="flex items-center gap-2">
            <button type="submit" className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold">
              <Check className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => setIsAdding(false)} className="p-2 bg-[#2a2a2a] hover:bg-[#333] text-slate-300 rounded-lg text-xs font-bold">
              <X className="w-4 h-4" />
            </button>
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded-full text-[10px] font-black uppercase">
              Active
            </span>
          </div>
        </form>
      )}

      {/* UOM LIST (Matches Page 3) */}
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="flex justify-center py-12"><RefreshCw className="w-8 h-8 animate-spin text-emerald-500" /></div>
        ) : (
          <div className="divide-y divide-[#2a2a2a]">
            {uoms.map(u => (
              <div key={u.uom_id} className="p-4 flex items-center justify-between hover:bg-[#252525] transition">
                <div className="flex items-center gap-4">
                  <span className="font-extrabold text-white text-xs tracking-wider w-16">{u.uom_code}</span>
                  <span className="text-slate-300 text-xs font-medium">{u.uom_name}</span>
                </div>

                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">
                  Active
                </span>
              </div>
            ))}
            {uoms.length === 0 && (
              <div className="py-8 text-center text-slate-500 italic">No units of measure configured.</div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
