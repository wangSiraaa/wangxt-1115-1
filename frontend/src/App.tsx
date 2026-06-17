import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import ExpiryListPage from './pages/ExpiryList';
import ExpiryListDetail from './pages/ExpiryListDetail';
import AllocationPage from './pages/Allocation';
import AllocationDetail from './pages/AllocationDetail';
import SettlementPage from './pages/Settlement';
import SettlementDetail from './pages/SettlementDetail';

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="expiry-lists" element={<ExpiryListPage />} />
        <Route path="expiry-lists/:id" element={<ExpiryListDetail />} />
        <Route path="allocations" element={<AllocationPage />} />
        <Route path="allocations/:id" element={<AllocationDetail />} />
        <Route path="settlements" element={<SettlementPage />} />
        <Route path="settlements/:id" element={<SettlementDetail />} />
      </Route>
    </Routes>
  );
}

export default App;
