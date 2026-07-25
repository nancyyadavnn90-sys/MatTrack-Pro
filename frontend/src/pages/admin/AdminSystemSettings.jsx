import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Settings, Edit2, Check, X, RefreshCw } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const getAuthHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function AdminSystemSettings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState('');

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/admin/settings`, getAuthHeader());
      setSettings(res.data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSetting = async (key) => {
    try {
      await axios.put(`${API}/admin/settings`, { setting_key: key, setting_value: editValue }, getAuthHeader());
      setEditingKey(null);
      fetchSettings();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update setting');
    }
  };

  return (
    <div className="bg-[#121212] text-slate-200 min-h-screen p-6 font-sans space-y-6">
      
      {/* TOP HEADER (Matches Page 10) */}
      <div className="flex justify-between items-center border-b border-[#2a2a2a] pb-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/admin')}
            className="flex items-center gap-1 bg-[#1e1e1e] hover:bg-[#282828] text-emerald-500 px-3 py-1.5 rounded-lg text-xs font-bold transition border border-[#333]"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Admin
          </button>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-500" />
            <h1 className="text-lg font-black text-white">System Settings</h1>
          </div>
        </div>
      </div>

      {/* SYSTEM SETTINGS TABLE (Matches Page 10) */}
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-lg space-y-3 p-5">
        <div className="border-b border-[#2a2a2a] pb-2 flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">SYSTEM SETTINGS</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><RefreshCw className="w-8 h-8 animate-spin text-emerald-500" /></div>
        ) : (
          <div className="divide-y divide-[#2a2a2a]">
            {settings.map(s => {
              const isEditing = editingKey === s.setting_key;

              return (
                <div key={s.setting_key} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#252525] px-2 rounded-lg transition">
                  <div className="space-y-0.5">
                    <h3 className="text-xs font-extrabold text-white">{s.setting_key}</h3>
                    <p className="text-[10px] text-slate-400 font-medium">{s.setting_description}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text" value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="bg-[#121212] border border-emerald-500 rounded px-2 py-1 text-xs text-white focus:outline-none font-bold"
                        />
                        <button onClick={() => handleSaveSetting(s.setting_key)} className="p-1 bg-emerald-500 text-white rounded"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditingKey(null)} className="p-1 bg-[#2a2a2a] text-slate-300 rounded"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs font-extrabold text-emerald-400 bg-[#121212] border border-[#333] px-3 py-1 rounded-md">
                          {s.setting_value}
                        </span>
                        <button 
                          onClick={() => { setEditingKey(s.setting_key); setEditValue(s.setting_value); }}
                          className="text-slate-500 hover:text-emerald-400 p-1"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
