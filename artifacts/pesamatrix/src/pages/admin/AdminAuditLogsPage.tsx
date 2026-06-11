import { AdminShell } from "@/components/layout/AdminShell";
import { useAdminAuditLogs, getAdminAuditLogsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

type LogEntry = {
  id?: string;
  action?: string;
  userId?: string;
  targetType?: string;
  targetId?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
};

const actionColor = (action: string = "") => {
  if (action.includes("delete") || action.includes("remove")) return "border-destructive/40 text-destructive bg-destructive/10";
  if (action.includes("create") || action.includes("register") || action.includes("initiate")) return "border-primary/40 text-primary bg-primary/10";
  if (action.includes("update") || action.includes("settings")) return "border-yellow-500/40 text-yellow-400 bg-yellow-500/10";
  return "border-muted-foreground/30 text-muted-foreground";
};

export default function AdminAuditLogsPage() {
  const { data, isLoading } = useAdminAuditLogs({
    query: { queryKey: getAdminAuditLogsQueryKey() },
  });

  const logs = (data?.logs ?? []) as LogEntry[];

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Platform-wide activity trail</p>
        </div>

        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Recent Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : logs.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-10">No audit logs yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-2 pr-4 text-xs text-muted-foreground uppercase tracking-wider">Time</th>
                      <th className="text-left py-2 pr-4 text-xs text-muted-foreground uppercase tracking-wider">Action</th>
                      <th className="text-left py-2 pr-4 text-xs text-muted-foreground uppercase tracking-wider">User</th>
                      <th className="text-left py-2 pr-4 text-xs text-muted-foreground uppercase tracking-wider">Target</th>
                      <th className="text-left py-2 text-xs text-muted-foreground uppercase tracking-wider">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {logs.map((log, i) => (
                      <tr key={log.id ?? i} className="hover:bg-accent/20 transition-colors">
                        <td className="py-2.5 pr-4 text-muted-foreground text-xs whitespace-nowrap">
                          {log.createdAt ? new Date(log.createdAt).toLocaleString() : "—"}
                        </td>
                        <td className="py-2.5 pr-4">
                          <Badge variant="outline" className={`text-xs ${actionColor(log.action)}`}>
                            {String(log.action ?? "unknown").replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">{log.userId ? log.userId.slice(0, 8) + "…" : "—"}</td>
                        <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">{log.targetId ? String(log.targetId).slice(0, 12) + "…" : "—"}</td>
                        <td className="py-2.5 text-xs text-muted-foreground capitalize">{log.targetType?.replace(/_/g, " ") ?? "—"}</td>
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
