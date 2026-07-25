import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  LayoutDashboard, Package, PackageOpen, ClipboardCheck, Factory, Boxes,
  Truck, BarChart3, LogOut, Menu, X, ChevronDown, Bell, User, Settings, ShieldCheck
} from 'lucide-react';
import logo from '../assets/logo.png';

const menuItems = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { name: 'Gate Pass', icon: Package, path: '/gate-pass' },
  { name: 'GRN', icon: PackageOpen, path: '/grn' },
  { name: 'Inventory', icon: Boxes, path: '/inventory' },
  { name: 'Quality Control', icon: ClipboardCheck, path: '/quality' },
  { name: 'Mixing', icon: Factory, path: '/mixing' },
  { name: 'Moulding', icon: Factory, path: '/moulding' },
  { name: 'Production / WO', icon: Factory, path: '/production' },
  { name: 'Final QC', icon: ShieldCheck, path: '/final-qc' },
  { name: 'FG Receipt', icon: Boxes, path: '/fg-receipt' },
  { name: 'Dispatch', icon: Truck, path: '/dispatch' },
  { name: 'WIP Tracking', icon: BarChart3, path: '/wip' },
  { name: 'OEE Dashboard', icon: BarChart3, path: '/oee' },
  { name: 'OEE Shift Log', icon: ClipboardCheck, path: '/oee/shift-log' },
  { name: 'Reports', icon: BarChart3, path: '/oee/reports' },
  { name: 'Admin Portal', icon: ShieldCheck, path: '/admin' },
];

const featureMap = {
  '/dashboard': 'Dashboard',
  '/gate-pass': 'GatePass',
  '/grn': 'GRN',
  '/inventory': 'Store',
  '/quality': 'Quality',
  '/mixing': 'Production',
  '/moulding': 'Production',
  '/production': 'Production',
  '/final-qc': 'Quality',
  '/fg-receipt': 'FG',
  '/dispatch': 'Dispatch',
  '/wip': 'ShopFloor',
  '/oee': 'Production',
  '/oee/shift-log': 'Production',
  '/oee/reports': 'Reports',
  '/admin': 'Admin'
};

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const userMenuRef = useRef(null);
  const notifRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const [notifications, setNotifications] = useState([
    { id: 1, text: 'Batch B/26/034 stuck at Curing 4.5h', type: 'red', time: '2 min ago', read: false, path: '/wip' },
    { id: 2, text: 'Machine 3 OEE at 58% — below benchmark', type: 'red', time: '15 min ago', read: false, path: '/oee' },
    { id: 3, text: '3 QC items pending inspection', type: 'amber', time: '1 hr ago', read: false, path: '/quality' },
    { id: 4, text: '3 batches completed — Hero, Honda', type: 'green', time: '2 hr ago', read: false, path: '/wip' },
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const isSuperAdmin = 
    user.role === 'Admin' || 
    user.role === 'System Administrator' || 
    user.email === 'admin@jayashree.com' || 
    user.email === 'nancy@jayashree.com' || 
    user.email === 'khushi@jayashree.com';

  const visibleMenuItems = menuItems.filter(item => {
    if (item.path === '/admin') return isSuperAdmin;
    if (isSuperAdmin) return true;
    if (item.path === '/dashboard') return true;
    const featureName = featureMap[item.path];
    if (!featureName) return true;
    if (!user.permissions || Object.keys(user.permissions).length === 0) return true;
    const perm = user.permissions[featureName];
    if (!perm) return true;
    return perm.can_view === true || perm.can_view === 1;
  });

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotif(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch Live Real Data Notifications Automatically
  const fetchLiveNotifications = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/dashboard/notifications');
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setNotifications(res.data);
      }
    } catch (err) {
      console.log('Using active notifications fallback');
    }
  };

  useEffect(() => {
    fetchLiveNotifications();
    const interval = setInterval(fetchLiveNotifications, 30000); // Auto-update every 30s
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleNotificationClick = (notif) => {
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    setShowNotif(false);
    if (notif.path) navigate(notif.path);
  };

  return (
    <div className="flex h-screen bg-[#121212] text-slate-200 font-sans">
      {/* Sidebar */}
      <aside className={`bg-[#181818] border-r border-[#2a2a2a] text-white transition-all duration-300 flex flex-col ${sidebarOpen ? 'w-64' : 'w-20'}`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-[#2a2a2a]">
          <img src={logo} alt="logo" className="w-10 h-10 rounded-lg flex-shrink-0" />
          {sidebarOpen && (
            <div>
              <p className="font-bold text-sm leading-tight text-white">
                MatTrack<span className="text-emerald-400">-Pro</span>
              </p>
              <p className="text-slate-400 text-xs font-medium">Jayashree Polymers</p>
            </div>
          )}
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                    : 'text-slate-300 hover:bg-[#252525] hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="border-t border-[#2a2a2a] p-2">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition w-full"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#121212]">
        {/* Topbar */}
        <header className="bg-[#1e1e1e] border-b border-[#2a2a2a] px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-300 hover:text-emerald-400 transition"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-4">

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { setShowNotif(!showNotif); setShowUserMenu(false); }}
                className="relative text-slate-300 hover:text-emerald-400 transition p-1.5 rounded-lg hover:bg-[#252525]"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-[#1e1e1e] animate-pulse"></span>
                )}
              </button>

              {showNotif && (
                <div className="absolute right-0 mt-3 w-80 bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-[#2a2a2a]">
                  <div className="px-4 py-3 bg-[#252525] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-black text-xs uppercase tracking-wider">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-black px-1.5 py-0.5 rounded-full border border-emerald-500/30">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold transition hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-[#2a2a2a]">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`px-4 py-3 hover:bg-[#252525] cursor-pointer transition flex items-start gap-3 ${
                          !n.read ? 'bg-emerald-500/5' : 'opacity-70'
                        }`}
                      >
                        <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${
                          n.type === 'red' ? 'bg-red-500 shadow-sm shadow-red-500/50' :
                          n.type === 'amber' ? 'bg-amber-500 shadow-sm shadow-amber-500/50' : 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                        }`}></div>
                        <div className="flex-1">
                          <p className={`text-xs ${!n.read ? 'text-white font-extrabold' : 'text-slate-300 font-medium'}`}>
                            {n.text}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono mt-1">{n.time}</p>
                        </div>
                      </div>
                    ))}
                    {notifications.length === 0 && (
                      <div className="px-4 py-6 text-center text-xs text-slate-400 italic">No notifications.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User dropdown */}
            <div className="relative pl-4 border-l border-[#2a2a2a]" ref={userMenuRef}>
              <button
                onClick={() => { setShowUserMenu(!showUserMenu); setShowNotif(false); }}
                className="flex items-center gap-2 hover:opacity-80 transition"
              >
                <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white font-black text-sm">
                  {user?.name?.charAt(0) || 'N'}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-xs font-bold text-white leading-tight">{user?.name || 'Nancy Yadav'}</p>
                  <p className="text-[10px] text-slate-400 font-medium">{user?.role || 'Manager'}</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-3 w-56 bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-[#2a2a2a]">
                  {/* User info */}
                  <div className="px-4 py-3 bg-[#252525]">
                    <p className="text-[10px] text-slate-400 font-medium">Signed in as</p>
                    <p className="text-xs font-black text-emerald-400 truncate mt-0.5">{user?.email || user?.username || 'admin@jayashree.com'}</p>
                  </div>

                  {/* Options */}
                  <div className="p-1 space-y-0.5">
                    <Link
                      to="/profile"
                      onClick={() => setShowUserMenu(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-200 hover:bg-[#252525] hover:text-white rounded-lg transition text-xs font-bold"
                    >
                      <User className="w-4 h-4 text-emerald-400" /> Profile
                    </Link>
                    <Link
                      to="/admin/settings"
                      onClick={() => setShowUserMenu(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-200 hover:bg-[#252525] hover:text-white rounded-lg transition text-xs font-bold"
                    >
                      <Settings className="w-4 h-4 text-slate-400" /> Settings
                    </Link>
                  </div>

                  {/* Sign out */}
                  <div className="p-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-red-400 hover:bg-red-500/20 rounded-lg transition text-xs font-black"
                    >
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}