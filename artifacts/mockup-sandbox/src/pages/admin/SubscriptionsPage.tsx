import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CreditCard,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
} from "lucide-react";
import { api, type Subscription, type SubscriptionStatus } from "@/lib/api";
import { formatCurrency, formatDate, formatRelative } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const STATUS_OPTIONS: (SubscriptionStatus | "all")[] = [
  "all", "active", "pending", "expired", "cancelled",
];

function SubBadge({ status }: { status: SubscriptionStatus }) {
  const map = {
    active: { label: "Active", cls: "bg-primary/20 text-primary border-primary/30", icon: CheckCircle2 },
    pending: { label: "Pending", cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Clock },
    expired: { label: "Expired", cls: "bg-muted text-muted-foreground", icon: XCircle },
    cancelled: { label: "Cancelled", cls: "bg-destructive/20 text-destructive border-destructive/30", icon: XCircle },
  };
  const v = map[status] ?? map.pending;
  const Icon = v.icon;
  return (
    <Badge variant="outline" className={v.cls}>
      <Icon className="size-3 mr-1" />
      {v.label}
    </Badge>
  );
}

export default function AdminSubscriptionsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<SubscriptionStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<{ id: string; action: "expire" | "cancel" } | null>(null);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["admin/subscriptions", status, page],
    queryFn: () =>
      api.admin.subscriptions({
        status: status === "all" ? undefined : status,
        page,
        limit,
      }),
    placeholderData: (prev) => prev,
  });

  const subs = data?.subscriptions ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const expireMutation = useMutation({
    mutationFn: (id: string) => api.admin.expireSubscription(id),
    onSuccess: () => {
      toast.success("Subscription expired.");
      qc.invalidateQueries({ queryKey: ["admin/subscriptions"] });
      setConfirm(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.admin.cancelSubscription(id),
    onSuccess: () => {
      toast.success("Subscription cancelled.");
      qc.invalidateQueries({ queryKey: ["admin/subscriptions"] });
      setConfirm(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleConfirm = () => {
    if (!confirm) return;
    if (confirm.action === "expire") expireMutation.mutate(confirm.id);
    else cancelMutation.mutate(confirm.id);
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Subscriptions</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {total > 0 ? `${total} subscriptions` : "Manage all subscriptions"}
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-4 flex-row items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="size-4 text-muted-foreground" />
            All Subscriptions
          </CardTitle>
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_OPTIONS.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={status === s ? "default" : "outline"}
                  className="h-7 text-xs capitalize"
                  onClick={() => {
                    setStatus(s);
                    setPage(1);
                  }}
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : subs.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="size-8 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">No subscriptions found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">User</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Duration</TableHead>
                  <TableHead className="text-muted-foreground">Amount</TableHead>
                  <TableHead className="text-muted-foreground">Start</TableHead>
                  <TableHead className="text-muted-foreground">Expiry</TableHead>
                  <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subs.map((sub) => (
                  <TableRow key={sub.id} className="border-border hover:bg-muted/30">
                    <TableCell>
                      <div className="text-sm text-foreground">
                        {sub.user ? `${sub.user.firstName} ${sub.user.lastName}` : "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">{sub.user?.email}</div>
                    </TableCell>
                    <TableCell>
                      <SubBadge status={sub.status} />
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {sub.numberOfDays}d
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-foreground">
                      {formatCurrency(sub.amountPaid)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {sub.startDate ? formatDate(sub.startDate) : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {sub.endDate ? (
                        <span title={formatDate(sub.endDate)}>
                          {formatRelative(sub.endDate)}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {(sub.status === "active" || sub.status === "pending") && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 text-xs">
                              Actions
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover border-border">
                            {sub.status === "active" && (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive focus:bg-destructive/10 text-sm"
                                onClick={() => setConfirm({ id: sub.id, action: "expire" })}
                              >
                                Force Expire
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive focus:bg-destructive/10 text-sm"
                              onClick={() => setConfirm({ id: sub.id, action: "cancel" })}
                            >
                              Cancel
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirm} onOpenChange={() => setConfirm(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.action === "expire" ? "Force Expire Subscription?" : "Cancel Subscription?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {confirm?.action === "expire"
                ? "This will immediately expire the subscription and detach the subscriber from CopyFactory."
                : "This will cancel the subscription. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirm}
              disabled={expireMutation.isPending || cancelMutation.isPending}
            >
              {(expireMutation.isPending || cancelMutation.isPending) && (
                <Loader2 className="size-4 animate-spin mr-2" />
              )}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
