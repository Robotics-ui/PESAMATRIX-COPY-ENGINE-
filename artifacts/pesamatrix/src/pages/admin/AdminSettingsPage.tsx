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
import { Settings, Save, AlertCircle } from "lucide-react";

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useAdminGetSettings({
    query: { queryKey: getAdminGetSettingsQueryKey() },
  });
  const updateMutation = useAdminUpdateSettings();

  const [form, setForm] = useState({
    subscriptionFeePerDay: "100",
    minimumSubscriptionDays: "7",
    maximumSubscriptionDays: "365",
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setForm({
        subscriptionFeePerDay: String(data.subscriptionFeePerDay ?? "100"),
        minimumSubscriptionDays: String(data.minimumSubscriptionDays ?? 7),
        maximumSubscriptionDays: String(data.maximumSubscriptionDays ?? 365),
      });
    }
  }, [data]);

  const handleSave = () => {
    setValidationError(null);

    const fee = parseFloat(form.subscriptionFeePerDay);
    const minDays = parseInt(form.minimumSubscriptionDays, 10);
    const maxDays = parseInt(form.maximumSubscriptionDays, 10);

    if (isNaN(fee) || fee <= 0) {
      setValidationError("Fee per day must be a positive number.");
      return;
    }
    if (isNaN(minDays) || minDays < 1) {
      setValidationError("Minimum days must be at least 1.");
      return;
    }
    if (isNaN(maxDays) || maxDays < 1) {
      setValidationError("Maximum days must be at least 1.");
      return;
    }
    if (minDays > maxDays) {
      setValidationError("Minimum days cannot exceed maximum days.");
      return;
    }

    updateMutation.mutate(
      {
        data: {
          subscriptionFeePerDay: fee,
          minimumSubscriptionDays: minDays,
          maximumSubscriptionDays: maxDays,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Settings Saved", description: "Subscription settings updated successfully." });
          queryClient.invalidateQueries({ queryKey: getAdminGetSettingsQueryKey() });
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : "Update failed";
          toast({ variant: "destructive", title: "Save Failed", description: msg });
        },
      },
    );
  };

  const feePreview = parseFloat(form.subscriptionFeePerDay) || 0;
  const minDays = parseInt(form.minimumSubscriptionDays, 10) || 0;
  const maxDays = parseInt(form.maximumSubscriptionDays, 10) || 0;

  return (
    <AdminShell>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Settings</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Configure platform-wide subscription defaults</p>
        </div>

        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              Subscription Pricing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <>
                {validationError && (
                  <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {validationError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="feePerDay">Subscription Fee Per Trading Day (KES)</Label>
                  <Input
                    id="feePerDay"
                    type="number"
                    min="1"
                    step="any"
                    value={form.subscriptionFeePerDay}
                    onChange={(e) => {
                      setValidationError(null);
                      setForm((f) => ({ ...f, subscriptionFeePerDay: e.target.value }));
                    }}
                    placeholder="100"
                  />
                  <p className="text-xs text-muted-foreground">
                    Amount charged per trading day (Mon–Fri). This is the only pricing dimension — no fixed plans.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="minDays">Minimum Trading Days</Label>
                    <Input
                      id="minDays"
                      type="number"
                      min="1"
                      value={form.minimumSubscriptionDays}
                      onChange={(e) => {
                        setValidationError(null);
                        setForm((f) => ({ ...f, minimumSubscriptionDays: e.target.value }));
                      }}
                    />
                    <p className="text-xs text-muted-foreground">Minimum days users can subscribe for.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="maxDays">Maximum Trading Days</Label>
                    <Input
                      id="maxDays"
                      type="number"
                      min="1"
                      value={form.maximumSubscriptionDays}
                      onChange={(e) => {
                        setValidationError(null);
                        setForm((f) => ({ ...f, maximumSubscriptionDays: e.target.value }));
                      }}
                    />
                    <p className="text-xs text-muted-foreground">Maximum days users can subscribe for.</p>
                  </div>
                </div>

                {/* Pricing preview */}
                {feePreview > 0 && minDays > 0 && maxDays >= minDays && (
                  <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pricing Preview</p>
                    <div className="grid grid-cols-3 gap-3">
                      {[minDays, Math.round((minDays + maxDays) / 2), maxDays].map((d) => (
                        <div key={d} className="text-center p-3 rounded-lg bg-card border border-border/30">
                          <p className="text-lg font-bold text-primary">KES {(feePreview * d).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{d} days</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
