import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import DashboardLayout from "./components/layout/DashboardLayout";
import AppToaster from "./components/ui/AppToaster"; // Sesuaikan path import jika diperlukan

const Account = lazy(() => import("./pages/account/Account"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const Login = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));
const Dashboard = lazy(() => import("./pages/dashboard/Dashboard"));
const Reports = lazy(() => import("./pages/reports/Reports"));
const Wallets = lazy(() => import("./pages/wallets/Wallets"));
const Transactions = lazy(() => import("./pages/transactions/Transactions"));
const VerifyEmail = lazy(() => import("./pages/auth/VerifyEmail"));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppToaster />
        <Suspense fallback={<div role="status" className="p-6 text-slate-500">Memuat halaman...</div>}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/account" element={<Account />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/wallets" element={<Wallets />} />
              <Route path="/transactions" element={<Transactions />} />
            </Route>
          </Route>

          <Route
            path="/"
            element={<Navigate to="/dashboard" replace />}
          />

          <Route
            path="*"
            element={<Navigate to="/dashboard" replace />}
          />
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}