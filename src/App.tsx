import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RootRedirect } from "@/components/RootRedirect";

// Pages
import Login from "./pages/Login";
import { ChangePassword } from "./pages/ChangePassword";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import ManagerDashboard from "./pages/ManagerDashboard";
import FinanceDashboard from "./pages/FinanceDashboard";
import Messages from "./pages/Messages";
import FinanceThisWeek from "./pages/FinanceThisWeek";
import AdminDashboard from "./pages/AdminDashboard";
import AdminSettings from "./pages/AdminSettings";
import CreateUser from "./pages/CreateUser";
import Users from "./pages/Users";
import Locations from "./pages/Locations";
import Clients from "./pages/Clients";
import SuperAdminDatabase from "./pages/SuperAdminDatabase";
import ActivityLogs from "./pages/ActivityLogs";
import WorkTypes from "./pages/WorkTypes";
import RateCard from "./pages/RateCard";
import WorkItems from "./pages/WorkItems";
import Unauthorized from "./pages/Unauthorized";
import NotFound from "./pages/NotFound";
import DealershipRates from "./pages/dealership/DealershipRates";
import DealershipRequests from "./pages/dealership/DealershipRequests";
import DealershipReport from "./pages/dealership/DealershipReport";
import PayrollDashboard from "./pages/payroll/PayrollDashboard";
import PortalLogin from "./pages/portal/PortalLogin";
import PortalSignup from "./pages/portal/PortalSignup";
import PortalDashboard from "./pages/portal/PortalDashboard";
import PortalRequestAccess from "./pages/portal/PortalRequestAccess";
import PortalLocationHistory from "./pages/portal/PortalLocationHistory";
import PortalRequestWash from "./pages/portal/PortalRequestWash";
import PortalMessages from "./pages/portal/PortalMessages";
import PortalAuthCallback from "./pages/portal/PortalAuthCallback";
import PortalOnboarding from "./pages/portal/PortalOnboarding";
import PortalPending from "./pages/portal/PortalPending";
import PortalRequests from "./pages/admin/PortalRequests";
import PortalUsers from "./pages/admin/PortalUsers";
import { PortalProtectedRoute } from "@/components/PortalProtectedRoute";

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
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* Client Portal (public auth) */}
            <Route path="/portal/login" element={<PortalLogin />} />
            <Route path="/portal/signup" element={<PortalSignup />} />
            <Route path="/portal/auth/callback" element={<PortalAuthCallback />} />
            <Route path="/portal" element={<Navigate to="/portal/login" replace />} />

            {/* Portal onboarding + pending status — allow any portal account status */}
            <Route path="/portal/onboarding" element={
              <PortalProtectedRoute allowAnyStatus><PortalOnboarding /></PortalProtectedRoute>
            } />
            <Route path="/portal/pending" element={
              <PortalProtectedRoute allowAnyStatus><PortalPending /></PortalProtectedRoute>
            } />

            {/* Client Portal (authed) */}
            <Route path="/portal/dashboard" element={
              <PortalProtectedRoute><PortalDashboard /></PortalProtectedRoute>
            } />
            <Route path="/portal/request-access" element={
              <PortalProtectedRoute><PortalRequestAccess /></PortalProtectedRoute>
            } />
            <Route path="/portal/messages" element={
              <PortalProtectedRoute><PortalMessages /></PortalProtectedRoute>
            } />
            <Route path="/portal/locations/:id" element={
              <PortalProtectedRoute><PortalLocationHistory /></PortalProtectedRoute>
            } />
            <Route path="/portal/locations/:id/request-wash" element={
              <PortalProtectedRoute><PortalRequestWash /></PortalProtectedRoute>
            } />

            {/* Internal admin: portal management */}
            <Route path="/admin/portal-requests" element={
              <ProtectedRoute allowedRoles={['finance', 'admin']}><PortalRequests /></ProtectedRoute>
            } />
            <Route path="/admin/portal-users" element={
              <ProtectedRoute allowedRoles={['finance', 'admin']}><PortalUsers /></ProtectedRoute>
            } />

            {/* Protected Routes - Smart root redirect */}
            <Route path="/" element={<RootRedirect />} />

            {/* Employee Routes */}
            <Route
              path="/employee/dashboard"
              element={
                <ProtectedRoute allowedRoles={['employee', 'manager', 'finance', 'admin']}>
                  <EmployeeDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages"
              element={
                <ProtectedRoute allowedRoles={['employee', 'manager', 'finance', 'admin']}>
                  <Messages />
                </ProtectedRoute>
              }
            />

            {/* Manager Routes - temporarily redirect to employee dashboard */}
            <Route
              path="/manager/dashboard"
              element={<Navigate to="/employee/dashboard" replace />}
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
            <Route
              path="/finance/this-week"
              element={
                <ProtectedRoute allowedRoles={['finance', 'admin']}>
                  <FinanceThisWeek />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/dealership"
              element={
                <ProtectedRoute allowedRoles={['finance', 'admin']}>
                  <DealershipReport />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/dealership-rates"
              element={
                <ProtectedRoute allowedRoles={['finance', 'admin']}>
                  <DealershipRates />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/dealership-requests"
              element={
                <ProtectedRoute allowedRoles={['finance', 'admin']}>
                  <DealershipRequests />
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
              path="/admin/users"
              element={
                <ProtectedRoute allowedRoles={['finance', 'admin']}>
                  <Users />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users/create"
              element={
                <ProtectedRoute allowedRoles={['finance', 'admin']}>
                  <CreateUser />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/locations"
              element={
                <ProtectedRoute allowedRoles={['finance', 'admin']}>
                  <Locations />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/clients"
              element={
                <ProtectedRoute allowedRoles={['finance', 'admin']}>
                  <Clients />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/work-types"
              element={
                <ProtectedRoute allowedRoles={['finance', 'admin']}>
                  <WorkTypes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/rates"
              element={
                <ProtectedRoute allowedRoles={['finance', 'admin']}>
                  <RateCard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/items"
              element={
                <ProtectedRoute allowedRoles={['finance', 'admin']}>
                  <WorkItems />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminSettings />
                </ProtectedRoute>
              }
            />

            {/* Super Admin Routes */}
            <Route
              path="/admin/database"
              element={
                <ProtectedRoute allowedRoles={['super_admin']}>
                  <SuperAdminDatabase />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/activity-logs"
              element={
                <ProtectedRoute allowedRoles={['super_admin']}>
                  <ActivityLogs />
                </ProtectedRoute>
              }
            />

            {/* Catch-all 404 */}
            {/* Payroll Routes (Finance+) */}
            <Route
              path="/payroll"
              element={<Navigate to="/payroll/dashboard" replace />}
            />
            <Route
              path="/payroll/dashboard"
              element={
                <ProtectedRoute allowedRoles={['finance', 'admin']}>
                  <PayrollDashboard />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
