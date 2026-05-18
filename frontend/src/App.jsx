import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Recipients from './pages/Recipients';
import NewBatch from './pages/NewBatch';
import AuditTrail from './pages/AuditTrail';
import BatchDetail from './pages/BatchDetail';

function Private({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/dashboard" element={<Private><Dashboard /></Private>} />
      <Route path="/recipients" element={<Private><Recipients /></Private>} />
      <Route path="/batches/new" element={<Private><NewBatch /></Private>} />
      <Route path="/batches/:id" element={<Private><BatchDetail /></Private>} />
      <Route path="/audit" element={<Private><AuditTrail /></Private>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
