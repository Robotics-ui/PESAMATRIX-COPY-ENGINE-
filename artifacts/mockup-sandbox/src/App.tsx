import { Switch, Route, Redirect } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Spinner } from "@/components/ui/spinner";

import AuthLayout from "@/components/layout/AuthLayout";
import AppShell from "@/components/layout/AppShell";
import AdminShell from "@/components/layout/AdminShell";

import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";

import UserDashboardPage from "@/pages/user/DashboardPage";
import ConnectMT5Page from "@/pages/user/ConnectMT5Page";
import SubscribePage from "@/pages/user/SubscribePage";
import PaymentHistoryPage from "@/pages/user/PaymentHistoryPage";

import AdminDashboardPage from "@/pages/admin/DashboardPage";
import AdminUsersPage from "@/pages/admin/UsersPage";
import AdminSubscriptionsPage from "@/pages/admin/SubscriptionsPage";
import AdminSettingsPage from "@/pages/admin/SettingsPage";
import AdminAuditLogsPage from "@/pages/admin/AuditLogsPage";

function ProtectedRoute({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: "admin" | "subscriber";
}) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Spinner className="size-8 text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return <Redirect to="/login" />;
  if (role && user?.role !== role) {
    return <Redirect to={user?.role === "admin" ? "/admin" : "/dashboard"} />;
  }

  return <>{children}</>;
}

export default function App() {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Spinner className="size-8 text-primary" />
      </div>
    );
  }

  return (
    <Switch>
      {/* Root redirect */}
      <Route path="/">
        {isAuthenticated ? (
          <Redirect to={user?.role === "admin" ? "/admin" : "/dashboard"} />
        ) : (
          <Redirect to="/login" />
        )}
      </Route>

      {/* Auth routes */}
      <Route path="/login">
        {isAuthenticated ? (
          <Redirect to={user?.role === "admin" ? "/admin" : "/dashboard"} />
        ) : (
          <AuthLayout>
            <LoginPage />
          </AuthLayout>
        )}
      </Route>
      <Route path="/register">
        {isAuthenticated ? (
          <Redirect to="/dashboard" />
        ) : (
          <AuthLayout>
            <RegisterPage />
          </AuthLayout>
        )}
      </Route>

      {/* User routes */}
      <Route path="/dashboard">
        <ProtectedRoute>
          <AppShell>
            <UserDashboardPage />
          </AppShell>
        </ProtectedRoute>
      </Route>
      <Route path="/connect-mt5">
        <ProtectedRoute>
          <AppShell>
            <ConnectMT5Page />
          </AppShell>
        </ProtectedRoute>
      </Route>
      <Route path="/subscribe">
        <ProtectedRoute>
          <AppShell>
            <SubscribePage />
          </AppShell>
        </ProtectedRoute>
      </Route>
      <Route path="/payments">
        <ProtectedRoute>
          <AppShell>
            <PaymentHistoryPage />
          </AppShell>
        </ProtectedRoute>
      </Route>

      {/* Admin routes */}
      <Route path="/admin">
        <ProtectedRoute role="admin">
          <AdminShell>
            <AdminDashboardPage />
          </AdminShell>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute role="admin">
          <AdminShell>
            <AdminUsersPage />
          </AdminShell>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/subscriptions">
        <ProtectedRoute role="admin">
          <AdminShell>
            <AdminSubscriptionsPage />
          </AdminShell>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/settings">
        <ProtectedRoute role="admin">
          <AdminShell>
            <AdminSettingsPage />
          </AdminShell>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/audit-logs">
        <ProtectedRoute role="admin">
          <AdminShell>
            <AdminAuditLogsPage />
          </AdminShell>
        </ProtectedRoute>
      </Route>

      {/* Fallback */}
      <Route>
        <Redirect to="/" />
      </Route>
    </Switch>
  );
}
