import { useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import {
  useAdminListSubscriptionsFiltered,
  useAdminGetSubscriptionStats,
  useAdminExpireSubscription,
  useAdminCancelSubscription,
  useAdminActivateSubscription,
  useAdminProcessExpiredSubscriptions,
  getAdminGetSubscriptionStatsQueryKey,
  getAdminListSubscriptionsFilteredQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  RefreshCw,
  MoreHorizontal,
  Zap,
  PlayCircle,
  Ban,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type StatusFilter = "all" | "active" | "expired" | "pending" | "cancelled";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "expired", label: "Expired" },
  { key: "pending", label: "Pending" },
  { key: "cancelled", label: "Cancelled" },
];

const statusColors: Record<string, string> = {
  active: "border-primary/40 text-primary bg-primary/10",
  pending: "border-yellow-500/40 text-yellow-400 bg-yellow-500/10",
  expired: "border-muted-foreground/40 text-muted-foreground",
  cancelled: "border-destructive/40 text-destructive bg-destructive/10",
};

function fmt(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

type SubscriptionRow = {
  subscription: {
    id: string;
    userId: string;
    status: string;
    isActive: boolean;
    numberOfDays: number;
    amountPaid: string;
    startDate: string | null;
    endDate: string | null;
  };
  plan: { id: string; name: string } | null;
  user: { id: string; email: string; firstName: string | null; lastName: string | null } | null;
};

type ActionTarget = { id: string; email: string; action: "expire" | "cancel" | "activate" };

export default function AdminSubscriptionsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null);

  const filterParams = statusFilter === "all" ? {} : { status: statusFilter };

  const { data: stats, isLoading: statsLoading } = useAdminGetSubscriptionStats({
    query: { queryKey: getAdminGetSubscriptionStatsQueryKey() },
  });

  const { data: listData, isLoading: listLoading } = useAdminListSubscriptionsFiltered(filterParams, {
    query: { queryKey: getAdminListSubscriptionsFilteredQueryKey(filterParams) },
  });

  const expireMutation = useAdminExpireSubscription();
  const cancelMutation = useAdminCancelSubscription();
  const activateMutation = useAdminActivateSubscription();
  const processMutation = useAdminProcessExpiredSubscriptions();

  const rawSubs = (listData as { subscriptions?: unknown[] } | undefined)?.subscriptions ?? [];
  const subs = rawSubs as SubscriptionRow[];
  const total = (listData as { total?: number } | undefined)?.total ?? 0;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getAdminGetSubscriptionStatsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getAdminListSubscriptionsFilteredQueryKey(filterParams) });
    queryClient.invalidateQueries({ queryKey: getAdminListSubscriptionsFilteredQueryKey({}) });
  };

  const confirmAction = (row: SubscriptionRow, action: ActionTarget["action"]) => {
    setActionTarget({
      id: row.subscription.id,
      email: row.user?.email ?? row.subscription.userId.slice(0, 8),
      action,
    });
  };

  const executeAction = () => {
    if (!actionTarget) return;
    const { id, action } = actionTarget;

    if (action === "expire") {
      expireMutation.mutate(
        { id },
        {
          onSuccess: () => { toast({ title: "Subscription expired" }); setActionTarget(null); invalidate(); },
          onError: (e: unknown) => toast({ variant: "destructive", title: "Failed", description: e instanceof Error ? e.message : undefined }),
        },
      );
    } else if (action === "cancel") {
      cancelMutation.mutate(
        { id },
        {
          onSuccess: () => { toast({ title: "Subscription cancelled" }); setActionTarget(null); invalidate(); },
          onError: (e: unknown) => toast({ variant: "destructive", title: "Failed", description: e instanceof Error ? e.message : undefined }),
        },
      );
    } else if (action === "activate") {
      activateMutation.mutate(
        { data: { subscriptionId: id } },
        {
          onSuccess: () => { toast({ title: "Subscription activated" }); setActionTarget(null); invalidate(); },
          onError: (e: unknown) => toast({ variant: "destructive", title: "Failed", description: e instanceof Error ? e.message : undefined }),
        },
      );
    }
  };

  const handleRunBatch = () => {
    processMutation.mutate(undefined, {
      onSuccess: (res) => {
        toast({ title: "Expiry batch complete", description: `Scanned ${res.scanned}, queued ${res.queued}` });
        invalidate();
      },
      onError: (e: unknown) => toast({ variant: "destructive", title: "Batch failed", description: e instanceof Error ? e.message : undefined }),
    });
  };

  const actionMutating = expireMutation.isPending || cancelMutation.isPending || activateMutation.isPending;

  const actionLabels: Record<ActionTarget["action"], { title: string; desc: string; btnLabel: string }> = {
    expire: { title: "Force Expire Subscription", desc: "This will immediately expire the subscription and disable copy trading.", btnLabel: "Force Expire" },
    cancel: { title: "Cancel Subscription", desc: "This will cancel the subscription and remove the CopyFactory relationship.", btnLabel: "Cancel Subscription" },
    activate: { title: "Activate Subscription", desc: "This will activate the subscription and enable copy trading for this user.", btnLabel: "Activate" },
  };

  return (
    <AdminShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Manage all platform subscriptions</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunBatch}
            disabled={processMutation.isPending}
            className="shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${processMutation.isPending ? "animate-spin" : ""}`} />
            {processMutation.isPending ? "Running..." : "Run Expiry Batch"}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {statsLoading ? (
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
          ) : (
            <>
              <Card className="bg-card border-border/50">
                <CardContent className="p-4 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span className="text-xs uppercase tracking-wide">Total</span>
                  </div>
                  <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border/50">
                <CardContent className="p-4 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-primary">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span className="text-xs uppercase tracking-wide">Active</span>
                  </div>
                  <p className="text-2xl font-bold text-primary">{stats?.active ?? 0}</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border/50">
                <CardContent className="p-4 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-xs uppercase tracking-wide">Expired</span>
                  </div>
                  <p className="text-2xl font-bold">{stats?.expired ?? 0}</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border/50">
                <CardContent className="p-4 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-yellow-500">
                    <Zap className="h-3.5 w-3.5" />
                    <span className="text-xs uppercase tracking-wide">Pending</span>
                  </div>
                  <p className="text-2xl font-bold text-yellow-400">{stats?.pending ?? 0}</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border/50">
                <CardContent className="p-4 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-destructive">
                    <XCircle className="h-3.5 w-3.5" />
                    <span className="text-xs uppercase tracking-wide">Cancelled</span>
                  </div>
                  <p className="text-2xl font-bold text-destructive">{stats?.cancelled ?? 0}</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border/50">
                <CardContent className="p-4 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-primary">
                    <DollarSign className="h-3.5 w-3.5" />
                    <span className="text-xs uppercase tracking-wide">Revenue</span>
                  </div>
                  <p className="text-xl font-bold text-primary">
                    {(stats?.totalRevenue ?? 0) >= 1000
                      ? `${((stats?.totalRevenue ?? 0) / 1000).toFixed(1)}k`
                      : (stats?.totalRevenue ?? 0).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              {label}
              {key !== "all" && stats && (
                <span className="ml-1.5 text-xs opacity-75">
                  {stats[key as keyof typeof stats] as number}
                </span>
              )}
            </button>
          ))}
          {total > 0 && (
            <span className="ml-auto text-xs text-muted-foreground self-center">
              {total} total
            </span>
          )}
        </div>

        {/* Subscriptions Table */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              {statusFilter === "all" ? "All Subscriptions" : `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Subscriptions`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {listLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : subs.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No subscriptions found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-2 pr-3 text-xs text-muted-foreground uppercase tracking-wider">User</th>
                      <th className="text-left py-2 pr-3 text-xs text-muted-foreground uppercase tracking-wider">Plan</th>
                      <th className="text-left py-2 pr-3 text-xs text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-left py-2 pr-3 text-xs text-muted-foreground uppercase tracking-wider">Days</th>
                      <th className="text-left py-2 pr-3 text-xs text-muted-foreground uppercase tracking-wider">Amount</th>
                      <th className="text-left py-2 pr-3 text-xs text-muted-foreground uppercase tracking-wider">Start</th>
                      <th className="text-left py-2 pr-3 text-xs text-muted-foreground uppercase tracking-wider">End</th>
                      <th className="text-right py-2 text-xs text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {subs.map((row) => {
                      const s = row.subscription;
                      const userName = row.user
                        ? `${row.user.firstName ?? ""} ${row.user.lastName ?? ""}`.trim() || row.user.email
                        : s.userId.slice(0, 8) + "…";
                      const userEmail = row.user?.email ?? "";
                      const canExpire = s.status === "active";
                      const canCancel = s.status === "active" || s.status === "pending";
                      const canActivate = s.status === "pending";

                      return (
                        <tr key={s.id} className="hover:bg-accent/20 transition-colors">
                          <td className="py-2.5 pr-3">
                            <div>
                              <p className="font-medium text-sm leading-tight">{userName}</p>
                              {userEmail && userName !== userEmail && (
                                <p className="text-xs text-muted-foreground font-mono">{userEmail}</p>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 pr-3 text-muted-foreground">
                            {row.plan?.name ?? "—"}
                          </td>
                          <td className="py-2.5 pr-3">
                            <Badge variant="outline" className={`text-xs capitalize ${statusColors[s.status] ?? ""}`}>
                              {s.status}
                            </Badge>
                          </td>
                          <td className="py-2.5 pr-3 font-medium">{s.numberOfDays}d</td>
                          <td className="py-2.5 pr-3 font-medium">
                            KES {parseFloat(s.amountPaid).toLocaleString()}
                          </td>
                          <td className="py-2.5 pr-3 text-muted-foreground text-xs">{fmt(s.startDate)}</td>
                          <td className="py-2.5 pr-3 text-muted-foreground text-xs">{fmt(s.endDate)}</td>
                          <td className="py-2.5 text-right">
                            {(canExpire || canCancel || canActivate) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {canActivate && (
                                    <DropdownMenuItem
                                      className="text-primary focus:text-primary"
                                      onClick={() => confirmAction(row, "activate")}
                                    >
                                      <PlayCircle className="h-3.5 w-3.5 mr-2" />
                                      Activate
                                    </DropdownMenuItem>
                                  )}
                                  {canExpire && (
                                    <DropdownMenuItem
                                      className="text-muted-foreground"
                                      onClick={() => confirmAction(row, "expire")}
                                    >
                                      <AlertTriangle className="h-3.5 w-3.5 mr-2" />
                                      Force Expire
                                    </DropdownMenuItem>
                                  )}
                                  {canCancel && (
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => confirmAction(row, "cancel")}
                                    >
                                      <Ban className="h-3.5 w-3.5 mr-2" />
                                      Cancel
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Action Confirmation Dialog ─────────────────────────────────────────── */}
      <AlertDialog open={!!actionTarget} onOpenChange={(open) => !open && setActionTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {actionTarget?.action === "activate" ? (
                <PlayCircle className="h-5 w-5 text-primary" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-destructive" />
              )}
              {actionTarget ? actionLabels[actionTarget.action].title : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionTarget ? actionLabels[actionTarget.action].desc : ""}
              {actionTarget && (
                <span className="block mt-1 font-medium text-foreground">{actionTarget.email}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeAction}
              disabled={actionMutating}
              className={
                actionTarget?.action === "activate"
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              }
            >
              {actionMutating ? "Processing..." : actionTarget ? actionLabels[actionTarget.action].btnLabel : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
