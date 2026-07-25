import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Shield, Plus, ChevronDown, ChevronUp, Save, RefreshCw } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const getAuthHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

const FEATURES = [
  'Dashboard', 'GatePass', 'GRN', 'Store', 'Quality', 
  'Production', 'MRN', 'ShopFloor', 'FG', 'Dispatch', 'Reports', 'Admin'
];

export default function AdminRoles() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [expandedRole, setExpandedRole] = useState(null);
  const [roleSearch, setRoleSearch] = useState('');
  const [featureSearch, setFeatureSearch] = useState('');

  // Create Role State
  const [isNewRoleOpen, setIsNewRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleMatrix, setNewRoleMatrix] = useState(
    FEATURES.map(f => ({
      feature_name: f,
      can_view: false, can_create: false, can_edit: false,
      can_delete: false, can_approve: false, can_print: false
    }))
  );

  // Editable permission matrix state for expanded role
  const [currentMatrix, setCurrentMatrix] = useState([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resRoles, resPerms] = await Promise.all([
        axios.get(`${API}/admin/roles`, getAuthHeader()),
        axios.get(`${API}/admin/permissions`, getAuthHeader())
      ]);
      setRoles(resRoles.data);
      setPermissions(resPerms.data);
      if (resRoles.data.length > 0 && !expandedRole) {
        setExpandedRole(resRoles.data[0].role_name);
      }
    } catch (err) {
      console.error('Failed to load roles and permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Update currentMatrix when expandedRole changes
  useEffect(() => {
    if (expandedRole) {
      const rolePerms = permissions.filter(p => p.role_name === expandedRole);
      const matrix = FEATURES.map(f => {
        const found = rolePerms.find(p => p.feature_name === f);
        return {
          feature_name: f,
          can_view: found ? Boolean(found.can_view) : false,
          can_create: found ? Boolean(found.can_create) : false,
          can_edit: found ? Boolean(found.can_edit) : false,
          can_delete: found ? Boolean(found.can_delete) : false,
          can_approve: found ? Boolean(found.can_approve) : false,
          can_print: found ? Boolean(found.can_print) : false,
        };
      });
      setCurrentMatrix(matrix);
    }
  }, [expandedRole, permissions]);

  const handleToggleCheckbox = (featureName, actionKey) => {
    setCurrentMatrix(prev => prev.map(item => {
      if (item.feature_name === featureName) {
        return { ...item, [actionKey]: !item[actionKey] };
      }
      return item;
    }));
  };

  const handleToggleNewRoleCheckbox = (featureName, actionKey) => {
    setNewRoleMatrix(prev => prev.map(item => {
      if (item.feature_name === featureName) {
        return { ...item, [actionKey]: !item[actionKey] };
      }
      return item;
    }));
  };

  const handleSavePermissions = async () => {
    try {
      await axios.post(`${API}/admin/permissions`, {
        role_name: expandedRole,
        permissions: currentMatrix
      }, getAuthHeader());

      // Update active user permissions in localStorage if sharing role
      const loggedUser = JSON.parse(localStorage.getItem('user') || '{}');
      if (loggedUser.role === expandedRole) {
        const permsMap = {};
        currentMatrix.forEach(p => { permsMap[p.feature_name] = p; });
        loggedUser.permissions = permsMap;
        localStorage.setItem('user', JSON.stringify(loggedUser));
      }

      alert(`Permissions saved successfully for ${expandedRole}!`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save permissions');
    }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (!newRoleName.trim()) return alert('Role name is required.');

    try {
      await axios.post(`${API}/admin/roles`, {
        role_name: newRoleName,
        initialPermissions: newRoleMatrix
      }, getAuthHeader());
      setIsNewRoleOpen(false);
      setNewRoleName('');
      setNewRoleMatrix(FEATURES.map(f => ({
        feature_name: f,
        can_view: false, can_create: false, can_edit: false,
        can_delete: false, can_approve: false, can_print: false
      })));
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create role');
    }
  };

  const filteredRoles = roles.filter(r => r.role_name.toLowerCase().includes(roleSearch.toLowerCase()));
  const filteredFeatures = currentMatrix.filter(f => f.feature_name.toLowerCase().includes(featureSearch.toLowerCase()));

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
            <Shield className="w-5 h-5 text-emerald-500" />
            <h1 className="text-lg font-black text-white">Roles & Permissions</h1>
          </div>
        </div>

        <button 
          onClick={() => setIsNewRoleOpen(!isNewRoleOpen)}
          className="bg-[#10b981] hover:bg-[#059669] text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/10"
        >
          <Plus className="w-4 h-4" /> New Role
        </button>
      </div>

      {/* SEARCH BARS */}
      <div className="bg-[#1e1e1e] p-4 rounded-xl border border-[#2a2a2a] flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text" placeholder="Search roles..." value={roleSearch}
            onChange={(e) => setRoleSearch(e.target.value)}
            className="w-full pl-3 pr-3 py-2 bg-[#121212] border border-[#333] rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
          />
        </div>
        <div className="relative flex-1">
          <input
            type="text" placeholder="Search features..." value={featureSearch}
            onChange={(e) => setFeatureSearch(e.target.value)}
            className="w-full pl-3 pr-3 py-2 bg-[#121212] border border-[#333] rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
          />
        </div>
      </div>

      {/* CREATE ROLE PANEL (Exact match to User Screenshot) */}
      {isNewRoleOpen && (
        <form onSubmit={handleCreateRole} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-6 space-y-5 shadow-2xl">
          <h2 className="text-sm font-black text-white">Create Role</h2>

          <div>
            <label className="block mb-1 text-slate-400 text-xs font-bold">Role Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. StoreManager"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              className="w-full max-w-md bg-[#121212] border border-[#333] rounded-lg p-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-[10px] font-black tracking-widest text-slate-400 uppercase">INITIAL PERMISSIONS</h3>

            <div className="overflow-x-auto border border-[#2a2a2a] rounded-lg">
              <table className="w-full text-left text-xs font-semibold border-collapse text-slate-300">
                <thead>
                  <tr className="bg-[#161616] text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-[#2a2a2a]">
                    <th className="py-2.5 px-4">FEATURE</th>
                    <th className="py-2.5 px-4 text-center">VIEW</th>
                    <th className="py-2.5 px-4 text-center">CREATE</th>
                    <th className="py-2.5 px-4 text-center">EDIT</th>
                    <th className="py-2.5 px-4 text-center">DELETE</th>
                    <th className="py-2.5 px-4 text-center">APPROVE</th>
                    <th className="py-2.5 px-4 text-center">PRINT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2a2a] bg-[#141414]">
                  {newRoleMatrix.map(item => (
                    <tr key={item.feature_name} className="hover:bg-[#1e1e1e]">
                      <td className="py-2.5 px-4 font-bold text-white">{item.feature_name}</td>
                      {['can_view', 'can_create', 'can_edit', 'can_delete', 'can_approve', 'can_print'].map(action => (
                        <td key={action} className="py-2.5 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={Boolean(item[action])}
                            onChange={() => handleToggleNewRoleCheckbox(item.feature_name, action)}
                            className="w-4 h-4 rounded border-[#333] text-emerald-500 focus:ring-0 bg-[#121212] cursor-pointer"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#2a2a2a]">
            <button 
              type="button" 
              onClick={() => setIsNewRoleOpen(false)} 
              className="px-4 py-2 bg-[#2a2a2a] text-slate-300 rounded-lg hover:bg-[#333] font-extrabold text-xs"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-6 py-2 bg-[#10b981] hover:bg-[#059669] text-white rounded-lg font-black text-xs shadow-lg shadow-emerald-500/10"
            >
              Create
            </button>
          </div>
        </form>
      )}

      {/* ROLES ACCORDION LIST */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-12"><RefreshCw className="w-8 h-8 animate-spin text-emerald-500" /></div>
        ) : (
          filteredRoles.map(role => {
            const isExpanded = expandedRole === role.role_name;

            return (
              <div key={role.role_id} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-md">
                <div 
                  onClick={() => setExpandedRole(isExpanded ? null : role.role_name)}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#252525] transition"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-emerald-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    <h3 className="text-xs font-black text-white">{role.role_name}</h3>
                    <span className="bg-[#121212] text-slate-400 border border-[#333] px-2 py-0.5 rounded text-[10px] font-bold">
                      {role.role_type || 'System Role'}
                    </span>
                  </div>
                </div>

                {/* EXPANDED PERMISSIONS MATRIX */}
                {isExpanded && (
                  <div className="p-4 border-t border-[#2a2a2a] bg-[#161616] space-y-4">
                    <div className="overflow-x-auto border border-[#2a2a2a] rounded-lg">
                      <table className="w-full text-left text-xs font-semibold border-collapse text-slate-300">
                        <thead>
                          <tr className="bg-[#121212] text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-[#2a2a2a]">
                            <th className="py-2.5 px-4">FEATURE</th>
                            <th className="py-2.5 px-4 text-center">VIEW</th>
                            <th className="py-2.5 px-4 text-center">CREATE</th>
                            <th className="py-2.5 px-4 text-center">EDIT</th>
                            <th className="py-2.5 px-4 text-center">DELETE</th>
                            <th className="py-2.5 px-4 text-center">APPROVE</th>
                            <th className="py-2.5 px-4 text-center">PRINT</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2a2a2a] bg-[#141414]">
                          {filteredFeatures.map(item => (
                            <tr key={item.feature_name} className="hover:bg-[#1e1e1e]">
                              <td className="py-2.5 px-4 font-bold text-white">{item.feature_name}</td>
                              {['can_view', 'can_create', 'can_edit', 'can_delete', 'can_approve', 'can_print'].map(action => (
                                <td key={action} className="py-2.5 px-4 text-center">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(item[action])}
                                    onChange={() => handleToggleCheckbox(item.feature_name, action)}
                                    className="w-4 h-4 rounded border-[#333] text-emerald-500 focus:ring-0 bg-[#121212] cursor-pointer"
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-start">
                      <button
                        onClick={handleSavePermissions}
                        className="bg-[#10b981] hover:bg-[#059669] text-white px-4 py-2 rounded-lg text-xs font-black flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/10"
                      >
                        <Save className="w-4 h-4" /> Save Permissions
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
