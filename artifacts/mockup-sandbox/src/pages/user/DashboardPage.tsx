import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Crown,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  RefreshCw,
  Wifi,
  WifiOff,
  BarChart2,
  Shield,
  Clock,
  ChevronRight,
  Bell,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { api, type Mt5Account, type ActiveSubscription } from "@/lib/api";
import { formatDate, formatRelative } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

const PERFORMANCE_DATA = [
  { day: "Mon", value: 0 },
  { day: "Tue", value: 12 },
  { day: "Wed", value: 8 },
  { day: "Thu", value: 22 },
  { day: "Fri", value: 18 },
  { day: "Sat", value: 35 },
  { day: "Sun", value: 42 },
];

const MARKET_PAIRS = [
  { symbol: "EUR/USD", label: "BUY signal updated", price: "1.08245", change: "+0.45%", up: true, color: "bg-blue-500" },
  { symbol: "XAU/USD", label: "Volatility increasing", price: "2,356.75", change: "+0.89%", up: true, color: "bg-yellow-500" },
  { symbol: "BTC/USDT", label: "Trend bullish continuation", price: "67,892.11", change: "+2.35%", up: true, color: "bg-orange-500" },
];

const RECENT_SIGNALS = [
  { symbol: "EUR/USD", type: "BUY", price: "1.08245", sl: "1.0790", tp: "1.0890", pips: "+45 pips", time: "2 min ago", up: true },
  { symbol: "XAU/USD", type: "BUY", price: "2,356.75", sl: "2,340.00", tp: "2,380.00", pips: "+120 pips", time: "15 min ago", up: true },
  { symbol: "GBP/USD", type: "SELL", price: "1.26340", sl: "1.2690", tp: "1.2550", pips: "-25 pips", time: "1 hour ago", up: false },
  { symbol: "BTC/USDT", type: "BUY", price: "67,892.11", sl: "66,500.00", tp: "69,500.00", pips: "+230 pips", time: "2 hours ago", up: true },
];

function DeploymentBadge({ status }: { status: Mt5Account["deploymentStatus"] }) {
  const map: Record<string, { label: string; cls: string }> = {
    deployed: { label: "Deployed", cls: "bg-primary/20 text-primary border-primary/30" },
    deploying: { label: "Deploying…", cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    pending: { label: "Pending", cls: "bg-muted text-muted-foreground border-border" },
    failed: { label: "Failed", cls: "bg-destructive/20 text-destructive border-destructive/30" },
    undeployed: { label: "Undeployed", cls: "bg-muted text-muted-foreground border-border" },
  };
  const v = map[status] ?? map["pending"];
  return <Badge variant="outline" className={v.cls}>{v.label}</Badge>;
}

function SyncBadge({ status }: { status: Mt5Account["synchronizationStatus"] }) {
  const map: Record<string, { label: string; cls: string; icon: typeof Wifi }> = {
    synchronized: { label: "Synced", cls: "bg-primary/20 text-primary border-primary/30", icon: Wifi },
    synchronizing: { label: "Syncing…", cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: RefreshCw },
    connected: { label: "Connected", cls: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Wifi },
    disconnected: { label: "Disconnected", cls: "bg-muted text-muted-foreground border-border", icon: WifiOff },
    connecting: { label: "Connecting…", cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: RefreshCw },
    error: { label: "Error", cls: "bg-destructive/20 text-destructive border-destructive/30", icon: XCircle },
  };
  const v = map[status] ?? map["disconnected"];
  const Icon = v.icon;
  return (
    <Badge variant="outline" className={v.cls}>
      <Icon className="size-3 mr-1" />{v.label}
    </Badge>
  );
}

function StatCard({
  title,
  value,
  sub,
  subUp,
  icon: Icon,
  iconCls,
  loading,
}: {
  title: string;
  value: string | number;
  sub?: string;
  subUp?: boolean;
  icon: typeof Activity;
  iconCls?: string;
  loading?: boolean;
}) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`size-4 ${iconCls ?? "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-7 w-28" />
        ) : (
          <div className="text-2xl font-bold text-foreground">{value}</div>
        )}
        {sub && (
          <p className={`text-xs mt-1 flex items-center gap-1 ${subUp === false ? "text-destructive" : "text-primary"}`}>
            {subUp !== false ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {sub}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PlanBadge({ sub }: { sub: ActiveSubscription }) {
  const isActive = sub.isActive && sub.status === "active";
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${
      isActive
        ? "bg-primary/15 text-primary border-primary/30"
        : "bg-muted text-muted-foreground border-border"
    }`}>
      <span className={`size-1.5 rounded-full ${isActive ? "bg-primary animate-pulse" : "bg-muted-foreground"}`} />
      {isActive ? "Active Plan" : sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
    </div>
  );
}

export default function UserDashboardPage() {
  const { user } = useAuth();

  const { data: mt5Accounts, isLoading: mt5Loading } = useQuery({
    queryKey: ["mt5/accounts"],
    queryFn: () => api.mt5.list(),
  });

  const { data: activeSub, isLoading: subLoading } = useQuery({
    queryKey: ["subscriptions/active"],
    queryFn: () => api.subscriptions.active(),
    retry: false,
  });

  const primaryAccount = mt5Accounts?.[0];
  const hasAccount = !!primaryAccount;
  const hasActiveSub = !!activeSub?.isActive;
  const hasSetup = hasAccount && hasActiveSub;

  const daysProgress =
    activeSub?.startDate && activeSub?.endDate
      ? (() => {
          const start = new Date(activeSub.startDate).getTime();
          const end = new Date(activeSub.endDate).getTime();
          const now = Date.now();
          return Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
        })()
      : null;

  const planLabel = activeSub
    ? activeSub.numberOfDays >= 60
      ? "Premium"
      : activeSub.numberOfDays >= 20
      ? "Standard"
      : "Basic"
    : "—";

  const firstName = user?.firstName ?? "Trader";

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">

      {/* ── Welcome row ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back,</p>
          <h1 className="text-2xl font-bold text-foreground mt-0.5">
            {firstName} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Here's what's happening with your trading today.
          </p>
        </div>

        {/* Subscription status card */}
        {subLoading ? (
          <Skeleton className="h-20 w-52 rounded-xl flex-shrink-0" />
        ) : activeSub ? (
          <div className="flex-shrink-0 rounded-xl border border-primary/30 bg-primary/5 p-4 min-w-[200px]">
            <div className="flex items-center gap-2 mb-1">
              <Crown className="size-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">{planLabel} Member</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <PlanBadge sub={activeSub} />
              <Badge variant="outline" className="text-[10px] px-1.5 border-primary/30 text-primary">
                {planLabel}
              </Badge>
            </div>
            {activeSub.endDate && (
              <p className="text-xs text-muted-foreground mt-2">
                Valid until {formatDate(activeSub.endDate)}
              </p>
            )}
          </div>
        ) : (
          <div className="flex-shrink-0 rounded-xl border border-border bg-card p-4 min-w-[200px]">
            <div className="flex items-center gap-2 mb-1">
              <Crown className="size-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-muted-foreground">No Active Plan</span>
            </div>
            <Link href="/subscribe">
              <Button size="sm" className="mt-2 text-xs h-7 w-full">
                Subscribe Now
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* ── 4 stat cards ────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Trading Days"
          value={activeSub ? `${activeSub.numberOfDays}` : "—"}
          sub={activeSub?.tradingDaysRemaining != null ? `${activeSub.tradingDaysRemaining} days left` : undefined}
          subUp
          icon={BarChart2}
          iconCls="text-primary"
          loading={subLoading}
        />
        <StatCard
          title="Win Rate"
          value="74%"
          sub="+5% this week"
          subUp
          icon={TrendingUp}
          iconCls="text-primary"
        />
        <StatCard
          title="Active Plan"
          value={activeSub?.isActive ? planLabel : "None"}
          sub={activeSub?.status ? activeSub.status : "Subscribe to start"}
          icon={Crown}
          iconCls={activeSub?.isActive ? "text-primary" : "text-muted-foreground"}
          loading={subLoading}
        />
        <StatCard
          title="Days Remaining"
          value={activeSub?.daysRemaining != null ? `${activeSub.daysRemaining}d` : "—"}
          sub={activeSub?.endDate ? `Exp. ${formatDate(activeSub.endDate)}` : "No subscription"}
          subUp={activeSub?.daysRemaining != null ? activeSub.daysRemaining > 5 : false}
          icon={Clock}
          iconCls="text-muted-foreground"
          loading={subLoading}
        />
      </div>

      {/* ── Getting started (if no setup) ────────────────────── */}
      {!hasSetup && !mt5Loading && !subLoading && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Getting Started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { done: hasAccount, label: "Connect your MT5 account", href: "/connect-mt5", cta: "Connect" },
              { done: primaryAccount?.deploymentStatus === "deployed", label: "Deploy to MetaApi cloud", href: "/connect-mt5", cta: "Deploy", locked: !hasAccount },
              { done: hasActiveSub, label: "Subscribe to copy trading", href: "/subscribe", cta: "Subscribe", locked: primaryAccount?.deploymentStatus !== "deployed" },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`size-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                  step.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground border border-border"
                }`}>
                  {step.done ? <CheckCircle2 className="size-3.5" /> : i + 1}
                </div>
                <span className={`flex-1 text-sm ${step.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                  {step.label}
                </span>
                {!step.done && !step.locked && (
                  <Link href={step.href}>
                    <Button size="sm" variant="outline" className="text-xs h-7">
                      {step.cta} <ArrowRight className="size-3 ml-1" />
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Live Market + Performance ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Live Market Overview */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base">Live Market Overview</CardTitle>
            <span className="flex items-center gap-1.5 text-xs text-primary">
              <span className="size-2 rounded-full bg-primary animate-pulse" />
              Live
            </span>
          </CardHeader>
          <CardContent className="space-y-3">
            {MARKET_PAIRS.map((pair) => (
              <div key={pair.symbol} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className={`size-9 rounded-full ${pair.color} flex items-center justify-center flex-shrink-0`}>
                  <span className="text-white text-xs font-bold">{pair.symbol.split("/")[0].slice(0, 1)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground">{pair.symbol}</div>
                  <div className="text-xs text-muted-foreground truncate">{pair.label}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-foreground">{pair.price}</div>
                  <div className={`text-xs font-medium ${pair.up ? "text-primary" : "text-destructive"}`}>
                    {pair.change}
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full text-xs h-8 mt-1">
              View All Markets <ChevronRight className="size-3 ml-1" />
            </Button>
          </CardContent>
        </Card>

        {/* Performance Chart */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base">Performance</CardTitle>
            <Badge variant="outline" className="text-xs text-muted-foreground border-border">This Week</Badge>
          </CardHeader>
          <CardContent>
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={PERFORMANCE_DATA} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="perfGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18%)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{ background: "hsl(222 40% 9%)", border: "1px solid hsl(222 30% 18%)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "hsl(210 40% 96%)" }}
                    itemStyle={{ color: "hsl(142 71% 45%)" }}
                    formatter={(v: number) => [`${v}%`, "Return"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(142 71% 45%)"
                    strokeWidth={2}
                    fill="url(#perfGradient)"
                    dot={false}
                    activeDot={{ r: 4, fill: "hsl(142 71% 45%)" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Your account is performing above average this week.</p>
              <span className="text-sm font-bold text-primary">+18.7%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Signals + Subscription ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Recent Signals */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Signals</CardTitle>
            <Link href="/subscribe">
              <Button variant="ghost" size="sm" className="text-xs h-7 text-primary hover:text-primary">
                View All
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {RECENT_SIGNALS.map((sig, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                <div className={`size-8 rounded-full flex items-center justify-center flex-shrink-0 ${sig.up ? "bg-primary/20" : "bg-destructive/20"}`}>
                  {sig.up
                    ? <TrendingUp className="size-3.5 text-primary" />
                    : <TrendingDown className="size-3.5 text-destructive" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground">{sig.symbol}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 h-4 ${sig.type === "BUY"
                        ? "bg-primary/15 text-primary border-primary/30"
                        : "bg-destructive/15 text-destructive border-destructive/30"}`}
                    >
                      {sig.type}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {sig.time} · SL:{sig.sl} TP:{sig.tp}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-foreground">{sig.price}</div>
                  <div className={`text-xs font-medium ${sig.up ? "text-primary" : "text-destructive"}`}>{sig.pips}</div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full text-xs h-8 mt-1">
              View All Signals <ChevronRight className="size-3 ml-1" />
            </Button>
          </CardContent>
        </Card>

        {/* Subscription Panel */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Subscription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {subLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : activeSub?.isActive ? (
              <>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <Crown className="size-8 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {planLabel} access active with full signal privileges.
                    </p>
                    {daysProgress !== null && (
                      <div className="mt-2 space-y-1">
                        <Progress value={daysProgress} className="h-1.5" />
                        <p className="text-xs text-muted-foreground">
                          {activeSub.daysRemaining ?? "?"} days remaining
                          {activeSub.endDate && ` · Expires ${formatRelative(activeSub.endDate)}`}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <ul className="space-y-2">
                  {["All VIP Signals", "Real-time Alerts", "Strategy Guide", "Priority Support"].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                      <CheckCircle2 className="size-4 text-primary flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link href="/subscribe">
                  <Button className="w-full" size="sm">
                    Manage Subscription <ArrowRight className="size-3 ml-1.5" />
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Subscribe to unlock copy trading, real-time signals, and full platform access.
                </p>
                <ul className="space-y-2">
                  {["Auto-copy trades in real-time", "Mon–Fri trading days", "MetaApi encrypted connection", "Cancel anytime"].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="size-4 text-primary/50 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/subscribe">
                  <Button className="w-full">
                    Subscribe Now <Crown className="size-3.5 ml-1.5" />
                  </Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── MT5 account details ─────────────────────────────── */}
      {primaryAccount && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base">MT5 Account</CardTitle>
            <div className="flex items-center gap-2">
              <DeploymentBadge status={primaryAccount.deploymentStatus} />
              <SyncBadge status={primaryAccount.synchronizationStatus} />
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Login", value: primaryAccount.login },
                { label: "Broker", value: primaryAccount.broker },
                { label: "Server", value: primaryAccount.server },
                { label: "Last Sync", value: primaryAccount.lastSyncedAt ? formatRelative(primaryAccount.lastSyncedAt) : "Never" },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-xs text-muted-foreground">{item.label}</dt>
                  <dd className="text-sm font-medium text-foreground mt-0.5 truncate">{item.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 flex gap-2">
              <Link href="/connect-mt5">
                <Button variant="outline" size="sm" className="text-xs h-7">
                  Manage MT5 <ArrowRight className="size-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Security banner ─────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Shield className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Secure Your Account</p>
            <p className="text-xs text-muted-foreground">Keep your trading account safe by reviewing your security settings.</p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">
          <Button variant="outline" size="sm" className="text-xs h-8 flex-1 sm:flex-none">
            <Bell className="size-3 mr-1.5" />
            Notifications
          </Button>
          <Link href="/contact">
            <Button size="sm" className="text-xs h-8 flex-1 sm:flex-none">
              Contact Support
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
