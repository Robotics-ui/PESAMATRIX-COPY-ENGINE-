import { useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import {
  useGetMasterAccount,
  useGetMasterAccountStatus,
  useRegisterMasterAccount,
  useDeleteMasterAccount,
  useRedeployMasterAccount,
  getGetMasterAccountQueryKey,
  getGetMasterAccountStatusQueryKey,
} from "@workspace/api-client-react";
import type { RegisterMasterAccountRequestRegion } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Trash2, Server, Rocket } from "lucide-react";

const REGIONS: RegisterMasterAccountRequestRegion[] = ["london", "new-york", "singapore", "sydney", "tokyo"];

export default function AdminMasterAccountPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ login: "", password: "", server: "", broker: "", region: "london" as RegisterMasterAccountRequestRegion });

  const { data: masterData, isLoading } = useGetMasterAccount({
    query: { queryKey: getGetMasterAccountQueryKey() },
  });
  const { data: statusData, refetch: refetchStatus } = useGetMasterAccountStatus({
    query: { queryKey: getGetMasterAccountStatusQueryKey(), enabled: !!masterData?.mt5Account },
  });

  const registerMutation = useRegisterMasterAccount();
  const deleteMutation = useDeleteMasterAccount();
  const redeployMutation = useRedeployMasterAccount();

  const master = masterData?.mt5Account;

  const handleRegister = () => {
    registerMutation.mutate(
      { data: { login: form.login, password: form.password, server: form.server, broker: form.broker, region: form.region } },
      {
        onSuccess: () => {
          toast({ title: "Master Account Registered", description: "Deploying to MetaApi now..." });
          queryClient.invalidateQueries({ queryKey: getGetMasterAccountQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMasterAccountStatusQueryKey() });
          setForm({ login: "", password: "", server: "", broker: "", region: "london" });
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : "Registration failed";
          toast({ variant: "destructive", title: "Failed", description: msg });
        },
      },
    );
  };

  const handleDelete = () => {
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "Master Account Removed" });
        queryClient.invalidateQueries({ queryKey: getGetMasterAccountQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMasterAccountStatusQueryKey() });
      },
      onError: () => toast({ variant: "destructive", title: "Delete failed" }),
    });
  };

  const handleRedeploy = () => {
    redeployMutation.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "Redeployment Started" });
        queryClient.invalidateQueries({ queryKey: getGetMasterAccountStatusQueryKey() });
      },
      onError: () => toast({ variant: "destructive", title: "Redeploy failed" }),
    });
  };

  const deployBadge: Record<string, string> = {
    not_deployed: "text-muted-foreground",
    deploying: "border-yellow-500/40 text-yellow-400 bg-yellow-500/10",
    deployed: "border-primary/40 text-primary bg-primary/10",
    failed: "border-destructive/40 text-destructive bg-destructive/10",
    removed: "text-muted-foreground",
  };

  return (
    <AdminShell>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Master Account</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Configure the master MT5 account for trade copying</p>
        </div>

        {isLoading ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : master ? (
          <Card className="bg-card border-primary/30">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Server className="h-4 w-4 text-primary" />
                  {master.login} — {master.broker}
                </CardTitle>
                <Badge variant="outline" className={`text-xs capitalize ${deployBadge[master.deploymentStatus] ?? ""}`}>
                  {master.deploymentStatus.replace("_", " ")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Server</p>
                  <p className="font-medium">{master.server}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sync Status</p>
                  <p className="font-medium capitalize">{master.synchronizationStatus.replace("_", " ")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">MetaApi ID</p>
                  <p className="font-mono text-xs truncate">{masterData?.metaApiAccountId ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">CopyFactory Strategy</p>
                  <p className="font-mono text-xs truncate">{masterData?.copyFactoryStrategyId ?? "—"}</p>
                </div>
              </div>

              {statusData && (
                <div className="p-3 rounded-lg bg-accent/30 text-sm space-y-1">
                  <p className="font-medium text-xs text-muted-foreground uppercase tracking-wider">Live Status</p>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${statusData.isSynchronized ? "bg-primary" : "bg-yellow-400"}`} />
                    <span>{statusData.isSynchronized ? "Synchronized" : "Not Synchronized"}</span>
                  </div>
                  {statusData.connectionStatus && (
                    <p className="text-xs text-muted-foreground capitalize">{statusData.connectionStatus}</p>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRedeploy}
                  disabled={redeployMutation.isPending}
                  className="border-primary/40 text-primary hover:bg-primary/10"
                >
                  <Rocket className="h-3.5 w-3.5 mr-1.5" />
                  {redeployMutation.isPending ? "..." : "Redeploy"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => refetchStatus()}
                  className="text-muted-foreground"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Refresh
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="text-destructive hover:bg-destructive/10 ml-auto"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Remove
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Register Master Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Login</Label>
                  <Input placeholder="12345678" value={form.login} onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Password</Label>
                  <Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Server</Label>
                  <Input placeholder="ICMarkets-Live01" value={form.server} onChange={(e) => setForm((f) => ({ ...f, server: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Broker</Label>
                  <Input placeholder="ICMarkets" value={form.broker} onChange={(e) => setForm((f) => ({ ...f, broker: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Region</Label>
                <Select value={form.region} onValueChange={(v) => setForm((f) => ({ ...f, region: v as RegisterMasterAccountRequestRegion }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REGIONS.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full bg-primary text-primary-foreground"
                onClick={handleRegister}
                disabled={registerMutation.isPending || !form.login || !form.password || !form.server || !form.broker}
              >
                {registerMutation.isPending ? "Registering..." : "Register & Deploy Master Account"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminShell>
  );
}
