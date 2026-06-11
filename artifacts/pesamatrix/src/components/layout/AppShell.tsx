import { useState } from "react";
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
  Menu,
  X,
} from "lucide-react";
import { useLogout } from "@workspace/api-client-react";

function NavLink({
  href,
  icon: Icon,
  children,
  onClick,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const [location] = useLocation();
  const active = location === href;
  return (
    <Link
      href={href}
      onClick={onClick}
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

function NavContent({
  user,
  onNavigate,
  onLogout,
}: {
  user: ReturnType<typeof useAuth>["user"];
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  return (
    <>
      <nav className="flex-1 px-4 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-2 px-2">Trading</p>
        <NavLink href="/dashboard" icon={BarChart3} onClick={onNavigate}>Dashboard</NavLink>
        <NavLink href="/mt5" icon={Box} onClick={onNavigate}>MT5 Accounts</NavLink>

        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-5 px-2">Account</p>
        <NavLink href="/subscription" icon={CreditCard} onClick={onNavigate}>Subscription</NavLink>
        <NavLink href="/profile" icon={User} onClick={onNavigate}>Profile</NavLink>

        {user?.role === "admin" && (
          <>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-5 px-2">Administration</p>
            <NavLink href="/admin" icon={Settings} onClick={onNavigate}>Admin Panel</NavLink>
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
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const logoutMutation = useLogout();

  const handleLogout = () => {
    setDrawerOpen(false);
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        logout();
        setLocation("/login");
      },
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-64 border-r border-border/50 bg-card flex-col shrink-0">
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight">
            <LineChart className="h-6 w-6" />
            <span>PesaMatrix</span>
          </div>
          <p className="text-muted-foreground text-xs mt-1">Copy Trading Console</p>
        </div>
        <NavContent user={user} onLogout={handleLogout} />
      </aside>

      {/* ── Mobile drawer overlay ── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Mobile drawer panel ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border/50 flex flex-col transform transition-transform duration-300 md:hidden ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-5 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary font-bold text-lg tracking-tight">
            <LineChart className="h-5 w-5" />
            <span>PesaMatrix</span>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-accent/50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <NavContent user={user} onNavigate={() => setDrawerOpen(false)} onLogout={handleLogout} />
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-border/50 bg-card">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 rounded-md text-foreground hover:bg-accent/50 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
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
