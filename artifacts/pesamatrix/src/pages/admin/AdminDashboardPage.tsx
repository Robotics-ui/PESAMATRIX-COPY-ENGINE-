import { AdminShell } from "@/components/layout/AdminShell";
import {
  useAdminDashboard,
  getAdminDashboardQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, CreditCard, TrendingUp, Clock, AlertCircle } from "lucide-react";

function StatCard({ title, value, icon: Icon, sub }: { title: string; value: string | number; icon: React.ComponentType<{ className?: string }>; sub?: string }) {
  return (
    <Card className="bg-card border-border/50">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const { data, isLoading } = useAdminDashboard({
    query: { queryKey: getAdminDashboardQueryKey() },
  });

  const stats = data?.stats;
  const recentUsers = data?.recentUsers ?? [];
  const recentActivity = (data?.recentActivity ?? []) as { action?: string; createdAt?: string; userId?: string; targetType?: string }[];

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Platform-wide overview</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard title="Total Users" value={stats?.totalUsers ?? 0} icon={Users} sub={`${stats?.adminUsers ?? 0} admins`} />
            <StatCard title="Active Subscriptions" value={stats?.activeSubscriptions ?? 0} icon={CreditCard} sub="Currently active" />
            <StatCard title="Total Revenue" value={`KES ${(stats?.totalRevenue ?? 0).toLocaleString()}`} icon={TrendingUp} sub="Completed payments" />
            <StatCard title="Subscribers" value={stats?.subscriberUsers ?? 0} icon={Users} sub="Non-admin users" />
            <StatCard title="Pending Payments" value={stats?.pendingPayments ?? 0} icon={Clock} sub="Awaiting confirmation" />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent users */}
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Recent Registrations</CardTitle>
            </CardHeader>
            <CardContent>
              {recentUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No users yet</p>
              ) : (
                <div className="space-y-2">
                  {recentUsers.slice(0, 8).map((u) => (
                    <div key={u.id} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold uppercase shrink-0">
                          {u.firstName?.[0] ?? u.email?.[0] ?? "U"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {u.firstName ? `${u.firstName} ${u.lastName ?? ""}`.trim() : u.email}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs capitalize ml-2 shrink-0">{u.role}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent activity */}
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No activity yet</p>
              ) : (
                <div className="space-y-2">
                  {recentActivity.slice(0, 10).map((a, i) => (
                    <div key={i} className="flex items-start gap-3 py-1.5">
                      <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                        <AlertCircle className="h-2.5 w-2.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium capitalize">{String(a.action ?? "").replace(/_/g, " ")}</p>
                        {a.createdAt && (
                          <p className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}
