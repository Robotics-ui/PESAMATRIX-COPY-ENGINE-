import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText, Loader2, Search } from "lucide-react";
import { api, type AuditLog } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

const ACTION_COLORS: Record<string, string> = {
  user_registered: "bg-primary/20 text-primary border-primary/30",
  user_logged_in: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  user_logged_out: "bg-muted text-muted-foreground",
  mt5_account_registered: "bg-primary/20 text-primary border-primary/30",
  mt5_account_deployed: "bg-primary/20 text-primary border-primary/30",
  mt5_account_removed: "bg-destructive/20 text-destructive border-destructive/30",
  subscription_created: "bg-primary/20 text-primary border-primary/30",
  subscription_activated: "bg-primary/20 text-primary border-primary/30",
  subscription_expired: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  subscription_cancelled: "bg-destructive/20 text-destructive border-destructive/30",
  payment_initiated: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  payment_completed: "bg-primary/20 text-primary border-primary/30",
  payment_failed: "bg-destructive/20 text-destructive border-destructive/30",
  copyfactory_subscriber_attached: "bg-primary/20 text-primary border-primary/30",
  copyfactory_subscriber_detached: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

function ActionBadge({ action }: { action: string }) {
  const cls = ACTION_COLORS[action] ?? "bg-muted text-muted-foreground";
  const label = action.replace(/_/g, " ");
  return (
    <Badge variant="outline" className={`${cls} text-xs capitalize`}>
      {label}
    </Badge>
  );
}

function LogRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;

  return (
    <>
      <TableRow
        className={`border-border hover:bg-muted/30 ${hasMetadata ? "cursor-pointer" : ""}`}
        onClick={() => hasMetadata && setExpanded(!expanded)}
      >
        <TableCell className="text-xs text-muted-foreground font-mono whitespace-nowrap">
          {formatDateTime(log.createdAt)}
        </TableCell>
        <TableCell>
          <ActionBadge action={log.action} />
        </TableCell>
        <TableCell className="text-sm text-foreground">
          {log.user ? (
            <div>
              <div className="font-medium">{log.user.firstName} {log.user.lastName}</div>
              <div className="text-xs text-muted-foreground">{log.user.email}</div>
            </div>
          ) : (
            <span className="text-muted-foreground text-xs">System</span>
          )}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {log.targetType && (
            <span className="capitalize">{log.targetType.replace(/_/g, " ")}</span>
          )}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground font-mono">
          {log.ipAddress ?? "—"}
        </TableCell>
      </TableRow>
      {expanded && hasMetadata && (
        <TableRow className="border-border bg-muted/10 hover:bg-muted/10">
          <TableCell colSpan={5} className="py-3 px-6">
            <pre className="text-xs text-muted-foreground font-mono overflow-x-auto whitespace-pre-wrap max-w-full">
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function AdminAuditLogsPage() {
  const [page, setPage] = useState(1);
  const limit = 30;

  const { data, isLoading } = useQuery({
    queryKey: ["admin/audit-logs", page],
    queryFn: () => api.admin.auditLogs({ page, limit }),
    placeholderData: (prev) => prev,
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Audit Logs</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {total > 0 ? `${total} total events` : "System activity trail"}
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3 flex-row items-center gap-2">
          <ScrollText className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Activity Log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <ScrollText className="size-8 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">No audit logs yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground whitespace-nowrap">Timestamp</TableHead>
                  <TableHead className="text-muted-foreground">Action</TableHead>
                  <TableHead className="text-muted-foreground">User</TableHead>
                  <TableHead className="text-muted-foreground">Target</TableHead>
                  <TableHead className="text-muted-foreground">IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <LogRow key={log.id} log={log} />
                ))}
              </TableBody>
            </Table>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages} · {total} total
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
    </div>
  );
}
