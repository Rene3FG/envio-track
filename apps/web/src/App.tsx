import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { DispatcherDashboard } from './pages/DispatcherDashboard';
import { ProtectedRoute } from './components/ProtectedRoute';

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/despacho"
        element={
          <ProtectedRoute requireAdmin>
            <DispatcherDashboard />
          </ProtectedRoute>
        }
      />
      {/* Redirección por defecto */}
      <Route path="/" element={<Navigate to="/despacho" replace />} />
      <Route path="*" element={<Navigate to="/despacho" replace />} />
    </Routes>
  );
};

export default App;
