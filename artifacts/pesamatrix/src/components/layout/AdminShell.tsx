import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "wouter";
import {
  BarChart3,
  Settings,
  LogOut,
  Users,
  Activity,
  Box,
  FileText,
  CreditCard,
  LineChart,
  User,
} from "lucide-react";
import { useLogout } from "@workspace/api-client-react";

function NavLink({ href, icon: Icon, children }: { href: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  const [location] = useLocation();
  const active = location === href;
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {children}
    </Link>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const [, setLocation] = useLocation();
  const logoutMutation = useLogout();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        logout();
        setLocation("/login");
      },
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      <aside className="hidden md:flex w-64 border-r border-border/50 bg-card flex-col shrink-0">
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight">
            <LineChart className="h-6 w-6" />
            <span>PesaMatrix</span>
          </div>
          <p className="text-destructive font-semibold text-xs mt-1 uppercase tracking-widest">Administrator</p>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-0.5 overflow-y-auto">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-2 px-2">Overview</p>
          <NavLink href="/admin" icon={Activity}>Dashboard</NavLink>

          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-5 px-2">Management</p>
          <NavLink href="/admin/users" icon={Users}>Users</NavLink>
          <NavLink href="/admin/subscriptions" icon={CreditCard}>Subscriptions</NavLink>
          <NavLink href="/admin/plans" icon={Box}>Plans</NavLink>

          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-5 px-2">System</p>
          <NavLink href="/admin/master-account" icon={BarChart3}>Master Account</NavLink>
          <NavLink href="/admin/settings" icon={Settings}>Settings</NavLink>
          <NavLink href="/admin/audit-logs" icon={FileText}>Audit Logs</NavLink>

          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-5 px-2">Switch View</p>
          <NavLink href="/dashboard" icon={User}>Subscriber View</NavLink>
        </nav>

        <div className="p-4 border-t border-border/50">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="md:hidden flex items-center justify-between p-4 border-b border-border/50 bg-card">
          <div className="flex items-center gap-2 text-primary font-bold text-lg">
            <LineChart className="h-5 w-5" />
            <span>PesaMatrix Admin</span>
          </div>
          <button onClick={handleLogout} className="p-2 text-destructive hover:bg-destructive/10 rounded-md">
            <LogOut className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
}
