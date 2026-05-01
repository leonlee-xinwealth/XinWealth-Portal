import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import AdvisorLogin from './AdvisorLogin';
import AdvisorLayout from './AdvisorLayout';
import Dashboard from './pages/Dashboard';
import ClientList from './pages/ClientList';
import NewClient from './pages/NewClient';
import ClientDetail from './pages/ClientDetail';
import Settings from './pages/Settings';

const AdvisorApp: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-xin-bg">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-xin-blue"></div>
    </div>
  );

  if (!session) {
    return (
      <Routes>
        <Route path="login" element={<AdvisorLogin onLoginSuccess={() => {}} />} />
        <Route path="*" element={<Navigate to="/advisor/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="login" element={<Navigate to="/advisor/dashboard" replace />} />
      <Route element={<AdvisorLayout />}>
        <Route index element={<Navigate to="/advisor/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="clients" element={<ClientList />} />
        <Route path="clients/new" element={<NewClient />} />
        <Route path="clients/:id" element={<ClientDetail />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
};

export default AdvisorApp;
