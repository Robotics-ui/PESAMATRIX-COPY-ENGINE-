import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  useListMt5Accounts,
  useRegisterMt5Account,
  useDeployMt5Account,
  useDeleteMt5Account,
  getListMt5AccountsQueryKey,
} from "@workspace/api-client-react";
import type { RegisterMt5RequestRegion } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Rocket, Trash2, Server, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Mt5Account } from "@workspace/api-client-react";

const REGIONS: RegisterMt5RequestRegion[] = ["london", "new-york", "singapore", "sydney", "tokyo"];

const deployBadge: Record<string, string> = {
  not_deployed: "text-muted-foreground border-muted-foreground/30",
  deploying: "text-yellow-400 border-yellow-500/40 bg-yellow-500/10",
  deployed: "text-primary border-primary/40 bg-primary/10",
  failed: "text-destructive border-destructive/40 bg-destructive/10",
  removed: "text-muted-foreground border-muted-foreground/30",
};

const syncBadge: Record<string, string> = {
  not_synced: "text-muted-foreground border-muted-foreground/30",
  synchronizing: "text-yellow-400 border-yellow-500/40 bg-yellow-500/10",
  synchronized: "text-primary border-primary/40 bg-primary/10",
  out_of_sync: "text-destructive border-destructive/40 bg-destructive/10",
  error: "text-destructive border-destructive/40 bg-destructive/10",
};

export default function Mt5Page() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);
  const [targetAccount, setTargetAccount] = useState<Mt5Account | null>(null);

  const [form, setForm] = useState({ login: "", server: "", broker: "", region: "london" as RegisterMt5RequestRegion });
  const [deployForm, setDeployForm] = useState({ password: "", multiplier: "1" });

  const { data, isLoading } = useListMt5Accounts({
    query: { queryKey: getListMt5AccountsQueryKey() },
  });
  const registerMutation = useRegisterMt5Account();
  const deployMutation = useDeployMt5Account();
  const deleteMutation = useDeleteMt5Account();

  const accounts = (data?.accounts ?? []) as unknown as Mt5Account[];

  const handleRegister = () => {
    registerMutation.mutate(
      { data: { login: form.login, server: form.server, broker: form.broker, region: form.region } },
      {
        onSuccess: () => {
          toast({ title: "MT5 Account Registered", description: "Your account has been added." });
          queryClient.invalidateQueries({ queryKey: getListMt5AccountsQueryKey() });
          setAddOpen(false);
          setForm({ login: "", server: "", broker: "", region: "london" });
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : "Registration failed";
          toast({ variant: "destructive", title: "Failed", description: msg });
        },
      },
    );
  };

  const handleDeploy = () => {
    if (!targetAccount) return;
    deployMutation.mutate(
      {
        id: targetAccount.id,
        data: { password: deployForm.password, multiplier: parseFloat(deployForm.multiplier) },
      },
      {
        onSuccess: () => {
          toast({ title: "Deployment Started", description: "Your MT5 account is being deployed to MetaApi." });
          queryClient.invalidateQueries({ queryKey: getListMt5AccountsQueryKey() });
          setDeployOpen(false);
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : "Deployment failed";
          toast({ variant: "destructive", title: "Deployment Failed", description: msg });
        },
      },
    );
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Account Removed" });
          queryClient.invalidateQueries({ queryKey: getListMt5AccountsQueryKey() });
        },
        onError: () => toast({ variant: "destructive", title: "Delete Failed" }),
      },
    );
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">MT5 Accounts</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Connect your MetaTrader 5 accounts for copy trading</p>
          </div>
          <Button
            onClick={() => setAddOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Account
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
          </div>
        ) : accounts.length === 0 ? (
          <Card className="bg-card border-border/50">
            <CardContent className="py-12 text-center">
              <Server className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-semibold">No MT5 Accounts</p>
              <p className="text-sm text-muted-foreground mt-1">Add your MT5 account to start copy trading</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {accounts.map((acct) => (
              <Card key={acct.id} className="bg-card border-border/50">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-semibold">{acct.login}</span>
                        <Badge variant="outline" className="text-xs">{acct.broker}</Badge>
                        {acct.isMaster && <Badge variant="outline" className="text-xs border-primary/40 text-primary bg-primary/10">Master</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{acct.server}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-2">
                        <Badge variant="outline" className={`text-xs capitalize ${deployBadge[acct.deploymentStatus] ?? ""}`}>
                          {acct.deploymentStatus.replace("_", " ")}
                        </Badge>
                        <Badge variant="outline" className={`text-xs capitalize ${syncBadge[acct.synchronizationStatus] ?? ""}`}>
                          {acct.synchronizationStatus.replace("_", " ")}
                        </Badge>
                      </div>
                      {acct.lastSyncedAt && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <RefreshCw className="h-3 w-3" />
                          Last sync: {new Date(acct.lastSyncedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {acct.deploymentStatus === "not_deployed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-primary/40 text-primary hover:bg-primary/10"
                          onClick={() => {
                            setTargetAccount(acct);
                            setDeployOpen(true);
                          }}
                        >
                          <Rocket className="h-3.5 w-3.5 mr-1.5" />
                          Deploy
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(acct.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Account Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add MT5 Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Login</Label>
                <Input placeholder="12345678" value={form.login} onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Broker</Label>
                <Input placeholder="ICMarkets" value={form.broker} onChange={(e) => setForm((f) => ({ ...f, broker: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Server</Label>
              <Input placeholder="ICMarkets-Live01" value={form.server} onChange={(e) => setForm((f) => ({ ...f, server: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Region</Label>
              <Select value={form.region} onValueChange={(v) => setForm((f) => ({ ...f, region: v as RegisterMt5RequestRegion }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REGIONS.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full bg-primary text-primary-foreground"
              onClick={handleRegister}
              disabled={registerMutation.isPending || !form.login || !form.server || !form.broker}
            >
              {registerMutation.isPending ? "Registering..." : "Register Account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deploy Dialog */}
      <Dialog open={deployOpen} onOpenChange={setDeployOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deploy Account — {targetAccount?.login}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>MT5 Password</Label>
              <Input
                type="password"
                placeholder="Your MT5 investor or master password"
                value={deployForm.password}
                onChange={(e) => setDeployForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Lot Multiplier</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="1.0"
                value={deployForm.multiplier}
                onChange={(e) => setDeployForm((f) => ({ ...f, multiplier: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">1.0 = same lot size as master. 0.5 = half. Max 2.0.</p>
            </div>
            <Button
              className="w-full bg-primary text-primary-foreground"
              onClick={handleDeploy}
              disabled={deployMutation.isPending || !deployForm.password}
            >
              {deployMutation.isPending ? "Deploying..." : "Deploy to MetaApi"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
