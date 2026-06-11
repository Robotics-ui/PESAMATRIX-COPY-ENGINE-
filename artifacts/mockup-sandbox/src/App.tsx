import { Switch, Route, Redirect } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Spinner } from "@/components/ui/spinner";
import WhatsAppButton from "@/components/WhatsAppButton";

import AuthLayout from "@/components/layout/AuthLayout";
import AppShell from "@/components/layout/AppShell";
import AdminShell from "@/components/layout/AdminShell";

import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import ChangePasswordPage from "@/pages/auth/ChangePasswordPage";

import UserDashboardPage from "@/pages/user/DashboardPage";
import ConnectMT5Page from "@/pages/user/ConnectMT5Page";
import SubscribePage from "@/pages/user/SubscribePage";
import PaymentHistoryPage from "@/pages/user/PaymentHistoryPage";
import GalleryPage from "@/pages/user/GalleryPage";
import ResourcesPage from "@/pages/user/ResourcesPage";
import NewsPage from "@/pages/user/NewsPage";
import ContactPage from "@/pages/user/ContactPage";

import AdminDashboardPage from "@/pages/admin/DashboardPage";
import AdminUsersPage from "@/pages/admin/UsersPage";
import AdminSubscriptionsPage from "@/pages/admin/SubscriptionsPage";
import AdminSettingsPage from "@/pages/admin/SettingsPage";
import AdminAuditLogsPage from "@/pages/admin/AuditLogsPage";
import AdminPaymentsPage from "@/pages/admin/PaymentsPage";
import MediaManagementPage from "@/pages/admin/MediaManagementPage";
import ResourcesManagementPage from "@/pages/admin/ResourcesManagementPage";
import NewsManagementPage from "@/pages/admin/NewsManagementPage";

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

  if (user?.mustChangePassword) return <Redirect to="/change-password" />;

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
    <>
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
        <Route path="/change-password">
          {!isAuthenticated ? (
            <Redirect to="/login" />
          ) : !user?.mustChangePassword ? (
            <Redirect to={user?.role === "admin" ? "/admin" : "/dashboard"} />
          ) : (
            <AuthLayout>
              <ChangePasswordPage />
            </AuthLayout>
          )}
        </Route>

        {/* User routes */}
        <Route path="/dashboard">
          <ProtectedRoute>
            <AppShell><UserDashboardPage /></AppShell>
          </ProtectedRoute>
        </Route>
        <Route path="/connect-mt5">
          <ProtectedRoute>
            <AppShell><ConnectMT5Page /></AppShell>
          </ProtectedRoute>
        </Route>
        <Route path="/subscribe">
          <ProtectedRoute>
            <AppShell><SubscribePage /></AppShell>
          </ProtectedRoute>
        </Route>
        <Route path="/payments">
          <ProtectedRoute>
            <AppShell><PaymentHistoryPage /></AppShell>
          </ProtectedRoute>
        </Route>
        <Route path="/gallery">
          <ProtectedRoute>
            <AppShell><GalleryPage /></AppShell>
          </ProtectedRoute>
        </Route>
        <Route path="/resources">
          <ProtectedRoute>
            <AppShell><ResourcesPage /></AppShell>
          </ProtectedRoute>
        </Route>
        <Route path="/news">
          <ProtectedRoute>
            <AppShell><NewsPage /></AppShell>
          </ProtectedRoute>
        </Route>
        <Route path="/contact">
          <ProtectedRoute>
            <AppShell><ContactPage /></AppShell>
          </ProtectedRoute>
        </Route>

        {/* Admin routes */}
        <Route path="/admin">
          <ProtectedRoute role="admin">
            <AdminShell><AdminDashboardPage /></AdminShell>
          </ProtectedRoute>
        </Route>
        <Route path="/admin/users">
          <ProtectedRoute role="admin">
            <AdminShell><AdminUsersPage /></AdminShell>
          </ProtectedRoute>
        </Route>
        <Route path="/admin/subscriptions">
          <ProtectedRoute role="admin">
            <AdminShell><AdminSubscriptionsPage /></AdminShell>
          </ProtectedRoute>
        </Route>
        <Route path="/admin/payments">
          <ProtectedRoute role="admin">
            <AdminShell><AdminPaymentsPage /></AdminShell>
          </ProtectedRoute>
        </Route>
        <Route path="/admin/mt5-accounts">
          <ProtectedRoute role="admin">
            <AdminShell><AdminUsersPage /></AdminShell>
          </ProtectedRoute>
        </Route>
        <Route path="/admin/media">
          <ProtectedRoute role="admin">
            <AdminShell><MediaManagementPage /></AdminShell>
          </ProtectedRoute>
        </Route>
        <Route path="/admin/resources">
          <ProtectedRoute role="admin">
            <AdminShell><ResourcesManagementPage /></AdminShell>
          </ProtectedRoute>
        </Route>
        <Route path="/admin/news">
          <ProtectedRoute role="admin">
            <AdminShell><NewsManagementPage /></AdminShell>
          </ProtectedRoute>
        </Route>
        <Route path="/admin/settings">
          <ProtectedRoute role="admin">
            <AdminShell><AdminSettingsPage /></AdminShell>
          </ProtectedRoute>
        </Route>
        <Route path="/admin/audit-logs">
          <ProtectedRoute role="admin">
            <AdminShell><AdminAuditLogsPage /></AdminShell>
          </ProtectedRoute>
        </Route>

        {/* Fallback */}
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>

      {/* WhatsApp floating button — visible on all pages */}
      <WhatsAppButton />
    </>
  );
}
