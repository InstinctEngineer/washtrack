import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Pages
import Login from "./pages/Login";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import ManagerDashboard from "./pages/ManagerDashboard";
import FinanceDashboard from "./pages/FinanceDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import CreateUser from "./pages/CreateUser";
import VehicleTypes from "./pages/VehicleTypes";
import Vehicles from "./pages/Vehicles";
import Locations from "./pages/Locations";
import Unauthorized from "./pages/Unauthorized";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* Protected Routes - Redirect root to login */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Employee Routes */}
            <Route
              path="/employee/dashboard"
              element={
                <ProtectedRoute allowedRoles={['employee', 'manager', 'finance', 'admin']}>
                  <EmployeeDashboard />
                </ProtectedRoute>
              }
            />

            {/* Manager Routes */}
            <Route
              path="/manager/dashboard"
              element={
                <ProtectedRoute allowedRoles={['manager', 'finance', 'admin']}>
                  <ManagerDashboard />
                </ProtectedRoute>
              }
            />

            {/* Finance Routes */}
            <Route
              path="/finance/dashboard"
              element={
                <ProtectedRoute allowedRoles={['finance', 'admin']}>
                  <FinanceDashboard />
                </ProtectedRoute>
              }
            />

            {/* Admin Routes */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users/create"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <CreateUser />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/vehicle-types"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <VehicleTypes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/vehicles"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Vehicles />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/locations"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Locations />
                </ProtectedRoute>
              }
            />

            {/* Catch-all 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
