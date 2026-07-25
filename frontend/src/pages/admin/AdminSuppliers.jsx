import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Truck, Plus, Edit2, X, RefreshCw, Phone, Mail, MapPin } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const getAuthHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function AdminSuppliers() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [formData, setFormData] = useState({
    supplier_code: '', supplier_name: '', contact_person: '', phone: '', email: '',
    address: '', city_state_pin: '', gstin: '', payment_terms: '30 days', status: 'Active'
  });

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/admin/suppliers`, getAuthHeader());
      setSuppliers(res.data);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleOpenCreate = () => {
    setEditingSupplier(null);
    setFormData({
      supplier_code: `SUP-${Date.now().toString().slice(-3)}`, supplier_name: '', contact_person: '', phone: '', email: '',
      address: '', city_state_pin: '', gstin: '', payment_terms: '30 days', status: 'Active'
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s) => {
    setEditingSupplier(s);
    setFormData({ ...s });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.supplier_name) return alert('Supplier name is required.');

    try {
      if (editingSupplier) {
        await axios.put(`${API}/admin/suppliers/${editingSupplier.supplier_id}`, formData, getAuthHeader());
      } else {
        await axios.post(`${API}/admin/suppliers`, formData, getAuthHeader());
      }
      setIsModalOpen(false);
      fetchSuppliers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save supplier');
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
            <Truck className="w-5 h-5 text-emerald-500" />
            <h1 className="text-lg font-black text-white">Supplier Master</h1>
          </div>
        </div>

        <button 
          onClick={handleOpenCreate}
          className="bg-[#10b981] hover:bg-[#059669] text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/10"
        >
          <Plus className="w-4 h-4" /> New Supplier
        </button>
      </div>

      {/* SUPPLIERS TABLE (Matches Page 3) */}
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="flex justify-center py-12"><RefreshCw className="w-8 h-8 animate-spin text-emerald-500" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-semibold border-collapse text-slate-300">
              <thead className="bg-[#161616] text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-[#2a2a2a]">
                <tr>
                  <th className="py-3 px-4">CODE</th>
                  <th className="py-3 px-4">SUPPLIER NAME</th>
                  <th className="py-3 px-4">CONTACT PERSON</th>
                  <th className="py-3 px-4">PHONE</th>
                  <th className="py-3 px-4">EMAIL</th>
                  <th className="py-3 px-4">GSTIN</th>
                  <th className="py-3 px-4 text-center">STATUS</th>
                  <th className="py-3 px-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {suppliers.map(s => (
                  <tr key={s.supplier_id} className="hover:bg-[#252525]">
                    <td className="py-3 px-4 font-black text-emerald-400">{s.supplier_code}</td>
                    <td className="py-3 px-4 font-extrabold text-white">{s.supplier_name}</td>
                    <td className="py-3 px-4 text-slate-300">{s.contact_person || '—'}</td>
                    <td className="py-3 px-4 text-slate-400">{s.phone || '—'}</td>
                    <td className="py-3 px-4 text-slate-400">{s.email || '—'}</td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{s.gstin || '—'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        s.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => handleOpenEdit(s)} className="p-1.5 bg-[#121212] hover:bg-[#333] border border-[#333] rounded-md text-emerald-400 transition" title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {suppliers.length === 0 && (
                  <tr><td colSpan="8" className="py-8 text-center text-slate-500 italic">No suppliers found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT SUPPLIER FORM MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#1e1e1e] border border-[#333] rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#2a2a2a] pb-3">
              <h2 className="text-base font-black text-white">{editingSupplier ? 'Edit Supplier' : 'Create New Supplier'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs font-semibold text-slate-300">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Supplier Code *</label>
                  <input type="text" required value={formData.supplier_code} onChange={(e) => setFormData({ ...formData, supplier_code: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-bold" />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Supplier Name *</label>
                  <input type="text" required placeholder="ABC Rubber Co." value={formData.supplier_name} onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Contact Person</label>
                  <input type="text" placeholder="Ramesh Kumar" value={formData.contact_person} onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium" />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Phone Number</label>
                  <input type="text" placeholder="9876543210" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Email</label>
                  <input type="email" placeholder="abc@rubber.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium" />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">GSTIN</label>
                  <input type="text" placeholder="07AABCU1234F1Z1" value={formData.gstin} onChange={(e) => setFormData({ ...formData, gstin: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium" />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-slate-400 text-[11px]">Address</label>
                <textarea rows="2" placeholder="Full address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Payment Terms</label>
                  <select value={formData.payment_terms} onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-bold">
                    <option value="Immediate">Immediate</option>
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
                <button type="submit" className="px-5 py-2 bg-[#10b981] hover:bg-[#059669] text-white rounded-lg font-black shadow-lg shadow-emerald-500/10">Save Supplier</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
