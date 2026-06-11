import { useQuery } from "@tanstack/react-query";
import {
  Users,
  CreditCard,
  TrendingUp,
  MonitorCheck,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatRelative } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function StatCard({
  title,
  value,
  icon: Icon,
  sub,
  loading,
}: {
  title: string;
  value: string | number;
  icon: typeof Users;
  sub?: string;
  loading?: boolean;
}) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <div className="text-2xl font-bold text-foreground">{value}</div>
        )}
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const { data: dash, isLoading: dashLoading } = useQuery({
    queryKey: ["admin/dashboard"],
    queryFn: () => api.admin.dashboard(),
    refetchInterval: 30_000,
  });

  const { data: subStats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin/subscriptions/stats"],
    queryFn: () => api.admin.subscriptionStats(),
    refetchInterval: 30_000,
  });

  const { data: queueHealth, isLoading: queueLoading } = useQuery({
    queryKey: ["admin/queue/health"],
    queryFn: () => api.admin.queueHealth(),
    refetchInterval: 15_000,
  });

  const { data: queueStats } = useQuery({
    queryKey: ["admin/queue/stats"],
    queryFn: () => api.admin.queueStats(),
    refetchInterval: 15_000,
  });

  const { data: masterAccount } = useQuery({
    queryKey: ["admin/master-account"],
    queryFn: () => api.admin.masterAccount(),
    retry: false,
  });

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">System overview and health</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={dash?.totalUsers ?? 0}
          icon={Users}
          loading={dashLoading}
        />
        <StatCard
          title="Active Subscriptions"
          value={subStats?.active ?? dash?.activeSubscriptions ?? 0}
          icon={CreditCard}
          sub={subStats ? `${subStats.pending} pending` : undefined}
          loading={dashLoading && statsLoading}
        />
        <StatCard
          title="Total Revenue"
          value={
            subStats?.totalRevenue
              ? formatCurrency(subStats.totalRevenue)
              : dash?.totalRevenue
              ? formatCurrency(dash.totalRevenue)
              : "KES 0"
          }
          icon={TrendingUp}
          loading={dashLoading && statsLoading}
        />
        <StatCard
          title="MT5 Accounts"
          value={dash?.totalMt5Accounts ?? 0}
          icon={MonitorCheck}
          loading={dashLoading}
        />
      </div>

      {/* Queue health + Master account */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Queue Health */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base">Queue Health</CardTitle>
            {queueLoading ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : queueHealth?.status === "ok" ? (
              <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
                <CheckCircle2 className="size-3 mr-1" /> Healthy
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30">
                <AlertTriangle className="size-3 mr-1" /> Degraded
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {queueStats?.queues?.map((q) => (
              <div key={q.name} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground capitalize">
                  {q.name.replace("Queue", "")}
                </span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-primary">{q.active} active</span>
                  <span className="text-muted-foreground">{q.waiting} waiting</span>
                  {q.failed > 0 && (
                    <span className="text-destructive">{q.failed} failed</span>
                  )}
                </div>
              </div>
            )) ?? (
              <p className="text-sm text-muted-foreground">
                {queueLoading ? "Loading…" : "No queue data"}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Master Account */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base">Master Account</CardTitle>
            <Zap className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            {masterAccount ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Login", value: masterAccount.login },
                    { label: "Broker", value: masterAccount.broker },
                    { label: "Server", value: masterAccount.server },
                    { label: "Deployment", value: masterAccount.deploymentStatus },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                      <div className="text-sm font-medium text-foreground capitalize truncate">
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className={
                      masterAccount.deploymentStatus === "deployed"
                        ? "bg-primary/20 text-primary border-primary/30"
                        : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                    }
                  >
                    {masterAccount.deploymentStatus}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      masterAccount.synchronizationStatus === "synchronized"
                        ? "bg-primary/20 text-primary border-primary/30"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {masterAccount.synchronizationStatus}
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No master account configured</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Subscription breakdown */}
      {subStats && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Subscription Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {[
                { label: "Total", value: subStats.total, icon: Activity, cls: "text-foreground" },
                { label: "Active", value: subStats.active, icon: CheckCircle2, cls: "text-primary" },
                { label: "Pending", value: subStats.pending, icon: Clock, cls: "text-yellow-400" },
                { label: "Expired", value: subStats.expired, icon: XCircle, cls: "text-muted-foreground" },
                { label: "Cancelled", value: subStats.cancelled, icon: XCircle, cls: "text-destructive" },
              ].map((item) => (
                <div key={item.label} className="text-center p-3 rounded-lg bg-muted/30">
                  <div className={`text-2xl font-bold ${item.cls}`}>{item.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{item.label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
