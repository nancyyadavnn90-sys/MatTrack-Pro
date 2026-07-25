import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Settings, Hash, Users, Shield, Package, Truck, UserCheck, 
  Cpu, Home, Component, Search, ChevronRight
} from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const getAuthHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [counts, setCounts] = useState({ items: 0, suppliers: 0, customers: 0, machines: 0, stores: 0, moulds: 0, users: 0 });

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [resI, resS, resC, resM, resSt, resMo, resU] = await Promise.all([
          axios.get(`${API}/admin/items`, getAuthHeader()),
          axios.get(`${API}/admin/suppliers`, getAuthHeader()),
          axios.get(`${API}/admin/customers`, getAuthHeader()),
          axios.get(`${API}/admin/machines`, getAuthHeader()),
          axios.get(`${API}/admin/stores`, getAuthHeader()),
          axios.get(`${API}/admin/moulds`, getAuthHeader()),
          axios.get(`${API}/admin/users`, getAuthHeader())
        ]);
        setCounts({
          items: resI.data?.length || 0,
          suppliers: resS.data?.length || 0,
          customers: resC.data?.length || 0,
          machines: resM.data?.length || 0,
          stores: resSt.data?.length || 0,
          moulds: resMo.data?.length || 0,
          users: resU.data?.length || 0
        });
      } catch (err) {
        console.error('Failed to fetch admin stats:', err);
      }
    };
    fetchCounts();
  }, []);

  const adminCategories = [
    {
      title: 'MASTER DATA',
      items: [
        {
          name: 'Item / Product Master',
          desc: 'Manage all raw materials, WIP items, consumables, and finished goods.',
          count: `${counts.items} Items`,
          icon: Package,
          path: '/admin/items'
        },
        {
          name: 'Supplier Master',
          desc: 'Manage raw material suppliers, contacts, GSTIN, and payment terms.',
          count: `${counts.suppliers} Suppliers`,
          icon: Truck,
          path: '/admin/suppliers'
        },
        {
          name: 'Customer Master',
          desc: 'Manage customers (Hero, Honda, Yamaha), GSTIN, billing, and delivery addresses.',
          count: `${counts.customers} Customers`,
          icon: UserCheck,
          path: '/admin/customers'
        }
      ]
    },
    {
      title: 'PRODUCTION & PLANT MASTERS',
      items: [
        {
          name: 'Machine Master',
          desc: 'Configure moulding presses, capacity, platen size, and Ideal Cycle Time for OEE.',
          count: `${counts.machines} Machines`,
          icon: Cpu,
          path: '/admin/machines'
        },
        {
          name: 'Store Master',
          desc: 'Manage Raw Material, WIP, Finished Good, Consumable, and Quarantine stores.',
          count: `${counts.stores} Stores`,
          icon: Home,
          path: '/admin/stores'
        },
        {
          name: 'Mould / Tool Master',
          desc: 'Configure moulds, cavities, compatible machines, and shot life maintenance limits.',
          count: `${counts.moulds} Moulds`,
          icon: Component,
          path: '/admin/moulds'
        }
      ]
    },
    {
      title: 'SYSTEM CONFIGURATION',
      items: [
        {
          name: 'Number Series Configuration',
          desc: 'Configure auto-numbering prefixes and sequences for GP, GRN, WO, DO, FGR, QC.',
          count: '10 Series',
          icon: Hash,
          path: '/admin/number-series'
        },
        {
          name: 'System Settings',
          desc: 'Manage company info, shifts (Morning/Evening/Night), OEE targets, and alert emails.',
          count: '4 Sections',
          icon: Settings,
          path: '/admin/settings'
        }
      ]
    },
    {
      title: 'SECURITY & USER ACCESS',
      items: [
        {
          name: 'User Management',
          desc: 'Create and manage user accounts, assign roles, reset passwords, and active status.',
          count: `${counts.users} Accounts`,
          icon: Users,
          path: '/admin/users'
        },
        {
          name: 'Roles & Permissions',
          desc: 'Define system roles and grant per-feature access matrix (View/Create/Edit/Approve).',
          count: 'Permissions Matrix',
          icon: Shield,
          path: '/admin/roles'
        }
      ]
    }
  ];

  return (
    <div className="bg-[#121212] text-slate-200 min-h-screen p-6 font-sans space-y-8">
      
      {/* HEADER ROW WITH SEARCH */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2a2a2a] pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white tracking-wide">Administration Portal</h1>
            <p className="text-xs text-slate-400 font-medium">Master configuration backbone for MatTrack Pro</p>
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search master modules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-3 py-2 bg-[#1e1e1e] border border-[#3a3a3a] rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 w-72 font-semibold placeholder-slate-400 shadow-md"
          />
        </div>
      </div>

      {/* CATEGORY GRID SECTIONS */}
      <div className="space-y-8">
        {adminCategories.map((cat, idx) => {
          const filteredItems = cat.items.filter(item => 
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.desc.toLowerCase().includes(searchQuery.toLowerCase())
          );

          if (searchQuery && filteredItems.length === 0) return null;

          return (
            <div key={idx} className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-black tracking-widest text-slate-400 uppercase">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>{cat.title}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map((item, itemIdx) => {
                  const IconComp = item.icon;
                  return (
                    <div
                      key={itemIdx}
                      onClick={() => navigate(item.path)}
                      className="bg-[#1e1e1e] hover:bg-[#252525] border border-[#2a2a2a] hover:border-emerald-500/40 rounded-xl p-5 flex flex-col justify-between cursor-pointer transition group shadow-lg space-y-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="p-3 rounded-xl bg-[#121212] border border-[#2a2a2a] text-emerald-400 group-hover:scale-110 transition">
                          <IconComp className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-black uppercase text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                          {item.count}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-sm font-black text-white group-hover:text-emerald-400 transition">{item.name}</h3>
                        <p className="text-xs text-slate-400 font-medium leading-relaxed">{item.desc}</p>
                      </div>

                      <div className="flex items-center justify-end text-xs font-bold text-slate-400 group-hover:text-emerald-400 transition pt-2 border-t border-[#2a2a2a]">
                        Configure Master <ChevronRight className="w-4 h-4 ml-1" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
