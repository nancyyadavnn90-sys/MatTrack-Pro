import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, UserCheck, Plus, Edit2, X, RefreshCw } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const getAuthHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function AdminCustomers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCust, setEditingCust] = useState(null);
  const [formData, setFormData] = useState({
    customer_code: '', customer_name: '', short_name: '', contact_person: '', phone: '', email: '',
    billing_address: '', delivery_address: '', city_state_pin: '', gstin: '', payment_terms: '30 days', status: 'Active'
  });

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/admin/customers`, getAuthHeader());
      setCustomers(res.data);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleOpenCreate = () => {
    setEditingCust(null);
    setFormData({
      customer_code: `CUST-${Date.now().toString().slice(-3)}`, customer_name: '', short_name: '', contact_person: '', phone: '', email: '',
      billing_address: '', delivery_address: '', city_state_pin: '', gstin: '', payment_terms: '30 days', status: 'Active'
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c) => {
    setEditingCust(c);
    setFormData({ ...c });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customer_name) return alert('Customer name is required.');

    try {
      if (editingCust) {
        await axios.put(`${API}/admin/customers/${editingCust.customer_id}`, formData, getAuthHeader());
      } else {
        await axios.post(`${API}/admin/customers`, formData, getAuthHeader());
      }
      setIsModalOpen(false);
      fetchCustomers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save customer');
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
            <UserCheck className="w-5 h-5 text-emerald-500" />
            <h1 className="text-lg font-black text-white">Customer Master</h1>
          </div>
        </div>

        <button 
          onClick={handleOpenCreate}
          className="bg-[#10b981] hover:bg-[#059669] text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/10"
        >
          <Plus className="w-4 h-4" /> New Customer
        </button>
      </div>

      {/* CUSTOMERS TABLE (Matches Page 4) */}
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="flex justify-center py-12"><RefreshCw className="w-8 h-8 animate-spin text-emerald-500" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-semibold border-collapse text-slate-300">
              <thead className="bg-[#161616] text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-[#2a2a2a]">
                <tr>
                  <th className="py-3 px-4">CODE</th>
                  <th className="py-3 px-4">CUSTOMER NAME</th>
                  <th className="py-3 px-4">CONTACT PERSON</th>
                  <th className="py-3 px-4">PHONE</th>
                  <th className="py-3 px-4">GSTIN</th>
                  <th className="py-3 px-4">LOCATION</th>
                  <th className="py-3 px-4 text-center">STATUS</th>
                  <th className="py-3 px-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {customers.map(c => (
                  <tr key={c.customer_id} className="hover:bg-[#252525]">
                    <td className="py-3 px-4 font-black text-emerald-400">{c.customer_code}</td>
                    <td className="py-3 px-4 font-extrabold text-white">{c.customer_name}</td>
                    <td className="py-3 px-4 text-slate-300">{c.contact_person || '—'}</td>
                    <td className="py-3 px-4 text-slate-400">{c.phone || '—'}</td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{c.gstin || '—'}</td>
                    <td className="py-3 px-4 text-slate-400">{c.city_state_pin || 'Manesar'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        c.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => handleOpenEdit(c)} className="p-1.5 bg-[#121212] hover:bg-[#333] border border-[#333] rounded-md text-emerald-400 transition" title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr><td colSpan="8" className="py-8 text-center text-slate-500 italic">No customers found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT CUSTOMER FORM MODAL (Matches Page 4) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#1e1e1e] border border-[#333] rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#2a2a2a] pb-3">
              <h2 className="text-base font-black text-white">{editingCust ? 'Edit Customer' : 'Create New Customer'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs font-semibold text-slate-300">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Customer Code *</label>
                  <input type="text" required value={formData.customer_code} onChange={(e) => setFormData({ ...formData, customer_code: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-bold" />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Customer Name *</label>
                  <input type="text" required placeholder="Honda Motorcycle & Scooter India" value={formData.customer_name} onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Short Name</label>
                  <input type="text" placeholder="Honda HMSI" value={formData.short_name} onChange={(e) => setFormData({ ...formData, short_name: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium" />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">GSTIN *</label>
                  <input type="text" required placeholder="06AAACH1234F1Z1" value={formData.gstin} onChange={(e) => setFormData({ ...formData, gstin: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Contact Person</label>
                  <input type="text" placeholder="Purchase Team" value={formData.contact_person} onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium" />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Phone Number</label>
                  <input type="text" placeholder="9999999991" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium" />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-slate-400 text-[11px]">Billing Address *</label>
                <textarea rows="2" required placeholder="Full billing address" value={formData.billing_address} onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium resize-none" />
              </div>

              <div>
                <label className="block mb-1 text-slate-400 text-[11px]">Delivery Address</label>
                <textarea rows="2" placeholder="Delivery address (if different)" value={formData.delivery_address} onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Payment Terms</label>
                  <select value={formData.payment_terms} onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-bold">
                    <option value="30 days">30 days</option>
                    <option value="45 days">45 days</option>
                    <option value="60 days">60 days</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Status</label>
                  <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-bold">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-[#2a2a2a]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-[#2a2a2a] text-slate-300 rounded-lg hover:bg-[#333] font-bold">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-[#10b981] hover:bg-[#059669] text-white rounded-lg font-black shadow-lg shadow-emerald-500/10">Save Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
