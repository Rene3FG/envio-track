import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';

const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const DispatcherDashboard = lazy(() => import('./pages/DispatcherDashboard').then((module) => ({ default: module.DispatcherDashboard })));
const PublicTrackingPage = lazy(() => import('./pages/PublicTrackingPage').then((module) => ({ default: module.PublicTrackingPage })));
const StatsPage = lazy(() => import('./pages/StatsPage').then((module) => ({ default: module.StatsPage })));

export const App: React.FC = () => {
  return (
    <Suspense fallback={<div className="p-6 text-center text-sm text-slate-600" role="status">Cargando…</div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/tracking/:guia?" element={<PublicTrackingPage />} />
        <Route
          path="/stats"
          element={
            <ProtectedRoute requireAdmin>
              <StatsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/despacho"
          element={
            <ProtectedRoute requireAdmin>
              <DispatcherDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/tracking" replace />} />
        <Route path="*" element={<Navigate to="/tracking" replace />} />
      </Routes>
    </Suspense>
  );
};

export default App;
