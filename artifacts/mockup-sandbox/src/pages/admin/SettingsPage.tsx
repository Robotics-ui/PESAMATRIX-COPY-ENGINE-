import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Settings, Loader2, Save, DollarSign, Calendar } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

const schema = z.object({
  subscriptionFeePerDay: z.coerce
    .number()
    .min(1, "Must be at least 1")
    .max(100000, "Too high"),
  minimumSubscriptionDays: z.coerce
    .number()
    .int()
    .min(1, "Must be at least 1 day")
    .max(365, "Max 365 days"),
  maximumSubscriptionDays: z.coerce
    .number()
    .int()
    .min(1, "Must be at least 1 day")
    .max(3650, "Max 3650 days"),
}).refine((d) => d.maximumSubscriptionDays >= d.minimumSubscriptionDays, {
  message: "Max days must be ≥ min days",
  path: ["maximumSubscriptionDays"],
});

type FormData = z.infer<typeof schema>;

export default function AdminSettingsPage() {
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin/subscription-settings"],
    queryFn: () => api.admin.getSubscriptionSettings(),
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (settings) {
      reset({
        subscriptionFeePerDay: parseFloat(settings.subscriptionFeePerDay),
        minimumSubscriptionDays: settings.minimumSubscriptionDays,
        maximumSubscriptionDays: settings.maximumSubscriptionDays,
      });
    }
  }, [settings, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      api.admin.updateSubscriptionSettings({
        subscriptionFeePerDay: String(data.subscriptionFeePerDay),
        minimumSubscriptionDays: data.minimumSubscriptionDays,
        maximumSubscriptionDays: data.maximumSubscriptionDays,
      }),
    onSuccess: () => {
      toast.success("Settings saved successfully.");
      qc.invalidateQueries({ queryKey: ["admin/subscription-settings"] });
      qc.invalidateQueries({ queryKey: ["subscriptions/settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fee = watch("subscriptionFeePerDay") || 0;
  const minDays = watch("minimumSubscriptionDays") || 0;
  const maxDays = watch("maximumSubscriptionDays") || 0;

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure subscription pricing and limits
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-4 flex-row items-center gap-3">
          <Settings className="size-4 text-muted-foreground" />
          <div>
            <CardTitle className="text-base">Subscription Settings</CardTitle>
            <CardDescription className="text-sm mt-0.5">
              These settings apply to all new subscriptions
            </CardDescription>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-5">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit((d) => updateMutation.mutate(d))} className="space-y-6">
              {/* Fee */}
              <div className="space-y-1.5">
                <Label htmlFor="fee" className="flex items-center gap-1.5">
                  <DollarSign className="size-3.5 text-muted-foreground" />
                  Subscription Fee Per Day (KES)
                </Label>
                <Input
                  id="fee"
                  type="number"
                  min={1}
                  step={1}
                  className="max-w-xs"
                  {...register("subscriptionFeePerDay")}
                />
                {errors.subscriptionFeePerDay && (
                  <p className="text-xs text-destructive">{errors.subscriptionFeePerDay.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Current: KES {Number(fee).toLocaleString()} / day
                </p>
              </div>

              {/* Min/Max days */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="minDays" className="flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-muted-foreground" />
                    Minimum Days
                  </Label>
                  <Input
                    id="minDays"
                    type="number"
                    min={1}
                    max={365}
                    {...register("minimumSubscriptionDays")}
                  />
                  {errors.minimumSubscriptionDays && (
                    <p className="text-xs text-destructive">{errors.minimumSubscriptionDays.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maxDays" className="flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-muted-foreground" />
                    Maximum Days
                  </Label>
                  <Input
                    id="maxDays"
                    type="number"
                    min={1}
                    max={3650}
                    {...register("maximumSubscriptionDays")}
                  />
                  {errors.maximumSubscriptionDays && (
                    <p className="text-xs text-destructive">{errors.maximumSubscriptionDays.message}</p>
                  )}
                </div>
              </div>

              {/* Preview */}
              {minDays > 0 && maxDays > 0 && fee > 0 && (
                <div className="rounded-lg bg-muted/30 border border-border p-4 space-y-2 text-sm">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Pricing Preview
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[minDays, Math.floor((minDays + maxDays) / 2), maxDays].map((d) => (
                      <div key={d} className="text-center">
                        <div className="text-xs text-muted-foreground">{d} days</div>
                        <div className="font-semibold text-primary">
                          KES {(d * fee).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={updateMutation.isPending || !isDirty}
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin mr-2" />
                  ) : (
                    <Save className="size-4 mr-2" />
                  )}
                  Save Settings
                </Button>
                {isDirty && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      reset({
                        subscriptionFeePerDay: parseFloat(settings!.subscriptionFeePerDay),
                        minimumSubscriptionDays: settings!.minimumSubscriptionDays,
                        maximumSubscriptionDays: settings!.maximumSubscriptionDays,
                      })
                    }
                  >
                    Discard
                  </Button>
                )}
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
