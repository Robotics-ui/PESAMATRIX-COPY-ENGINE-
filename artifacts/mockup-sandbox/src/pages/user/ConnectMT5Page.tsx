import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  MonitorCheck,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Trash2,
  Wifi,
  WifiOff,
  Server,
  Play,
  AlertCircle,
} from "lucide-react";
import { api, type Mt5Account } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";

const schema = z.object({
  login: z.string().min(3, "MT5 login required"),
  password: z.string().min(1, "Password required"),
  broker: z.string().min(2, "Broker name required"),
  server: z.string().min(2, "Server required (e.g. ICMarkets-Live)"),
});
type FormData = z.infer<typeof schema>;

function StatusBadge({ account }: { account: Mt5Account }) {
  const deploy = account.deploymentStatus;
  const sync = account.synchronizationStatus;

  const deployMap = {
    deployed: { label: "Deployed", cls: "bg-primary/20 text-primary border-primary/30" },
    deploying: { label: "Deploying…", cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    pending: { label: "Pending", cls: "bg-muted text-muted-foreground" },
    failed: { label: "Failed", cls: "bg-destructive/20 text-destructive border-destructive/30" },
    undeployed: { label: "Undeployed", cls: "bg-muted text-muted-foreground" },
  };
  const syncMap = {
    synchronized: { label: "Synced", cls: "bg-primary/20 text-primary border-primary/30", icon: Wifi },
    synchronizing: { label: "Syncing…", cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: RefreshCw },
    connected: { label: "Connected", cls: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Wifi },
    disconnected: { label: "Disconnected", cls: "bg-muted text-muted-foreground", icon: WifiOff },
    connecting: { label: "Connecting…", cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: RefreshCw },
    error: { label: "Error", cls: "bg-destructive/20 text-destructive border-destructive/30", icon: XCircle },
  };
  const dv = deployMap[deploy] ?? deployMap.pending;
  const sv = syncMap[sync] ?? syncMap.disconnected;
  const SyncIcon = sv.icon;

  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge variant="outline" className={dv.cls}>{dv.label}</Badge>
      <Badge variant="outline" className={sv.cls}>
        <SyncIcon className="size-3 mr-1" />
        {sv.label}
      </Badge>
    </div>
  );
}

export default function ConnectMT5Page() {
  const qc = useQueryClient();
  const [pollingId, setPollingId] = useState<string | null>(null);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["mt5/accounts"],
    queryFn: () => api.mt5.list(),
  });

  const { data: polledStatus } = useQuery({
    queryKey: ["mt5/status", pollingId],
    queryFn: () => api.mt5.getStatus(pollingId!),
    enabled: !!pollingId,
    refetchInterval: 4000,
  });

  useEffect(() => {
    if (!polledStatus || !pollingId) return;
    const done = ["deployed", "failed"].includes(polledStatus.deploymentStatus) &&
      polledStatus.deploymentStatus !== "deploying";
    if (done) {
      setPollingId(null);
      qc.invalidateQueries({ queryKey: ["mt5/accounts"] });
      if (polledStatus.deploymentStatus === "deployed") {
        toast.success("MT5 account deployed successfully!");
      } else if (polledStatus.deploymentStatus === "failed") {
        toast.error("Deployment failed. Check your MT5 credentials.");
      }
    }
  }, [polledStatus, pollingId, qc]);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const registerMutation = useMutation({
    mutationFn: (data: FormData) => api.mt5.register(data),
    onSuccess: () => {
      toast.success("MT5 account registered!");
      qc.invalidateQueries({ queryKey: ["mt5/accounts"] });
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deployMutation = useMutation({
    mutationFn: (id: string) => api.mt5.deploy(id),
    onSuccess: (_, id) => {
      toast.info("Deploying your MT5 account…");
      setPollingId(id);
      qc.invalidateQueries({ queryKey: ["mt5/accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.mt5.remove(id),
    onSuccess: () => {
      toast.success("Account removed.");
      qc.invalidateQueries({ queryKey: ["mt5/accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refreshMutation = useMutation({
    mutationFn: (id: string) => api.mt5.getStatus(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mt5/accounts"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">MT5 Account</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Connect your MetaTrader 5 account to start copy trading
        </p>
      </div>

      {/* Existing accounts */}
      {isLoading ? (
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading accounts…</span>
            </div>
          </CardContent>
        </Card>
      ) : accounts.length > 0 ? (
        <div className="space-y-3">
          {accounts.map((account) => (
            <Card key={account.id} className="bg-card border-border">
              <CardContent className="pt-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <MonitorCheck className="size-4 text-primary flex-shrink-0" />
                      <span className="font-semibold text-foreground">{account.login}</span>
                      {pollingId === account.id && (
                        <Loader2 className="size-3.5 animate-spin text-yellow-400" />
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span><Server className="size-3 inline mr-1" />{account.broker}</span>
                      <span>{account.server}</span>
                      {account.lastSyncedAt && (
                        <span className="col-span-2">Last sync {formatRelative(account.lastSyncedAt)}</span>
                      )}
                    </div>
                    <StatusBadge account={account} />
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => refreshMutation.mutate(account.id)}
                      disabled={refreshMutation.isPending}
                      title="Refresh status"
                    >
                      <RefreshCw className={`size-3.5 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
                    </Button>
                    {["pending", "undeployed", "failed"].includes(account.deploymentStatus) && (
                      <Button
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => deployMutation.mutate(account.id)}
                        disabled={deployMutation.isPending || !!pollingId}
                      >
                        <Play className="size-3 mr-1" />
                        Deploy
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => removeMutation.mutate(account.id)}
                      disabled={removeMutation.isPending}
                      title="Remove account"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Register form */}
      {accounts.length === 0 && (
        <Alert className="border-primary/30 bg-primary/5">
          <AlertCircle className="size-4 text-primary" />
          <AlertDescription className="text-sm">
            Connect your MT5 account below. Your trading password is encrypted and used only to sync with MetaApi.
          </AlertDescription>
        </Alert>
      )}

      {accounts.length < 1 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Connect MT5 Account</CardTitle>
            <CardDescription className="text-sm">
              Enter your MetaTrader 5 account credentials
            </CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="pt-5">
            <form onSubmit={handleSubmit((d) => registerMutation.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login">MT5 Login (Account Number)</Label>
                  <Input id="login" placeholder="e.g. 12345678" {...register("login")} />
                  {errors.login && <p className="text-xs text-destructive">{errors.login.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Trading Password</Label>
                  <Input id="password" type="password" placeholder="••••••••" {...register("password")} />
                  {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="broker">Broker Name</Label>
                  <Input id="broker" placeholder="e.g. ICMarkets" {...register("broker")} />
                  {errors.broker && <p className="text-xs text-destructive">{errors.broker.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="server">Trading Server</Label>
                  <Input id="server" placeholder="e.g. ICMarkets-Live01" {...register("server")} />
                  {errors.server && <p className="text-xs text-destructive">{errors.server.message}</p>}
                </div>
              </div>
              <Button
                type="submit"
                disabled={registerMutation.isPending}
                className="w-full sm:w-auto"
              >
                {registerMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="size-4 mr-2" />
                )}
                Connect Account
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* How it works */}
      <Card className="bg-card/50 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-muted-foreground">How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { step: "1", text: "Connect your MT5 account with your trading credentials" },
            { step: "2", text: "Deploy to MetaApi cloud — this provisions your account for copy trading" },
            { step: "3", text: "Subscribe to automatically receive trades from the master account" },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <div className="size-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {item.step}
              </div>
              <p className="text-sm text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
