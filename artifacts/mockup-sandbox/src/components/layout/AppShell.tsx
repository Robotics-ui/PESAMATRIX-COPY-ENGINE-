import { type ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  MonitorCheck,
  CreditCard,
  TrendingUp,
  Menu,
  LogOut,
  ChevronRight,
  Image,
  BookOpen,
  Newspaper,
  Phone,
  Crown,
  ShieldCheck,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/gallery", icon: Image, label: "Gallery" },
  { href: "/resources", icon: BookOpen, label: "Resources" },
  { href: "/news", icon: Newspaper, label: "News" },
  { href: "/subscribe", icon: CreditCard, label: "Subscription" },
  { href: "/connect-mt5", icon: MonitorCheck, label: "MT5 Account" },
  { href: "/contact", icon: Phone, label: "Contact" },
];

function NavLink({
  href,
  icon: Icon,
  label,
  onClick,
}: {
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
  onClick?: () => void;
}) {
  const [location] = useLocation();
  const active = location === href;

  return (
    <Link href={href} onClick={onClick}>
      <span
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer",
          active
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        )}
      >
        <Icon className="size-4 flex-shrink-0" />
        {label}
        {active && <ChevronRight className="size-3 ml-auto opacity-60" />}
      </span>
    </Link>
  );
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const { user, logout } = useAuth();

  const { data: activeSub } = useQuery({
    queryKey: ["subscriptions/active"],
    queryFn: () => api.subscriptions.active(),
    retry: false,
  });

  const initials = user
    ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "U"
    : "U";

  const isAdmin = user?.role === "admin";
  const hasActiveSub = !!activeSub?.isActive;

  const planLabel = activeSub
    ? activeSub.numberOfDays >= 60
      ? "Premium"
      : activeSub.numberOfDays >= 20
      ? "Standard"
      : "Basic"
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <TrendingUp className="size-4.5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">PesaMatrix</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Copy Trading</div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden text-muted-foreground hover:text-foreground p-1">
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink key={item.href} {...item} onClick={onClose} />
        ))}

        {isAdmin && (
          <>
            <Separator className="my-2 bg-sidebar-border" />
            <Link href="/admin" onClick={onClose}>
              <span className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                <ShieldCheck className="size-4 flex-shrink-0 text-primary" />
                Admin Panel
                <Badge variant="secondary" className="ml-auto text-[9px] px-1.5 py-0 h-4 bg-primary/20 text-primary border-0">
                  Admin
                </Badge>
              </span>
            </Link>
          </>
        )}
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* VIP / Upgrade box */}
      <div className="p-3">
        {hasActiveSub ? (
          <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 mb-3">
            <div className="flex items-center gap-2 mb-1">
              <Crown className="size-4 text-primary" />
              <span className="text-xs font-semibold text-primary">{planLabel} Access</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              You have full access to all {planLabel?.toLowerCase()} signals.
            </p>
          </div>
        ) : (
          <div className="rounded-xl bg-muted/50 border border-border p-3 mb-3">
            <div className="flex items-center gap-2 mb-1">
              <Crown className="size-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">Upgrade Plan</span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-2">
              Subscribe to unlock full signal access.
            </p>
            <Link href="/subscribe" onClick={onClose}>
              <Button size="sm" className="w-full h-7 text-xs">
                Upgrade Plan
              </Button>
            </Link>
          </div>
        )}

        {/* User footer */}
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-sidebar-accent transition-colors">
          <Avatar className="size-8 flex-shrink-0">
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate text-foreground">
              {user?.firstName} {user?.lastName}
            </div>
            <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 flex-shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => logout()}
            title="Logout"
          >
            <LogOut className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col bg-sidebar border-r border-sidebar-border flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border shadow-2xl">
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="size-6 rounded bg-primary flex items-center justify-center">
                <TrendingUp className="size-3.5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-sm">PesaMatrix</span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground truncate max-w-[120px]">
            {user?.firstName} {user?.lastName}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
