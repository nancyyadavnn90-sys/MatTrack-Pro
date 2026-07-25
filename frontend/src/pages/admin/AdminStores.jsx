import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Home, Plus, ChevronRight, Edit2, RefreshCw } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const getAuthHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function AdminStores() {
  const navigate = useNavigate();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSite, setSelectedSite] = useState('All');

  const fetchStores = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/admin/stores`, getAuthHeader());
      setStores(res.data);
    } catch (err) {
      console.error('Failed to load stores:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  return (
    <div className="bg-[#121212] text-slate-200 min-h-screen p-6 font-sans space-y-6">
      
      {/* TOP HEADER (Matches Page 1) */}
      <div className="flex justify-between items-center border-b border-[#2a2a2a] pb-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/admin')}
            className="flex items-center gap-1 bg-[#1e1e1e] hover:bg-[#282828] text-emerald-500 px-3 py-1.5 rounded-lg text-xs font-bold transition border border-[#333]"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Admin
          </button>
          <div className="flex items-center gap-2">
            <Home className="w-5 h-5 text-emerald-500" />
            <h1 className="text-lg font-black text-white">Stores & Bins</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="bg-[#1e1e1e] hover:bg-[#252525] border border-[#333] text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-bold transition">
            + New Site
          </button>
          <button className="bg-[#10b981] hover:bg-[#059669] text-white px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-lg shadow-emerald-500/10">
            + New Store
          </button>
        </div>
      </div>

      {/* SITES FILTER */}
      <div className="bg-[#1e1e1e] p-3 rounded-xl border border-[#2a2a2a] inline-block">
        <select
          value={selectedSite}
          onChange={(e) => setSelectedSite(e.target.value)}
          className="bg-[#121212] border border-[#333] text-white text-xs px-4 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500 font-bold"
        >
          <option value="All">— All Sites —</option>
          <option value="Main Plant">Main Plant</option>
        </select>
      </div>

      {/* MAIN PLANT STORE CONTAINER (Matches Page 1) */}
      <div className="space-y-4">
        <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-4 shadow-lg space-y-3">
          <div className="flex justify-between items-center border-b border-[#2a2a2a] pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-emerald-400">🏢 MP</span>
              <span className="text-xs font-bold text-slate-300">— Main Plant</span>
            </div>
            <button className="text-slate-500 hover:text-emerald-400 p-1"><Edit2 className="w-3.5 h-3.5" /></button>
          </div>

          <div className="space-y-2">
            {loading ? (
              <div className="flex justify-center py-6"><RefreshCw className="w-6 h-6 animate-spin text-emerald-500" /></div>
            ) : (
              stores.map(s => (
                <div key={s.store_id} className="bg-[#141414] p-3 rounded-lg border border-[#2a2a2a] flex items-center justify-between hover:bg-[#1a1a1a] transition">
                  <div className="flex items-center gap-3">
                    <ChevronRight className="w-4 h-4 text-emerald-500" />
                    <span className="font-extrabold text-white text-xs">{s.store_code}</span>
                    <span className="text-slate-300 text-xs font-medium">{s.store_name}</span>
                    <span className="bg-[#1e1e1e] text-slate-400 border border-[#333] px-2 py-0.5 rounded text-[10px] font-bold">
                      {s.store_type}
                    </span>
                    <span className="text-slate-500 text-[11px] font-medium">{s.bin_count || 0} bins</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button className="text-slate-500 hover:text-emerald-400 p-1"><Edit2 className="w-3.5 h-3.5" /></button>
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">
                      Active
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RACK CARD (Matches Page 1) */}
        <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-4 shadow-lg space-y-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-emerald-400">🏢 RACK</span>
              <span className="text-xs font-bold text-slate-300">— 5</span>
            </div>
            <button className="text-slate-500 hover:text-emerald-400 p-1"><Edit2 className="w-3.5 h-3.5" /></button>
          </div>
          <p className="text-xs text-slate-500 italic">No stores in this site.</p>
        </div>
      </div>

    </div>
  );
}
