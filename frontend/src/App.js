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
import Layout from './components/Layout';

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/" />;
  return <Layout>{children}</Layout>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/gate-pass" element={<ProtectedRoute><GatePass /></ProtectedRoute>} />
        <Route path="/grn" element={<ProtectedRoute><GRN /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
        <Route path="/quality" element={<ProtectedRoute><Quality /></ProtectedRoute>} />
        <Route path="/production" element={<ProtectedRoute><Production /></ProtectedRoute>} />
        <Route path="/mixing" element={<ProtectedRoute><Mixing /></ProtectedRoute>} />
        <Route path="/moulding" element={<ProtectedRoute><Moulding /></ProtectedRoute>} />
        <Route path="/final-qc" element={<ProtectedRoute><FinalQC /></ProtectedRoute>} />
        <Route path="/fg-receipt" element={<ProtectedRoute><FGReceipt /></ProtectedRoute>} />
        <Route path="/dispatch" element={<ProtectedRoute><Dispatch /></ProtectedRoute>} />
        <Route path="/wip" element={<ProtectedRoute><WIPKanban /></ProtectedRoute>} />
        <Route path="/wip/scan" element={<ProtectedRoute><OperatorScan /></ProtectedRoute>} />
        <Route path="/oee" element={<ProtectedRoute><WIPKanban initialTab="reports" /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;