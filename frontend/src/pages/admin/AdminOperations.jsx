import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Wrench, Plus, Check, X, Edit2, RefreshCw } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const getAuthHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

const OP_TYPES = ['Molding', 'Assembly', 'QC', 'Packing', 'Drying', 'Coating', 'Machining', 'Fabrication', 'Mixing', 'Other'];

export default function AdminOperations() {
  const navigate = useNavigate();
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);

  // New operation inline bar state
  const [isAdding, setIsAdding] = useState(false);
  const [newOp, setNewOp] = useState({ operation_code: '', operation_name: '', operation_type: 'Molding' });

  const fetchOps = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/admin/operations`, getAuthHeader());
      setOperations(res.data);
    } catch (err) {
      console.error('Failed to load operations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOps();
  }, []);

  const handleSaveNewOp = async (e) => {
    e.preventDefault();
    if (!newOp.operation_code || !newOp.operation_name) return alert('Code and name are required.');

    try {
      await axios.post(`${API}/admin/operations`, newOp, getAuthHeader());
      setIsAdding(false);
      setNewOp({ operation_code: '', operation_name: '', operation_type: 'Molding' });
      fetchOps();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add operation');
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
            <Wrench className="w-5 h-5 text-emerald-500" />
            <h1 className="text-lg font-black text-white">Operations</h1>
          </div>
        </div>

        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-[#10b981] hover:bg-[#059669] text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/10"
        >
          <Plus className="w-4 h-4" /> New Operation
        </button>
      </div>

      {/* INLINE NEW OPERATION BAR (Matches Page 1 & 2) */}
      {isAdding && (
        <form onSubmit={handleSaveNewOp} className="bg-[#1e1e1e] p-4 rounded-xl border border-emerald-500/50 flex flex-col sm:flex-row items-center gap-3 shadow-lg">
          <input
            type="text" placeholder="Code (e.g. EXTRUSION PROCESS)" value={newOp.operation_code}
            onChange={(e) => setNewOp({ ...newOp, operation_code: e.target.value })}
            className="flex-1 bg-[#121212] border border-[#333] rounded-lg p-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
            required
          />
          <input
            type="text" placeholder="Description / Name" value={newOp.operation_name}
            onChange={(e) => setNewOp({ ...newOp, operation_name: e.target.value })}
            className="flex-1 bg-[#121212] border border-[#333] rounded-lg p-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
            required
          />
          <select
            value={newOp.operation_type}
            onChange={(e) => setNewOp({ ...newOp, operation_type: e.target.value })}
            className="bg-[#121212] border border-[#333] text-white text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500 font-bold"
          >
            {OP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

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

      {/* OPERATIONS LIST TABLE (Matches Page 1 & 2) */}
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="flex justify-center py-12"><RefreshCw className="w-8 h-8 animate-spin text-emerald-500" /></div>
        ) : (
          <div className="divide-y divide-[#2a2a2a]">
            {operations.map(op => (
              <div key={op.operation_id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#252525] transition">
                <div className="flex items-center gap-4">
                  <span className="font-extrabold text-white text-xs tracking-wide">{op.operation_code}</span>
                  <span className="text-slate-400 text-xs font-medium">{op.operation_name}</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="bg-[#121212] text-slate-300 border border-[#333] px-2.5 py-0.5 rounded text-[10px] font-bold">
                    {op.operation_type || 'Molding'}
                  </span>
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">
                    Active
                  </span>
                </div>
              </div>
            ))}
            {operations.length === 0 && (
              <div className="py-8 text-center text-slate-500 italic">No operations configured.</div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
