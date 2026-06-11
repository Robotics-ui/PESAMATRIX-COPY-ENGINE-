import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Settings, Loader2, Save, DollarSign, Calendar, BarChart2, Activity, Shield } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

const subscriptionSchema = z.object({
  subscriptionFeePerDay: z.coerce.number().min(1, "Must be at least 1").max(100000, "Too high"),
  minimumSubscriptionDays: z.coerce.number().int().min(1, "Must be at least 1 day").max(365, "Max 365 days"),
  maximumSubscriptionDays: z.coerce.number().int().min(1, "Must be at least 1 day").max(3650, "Max 3650 days"),
}).refine((d) => d.maximumSubscriptionDays >= d.minimumSubscriptionDays, {
  message: "Max days must be ≥ min days",
  path: ["maximumSubscriptionDays"],
});

const statsSchema = z.object({
  winRate: z.coerce.number().min(0, "0–100").max(100, "0–100"),
  totalTradesCount: z.coerce.number().int().min(0, "Must be ≥ 0"),
  uptimePercent: z.coerce.number().min(0, "0–100").max(100, "0–100"),
});

type SubscriptionFormData = z.infer<typeof subscriptionSchema>;
type StatsFormData = z.infer<typeof statsSchema>;

export default function AdminSettingsPage() {
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin/subscription-settings"],
    queryFn: () => api.admin.getSubscriptionSettings(),
  });

  const {
    register: regSub,
    handleSubmit: handleSub,
    reset: resetSub,
    watch: watchSub,
    formState: { errors: subErrors, isDirty: subDirty },
  } = useForm<SubscriptionFormData>({ resolver: zodResolver(subscriptionSchema) });

  const {
    register: regStats,
    handleSubmit: handleStats,
    reset: resetStats,
    formState: { errors: statsErrors, isDirty: statsDirty },
  } = useForm<StatsFormData>({ resolver: zodResolver(statsSchema) });

  useEffect(() => {
    if (settings) {
      resetSub({
        subscriptionFeePerDay: parseFloat(settings.subscriptionFeePerDay),
        minimumSubscriptionDays: settings.minimumSubscriptionDays,
        maximumSubscriptionDays: settings.maximumSubscriptionDays,
      });
      resetStats({
        winRate: settings.winRate ?? 74.0,
        totalTradesCount: settings.totalTradesCount ?? 50000,
        uptimePercent: settings.uptimePercent ?? 99.9,
      });
    }
  }, [settings, resetSub, resetStats]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin/subscription-settings"] });
    void qc.invalidateQueries({ queryKey: ["subscriptions/settings"] });
    void qc.invalidateQueries({ queryKey: ["public/stats"] });
  };

  const subMutation = useMutation({
    mutationFn: (data: SubscriptionFormData) =>
      api.admin.updateSubscriptionSettings({
        subscriptionFeePerDay: String(data.subscriptionFeePerDay),
        minimumSubscriptionDays: data.minimumSubscriptionDays,
        maximumSubscriptionDays: data.maximumSubscriptionDays,
      }),
    onSuccess: () => { toast.success("Subscription settings saved."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const statsMutation = useMutation({
    mutationFn: (data: StatsFormData) =>
      api.admin.updateSubscriptionSettings({
        winRate: data.winRate,
        totalTradesCount: data.totalTradesCount,
        uptimePercent: data.uptimePercent,
      }),
    onSuccess: () => { toast.success("Performance stats saved — landing page will reflect these values."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const fee = watchSub("subscriptionFeePerDay") || 0;
  const minDays = watchSub("minimumSubscriptionDays") || 0;
  const maxDays = watchSub("maximumSubscriptionDays") || 0;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Configure subscription pricing and landing page stats</p>
      </div>

      {/* ── Subscription Settings ── */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-4 flex-row items-center gap-3">
          <Settings className="size-4 text-muted-foreground" />
          <div>
            <CardTitle className="text-base">Subscription Settings</CardTitle>
            <CardDescription className="text-sm mt-0.5">Pricing and duration limits for all new subscriptions</CardDescription>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-5">
          <form onSubmit={handleSub((d) => subMutation.mutate(d))} className="space-y-6">
            <div className="space-y-1.5">
              <Label htmlFor="fee" className="flex items-center gap-1.5">
                <DollarSign className="size-3.5 text-muted-foreground" />
                Subscription Fee Per Day (KES)
              </Label>
              <Input id="fee" type="number" min={1} step={1} className="max-w-xs" {...regSub("subscriptionFeePerDay")} />
              {subErrors.subscriptionFeePerDay && (
                <p className="text-xs text-destructive">{subErrors.subscriptionFeePerDay.message}</p>
              )}
              <p className="text-xs text-muted-foreground">Current: KES {Number(fee).toLocaleString()} / day</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="minDays" className="flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  Minimum Days
                </Label>
                <Input id="minDays" type="number" min={1} max={365} {...regSub("minimumSubscriptionDays")} />
                {subErrors.minimumSubscriptionDays && (
                  <p className="text-xs text-destructive">{subErrors.minimumSubscriptionDays.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maxDays" className="flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  Maximum Days
                </Label>
                <Input id="maxDays" type="number" min={1} max={3650} {...regSub("maximumSubscriptionDays")} />
                {subErrors.maximumSubscriptionDays && (
                  <p className="text-xs text-destructive">{subErrors.maximumSubscriptionDays.message}</p>
                )}
              </div>
            </div>

            {minDays > 0 && maxDays > 0 && fee > 0 && (
              <div className="rounded-lg bg-muted/30 border border-border p-4 space-y-2 text-sm">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pricing Preview</div>
                <div className="grid grid-cols-3 gap-3">
                  {[minDays, Math.floor((minDays + maxDays) / 2), maxDays].map((d) => (
                    <div key={d} className="text-center">
                      <div className="text-xs text-muted-foreground">{d} days</div>
                      <div className="font-semibold text-primary">KES {(d * fee).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={subMutation.isPending || !subDirty}>
                {subMutation.isPending ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
                Save Settings
              </Button>
              {subDirty && (
                <Button type="button" variant="ghost"
                  onClick={() => resetSub({
                    subscriptionFeePerDay: parseFloat(settings!.subscriptionFeePerDay),
                    minimumSubscriptionDays: settings!.minimumSubscriptionDays,
                    maximumSubscriptionDays: settings!.maximumSubscriptionDays,
                  })}>
                  Discard
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── Landing Page Stats ── */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-4 flex-row items-center gap-3">
          <BarChart2 className="size-4 text-muted-foreground" />
          <div>
            <CardTitle className="text-base">Landing Page Performance Stats</CardTitle>
            <CardDescription className="text-sm mt-0.5">
              These numbers are displayed on the public landing page. Active subscriber count is live from the DB — update the others to match your real trading performance.
            </CardDescription>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-5">
          <form onSubmit={handleStats((d) => statsMutation.mutate(d))} className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="winRate" className="flex items-center gap-1.5">
                  <Activity className="size-3.5 text-muted-foreground" />
                  Win Rate (%)
                </Label>
                <Input id="winRate" type="number" min={0} max={100} step={0.1} {...regStats("winRate")} />
                {statsErrors.winRate && (
                  <p className="text-xs text-destructive">{statsErrors.winRate.message}</p>
                )}
                <p className="text-xs text-muted-foreground">e.g. 74.2</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="trades" className="flex items-center gap-1.5">
                  <BarChart2 className="size-3.5 text-muted-foreground" />
                  Total Trades Copied
                </Label>
                <Input id="trades" type="number" min={0} step={1} {...regStats("totalTradesCount")} />
                {statsErrors.totalTradesCount && (
                  <p className="text-xs text-destructive">{statsErrors.totalTradesCount.message}</p>
                )}
                <p className="text-xs text-muted-foreground">e.g. 52000</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="uptime" className="flex items-center gap-1.5">
                  <Shield className="size-3.5 text-muted-foreground" />
                  Uptime (%)
                </Label>
                <Input id="uptime" type="number" min={0} max={100} step={0.1} {...regStats("uptimePercent")} />
                {statsErrors.uptimePercent && (
                  <p className="text-xs text-destructive">{statsErrors.uptimePercent.message}</p>
                )}
                <p className="text-xs text-muted-foreground">e.g. 99.9</p>
              </div>
            </div>

            <div className="rounded-lg bg-muted/20 border border-border px-4 py-3 text-xs text-muted-foreground">
              Active subscriber count is always live from the database — it updates automatically and cannot be overridden here.
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={statsMutation.isPending || !statsDirty}>
                {statsMutation.isPending ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
                Update Stats
              </Button>
              {statsDirty && (
                <Button type="button" variant="ghost"
                  onClick={() => resetStats({
                    winRate: settings?.winRate ?? 74.0,
                    totalTradesCount: settings?.totalTradesCount ?? 50000,
                    uptimePercent: settings?.uptimePercent ?? 99.9,
                  })}>
                  Discard
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
