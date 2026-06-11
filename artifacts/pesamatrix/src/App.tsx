import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import DashboardPage from "@/pages/DashboardPage";
import SubscriptionPage from "@/pages/SubscriptionPage";
import Mt5Page from "@/pages/Mt5Page";
import ProfilePage from "@/pages/ProfilePage";
import AdminDashboardPage from "@/pages/admin/AdminDashboardPage";
import AdminUsersPage from "@/pages/admin/AdminUsersPage";
import AdminSubscriptionsPage from "@/pages/admin/AdminSubscriptionsPage";
import AdminPlansPage from "@/pages/admin/AdminPlansPage";
import AdminSettingsPage from "@/pages/admin/AdminSettingsPage";
import AdminMasterAccountPage from "@/pages/admin/AdminMasterAccountPage";
import AdminAuditLogsPage from "@/pages/admin/AdminAuditLogsPage";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function Landing() {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (user?.role === "admin") return <Redirect to="/admin" />;
  return <Redirect to="/dashboard" />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />

      {/* Subscriber routes */}
      <Route path="/dashboard">
        <ProtectedRoute><DashboardPage /></ProtectedRoute>
      </Route>
      <Route path="/subscription">
        <ProtectedRoute><SubscriptionPage /></ProtectedRoute>
      </Route>
      <Route path="/mt5">
        <ProtectedRoute><Mt5Page /></ProtectedRoute>
      </Route>
      <Route path="/profile">
        <ProtectedRoute><ProfilePage /></ProtectedRoute>
      </Route>

      {/* Admin routes */}
      <Route path="/admin">
        <ProtectedRoute requireAdmin><AdminDashboardPage /></ProtectedRoute>
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute requireAdmin><AdminUsersPage /></ProtectedRoute>
      </Route>
      <Route path="/admin/subscriptions">
        <ProtectedRoute requireAdmin><AdminSubscriptionsPage /></ProtectedRoute>
      </Route>
      <Route path="/admin/plans">
        <ProtectedRoute requireAdmin><AdminPlansPage /></ProtectedRoute>
      </Route>
      <Route path="/admin/settings">
        <ProtectedRoute requireAdmin><AdminSettingsPage /></ProtectedRoute>
      </Route>
      <Route path="/admin/master-account">
        <ProtectedRoute requireAdmin><AdminMasterAccountPage /></ProtectedRoute>
      </Route>
      <Route path="/admin/audit-logs">
        <ProtectedRoute requireAdmin><AdminAuditLogsPage /></ProtectedRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
