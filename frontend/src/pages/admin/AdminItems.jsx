import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Package, Plus, Edit2, X, RefreshCw, Upload, Download } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const getAuthHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function AdminItems() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    item_code: '', item_name: '', category: 'Raw Material', unit: 'KG', customer: '', reorder_level: 0, description: '', status: 'Active'
  });

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/admin/items`, getAuthHeader());
      setItems(res.data);
    } catch (err) {
      console.error('Failed to load items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({
      item_code: `RM-${Date.now().toString().slice(-3)}`, item_name: '', category: 'Raw Material', unit: 'KG', customer: '', reorder_level: 0, description: '', status: 'Active'
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({ ...item });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.item_code || !formData.item_name) return alert('Item code and name are required.');

    try {
      if (editingItem) {
        await axios.put(`${API}/admin/items/${editingItem.item_id}`, formData, getAuthHeader());
      } else {
        await axios.post(`${API}/admin/items`, formData, getAuthHeader());
      }
      setIsModalOpen(false);
      fetchItems();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save item');
    }
  };

  const filteredItems = items.filter(i => {
    const matchCat = categoryFilter === 'All' || i.category === categoryFilter;
    const matchStatus = statusFilter === 'All' || i.status === statusFilter;
    const matchSearch = i.item_name.toLowerCase().includes(searchQuery.toLowerCase()) || i.item_code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchStatus && matchSearch;
  });

  // Calculate stats
  const totalItems = items.length;
  const rawMaterials = items.filter(i => i.category === 'Raw Material').length;
  const finishedGoods = items.filter(i => i.category === 'Finished Good').length;
  const consumables = items.filter(i => i.category === 'Consumable').length;

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
            <Package className="w-5 h-5 text-emerald-500" />
            <div>
              <h1 className="text-lg font-black text-white">Items / Products Master</h1>
              <p className="text-[10px] text-slate-400">Manage all raw materials, WIP items and finished goods</p>
            </div>
          </div>
        </div>

        <button 
          onClick={handleOpenCreate}
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-amber-600/10"
        >
          <Plus className="w-4 h-4" /> New Item
        </button>
      </div>

      {/* STATS CARDS (Matches Page 2) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#1e1e1e] border border-[#2a2a2a] p-4 rounded-xl shadow-md">
          <p className="text-[10px] font-black uppercase text-slate-400">Total Items</p>
          <p className="text-2xl font-black text-white mt-1">{totalItems}</p>
        </div>
        <div className="bg-[#1e1e1e] border border-[#2a2a2a] p-4 rounded-xl shadow-md">
          <p className="text-[10px] font-black uppercase text-emerald-400">Raw Materials</p>
          <p className="text-2xl font-black text-white mt-1">{rawMaterials}</p>
        </div>
        <div className="bg-[#1e1e1e] border border-[#2a2a2a] p-4 rounded-xl shadow-md">
          <p className="text-[10px] font-black uppercase text-blue-400">Finished Goods</p>
          <p className="text-2xl font-black text-white mt-1">{finishedGoods}</p>
        </div>
        <div className="bg-[#1e1e1e] border border-[#2a2a2a] p-4 rounded-xl shadow-md">
          <p className="text-[10px] font-black uppercase text-purple-400">Consumables</p>
          <p className="text-2xl font-black text-white mt-1">{consumables}</p>
        </div>
      </div>

      {/* FILTER BAR (Matches Page 2) */}
      <div className="bg-[#1e1e1e] p-4 rounded-xl border border-[#2a2a2a] flex flex-col sm:flex-row items-center gap-3">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-[#121212] border border-[#333] text-white text-xs px-3 py-2 rounded-lg font-bold"
        >
          <option value="All">All Categories</option>
          <option value="Raw Material">Raw Material</option>
          <option value="Finished Good">Finished Good</option>
          <option value="Semi Finished">Semi Finished</option>
          <option value="Consumable">Consumable</option>
          <option value="Spare Part">Spare Part</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#121212] border border-[#333] text-white text-xs px-3 py-2 rounded-lg font-bold"
        >
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>

        <input
          type="text"
          placeholder="Search by item name or code..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 w-full bg-[#121212] border border-[#333] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
        />
      </div>

      {/* ITEMS TABLE (Matches Page 2) */}
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="flex justify-center py-12"><RefreshCw className="w-8 h-8 animate-spin text-emerald-500" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-semibold border-collapse text-slate-300">
              <thead className="bg-[#161616] text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-[#2a2a2a]">
                <tr>
                  <th className="py-3 px-4">ITEM CODE</th>
                  <th className="py-3 px-4">ITEM NAME</th>
                  <th className="py-3 px-4">CATEGORY</th>
                  <th className="py-3 px-4">UNIT</th>
                  <th className="py-3 px-4">CUSTOMER</th>
                  <th className="py-3 px-4">REORDER LEVEL</th>
                  <th className="py-3 px-4 text-center">STATUS</th>
                  <th className="py-3 px-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {filteredItems.map(i => (
                  <tr key={i.item_id} className="hover:bg-[#252525]">
                    <td className="py-3 px-4 font-black text-emerald-400">{i.item_code}</td>
                    <td className="py-3 px-4 font-extrabold text-white">{i.item_name}</td>
                    <td className="py-3 px-4">
                      <span className="bg-[#121212] border border-[#333] px-2 py-0.5 rounded text-[10px] font-bold text-slate-300">
                        {i.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-bold">{i.unit || 'Nos'}</td>
                    <td className="py-3 px-4 text-slate-300">{i.customer || '—'}</td>
                    <td className="py-3 px-4 text-amber-400 font-bold">{i.reorder_level ? `${i.reorder_level} ${i.unit}` : '0'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        i.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'
                      }`}>
                        {i.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => handleOpenEdit(i)} className="p-1.5 bg-[#121212] hover:bg-[#333] border border-[#333] rounded-md text-emerald-400 transition" title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr><td colSpan="8" className="py-8 text-center text-slate-500 italic">No items found matching filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT ITEM FORM MODAL (Matches Page 2) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#1e1e1e] border border-[#333] rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#2a2a2a] pb-3">
              <h2 className="text-base font-black text-white">{editingItem ? 'Edit Item' : 'Create New Item'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs font-semibold text-slate-300">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Item Code *</label>
                  <input type="text" required value={formData.item_code} onChange={(e) => setFormData({ ...formData, item_code: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-bold" />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Item Name *</label>
                  <input type="text" required placeholder="Engine Grommet Type A" value={formData.item_name} onChange={(e) => setFormData({ ...formData, item_name: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Category *</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-bold">
                    <option value="Raw Material">Raw Material</option>
                    <option value="Finished Good">Finished Good</option>
                    <option value="Semi Finished">Semi Finished</option>
                    <option value="Consumable">Consumable</option>
                    <option value="Spare Part">Spare Part</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Unit of Measure *</label>
                  <select value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-bold">
                    <option value="KG">KG</option>
                    <option value="Nos">Nos</option>
                    <option value="Ltr">Ltr</option>
                    <option value="Gm">Gm</option>
                    <option value="Ml">Ml</option>
                    <option value="Box">Box</option>
                    <option value="Roll">Roll</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Customer (For FG)</label>
                  <select value={formData.customer} onChange={(e) => setFormData({ ...formData, customer: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-bold">
                    <option value="">— None —</option>
                    <option value="Hero MotoCorp">Hero MotoCorp</option>
                    <option value="Honda HMSI">Honda HMSI</option>
                    <option value="Yamaha Motors">Yamaha Motors</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Reorder Level</label>
                  <input type="number" value={formData.reorder_level} onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium" />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-slate-400 text-[11px]">Description</label>
                <textarea rows="2" placeholder="Optional details..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-medium resize-none" />
              </div>

              <div>
                <label className="block mb-1 text-slate-400 text-[11px]">Status</label>
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white font-bold">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-[#2a2a2a]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-[#2a2a2a] text-slate-300 rounded-lg hover:bg-[#333] font-bold">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-black shadow-lg shadow-amber-600/10">Save Item</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
