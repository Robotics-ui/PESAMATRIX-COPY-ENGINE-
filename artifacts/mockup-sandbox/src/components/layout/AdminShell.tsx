import { type ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Settings,
  TrendingUp,
  Menu,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Film,
  BookOpen,
  Newspaper,
  DollarSign,
  MonitorCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: "/admin/users", icon: Users, label: "Users" },
  { href: "/admin/subscriptions", icon: CreditCard, label: "Subscriptions" },
  { href: "/admin/payments", icon: DollarSign, label: "Payments" },
  { href: "/admin/mt5-accounts", icon: MonitorCheck, label: "MT5 Accounts" },
  { href: "/admin/media", icon: Film, label: "Media Management" },
  { href: "/admin/resources", icon: BookOpen, label: "Resources" },
  { href: "/admin/news", icon: Newspaper, label: "News" },
  { href: "/admin/settings", icon: Settings, label: "Settings" },
];

function NavLink({
  href,
  icon: Icon,
  label,
  exact,
  onClick,
}: {
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
  exact?: boolean;
  onClick?: () => void;
}) {
  const [location] = useLocation();
  const active = exact
    ? location === href
    : location.startsWith(href) && (href !== "/admin" || location === "/admin");

  return (
    <Link href={href} onClick={onClick}>
      <span
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
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

export default function AdminShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = user
    ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "A"
    : "A";

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-sidebar-border">
        <div className="size-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <TrendingUp className="size-4.5 text-primary-foreground" />
        </div>
        <div>
          <div className="text-sm font-bold text-foreground">PesaMatrix</div>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 mt-0.5">
            Admin
          </Badge>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            onClick={() => setMobileOpen(false)}
          />
        ))}
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* User footer */}
      <div className="p-3">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-foreground truncate">
                {user?.firstName} {user?.lastName}
              </span>
              <ShieldCheck className="size-3 text-primary flex-shrink-0" />
            </div>
            <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => logout()}
            title="Logout"
          >
            <LogOut className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col bg-sidebar border-r border-sidebar-border flex-shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-4" />
          </Button>
          <span className="font-semibold text-sm">PesaMatrix Admin</span>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
