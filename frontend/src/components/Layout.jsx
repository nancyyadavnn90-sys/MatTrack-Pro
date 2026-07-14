import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
];

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const userMenuRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const notifications = [
    { text: 'Batch B/26/034 stuck at Curing 4.5h', type: 'red', time: '2 min ago' },
    { text: 'Machine 3 OEE at 58% — below benchmark', type: 'red', time: '15 min ago' },
    { text: '5 QC items pending inspection', type: 'amber', time: '1 hr ago' },
    { text: '3 batches completed — Hero, Honda', type: 'green', time: '2 hr ago' },
  ];

  return (
    <div className="flex h-screen bg-slate-100">
      {/* Sidebar */}
      <aside className={`bg-slate-900 text-white transition-all duration-300 flex flex-col ${sidebarOpen ? 'w-64' : 'w-20'}`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700">
          <img src={logo} alt="logo" className="w-10 h-10 rounded-lg flex-shrink-0" />
          {sidebarOpen && (
            <div>
              <p className="font-bold text-sm leading-tight">
                MatTrack<span className="text-orange-500">-Pro</span>
              </p>
              <p className="text-slate-400 text-xs">Jayashree Polymers</p>
            </div>
          )}
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-orange-500 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="border-t border-slate-700 p-2">
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
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-600 hover:text-orange-500 transition"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-4">

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => { setShowNotif(!showNotif); setShowUserMenu(false); }}
                className="relative text-slate-600 hover:text-orange-500 transition"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full"></span>
              </button>

              {showNotif && (
                <div className="absolute right-0 mt-3 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl z-50">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-slate-800 font-semibold text-sm">Notifications</span>
                    <span className="text-xs text-orange-500 cursor-pointer hover:underline">Mark all read</span>
                  </div>
                  {notifications.map((n, i) => (
                    <div key={i} className="px-4 py-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer">
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                          n.type === 'red' ? 'bg-red-500' :
                          n.type === 'amber' ? 'bg-amber-500' : 'bg-green-500'
                        }`}></div>
                        <div>
                          <p className="text-slate-700 text-xs">{n.text}</p>
                          <p className="text-slate-400 text-xs mt-1">{n.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="px-4 py-2.5 text-center">
                    <span className="text-orange-500 text-xs cursor-pointer hover:underline">View all notifications</span>
                  </div>
                </div>
              )}
            </div>

            {/* User dropdown */}
            <div className="relative pl-4 border-l border-slate-200" ref={userMenuRef}>
              <button
                onClick={() => { setShowUserMenu(!showUserMenu); setShowNotif(false); }}
                className="flex items-center gap-2 hover:opacity-80 transition"
              >
                <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-white font-semibold text-sm">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-slate-800 leading-tight">{user?.name}</p>
                  <p className="text-xs text-slate-500">{user?.role}</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-3 w-56 bg-white border border-slate-200 rounded-xl shadow-2xl z-50">
                  {/* User info */}
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-xs text-slate-500">Signed in as</p>
                    <p className="text-sm font-semibold text-slate-800 truncate">{user?.email || 'admin@jayashree.com'}</p>
                  </div>

                  {/* Menu items */}
                  <div className="py-1">
                    <button
                      onClick={() => { setShowUserMenu(false); navigate('/profile'); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-700 hover:bg-slate-50 hover:text-orange-500 transition text-sm"
                    >
                      <User className="w-4 h-4" />
                      Profile
                    </button>
                    <button
                      onClick={() => { setShowUserMenu(false); navigate('/settings'); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-700 hover:bg-slate-50 hover:text-orange-500 transition text-sm"
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </button>
                  </div>

                  {/* Sign out */}
                  <div className="border-t border-slate-100 py-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-red-500 hover:bg-red-50 transition text-sm"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
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