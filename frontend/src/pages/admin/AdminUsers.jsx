import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Users, Plus, Search, Edit2, Key, Ban, Check, X, Shield, RefreshCw, Trash2 } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const getAuthHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);

  const [targetUser, setTargetUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '', username: '', email: '', phone: '', role: 'Operator', department: '', password: '', confirmPassword: '', active: true
  });
  const [resetPass, setResetPass] = useState({ newPassword: '', confirmPassword: '' });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/admin/users`, getAuthHeader());
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      return alert('Passwords do not match.');
    }
    try {
      await axios.post(`${API}/admin/users`, {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        department: formData.department,
        status: formData.active ? 'Active' : 'Inactive'
      }, getAuthHeader());
      setIsCreateOpen(false);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create user');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API}/admin/users/${targetUser.user_id}`, {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        department: formData.department,
        status: formData.active ? 'Active' : 'Inactive'
      }, getAuthHeader());
      setIsEditOpen(false);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update user');
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (resetPass.newPassword !== resetPass.confirmPassword) {
      return alert('Passwords do not match.');
    }
    try {
      await axios.post(`${API}/admin/users/${targetUser.user_id}/reset-password`, {
        newPassword: resetPass.newPassword
      }, getAuthHeader());
      setIsResetOpen(false);
      alert('Password reset successfully!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reset password');
    }
  };

  const handleDeleteUser = async (userObj) => {
    if (window.confirm(`Are you sure you want to delete user "${userObj.name}" (${userObj.email})? This action cannot be undone.`)) {
      try {
        await axios.delete(`${API}/admin/users/${userObj.user_id}`, getAuthHeader());
        alert(`User "${userObj.name}" deleted successfully.`);
        fetchUsers();
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to delete user.');
      }
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || u.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
            <Users className="w-5 h-5 text-emerald-500" />
            <h1 className="text-lg font-black text-white">Users</h1>
          </div>
        </div>

        <button 
          onClick={() => {
            setFormData({ name: '', username: '', email: '', phone: '', role: 'Operator', department: '', password: '', confirmPassword: '', active: true });
            setIsCreateOpen(true);
          }}
          className="bg-[#10b981] hover:bg-[#059669] text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/10"
        >
          <Plus className="w-4 h-4" /> Create User
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="bg-[#1e1e1e] p-4 rounded-xl border border-[#2a2a2a] flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <input
            type="text"
            placeholder="Search by name, email, username, role, department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-8 py-2 bg-[#121212] border border-[#333] rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#121212] border border-[#333] text-white text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500 font-bold"
        >
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {/* USERS TABLE */}
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="flex justify-center py-12"><RefreshCw className="w-8 h-8 animate-spin text-emerald-500" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-medium text-slate-300">
              <thead className="bg-[#161616] text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-[#2a2a2a]">
                <tr>
                  <th className="py-3 px-4">USERNAME</th>
                  <th className="py-3 px-4">FULL NAME</th>
                  <th className="py-3 px-4">EMAIL</th>
                  <th className="py-3 px-4">PHONE</th>
                  <th className="py-3 px-4">DEPARTMENT</th>
                  <th className="py-3 px-4">ROLE</th>
                  <th className="py-3 px-4 text-center">STATUS</th>
                  <th className="py-3 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {filteredUsers.map(u => (
                  <tr key={u.user_id} className="hover:bg-[#252525]">
                    <td className="py-3 px-4 font-bold text-white">{u.email.split('@')[0]}</td>
                    <td className="py-3 px-4 text-slate-200 font-semibold">{u.name}</td>
                    <td className="py-3 px-4 text-slate-400">{u.email}</td>
                    <td className="py-3 px-4 text-slate-500">—</td>
                    <td className="py-3 px-4 text-slate-300">{u.department || 'Production'}</td>
                    <td className="py-3 px-4">
                      <span className="bg-[#121212] text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-md text-[10px] font-black uppercase">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        u.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'Active' ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          onClick={() => {
                            setTargetUser(u);
                            setFormData({ name: u.name, username: u.email.split('@')[0], email: u.email, phone: '', role: u.role, department: u.department, active: u.status === 'Active' });
                            setIsEditOpen(true);
                          }}
                          className="p-1.5 bg-[#121212] hover:bg-[#333] border border-[#333] rounded-md text-emerald-400 transition" 
                          title="Edit User"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => {
                            setTargetUser(u);
                            setResetPass({ newPassword: '', confirmPassword: '' });
                            setIsResetOpen(true);
                          }}
                          className="p-1.5 bg-[#121212] hover:bg-[#333] border border-[#333] rounded-md text-amber-400 transition" 
                          title="Reset Password"
                        >
                          <Key className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(u)}
                          className="p-1.5 bg-[#121212] hover:bg-red-500/20 border border-[#333] hover:border-red-500/40 rounded-md text-red-400 hover:text-red-300 transition" 
                          title="Delete User"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan="8" className="py-8 text-center text-slate-500 italic">No users matching search filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE USER MODAL (Matches Page 8) */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#1e1e1e] border border-[#333] rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#2a2a2a] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                  <Users className="w-5 h-5" />
                </div>
                <h2 className="text-base font-black text-white">Create User</h2>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs font-semibold text-slate-300">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Full Name *</label>
                  <input
                    type="text" required placeholder="John Doe" value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Username *</label>
                  <input
                    type="text" required placeholder="johndoe" value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Email *</label>
                  <input
                    type="email" required placeholder="john@example.com" value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Mobile Number</label>
                  <input
                    type="text" placeholder="+91 98765 43210" value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500 font-bold"
                  >
                    <option value="Admin">System Administrator</option>
                    <option value="Operator">Operator</option>
                    <option value="QCInspector">QCInspector</option>
                    <option value="StoreUser">StoreUser</option>
                    <option value="DispatchUser">DispatchUser</option>
                    <option value="ProductionPlanner">ProductionPlanner</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Department</label>
                  <input
                    type="text" placeholder="e.g. Production" value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Password *</label>
                  <input
                    type="password" required placeholder="••••••••" value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Confirm Password *</label>
                  <input
                    type="password" required placeholder="Re-enter password" value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox" id="activeCheck" checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="rounded border-[#333] text-emerald-500 focus:ring-0 w-4 h-4 bg-[#121212]"
                />
                <label htmlFor="activeCheck" className="text-xs font-bold text-white cursor-pointer">Active</label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-[#2a2a2a]">
                <button type="button" onClick={() => setIsCreateOpen(false)} className="px-4 py-2 bg-[#2a2a2a] text-slate-300 rounded-lg hover:bg-[#333] font-bold">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-[#10b981] hover:bg-[#059669] text-white rounded-lg font-black shadow-lg shadow-emerald-500/10">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL (Matches Page 9) */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#1e1e1e] border border-[#333] rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#2a2a2a] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                  <Edit2 className="w-5 h-5" />
                </div>
                <h2 className="text-base font-black text-white">Edit User</h2>
              </div>
              <button onClick={() => setIsEditOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs font-semibold text-slate-300">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Full Name *</label>
                  <input
                    type="text" required value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Username</label>
                  <input
                    type="text" disabled value={formData.username}
                    className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-slate-500 font-medium opacity-60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Email</label>
                  <input
                    type="email" required value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Mobile Number</label>
                  <input
                    type="text" value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500 font-bold"
                  >
                    <option value="Admin">System Administrator</option>
                    <option value="Operator">Operator</option>
                    <option value="QCInspector">QCInspector</option>
                    <option value="StoreUser">StoreUser</option>
                    <option value="DispatchUser">DispatchUser</option>
                    <option value="ProductionPlanner">ProductionPlanner</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-slate-400 text-[11px]">Department</label>
                  <input
                    type="text" value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox" id="editActiveCheck" checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="rounded border-[#333] text-emerald-500 focus:ring-0 w-4 h-4 bg-[#121212]"
                />
                <label htmlFor="editActiveCheck" className="text-xs font-bold text-white cursor-pointer">Active</label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-[#2a2a2a]">
                <button type="button" onClick={() => setIsEditOpen(false)} className="px-4 py-2 bg-[#2a2a2a] text-slate-300 rounded-lg hover:bg-[#333] font-bold">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-[#10b981] hover:bg-[#059669] text-white rounded-lg font-black shadow-lg shadow-emerald-500/10">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL (Matches Page 7) */}
      {isResetOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#1e1e1e] border border-[#333] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#2a2a2a] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-white">Reset Password</h2>
                  <p className="text-[10px] text-slate-400">for {targetUser?.name} ({targetUser?.email})</p>
                </div>
              </div>
              <button onClick={() => setIsResetOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleResetSubmit} className="space-y-4 text-xs font-semibold text-slate-300">
              <div>
                <label className="block mb-1 text-slate-400 text-[11px]">New Password *</label>
                <input
                  type="password" required value={resetPass.newPassword}
                  onChange={(e) => setResetPass({ ...resetPass, newPassword: e.target.value })}
                  className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block mb-1 text-slate-400 text-[11px]">Confirm Password *</label>
                <input
                  type="password" required value={resetPass.confirmPassword}
                  onChange={(e) => setResetPass({ ...resetPass, confirmPassword: e.target.value })}
                  className="w-full bg-[#121212] border border-[#333] rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>

              <p className="text-[10px] text-slate-500">Password must be at least 4 characters long.</p>

              <div className="flex justify-end gap-2 pt-4 border-t border-[#2a2a2a]">
                <button type="button" onClick={() => setIsResetOpen(false)} className="px-4 py-2 bg-[#2a2a2a] text-slate-300 rounded-lg hover:bg-[#333] font-bold">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-[#10b981] hover:bg-[#059669] text-white rounded-lg font-black shadow-lg shadow-emerald-500/10">Reset Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
