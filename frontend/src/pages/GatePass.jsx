import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, X, Eye, CheckCircle, Clock, XCircle, ArrowLeft, Printer } from 'lucide-react';
import { QRCodeCanvas as QRCode } from 'qrcode.react';
import Barcode from 'react-barcode';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useRef } from 'react';

const API = 'http://localhost:5000/api';

const getAuthHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

export default function GatePass() {
  const [gatePasses, setGatePasses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gpDetail, setGpDetail] = useState(null);
  const [showSlip, setShowSlip] = useState(false);
  const slipRef = useRef(null);

  const [filters, setFilters] = useState({
    from_date: '', to_date: '', status: 'All', search: ''
  });

  const [form, setForm] = useState({
    gp_type: 'Inward',
    supplier_id: '',
    customer_id: '',
    vehicle_number: '',
    driver_name: '',
    dc_number: '',
    invoice_number: '',
    invoice_date: '',
    remarks: '',
    items: []
  });

  useEffect(() => {
    fetchGatePasses();
    fetchSuppliers();
    fetchItems();
  }, []);

  const fetchGatePasses = async () => {
    try {
      const res = await axios.get(`${API}/gate-passes`, getAuthHeader());
      setGatePasses(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await axios.get(`${API}/gate-passes/suppliers`, getAuthHeader());
      setSuppliers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchItems = async () => {
    try {
      const res = await axios.get(`${API}/gate-passes/items`, getAuthHeader());
      setItems(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const addItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { item_id: '', expected_qty: '', unit: 'Kg' }]
    }));
  };

  const removeItem = (index) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateItem = (index, field, value) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/gate-passes`, form, getAuthHeader());
      setShowForm(false);
      setForm({
        gp_type: 'Inward', supplier_id: '', customer_id: '',
        vehicle_number: '', driver_name: '', dc_number: '',
        invoice_number: '', invoice_date: '', remarks: '', items: []
      });
      fetchGatePasses();
      alert('Gate Pass created successfully!');
    } catch (err) {
      alert('Error creating gate pass');
    } finally {
      setLoading(false);
    }
  };

  const filteredGPs = gatePasses.filter(gp => {
    if (filters.status !== 'All' && gp.status !== filters.status) return false;
    if (filters.from_date && new Date(gp.created_at) < new Date(filters.from_date)) return false;
    if (filters.to_date && new Date(gp.created_at) > new Date(filters.to_date)) return false;
    if (filters.search) {
      const s = filters.search.toLowerCase();
      const match =
        gp.gp_number?.toLowerCase().includes(s) ||
        gp.supplier_name?.toLowerCase().includes(s) ||
        gp.vehicle_number?.toLowerCase().includes(s);
      if (!match) return false;
    }
    return true;
  });

  const getStatusBadge = (status) => {
    const styles = {
      'Open': 'bg-red-500/10 text-red-400 border border-red-500/30',
      'GRN Created': 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
      'Closed': 'bg-slate-500/10 text-slate-400 border border-slate-500/30',
    };
    const icons = {
      'Open': <Clock className="w-3 h-3" />,
      'GRN Created': <CheckCircle className="w-3 h-3" />,
      'Closed': <XCircle className="w-3 h-3" />,
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${styles[status] || 'bg-slate-800 text-slate-400'}`}>
        {icons[status]} {status}
      </span>
    );
  };

  return (
    <div className="bg-[#121212] text-slate-200 min-h-screen p-6 font-sans space-y-6">
      {/* Related quick-actions bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-slate-400 text-xs font-black uppercase">RELATED</span>
        <button className="flex items-center gap-1 bg-[#1e1e1e] text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-lg text-xs font-bold hover:bg-[#252525]">
          📦 GRN
        </button>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-lg text-xs font-bold hover:bg-amber-500/20"
        >
          <Plus className="w-3 h-3" /> New GRN
        </button>
        <button className="flex items-center gap-1 bg-[#1e1e1e] text-blue-400 border border-blue-500/30 px-3 py-1 rounded-lg text-xs font-bold hover:bg-[#252525]">
          🚚 Dispatch
        </button>
        <button className="flex items-center gap-1 bg-[#1e1e1e] text-purple-400 border border-purple-500/30 px-3 py-1 rounded-lg text-xs font-bold hover:bg-[#252525]">
          ✅ Quality
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2a2a2a] pb-4">
        <div>
          <h1 className="text-lg font-black text-white">Gate Passes</h1>
          <p className="text-xs text-slate-400 font-medium">
            Manage inward and outward gate passes
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#10b981] hover:bg-[#059669] text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg shadow-emerald-500/10 transition"
        >
          <Plus className="w-4 h-4" /> New
        </button>
      </div>

      {/* Filters */}
      <div className="bg-[#1e1e1e] rounded-xl border border-[#2a2a2a] p-4 shadow-md space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-semibold">From Date</label>
            <input
              type="date"
              value={filters.from_date}
              onChange={e => setFilters({ ...filters, from_date: e.target.value })}
              className="w-full bg-[#121212] border border-[#333] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-semibold">To Date</label>
            <input
              type="date"
              value={filters.to_date}
              onChange={e => setFilters({ ...filters, to_date: e.target.value })}
              className="w-full bg-[#121212] border border-[#333] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Status</label>
            <select
              value={filters.status}
              onChange={e => setFilters({ ...filters, status: e.target.value })}
              className="w-full bg-[#121212] border border-[#333] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
            >
              <option>All</option>
              <option>Open</option>
              <option>GRN Created</option>
              <option>Closed</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Search</label>
            <input
              type="text"
              placeholder="GP no / supplier / vehicle..."
              value={filters.search}
              onChange={e => setFilters({ ...filters, search: e.target.value })}
              className="w-full bg-[#121212] border border-[#333] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#1e1e1e] rounded-xl border border-[#2a2a2a] p-4 shadow-md space-y-1">
          <p className="text-[10px] font-black uppercase text-slate-400">Total Gate Passes</p>
          <p className="text-2xl font-black text-white">{filteredGPs.length}</p>
        </div>
        <div className="bg-[#1e1e1e] rounded-xl border border-[#2a2a2a] p-4 shadow-md space-y-1">
          <p className="text-[10px] font-black uppercase text-slate-400">Open</p>
          <p className="text-2xl font-black text-red-400">
            {filteredGPs.filter(gp => gp.status === 'Open').length}
          </p>
        </div>
        <div className="bg-[#1e1e1e] rounded-xl border border-[#2a2a2a] p-4 shadow-md space-y-1">
          <p className="text-[10px] font-black uppercase text-slate-400">GRN Created</p>
          <p className="text-2xl font-black text-emerald-400">
            {filteredGPs.filter(gp => gp.status === 'GRN Created').length}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#1e1e1e] rounded-xl border border-[#2a2a2a] overflow-hidden shadow-lg">
        <div className="px-4 py-3 border-b border-[#2a2a2a]">
          <h2 className="text-xs font-black uppercase text-white tracking-wider">All Gate Passes ({filteredGPs.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-semibold text-slate-200">
            <thead className="bg-[#252525] border-b border-[#333]">
              <tr>
                {['GP NUMBER', 'DATE', 'TYPE', 'SUPPLIER', 'VEHICLE NO', 'STATUS', ''].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-black text-slate-200 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a2a]">
              {filteredGPs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-400">
                    No gate passes found. Create your first one!
                  </td>
                </tr>
              ) : (
                filteredGPs.map(gp => (
                  <tr key={gp.gp_id} className="hover:bg-[#252525] border-b border-[#2a2a2a] transition cursor-pointer" onClick={async () => {
                    try {
                      const res = await axios.get(`${API}/gate-passes/${gp.gp_id}`, getAuthHeader());
                      setGpDetail(res.data);
                    } catch (err) {
                      setGpDetail(gp);
                    }
                  }}>
                    <td className="px-6 py-3 font-extrabold text-emerald-400 text-xs">{gp.gp_number}</td>
                    <td className="px-6 py-3 text-slate-300 font-mono text-xs">
                      {new Date(gp.created_at || gp.gp_date).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-6 py-3">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#121212] border border-[#3a3a3a] text-purple-400">
                        {gp.gp_type}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-white font-extrabold text-xs">{gp.supplier_name || '-'}</td>
                    <td className="px-6 py-3 text-slate-300 font-mono text-xs">{gp.vehicle_number || '-'}</td>
                    <td className="px-6 py-3">{getStatusBadge(gp.status)}</td>
                    <td className="px-6 py-3">
                      <Eye className="w-4 h-4 text-emerald-400" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">New Gate Pass</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-red-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">GP Type</label>
                  <select
                    value={form.gp_type}
                    onChange={e => setForm({ ...form, gp_type: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  >
                    <option>Inward</option>
                    <option>Outward</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
                  <select
                    value={form.supplier_id}
                    onChange={e => setForm({ ...form, supplier_id: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map(s => (
                      <option key={s.supplier_id} value={s.supplier_id}>
                        {s.supplier_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Vehicle Number</label>
                  <input
                    type="text"
                    value={form.vehicle_number}
                    onChange={e => setForm({ ...form, vehicle_number: e.target.value })}
                    placeholder="e.g. HR26AB1234"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Driver Name</label>
                  <input
                    type="text"
                    value={form.driver_name}
                    onChange={e => setForm({ ...form, driver_name: e.target.value })}
                    placeholder="Driver name"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">DC Number</label>
                  <input
                    type="text"
                    value={form.dc_number}
                    onChange={e => setForm({ ...form, dc_number: e.target.value })}
                    placeholder="Delivery challan number"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Number</label>
                  <input
                    type="text"
                    value={form.invoice_number}
                    onChange={e => setForm({ ...form, invoice_number: e.target.value })}
                    placeholder="Invoice number"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Date</label>
                  <input
                    type="date"
                    value={form.invoice_date}
                    onChange={e => setForm({ ...form, invoice_date: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
                  <input
                    type="text"
                    value={form.remarks}
                    onChange={e => setForm({ ...form, remarks: e.target.value })}
                    placeholder="Optional remarks"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">Items</label>
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-orange-500 hover:text-orange-600 text-sm font-medium flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Add Item
                  </button>
                </div>

                {form.items.length === 0 && (
                  <p className="text-slate-400 text-sm text-center py-4 border border-dashed border-slate-300 rounded-lg">
                    No items added yet. Click "Add Item" to add.
                  </p>
                )}

                {form.items.map((item, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <select
                      value={item.item_id}
                      onChange={e => updateItem(index, 'item_id', e.target.value)}
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    >
                      <option value="">Select Item</option>
                      {items.map(i => (
                        <option key={i.item_id} value={i.item_id}>
                          {i.item_name} ({i.item_code})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={item.expected_qty}
                      onChange={e => updateItem(index, 'expected_qty', e.target.value)}
                      placeholder="Qty"
                      className="w-24 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    />
                    <select
                      value={item.unit}
                      onChange={e => updateItem(index, 'unit', e.target.value)}
                      className="w-20 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    >
                      <option>Kg</option>
                      <option>Nos</option>
                      <option>Ltr</option>
                      <option>Box</option> 
                    </select>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-red-400 hover:text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-lg font-medium hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg font-medium transition disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Gate Pass'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GP Detail View */}
      {gpDetail && !showSlip && (
        <div className="fixed inset-0 bg-slate-100 z-40 overflow-y-auto">
          <div className="max-w-5xl mx-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-slate-800">{gpDetail.gp_number}</h1>
                {getStatusBadge(gpDetail.status)}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSlip(true)}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                >
                  <Printer className="w-4 h-4" /> Print Slip
                </button>
                <button
                  onClick={() => setGpDetail(null)}
                  className="flex items-center gap-2 border border-slate-300 text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-50 transition"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
              </div>
            </div>

            {/* Details card */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-xs text-slate-400 uppercase mb-1">Type</p>
                  <p className="font-semibold text-slate-800">{gpDetail.gp_type}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase mb-1">Supplier</p>
                  <p className="font-semibold text-slate-800">{gpDetail.supplier_name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase mb-1">Vehicle No</p>
                  <p className="font-semibold text-slate-800">{gpDetail.vehicle_number || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase mb-1">Driver</p>
                  <p className="font-semibold text-slate-800">{gpDetail.driver_name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase mb-1">DC No</p>
                  <p className="font-semibold text-slate-800">{gpDetail.dc_number || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase mb-1">Invoice No</p>
                  <p className="font-semibold text-slate-800">{gpDetail.invoice_number || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase mb-1">Entry Time</p>
                  <p className="font-semibold text-slate-800">
                    {new Date(gpDetail.created_at).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
              <h3 className="font-semibold text-slate-700 mb-4">Timeline</h3>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500 mt-1 flex-shrink-0"></div>
                  <div>
                    <p className="font-medium text-slate-800 text-sm">Gate Pass Created</p>
                    <p className="text-slate-400 text-xs">{new Date(gpDetail.created_at).toLocaleString('en-IN')}</p>
                  </div>
                </div>
                {(gpDetail.linked_grns || []).map(g => (
                  <div key={g.grn_id} className="flex gap-3">
                    <div className="w-3 h-3 rounded-full bg-blue-500 mt-1 flex-shrink-0"></div>
                    <div>
                      <p className="font-medium text-slate-800 text-sm">GRN Created — {g.grn_number}</p>
                      <p className="text-slate-400 text-xs">{new Date(g.grn_date).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Items */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-4">
              <div className="px-6 py-3 border-b border-slate-200">
                <span className="font-semibold text-slate-700">Items ({(gpDetail.items || []).length})</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['#', 'Description', 'Qty', 'UOM'].map(h => (
                      <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(gpDetail.items || []).map((item, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 text-slate-500">{i + 1}</td>
                      <td className="px-4 py-2 font-medium text-slate-800">{item.item_name}</td>
                      <td className="px-4 py-2 text-slate-700">{item.expected_qty}</td>
                      <td className="px-4 py-2 text-slate-500">{item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Linked GRN */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-4">
              <div className="px-6 py-3 border-b border-slate-200">
                <span className="font-semibold text-slate-700">Linked GRN</span>
              </div>
              {(gpDetail.linked_grns || []).length === 0 ? (
                <p className="text-center text-slate-400 py-6 text-sm">No GRN created yet for this Gate Pass.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {['GRN No', 'Date', 'Lines', 'Status'].map(h => (
                        <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {gpDetail.linked_grns.map(g => (
                      <tr key={g.grn_id}>
                        <td className="px-4 py-2 font-medium text-orange-600">{g.grn_number}</td>
                        <td className="px-4 py-2 text-slate-600">{new Date(g.grn_date).toLocaleDateString('en-IN')}</td>
                        <td className="px-4 py-2 text-slate-600">{g.item_lines}</td>
                        <td className="px-4 py-2">
                          <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-medium">{g.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end gap-3 pb-6">
              <button
                onClick={() => setGpDetail(null)}
                className="border border-slate-300 text-slate-600 px-5 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
              >
                Back to List
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Slip View */}
      {gpDetail && showSlip && (
        <div className="fixed inset-0 bg-slate-100 z-50 overflow-y-auto flex flex-col items-center py-8">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setShowSlip(false)}
              className="border border-slate-300 text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-50 transition"
            >
              ← Back
            </button>
            <button
              onClick={async () => {
                const canvas = await html2canvas(slipRef.current, { scale: 2, backgroundColor: '#ffffff' });
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                pdf.save(`${gpDetail.gp_number}_slip.pdf`);
              }}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              ⬇ Download PDF
            </button>
          </div>

          <div ref={slipRef} className="bg-white border border-slate-300 rounded-lg p-8 w-80 text-center">
            <p className="text-xs text-slate-500 font-semibold tracking-wide">MATTRACK PRO</p>
            <p className="text-lg font-bold text-slate-800 mt-1">GATE PASS</p>
            <p className="text-sm text-slate-600 mb-4">{gpDetail.gp_number}</p>
            <hr className="mb-4" />
            <div className="flex justify-center mb-4">
              <QRCode
                value={JSON.stringify({
                  gp: gpDetail.gp_number,
                  supplier: gpDetail.supplier_name,
                  vehicle: gpDetail.vehicle_number,
                  type: gpDetail.gp_type
                })}
                size={160}
              />
            </div>
            <div className="flex justify-center mb-2">
              <Barcode value={gpDetail.gp_number} width={1.5} height={50} fontSize={12} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}