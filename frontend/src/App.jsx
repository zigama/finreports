// App.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AddFacility from './pages/AddFacility';
import Catalog from './pages/Catalog';
import ProtectedAppLayout from './components/ProtectedAppLayout';
import BudgetLines from './pages/BudgetLines';
import Activities from './pages/Activities';
import BudgetCreate from './pages/BudgetCreate';
import BudgetSheet from './pages/BudgetSheet';

// 👉 NEW: import the cashbook screens
import CashbookSheet from './pages/CashbookSheet';
 import Accounts from './pages/Accounts';
 import AdminUserCreate from "./pages/AdminUserCreate";
import AdminUserEdit from "./pages/AdminUserEdit";
import AdminUsers from "./pages/AdminUsers";

export default function App(){
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* All routes below share AppHeader + Drawer via the parent layout */}
      <Route element={<ProtectedAppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="admin/add-facility" element={<AddFacility />} />
        <Route path="admin/catalog" element={<Catalog />} />

        {/* Budgeting */}
        <Route path="budget/lines" element={<BudgetLines />} />
        <Route path="budget/activities" element={<Activities />} />
        <Route path="budget/new" element={<BudgetCreate />} />
        <Route path="budget/sheet" element={<BudgetSheet />} />

        {/* 👉 NEW: Cashbook */}
        <Route path="cashbook/sheet" element={<CashbookSheet />} />
        <Route path="cashbook/accounts" element={<Accounts />} />

          <Route path="admin/users/new" element={<AdminUserCreate />} />
          <Route path="admin/users/:id/edit" element={<AdminUserEdit />} />
          <Route path="admin/users" element={<AdminUsers />} />

      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
