import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Settings, Building2, Clock, BarChart3, Bell, Save, Upload, RefreshCw } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const getAuthHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function AdminSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('company');

  const [formData, setFormData] = useState({
    company_name: 'Jayashree Polymers (India) Pvt. Ltd.',
    short_name: 'Jayashree Polymers',
    address_line1: 'Plot No. 6, IMT Manesar',
    address_line2: 'Gurugram, Haryana — 122050',
    gstin: '06AAACJ1234F1Z5',
    pan: 'AAACJ1234F',
    phone: '0124-4567890',
    email: 'info@jayashreepolymers.com',
    shift_count: 3,
    morning_start: '06:00 AM', morning_end: '02:00 PM',
    evening_start: '02:00 PM', evening_end: '10:00 PM',
    night_start: '10:00 PM', night_end: '06:00 AM',
    oee_benchmark: 85.0, oee_slow_threshold: 65.0, oee_critical_threshold: 50.0,
    wip_slow_hours: 3.0, wip_stuck_hours: 6.0,
    enable_email_notif: true,
    qc_alert_email: 'qc@jayashreepolymers.com',
    oee_alert_email: 'plant@jayashreepolymers.com',
    stock_alert_email: 'stores@jayashreepolymers.com',
    enable_wip_stuck_notif: true
  });

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/admin/company-settings`, getAuthHeader());
      if (res.data && res.data.setting_id) {
        setFormData({ ...res.data });
      }
    } catch (err) {
      console.error('Failed to load company settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API}/admin/company-settings`, formData, getAuthHeader());
      alert('System Settings saved successfully!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save settings');
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
            <Settings className="w-5 h-5 text-emerald-500" />
            <div>
              <h1 className="text-lg font-black text-white">System Settings</h1>
              <p className="text-[10px] text-slate-400">Configure system-wide settings across 4 core sections</p>
            </div>
          </div>
        </div>

        <button 
          onClick={handleSubmit}
          className="bg-[#10b981] hover:bg-[#059669] text-white px-5 py-2 rounded-lg text-xs font-black flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/10"
        >
          <Save className="w-4 h-4" /> Save Settings
        </button>
      </div>

      {/* SECTION TABS */}
      <div className="flex gap-2 border-b border-[#2a2a2a] pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('company')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'company' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/10' : 'bg-[#1e1e1e] text-slate-400 hover:text-white border border-[#2a2a2a]'
          }`}
        >
          <Building2 className="w-4 h-4" /> Section 1 — Company Info
        </button>
        <button
          onClick={() => setActiveTab('shifts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'shifts' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/10' : 'bg-[#1e1e1e] text-slate-400 hover:text-white border border-[#2a2a2a]'
          }`}
        >
          <Clock className="w-4 h-4" /> Section 2 — Shifts
        </button>
        <button
          onClick={() => setActiveTab('oee')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'oee' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/10' : 'bg-[#1e1e1e] text-slate-400 hover:text-white border border-[#2a2a2a]'
          }`}
        >
          <BarChart3 className="w-4 h-4" /> Section 3 — OEE & WIP
        </button>
        <button
          onClick={() => setActiveTab('notif')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'notif' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/10' : 'bg-[#1e1e1e] text-slate-400 hover:text-white border border-[#2a2a2a]'
          }`}
        >
          <Bell className="w-4 h-4" /> Section 4 — Notifications
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><RefreshCw className="w-8 h-8 animate-spin text-emerald-500" /></div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-6 shadow-xl space-y-6">

          {/* SECTION 1: COMPANY INFORMATION (Matches Page 9) */}
          {activeTab === 'company' && (
            <div className="space-y-4">
              <h2 className="text-sm font-black text-white border-b border-[#2a2a2a] pb-2">Section 1 — Company Information</h2>
              <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Company Name *</label>
                  <input type="text" required value={formData.company_name} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2.5 text-white font-bold" />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Short Name</label>
                  <input type="text" value={formData.short_name} onChange={(e) => setFormData({ ...formData, short_name: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2.5 text-white font-medium" />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Address Line 1 *</label>
                  <input type="text" required value={formData.address_line1} onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2.5 text-white font-medium" />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Address Line 2</label>
                  <input type="text" value={formData.address_line2} onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2.5 text-white font-medium" />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">GSTIN *</label>
                  <input type="text" required value={formData.gstin} onChange={(e) => setFormData({ ...formData, gstin: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2.5 text-white font-medium font-mono" />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">PAN Number</label>
                  <input type="text" value={formData.pan} onChange={(e) => setFormData({ ...formData, pan: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2.5 text-white font-medium font-mono" />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Phone</label>
                  <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2.5 text-white font-medium" />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Email</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2.5 text-white font-medium" />
                </div>
              </div>

              <div className="pt-2">
                <label className="block mb-1 text-slate-400 text-[11px]">Company Logo (PDF / DC Documents)</label>
                <button type="button" onClick={() => alert('Logo upload triggered!')} className="px-4 py-2 bg-[#121212] border border-[#333] text-emerald-400 hover:bg-[#252525] rounded-lg text-xs font-bold flex items-center gap-2">
                  <Upload className="w-4 h-4" /> Upload Company Logo
                </button>
              </div>
            </div>
          )}

          {/* SECTION 2: SHIFT CONFIGURATION (Matches Page 9) */}
          {activeTab === 'shifts' && (
            <div className="space-y-4 text-xs font-semibold">
              <h2 className="text-sm font-black text-white border-b border-[#2a2a2a] pb-2">Section 2 — Shift Configuration</h2>
              
              <div>
                <label className="block mb-1 text-slate-400 text-[11px]">Number of Shifts</label>
                <select value={formData.shift_count} onChange={(e) => setFormData({ ...formData, shift_count: Number(e.target.value) })} className="w-48 bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-bold">
                  <option value={1}>1 Shift</option>
                  <option value={2}>2 Shifts</option>
                  <option value={3}>3 Shifts</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="bg-[#121212] border border-[#2a2a2a] p-4 rounded-xl space-y-2">
                  <h3 className="text-xs font-extrabold text-emerald-400">Morning Shift (480 mins)</h3>
                  <div>
                    <label className="text-[10px] text-slate-400 block">Start Time</label>
                    <input type="text" value={formData.morning_start} onChange={(e) => setFormData({ ...formData, morning_start: e.target.value })} className="w-full bg-[#1e1e1e] border border-[#333] rounded p-2 text-white font-bold" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block">End Time</label>
                    <input type="text" value={formData.morning_end} onChange={(e) => setFormData({ ...formData, morning_end: e.target.value })} className="w-full bg-[#1e1e1e] border border-[#333] rounded p-2 text-white font-bold" />
                  </div>
                </div>

                <div className="bg-[#121212] border border-[#2a2a2a] p-4 rounded-xl space-y-2">
                  <h3 className="text-xs font-extrabold text-blue-400">Evening Shift (480 mins)</h3>
                  <div>
                    <label className="text-[10px] text-slate-400 block">Start Time</label>
                    <input type="text" value={formData.evening_start} onChange={(e) => setFormData({ ...formData, evening_start: e.target.value })} className="w-full bg-[#1e1e1e] border border-[#333] rounded p-2 text-white font-bold" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block">End Time</label>
                    <input type="text" value={formData.evening_end} onChange={(e) => setFormData({ ...formData, evening_end: e.target.value })} className="w-full bg-[#1e1e1e] border border-[#333] rounded p-2 text-white font-bold" />
                  </div>
                </div>

                <div className="bg-[#121212] border border-[#2a2a2a] p-4 rounded-xl space-y-2">
                  <h3 className="text-xs font-extrabold text-purple-400">Night Shift (480 mins)</h3>
                  <div>
                    <label className="text-[10px] text-slate-400 block">Start Time</label>
                    <input type="text" value={formData.night_start} onChange={(e) => setFormData({ ...formData, night_start: e.target.value })} className="w-full bg-[#1e1e1e] border border-[#333] rounded p-2 text-white font-bold" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block">End Time</label>
                    <input type="text" value={formData.night_end} onChange={(e) => setFormData({ ...formData, night_end: e.target.value })} className="w-full bg-[#1e1e1e] border border-[#333] rounded p-2 text-white font-bold" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: OEE SETTINGS (Matches Page 9) */}
          {activeTab === 'oee' && (
            <div className="space-y-4 text-xs font-semibold">
              <h2 className="text-sm font-black text-white border-b border-[#2a2a2a] pb-2">Section 3 — OEE & WIP Settings</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">World Class OEE Benchmark (%)</label>
                  <input type="number" step="0.1" value={formData.oee_benchmark} onChange={(e) => setFormData({ ...formData, oee_benchmark: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2.5 text-white font-bold text-sm" />
                </div>
                <div>
                  <label className="block mb-1 text-amber-400 text-[11px]">Alert Threshold — Slow OEE (%)</label>
                  <input type="number" step="0.1" value={formData.oee_slow_threshold} onChange={(e) => setFormData({ ...formData, oee_slow_threshold: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2.5 text-white font-bold text-sm" />
                </div>
                <div>
                  <label className="block mb-1 text-red-400 text-[11px]">Alert Threshold — Critical OEE (%)</label>
                  <input type="number" step="0.1" value={formData.oee_critical_threshold} onChange={(e) => setFormData({ ...formData, oee_critical_threshold: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2.5 text-white font-bold text-sm" />
                </div>
                <div>
                  <label className="block mb-1 text-amber-400 text-[11px]">WIP Alert — Slow Stage Time (hours)</label>
                  <input type="number" step="0.5" value={formData.wip_slow_hours} onChange={(e) => setFormData({ ...formData, wip_slow_hours: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2.5 text-white font-bold text-sm" />
                </div>
                <div>
                  <label className="block mb-1 text-red-400 text-[11px]">WIP Alert — Stuck Stage Time (hours)</label>
                  <input type="number" step="0.5" value={formData.wip_stuck_hours} onChange={(e) => setFormData({ ...formData, wip_stuck_hours: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2.5 text-white font-bold text-sm" />
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: NOTIFICATION SETTINGS (Matches Page 9) */}
          {activeTab === 'notif' && (
            <div className="space-y-4 text-xs font-semibold">
              <h2 className="text-sm font-black text-white border-b border-[#2a2a2a] pb-2">Section 4 — Notification Settings</h2>
              
              <div className="flex items-center justify-between bg-[#121212] p-3 rounded-xl border border-[#2a2a2a]">
                <label className="text-xs font-bold text-white">Enable Email Notifications</label>
                <input type="checkbox" checked={formData.enable_email_notif} onChange={(e) => setFormData({ ...formData, enable_email_notif: e.target.checked })} className="w-4 h-4 rounded border-[#333] text-emerald-500 bg-[#1e1e1e]" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Email for QC Alerts</label>
                  <input type="email" value={formData.qc_alert_email} onChange={(e) => setFormData({ ...formData, qc_alert_email: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2.5 text-white font-medium" />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Email for OEE Alerts</label>
                  <input type="email" value={formData.oee_alert_email} onChange={(e) => setFormData({ ...formData, oee_alert_email: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2.5 text-white font-medium" />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Email for Stock Alerts</label>
                  <input type="email" value={formData.stock_alert_email} onChange={(e) => setFormData({ ...formData, stock_alert_email: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2.5 text-white font-medium" />
                </div>
              </div>

              <div className="flex items-center justify-between bg-[#121212] p-3 rounded-xl border border-[#2a2a2a]">
                <label className="text-xs font-bold text-white">Enable WIP Stuck Notifications</label>
                <input type="checkbox" checked={formData.enable_wip_stuck_notif} onChange={(e) => setFormData({ ...formData, enable_wip_stuck_notif: e.target.checked })} className="w-4 h-4 rounded border-[#333] text-emerald-500 bg-[#1e1e1e]" />
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-[#2a2a2a]">
            <button type="submit" className="px-6 py-2.5 bg-[#10b981] hover:bg-[#059669] text-white rounded-xl font-black text-xs shadow-lg shadow-emerald-500/10 flex items-center gap-1.5">
              <Save className="w-4 h-4" /> Save Settings
            </button>
          </div>

        </form>
      )}

    </div>
  );
}
