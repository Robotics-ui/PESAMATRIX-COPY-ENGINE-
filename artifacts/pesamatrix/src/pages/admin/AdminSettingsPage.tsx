import { useState, useEffect } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import {
  useAdminGetSettings,
  useAdminUpdateSettings,
  getAdminGetSettingsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Settings, Save } from "lucide-react";

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useAdminGetSettings({
    query: { queryKey: getAdminGetSettingsQueryKey() },
  });
  const updateMutation = useAdminUpdateSettings();

  const [form, setForm] = useState({
    subscriptionFeePerDay: "",
    minimumSubscriptionDays: "",
    maximumSubscriptionDays: "",
  });

  useEffect(() => {
    if (data) {
      setForm({
        subscriptionFeePerDay: data.subscriptionFeePerDay ?? "100",
        minimumSubscriptionDays: String(data.minimumSubscriptionDays ?? 7),
        maximumSubscriptionDays: String(data.maximumSubscriptionDays ?? 365),
      });
    }
  }, [data]);

  const handleSave = () => {
    updateMutation.mutate(
      {
        data: {
          subscriptionFeePerDay: form.subscriptionFeePerDay,
          minimumSubscriptionDays: parseInt(form.minimumSubscriptionDays),
          maximumSubscriptionDays: parseInt(form.maximumSubscriptionDays),
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Settings Saved" });
          queryClient.invalidateQueries({ queryKey: getAdminGetSettingsQueryKey() });
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : "Update failed";
          toast({ variant: "destructive", title: "Save Failed", description: msg });
        },
      },
    );
  };

  return (
    <AdminShell>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Settings</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Configure platform-wide defaults</p>
        </div>

        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              Subscription Pricing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="feePerDay">Fee Per Day (KES)</Label>
                  <Input
                    id="feePerDay"
                    type="number"
                    value={form.subscriptionFeePerDay}
                    onChange={(e) => setForm((f) => ({ ...f, subscriptionFeePerDay: e.target.value }))}
                    placeholder="100"
                  />
                  <p className="text-xs text-muted-foreground">Default price per trading day (used when no plan is specified).</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="minDays">Minimum Days</Label>
                    <Input
                      id="minDays"
                      type="number"
                      value={form.minimumSubscriptionDays}
                      onChange={(e) => setForm((f) => ({ ...f, minimumSubscriptionDays: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="maxDays">Maximum Days</Label>
                    <Input
                      id="maxDays"
                      type="number"
                      value={form.maximumSubscriptionDays}
                      onChange={(e) => setForm((f) => ({ ...f, maximumSubscriptionDays: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-border/40">
                  <Button
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {updateMutation.isPending ? "Saving..." : "Save Settings"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Read-only system info */}
        {data && (
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">MetaApi / CopyFactory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Master MT5 Login</span>
                <span className="font-mono">{data.masterMt5Login ?? "Not configured"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CopyFactory Strategy ID</span>
                <span className="font-mono text-xs">{data.copyFactoryStrategyId ?? "Not configured"}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Configure the master account via the Master Account page.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminShell>
  );
}
