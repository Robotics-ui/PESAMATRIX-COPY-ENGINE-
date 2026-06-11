import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  MonitorCheck,
  CreditCard,
  Activity,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api, type Mt5Account, type ActiveSubscription } from "@/lib/api";
import { formatDate, formatCurrency, formatRelative } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

function DeploymentBadge({ status }: { status: Mt5Account["deploymentStatus"] }) {
  const map: Record<string, { label: string; className: string }> = {
    deployed: { label: "Deployed", className: "bg-primary/20 text-primary border-primary/30" },
    deploying: { label: "Deploying…", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    pending: { label: "Pending", className: "bg-muted text-muted-foreground border-border" },
    failed: { label: "Failed", className: "bg-destructive/20 text-destructive border-destructive/30" },
    undeployed: { label: "Undeployed", className: "bg-muted text-muted-foreground border-border" },
  };
  const v = map[status] ?? map.pending;
  return <Badge variant="outline" className={v.className}>{v.label}</Badge>;
}

function SyncBadge({ status }: { status: Mt5Account["synchronizationStatus"] }) {
  const map: Record<string, { label: string; className: string; icon: typeof Wifi }> = {
    synchronized: { label: "Synced", className: "bg-primary/20 text-primary border-primary/30", icon: Wifi },
    synchronizing: { label: "Syncing…", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: RefreshCw },
    connected: { label: "Connected", className: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Wifi },
    disconnected: { label: "Disconnected", className: "bg-muted text-muted-foreground border-border", icon: WifiOff },
    connecting: { label: "Connecting…", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: RefreshCw },
    error: { label: "Error", className: "bg-destructive/20 text-destructive border-destructive/30", icon: XCircle },
  };
  const v = map[status] ?? map.disconnected;
  const Icon = v.icon;
  return (
    <Badge variant="outline" className={v.className}>
      <Icon className="size-3 mr-1" />
      {v.label}
    </Badge>
  );
}

function SubscriptionStatusBadge({ status }: { status: ActiveSubscription["status"] }) {
  const map: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
    active: { label: "Active", className: "bg-primary/20 text-primary border-primary/30", icon: CheckCircle2 },
    pending: { label: "Pending", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Clock },
    expired: { label: "Expired", className: "bg-muted text-muted-foreground border-border", icon: XCircle },
    cancelled: { label: "Cancelled", className: "bg-destructive/20 text-destructive border-destructive/30", icon: XCircle },
  };
  const v = map[status] ?? map.pending;
  const Icon = v.icon;
  return (
    <Badge variant="outline" className={v.className}>
      <Icon className="size-3 mr-1" />
      {v.label}
    </Badge>
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

  const daysProgress = activeSub?.startDate && activeSub?.endDate
    ? (() => {
        const start = new Date(activeSub.startDate).getTime();
        const end = new Date(activeSub.endDate).getTime();
        const now = Date.now();
        const total = end - start;
        const elapsed = now - start;
        return Math.max(0, Math.min(100, (elapsed / total) * 100));
      })()
    : null;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back, {user?.firstName}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Here's your copy trading status
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* MT5 Account */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">MT5 Account</CardTitle>
            <MonitorCheck className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {mt5Loading ? (
              <Skeleton className="h-6 w-24" />
            ) : primaryAccount ? (
              <div className="space-y-2">
                <div className="text-xl font-bold text-foreground">{primaryAccount.login}</div>
                <div className="text-xs text-muted-foreground">{primaryAccount.broker}</div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <DeploymentBadge status={primaryAccount.deploymentStatus} />
                  <SyncBadge status={primaryAccount.synchronizationStatus} />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">No account connected</div>
                <Link href="/connect-mt5">
                  <Button size="sm" variant="outline" className="text-xs h-7">
                    Connect MT5 <ArrowRight className="size-3 ml-1" />
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subscription */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Subscription</CardTitle>
            <CreditCard className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {subLoading ? (
              <Skeleton className="h-6 w-24" />
            ) : activeSub ? (
              <div className="space-y-2">
                <SubscriptionStatusBadge status={activeSub.status} />
                <div className="text-xl font-bold text-foreground">
                  {activeSub.daysRemaining != null
                    ? `${activeSub.daysRemaining}d left`
                    : activeSub.endDate
                    ? `Exp. ${formatDate(activeSub.endDate)}`
                    : "Active"}
                </div>
                {daysProgress !== null && (
                  <Progress value={daysProgress} className="h-1.5" />
                )}
                {activeSub.endDate && (
                  <div className="text-xs text-muted-foreground">
                    Expires {formatRelative(activeSub.endDate)}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">No active subscription</div>
                <Link href="/subscribe">
                  <Button size="sm" variant="outline" className="text-xs h-7">
                    Subscribe <ArrowRight className="size-3 ml-1" />
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Copy Trading */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Copy Trading</CardTitle>
            <Activity className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {subLoading || mt5Loading ? (
              <Skeleton className="h-6 w-24" />
            ) : activeSub?.copyFactoryStatus ? (
              <div className="space-y-1.5">
                <div className="text-xl font-bold text-foreground capitalize">
                  {activeSub.copyFactoryStatus}
                </div>
                {activeSub.copyFactoryStatus === "active" ? (
                  <div className="flex items-center gap-1.5 text-xs text-primary">
                    <TrendingUp className="size-3" />
                    Signals being copied
                  </div>
                ) : activeSub.copyFactoryStatus === "error" ? (
                  <div className="flex items-center gap-1.5 text-xs text-destructive">
                    <AlertCircle className="size-3" />
                    Check your account
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    Setting up…
                  </div>
                )}
              </div>
            ) : activeSub?.isActive && primaryAccount?.deploymentStatus === "deployed" ? (
              <div className="space-y-1.5">
                <div className="text-xl font-bold text-foreground">Pending</div>
                <div className="text-xs text-muted-foreground">Being activated…</div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="text-sm text-muted-foreground">Inactive</div>
                <div className="text-xs text-muted-foreground">
                  Requires active subscription + deployed MT5
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Setup checklist */}
      {(!primaryAccount || !activeSub) && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Getting Started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                done: !!primaryAccount,
                label: "Connect your MT5 account",
                href: "/connect-mt5",
                cta: "Connect now",
              },
              {
                done: primaryAccount?.deploymentStatus === "deployed",
                label: "Deploy to MetaApi cloud",
                href: "/connect-mt5",
                cta: "Deploy",
                disabled: !primaryAccount,
              },
              {
                done: !!activeSub?.isActive,
                label: "Subscribe to copy trading",
                href: "/subscribe",
                cta: "Subscribe",
                disabled: primaryAccount?.deploymentStatus !== "deployed",
              },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div
                  className={`size-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                    step.done
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground border border-border"
                  }`}
                >
                  {step.done ? <CheckCircle2 className="size-3.5" /> : i + 1}
                </div>
                <span
                  className={`flex-1 text-sm ${
                    step.done ? "text-muted-foreground line-through" : "text-foreground"
                  }`}
                >
                  {step.label}
                </span>
                {!step.done && !step.disabled && (
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

      {/* Account details if exists */}
      {primaryAccount && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base">MT5 Account Details</CardTitle>
            <Link href="/connect-mt5">
              <Button variant="ghost" size="sm" className="text-xs h-7">
                Manage <ArrowRight className="size-3 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Login", value: primaryAccount.login },
                { label: "Broker", value: primaryAccount.broker },
                { label: "Server", value: primaryAccount.server },
                {
                  label: "Last Sync",
                  value: primaryAccount.lastSyncedAt
                    ? formatRelative(primaryAccount.lastSyncedAt)
                    : "Never",
                },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-xs text-muted-foreground">{item.label}</dt>
                  <dd className="text-sm font-medium text-foreground mt-0.5 truncate">{item.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
