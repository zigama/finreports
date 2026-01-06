import React from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Layout from './Layout';

export default function ProtectedAppLayout() {
  const { token } = useAuth();
  const loc = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: loc }} replace />;
  }

  // Universal header + drawer for all protected pages:
  return (
    <Layout title="Financial Reports Portal" subtitle={subtitleFor(loc.pathname)}>
      {/* Children pages render inside Layout */}
      <Outlet />
    </Layout>
  );
}

function subtitleFor(pathname = '') {
  if (pathname.startsWith('/admin/add-facility')) return 'Add Health Facility';
  if (pathname.startsWith('/admin/catalog')) return 'Locations Catalog';
  if (pathname.startsWith('/reports')) return 'Reports';
  return 'Dashboard';
}
