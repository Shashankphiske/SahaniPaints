import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import Index from "./pages/Index";
import TasksPage from "./pages/TasksPage";
import SettingsPage from "./pages/SettingsPage";
import ProjectsPage from "./pages/ProjectsPage";

import CustomersPage from "./components/masters/CustomersPage";
import BrandsPage from "./components/masters/BrandsPage";
import ProductsPage from "./components/masters/ProductsPage";
import InteriorsPage from "./components/masters/InteriorsPage";
import SalesAssociatePage from "./components/masters/SalesAssociatePage";
import ColorsPage from "./components/masters/ColorsPage";
import SiteColorsPage from "./components/masters/SiteColorsPage";
import LaboursPage from "./components/masters/LaboursPage";
import AreasPage from "./components/masters/AreasPage";
import LabourAttendancePage from "./components/attendance/LabourAttendancePage";
import MaterialLogsPage from "./components/materials/MaterialLogsPage";
import PaymentsPage from "./components/payments/PaymentsPage";
import ContractorPaymentsPage from "./components/payments/ContractorPaymentsPage";
import WeeklyDiaryPage from "./components/payments/WeeklyDiaryPage";
import StoresPage from "./components/masters/StoresPage";
import ContractorsPage from "./components/masters/ContractorsPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

const Protected = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <DashboardLayout>{children}</DashboardLayout>
  </ProtectedRoute>
);

const AdminProtected = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute roles={["ADMIN"]}>
    <DashboardLayout>{children}</DashboardLayout>
  </ProtectedRoute>
);

function NotFound() {
  return <Navigate to="/" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-right" richColors />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Public Auth Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/change-pass/:token" element={<ChangePasswordPage />} />

              {/* Protected Core Dashboard Route */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Index />
                  </ProtectedRoute>
                }
              />

              {/* Protected Core Pages */}
              <Route path="/customers" element={<Protected><CustomersPage /></Protected>} />
              <Route path="/projects" element={<Protected><ProjectsPage /></Protected>} />
              <Route path="/tasks" element={<Protected><TasksPage /></Protected>} />
              <Route path="/labour-attendance" element={<Protected><LabourAttendancePage /></Protected>} />
              <Route path="/material-usage" element={<Protected><MaterialLogsPage /></Protected>} />
              <Route path="/payments" element={<AdminProtected><PaymentsPage /></AdminProtected>} />
              <Route path="/contractor-payments" element={<AdminProtected><ContractorPaymentsPage /></AdminProtected>} />
              <Route path="/weekly-diary" element={<Protected><WeeklyDiaryPage /></Protected>} />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />

              {/* Protected Master Sub-Routes */}
              <Route path="/masters/brands" element={<Protected><BrandsPage /></Protected>} />
              <Route path="/masters/products" element={<Protected><ProductsPage /></Protected>} />
              <Route path="/masters/interiors" element={<Protected><InteriorsPage /></Protected>} />
              <Route path="/masters/sales-associate" element={<Protected><SalesAssociatePage /></Protected>} />
              <Route path="/masters/colors" element={<Protected><ColorsPage /></Protected>} />
              <Route path="/masters/site-colors" element={<Protected><SiteColorsPage /></Protected>} />
              <Route path="/masters/areas" element={<Protected><AreasPage /></Protected>} />
              <Route path="/masters/labours" element={<Protected><LaboursPage /></Protected>} />
              <Route path="/masters/contractors" element={<Protected><ContractorsPage /></Protected>} />
              <Route path="/masters/stores" element={<Protected><StoresPage /></Protected>} />

              {/* Catch-all Routing */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
