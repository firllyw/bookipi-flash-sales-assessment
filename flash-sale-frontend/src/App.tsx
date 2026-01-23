import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { CustomerPage } from './pages/CustomerPage';
import { AdminDashboard, CreateSale, SaleDetail } from './pages/admin';

function App() {
  return (
    <Router>
      <Routes>
        {/* Customer Routes */}
        <Route path="/" element={<CustomerPage />} />
        <Route path="/sale/:id" element={<CustomerPage />} />

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/create" element={<CreateSale />} />
        <Route path="/admin/sale/:id" element={<SaleDetail />} />
      </Routes>
    </Router>
  );
}

export default App;
