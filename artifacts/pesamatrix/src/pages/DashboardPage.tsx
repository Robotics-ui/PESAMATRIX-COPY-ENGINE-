import { AppShell } from "@/components/layout/AppShell";
import {
  useGetSubscriberDashboard,
  useGetTradingSignals,
  useGetTradingPerformance,
  useGetMySubscription,
  useGetSubscriptionSettings,
  getGetSubscriberDashboardQueryKey,
  getGetTradingSignalsQueryKey,
  getGetTradingPerformanceQueryKey,
  getGetMySubscriptionQueryKey,
  getGetSubscriptionSettingsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  Calendar,
  Zap,
  CheckCircle2,
  XCircle,
  Shield,
  Clock,
} from "lucide-react";

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  positive,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  positive?: boolean;
}) {
  return (
    <Card className="bg-card border-border/50">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {sub && (
              <p className={`text-xs flex items-center gap-1 ${positive ? "text-primary" : "text-muted-foreground"}`}>
                {positive !== undefined &&
                  (positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />)}
                {sub}
              </p>
            )}
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function fmt(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

export default function DashboardPage() {
  const { data: dash, isLoading: dashLoading } = useGetSubscriberDashboard({
    query: { queryKey: getGetSubscriberDashboardQueryKey() },
  });
  const { data: signalsData, isLoading: signalsLoading } = useGetTradingSignals({
    query: { queryKey: getGetTradingSignalsQueryKey() },
  });
  const { data: perf, isLoading: perfLoading } = useGetTradingPerformance({
    query: { queryKey: getGetTradingPerformanceQueryKey() },
  });
  const { data: mySub } = useGetMySubscription({
    query: { queryKey: getGetMySubscriptionQueryKey() },
  });
  const { data: settings } = useGetSubscriptionSettings({
    query: { queryKey: getGetSubscriptionSettingsQueryKey() },
  });

  const signals = signalsData?.signals ?? [];
  const weeklyData = perf?.weeklyData ?? [];
  const isSubActive = !!mySub?.isActive;
  const feePerDay = settings?.subscriptionFeePerDay ?? 100;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trading Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Live copy-trading performance overview</p>
        </div>

        {/* Subscription status banner */}
        {!dashLoading && dash && !dash.isSubscriptionActive && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2">
            <Zap className="h-4 w-4 shrink-0" />
            <span>No active subscription — trades are not being copied. </span>
            <a href="/subscription" className="underline font-medium ml-1">Subscribe now</a>
          </div>
        )}

        {/* Stat cards */}
        {dashLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Signals"
              value={String(dash?.totalSignals ?? 0)}
              sub={`${dash?.signalsThisWeek ?? 0} this week`}
              icon={Activity}
              positive
            />
            <StatCard
              title="Win Rate"
              value={`${dash?.winRate ?? 0}%`}
              sub={
                dash?.winRateChange !== 0
                  ? `${(dash?.winRateChange ?? 0) > 0 ? "+" : ""}${dash?.winRateChange ?? 0}% vs last period`
                  : undefined
              }
              icon={TrendingUp}
              positive={(dash?.winRateChange ?? 0) >= 0}
            />
            <StatCard
              title="Total Profit"
              value={`KES ${(dash?.totalProfit ?? 0).toLocaleString()}`}
              sub={
                dash?.profitChangePercent !== 0
                  ? `${(dash?.profitChangePercent ?? 0) > 0 ? "+" : ""}${dash?.profitChangePercent ?? 0}%`
                  : undefined
              }
              icon={DollarSign}
              positive={(dash?.profitChangePercent ?? 0) >= 0}
            />
            <StatCard
              title="Subscription"
              value={isSubActive ? `${dash?.daysRemaining ?? 0}d left` : "Inactive"}
              sub={isSubActive ? `${mySub?.subscription?.numberOfDays ?? 0} trading days` : undefined}
              icon={Calendar}
              positive={isSubActive}
            />
          </div>
        )}

        {/* ── Subscription Detail Panel ────────────────────────────────────── */}
        <Card className={`border ${isSubActive ? "border-primary/30 bg-primary/5" : "border-border/50 bg-card"}`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Subscription Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!mySub ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
              </div>
            ) : isSubActive ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      Copy Trading
                    </span>
                    <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10 text-xs">
                      Enabled
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5" />
                      Trading Days Purchased
                    </span>
                    <span className="font-medium">{mySub.subscription?.numberOfDays ?? 0} days</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Days Remaining
                    </span>
                    <span className="font-medium text-primary">{mySub.daysRemaining ?? 0} days</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      Expiry Date
                    </span>
                    <span className="font-medium">{fmt(mySub.subscription?.endDate)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5" />
                      Cost Per Day
                    </span>
                    <span className="font-medium">KES {feePerDay.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Total Paid
                    </span>
                    <span className="font-medium">
                      KES {mySub.subscription?.amountPaid
                        ? parseFloat(mySub.subscription.amountPaid).toLocaleString()
                        : "—"}
                    </span>
                  </div>
                </div>
                {/* Progress bar */}
                {mySub.subscription?.numberOfDays && (
                  <div className="sm:col-span-2">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                      <span>Subscription progress</span>
                      <span>{mySub.daysRemaining ?? 0} / {mySub.subscription.numberOfDays} days</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-primary/20">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{
                          width: `${Math.max(0, Math.min(100, ((mySub.daysRemaining ?? 0) / mySub.subscription.numberOfDays) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">No active subscription</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Copy trading is disabled.{" "}
                    <a href="/subscription" className="text-primary underline">Subscribe now</a>{" "}
                    — KES {feePerDay.toLocaleString()} per trading day.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance chart + signals list */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart */}
          <Card className="lg:col-span-2 bg-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Weekly Performance</CardTitle>
              <p className="text-xs text-muted-foreground">Cumulative profit per week (closed trades)</p>
            </CardHeader>
            <CardContent>
              {perfLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={weeklyData as { week: string; profit: number }[]}>
                    <defs>
                      <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 3.7% 18%)" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(240 5% 64.9%)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(240 5% 64.9%)" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "hsl(240 10% 6%)", border: "1px solid hsl(240 3.7% 18%)", borderRadius: 8 }}
                      labelStyle={{ color: "hsl(0 0% 98%)" }}
                      itemStyle={{ color: "hsl(142 71% 45%)" }}
                    />
                    <Area type="monotone" dataKey="profit" stroke="hsl(142 71% 45%)" strokeWidth={2} fill="url(#profitGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Quick stats */}
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Performance Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {perfLoading ? (
                Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)
              ) : (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Trades</span>
                    <span className="font-medium">{perf?.totalTrades ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Winning</span>
                    <span className="font-medium text-primary">{perf?.winningTrades ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Losing</span>
                    <span className="font-medium text-destructive">{perf?.losingTrades ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Win Rate</span>
                    <span className="font-medium">{perf?.winRate ?? 0}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Pips</span>
                    <span className="font-medium">{perf?.totalPips ?? 0}</span>
                  </div>
                  <div className="pt-2 border-t border-border/50">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground font-medium">Net Profit</span>
                      <span className={`font-bold ${(perf?.totalProfit ?? 0) >= 0 ? "text-primary" : "text-destructive"}`}>
                        KES {(perf?.totalProfit ?? 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Signals table */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Recent Signals</CardTitle>
            <p className="text-xs text-muted-foreground">Last 50 copied trade events</p>
          </CardHeader>
          <CardContent>
            {signalsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : signals.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">No signals yet. Trades will appear here once copying starts.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-2 pr-4 text-muted-foreground font-medium text-xs uppercase tracking-wider">Symbol</th>
                      <th className="text-left py-2 pr-4 text-muted-foreground font-medium text-xs uppercase tracking-wider">Type</th>
                      <th className="text-left py-2 pr-4 text-muted-foreground font-medium text-xs uppercase tracking-wider">Direction</th>
                      <th className="text-right py-2 pr-4 text-muted-foreground font-medium text-xs uppercase tracking-wider">Profit</th>
                      <th className="text-right py-2 text-muted-foreground font-medium text-xs uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {signals.slice(0, 20).map((s) => (
                      <tr key={s.id} className="hover:bg-accent/20 transition-colors">
                        <td className="py-2.5 pr-4 font-mono font-semibold text-foreground">{s.symbol}</td>
                        <td className="py-2.5 pr-4">
                          <Badge variant="outline" className="text-xs capitalize">{s.type}</Badge>
                        </td>
                        <td className="py-2.5 pr-4">
                          <Badge
                            variant="outline"
                            className={`text-xs uppercase ${s.direction === "buy" ? "border-primary/40 text-primary bg-primary/10" : "border-destructive/40 text-destructive bg-destructive/10"}`}
                          >
                            {s.direction}
                          </Badge>
                        </td>
                        <td className={`py-2.5 pr-4 text-right font-mono tabular-nums ${s.profit ? (parseFloat(s.profit) >= 0 ? "text-primary" : "text-destructive") : "text-muted-foreground"}`}>
                          {s.profit ? `${parseFloat(s.profit) >= 0 ? "+" : ""}${parseFloat(s.profit).toFixed(2)}` : "—"}
                        </td>
                        <td className="py-2.5 text-right text-muted-foreground text-xs">
                          {new Date(s.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
