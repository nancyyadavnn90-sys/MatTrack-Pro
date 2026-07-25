import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import GatePass from './pages/GatePass';
import GRN from './pages/GRN';
import Inventory from './pages/Inventory';
import Quality from './pages/Quality';
import Production from './pages/Production';
import Mixing from './pages/Mixing';
import Moulding from './pages/Moulding';
import FinalQC from './pages/FinalQC';
import FGReceipt from './pages/FGReceipt';
import Dispatch from './pages/Dispatch';
import WIPKanban from './pages/WIPKanban';
import OperatorScan from './pages/OperatorScan';
import OEEDashboard from './pages/OEEDashboard';
import ShiftLog from './pages/ShiftLog';
import MachineDetail from './pages/MachineDetail';
import OEEReports from './pages/OEEReports';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminRoles from './pages/admin/AdminRoles';
import AdminOperations from './pages/admin/AdminOperations';
import AdminUOM from './pages/admin/AdminUOM';
import AdminStores from './pages/admin/AdminStores';
import AdminCustomers from './pages/admin/AdminCustomers';
import AdminItems from './pages/admin/AdminItems';
import AdminSuppliers from './pages/admin/AdminSuppliers';
import AdminMachines from './pages/admin/AdminMachines';
import AdminMoulds from './pages/admin/AdminMoulds';
import AdminSettings from './pages/admin/AdminSettings';
import AdminNumberSeries from './pages/admin/AdminNumberSeries';
import Layout from './components/Layout';
import { ShieldAlert } from 'lucide-react';

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

function ProtectedRoute({ children, routePath }) {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  if (!token) return <Navigate to="/" />;

  const isSuperAdmin = 
    user.role === 'Admin' || 
    user.role === 'System Administrator' || 
    user.email === 'admin@jayashree.com' || 
    user.email === 'nancy@jayashree.com' || 
    user.email === 'khushi@jayashree.com';

  // Dashboard is open to all authenticated users
  if (routePath === '/dashboard') {
    return <Layout>{children}</Layout>;
  }

  if (!isSuperAdmin && routePath && user.permissions) {
    const featureName = featureMap[routePath] || (routePath.startsWith('/admin') ? 'Admin' : null);
    if (featureName && featureName !== 'Dashboard') {
      const perm = user.permissions[featureName];
      if (perm && (perm.can_view === false || perm.can_view === 0)) {
        return (
          <Layout>
            <div className="bg-[#121212] min-h-[75vh] flex flex-col items-center justify-center p-8 text-center text-slate-200 space-y-3 rounded-2xl border border-[#2a2a2a] my-6">
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400">
                <ShieldAlert className="w-12 h-12" />
              </div>
              <h2 className="text-xl font-black text-white">Access Denied</h2>
              <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                Your account role (<strong>{user.role}</strong>) does not have permission to view the <strong>{featureName}</strong> module.
              </p>
            </div>
          </Layout>
        );
      }
    }
  }

  return <Layout>{children}</Layout>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute routePath="/dashboard"><Dashboard /></ProtectedRoute>} />
        <Route path="/gate-pass" element={<ProtectedRoute routePath="/gate-pass"><GatePass /></ProtectedRoute>} />
        <Route path="/grn" element={<ProtectedRoute routePath="/grn"><GRN /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute routePath="/inventory"><Inventory /></ProtectedRoute>} />
        <Route path="/quality" element={<ProtectedRoute routePath="/quality"><Quality /></ProtectedRoute>} />
        <Route path="/production" element={<ProtectedRoute routePath="/production"><Production /></ProtectedRoute>} />
        <Route path="/mixing" element={<ProtectedRoute routePath="/mixing"><Mixing /></ProtectedRoute>} />
        <Route path="/moulding" element={<ProtectedRoute routePath="/moulding"><Moulding /></ProtectedRoute>} />
        <Route path="/final-qc" element={<ProtectedRoute routePath="/final-qc"><FinalQC /></ProtectedRoute>} />
        <Route path="/fg-receipt" element={<ProtectedRoute routePath="/fg-receipt"><FGReceipt /></ProtectedRoute>} />
        <Route path="/dispatch" element={<ProtectedRoute routePath="/dispatch"><Dispatch /></ProtectedRoute>} />
        <Route path="/wip" element={<ProtectedRoute routePath="/wip"><WIPKanban /></ProtectedRoute>} />
        <Route path="/wip/scan" element={<ProtectedRoute routePath="/wip/scan"><OperatorScan /></ProtectedRoute>} />
        <Route path="/oee" element={<ProtectedRoute routePath="/oee"><OEEDashboard /></ProtectedRoute>} />
        <Route path="/oee/shift-log" element={<ProtectedRoute routePath="/oee/shift-log"><ShiftLog /></ProtectedRoute>} />
        <Route path="/oee/machine/:id" element={<ProtectedRoute routePath="/oee"><MachineDetail /></ProtectedRoute>} />
        <Route path="/oee/reports" element={<ProtectedRoute routePath="/oee/reports"><OEEReports /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute routePath="/oee/reports"><OEEReports /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute routePath="/admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute routePath="/admin"><AdminUsers /></ProtectedRoute>} />
        <Route path="/admin/roles" element={<ProtectedRoute routePath="/admin"><AdminRoles /></ProtectedRoute>} />
        <Route path="/admin/operations" element={<ProtectedRoute routePath="/admin"><AdminOperations /></ProtectedRoute>} />
        <Route path="/admin/uom" element={<ProtectedRoute routePath="/admin"><AdminUOM /></ProtectedRoute>} />
        <Route path="/admin/stores" element={<ProtectedRoute routePath="/admin"><AdminStores /></ProtectedRoute>} />
        <Route path="/admin/customers" element={<ProtectedRoute routePath="/admin"><AdminCustomers /></ProtectedRoute>} />
        <Route path="/admin/items" element={<ProtectedRoute routePath="/admin"><AdminItems /></ProtectedRoute>} />
        <Route path="/admin/suppliers" element={<ProtectedRoute routePath="/admin"><AdminSuppliers /></ProtectedRoute>} />
        <Route path="/admin/machines" element={<ProtectedRoute routePath="/admin"><AdminMachines /></ProtectedRoute>} />
        <Route path="/admin/moulds" element={<ProtectedRoute routePath="/admin"><AdminMoulds /></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute routePath="/admin"><AdminSettings /></ProtectedRoute>} />
        <Route path="/admin/number-series" element={<ProtectedRoute routePath="/admin"><AdminNumberSeries /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;