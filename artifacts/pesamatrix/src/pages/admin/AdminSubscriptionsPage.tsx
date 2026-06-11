import { AdminShell } from "@/components/layout/AdminShell";
import { useAdminListSubscriptions, getAdminListSubscriptionsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const statusColors: Record<string, string> = {
  active: "border-primary/40 text-primary bg-primary/10",
  pending: "border-yellow-500/40 text-yellow-400 bg-yellow-500/10",
  expired: "border-muted-foreground/40 text-muted-foreground",
  cancelled: "border-destructive/40 text-destructive bg-destructive/10",
};

export default function AdminSubscriptionsPage() {
  const { data, isLoading } = useAdminListSubscriptions({
    query: { queryKey: getAdminListSubscriptionsQueryKey() },
  });

  const subs = data?.subscriptions ?? [];

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
          <p className="text-muted-foreground text-sm mt-0.5">All platform subscriptions</p>
        </div>

        {/* Summary badges */}
        <div className="flex gap-3 flex-wrap">
          <Badge variant="outline" className="px-3 py-1 text-sm">Total: {data?.total ?? 0}</Badge>
          <Badge variant="outline" className="px-3 py-1 text-sm border-primary/40 text-primary bg-primary/10">Active: {data?.active ?? 0}</Badge>
          <Badge variant="outline" className="px-3 py-1 text-sm text-muted-foreground">Expired: {data?.expired ?? 0}</Badge>
        </div>

        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">All Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : subs.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No subscriptions yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-2 pr-3 text-xs text-muted-foreground uppercase tracking-wider">User ID</th>
                      <th className="text-left py-2 pr-3 text-xs text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-left py-2 pr-3 text-xs text-muted-foreground uppercase tracking-wider">Days</th>
                      <th className="text-left py-2 pr-3 text-xs text-muted-foreground uppercase tracking-wider">Paid</th>
                      <th className="text-left py-2 pr-3 text-xs text-muted-foreground uppercase tracking-wider">Start</th>
                      <th className="text-left py-2 text-xs text-muted-foreground uppercase tracking-wider">End</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {subs.map((s) => (
                      <tr key={s.id} className="hover:bg-accent/20">
                        <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">{s.userId.slice(0, 8)}…</td>
                        <td className="py-2.5 pr-3">
                          <Badge variant="outline" className={`text-xs capitalize ${statusColors[s.status] ?? ""}`}>{s.status}</Badge>
                        </td>
                        <td className="py-2.5 pr-3">{s.numberOfDays}d</td>
                        <td className="py-2.5 pr-3 font-medium">KES {parseFloat(s.amountPaid).toLocaleString()}</td>
                        <td className="py-2.5 pr-3 text-muted-foreground text-xs">
                          {s.startDate ? new Date(s.startDate).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-2.5 text-muted-foreground text-xs">
                          {s.endDate ? new Date(s.endDate).toLocaleDateString() : "—"}
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
    </AdminShell>
  );
}
