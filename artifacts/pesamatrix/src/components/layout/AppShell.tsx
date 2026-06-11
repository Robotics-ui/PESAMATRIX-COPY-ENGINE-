import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "wouter";
import {
  BarChart3,
  Settings,
  LogOut,
  User,
  CreditCard,
  LineChart,
  Box,
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
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
          <p className="text-muted-foreground text-xs mt-1">Copy Trading Console</p>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-0.5 overflow-y-auto">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-2 px-2">Trading</p>
          <NavLink href="/dashboard" icon={BarChart3}>Dashboard</NavLink>
          <NavLink href="/mt5" icon={Box}>MT5 Accounts</NavLink>

          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-5 px-2">Account</p>
          <NavLink href="/subscription" icon={CreditCard}>Subscription</NavLink>
          <NavLink href="/profile" icon={User}>Profile</NavLink>

          {user?.role === "admin" && (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-5 px-2">Administration</p>
              <NavLink href="/admin" icon={Settings}>Admin Panel</NavLink>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-border/50">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold uppercase shrink-0">
              {user?.firstName?.[0] ?? user?.email?.[0] ?? "U"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user?.email}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
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
            <span>PesaMatrix</span>
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
