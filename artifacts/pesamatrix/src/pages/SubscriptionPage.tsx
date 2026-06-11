import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  useGetMySubscription,
  useGetSubscriptionHistory,
  useListPlans,
  useInitiatePayment,
  useGetPaymentHistory,
  useGetSubscriptionSettings,
  useGetSubscriptionPreview,
  useRenewSubscription,
  useCancelSubscription,
  getGetMySubscriptionQueryKey,
  getGetSubscriptionHistoryQueryKey,
  getListPlansQueryKey,
  getGetPaymentHistoryQueryKey,
  getGetSubscriptionSettingsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import {
  CheckCircle2,
  Clock,
  XCircle,
  CreditCard,
  Calendar,
  Zap,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const statusColors: Record<string, string> = {
  active: "border-primary/40 text-primary bg-primary/10",
  pending: "border-yellow-500/40 text-yellow-400 bg-yellow-500/10",
  expired: "border-muted-foreground/40 text-muted-foreground",
  cancelled: "border-destructive/40 text-destructive bg-destructive/10",
  completed: "border-primary/40 text-primary bg-primary/10",
  failed: "border-destructive/40 text-destructive bg-destructive/10",
};

function fmt(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

function tradingDaysLabel(days: number): string {
  if (days <= 0) return "—";
  const weeks = Math.floor(days / 5);
  const rem = days % 5;
  if (weeks === 0) return `${rem} trading day${rem !== 1 ? "s" : ""}`;
  if (rem === 0) return `${weeks} trading week${weeks !== 1 ? "s" : ""}`;
  return `${weeks}w ${rem}d`;
}

export default function SubscriptionPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [phone, setPhone] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [stkPending, setStkPending] = useState(false);
  const [debouncedDays, setDebouncedDays] = useState(30);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedDays(days), 350);
    return () => clearTimeout(t);
  }, [days]);

  const { data: mySub, isLoading: subLoading } = useGetMySubscription({
    query: { queryKey: getGetMySubscriptionQueryKey() },
  });
  const { data: historyData } = useGetSubscriptionHistory({
    query: { queryKey: getGetSubscriptionHistoryQueryKey() },
  });
  const { data: plansData, isLoading: plansLoading } = useListPlans({
    query: { queryKey: getListPlansQueryKey() },
  });
  const { data: paymentHistory } = useGetPaymentHistory({
    query: { queryKey: getGetPaymentHistoryQueryKey() },
  });
  const { data: settings } = useGetSubscriptionSettings({
    query: { queryKey: getGetSubscriptionSettingsQueryKey() },
  });

  const plans = plansData?.plans ?? [];
  const payments = paymentHistory?.payments ?? [];
  const subs = historyData?.subscriptions ?? [];
  const isActive = !!mySub?.isActive;

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null;

  const minDays = useMemo(() => {
    if (!selectedPlan || !settings) return settings?.minimumSubscriptionDays ?? 7;
    return Math.max(selectedPlan.minimumDays, settings.minimumSubscriptionDays ?? 7);
  }, [selectedPlan, settings]);

  const maxDays = useMemo(() => {
    if (!selectedPlan || !settings) return settings?.maximumSubscriptionDays ?? 365;
    return Math.min(selectedPlan.maximumDays, settings.maximumSubscriptionDays ?? 365);
  }, [selectedPlan, settings]);

  useEffect(() => {
    if (days < minDays) setDays(minDays);
    if (days > maxDays) setDays(maxDays);
  }, [minDays, maxDays]);

  const previewEnabled = !!(selectedPlanId && debouncedDays >= minDays && debouncedDays <= maxDays);
  const { data: preview, isLoading: previewLoading } = useGetSubscriptionPreview(
    { planId: selectedPlanId ?? "", days: debouncedDays },
    { query: { enabled: previewEnabled } },
  );

  const totalAmount = selectedPlan
    ? Math.round(parseFloat(selectedPlan.pricePerDay) * days)
    : 0;

  const initiateMutation = useInitiatePayment();
  const renewMutation = useRenewSubscription();
  const cancelMutation = useCancelSubscription();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getGetMySubscriptionQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetSubscriptionHistoryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetPaymentHistoryQueryKey() });
  };

  const handlePay = () => {
    if (!selectedPlan || !phone || days < minDays) return;
    setStkPending(true);

    if (isActive && preview?.isRenewal) {
      renewMutation.mutate(
        { data: { planId: selectedPlan.id, days, phone } },
        {
          onSuccess: (resp) => {
            setStkPending(false);
            setConfirmOpen(false);
            toast({ title: "STK Push Sent", description: resp.message ?? "Check your phone to complete payment." });
            invalidateAll();
          },
          onError: (err: unknown) => {
            setStkPending(false);
            toast({ variant: "destructive", title: "Renewal Failed", description: err instanceof Error ? err.message : "Payment failed" });
          },
        },
      );
    } else {
      initiateMutation.mutate(
        { data: { phone, amount: totalAmount, numberOfDays: days, planId: selectedPlan.id } },
        {
          onSuccess: (resp) => {
            setStkPending(false);
            setConfirmOpen(false);
            toast({ title: "STK Push Sent", description: resp.message ?? "Check your phone to complete payment." });
            invalidateAll();
          },
          onError: (err: unknown) => {
            setStkPending(false);
            toast({ variant: "destructive", title: "Payment Failed", description: err instanceof Error ? err.message : "Payment failed" });
          },
        },
      );
    }
  };

  const handleCancel = () => {
    if (!mySub?.subscription?.id) return;
    cancelMutation.mutate(
      { id: mySub.subscription.id },
      {
        onSuccess: () => {
          setCancelConfirmOpen(false);
          toast({ title: "Subscription Cancelled", description: "Copy trading has been disabled." });
          invalidateAll();
        },
        onError: (err: unknown) => {
          toast({ variant: "destructive", title: "Cancel Failed", description: err instanceof Error ? err.message : "Cancellation failed" });
        },
      },
    );
  };

  const canPay = !!phone && days >= minDays && days <= maxDays && !!selectedPlan;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscription</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage your copy-trading subscription</p>
        </div>

        {/* ── Active Subscription Card ─────────────────────────────────────── */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              Current Subscription
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : isActive ? (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-semibold">{mySub.plan?.name ?? "Active Plan"}</span>
                      <Badge variant="outline" className={statusColors["active"]}>Active</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      Expires {fmt(mySub.subscription?.endDate)}
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      {mySub.daysRemaining ?? 0} calendar days remaining
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-primary">{mySub.daysRemaining ?? 0}</p>
                    <p className="text-xs text-muted-foreground">days left</p>
                  </div>
                </div>

                {/* Days-remaining progress bar */}
                {mySub.subscription?.numberOfDays && (
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                      <span>Progress</span>
                      <span>{mySub.daysRemaining ?? 0} / {mySub.subscription.numberOfDays} days</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-primary/20">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.max(0, Math.min(100, ((mySub.daysRemaining ?? 0) / mySub.subscription.numberOfDays) * 100))}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-primary/40 text-primary hover:bg-primary/10"
                    onClick={() => {
                      if (!selectedPlanId && plans.length > 0) setSelectedPlanId(mySub.plan?.id ?? plans[0].id);
                      document.getElementById("subscribe-form")?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Renew
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setCancelConfirmOpen(true)}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1.5" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-muted-foreground">
                <XCircle className="h-5 w-5 text-destructive shrink-0" />
                <div>
                  <p className="font-medium text-foreground">No active subscription</p>
                  <p className="text-sm">Select a plan below to start copy trading</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Plan Selection ────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            {isActive ? "Renew or change plan" : "Choose a plan"}
          </h2>
          {plansLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
            </div>
          ) : plans.length === 0 ? (
            <p className="text-muted-foreground text-sm">No plans available yet. Contact support.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`rounded-xl border p-5 cursor-pointer transition-all ${
                    selectedPlanId === plan.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                      : "border-border/50 hover:border-primary/30 bg-card"
                  }`}
                  onClick={() => setSelectedPlanId(plan.id)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{plan.name}</h3>
                      <p className="text-2xl font-bold text-primary mt-1">
                        KES {parseFloat(plan.pricePerDay).toFixed(0)}
                        <span className="text-sm font-normal text-muted-foreground">/day</span>
                      </p>
                    </div>
                    {selectedPlanId === plan.id && (
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {plan.minimumDays}–{plan.maximumDays} trading days
                  </p>
                  {plan.features?.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {plan.features.slice(0, 4).map((f, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <div className="h-1 w-1 rounded-full bg-primary shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Subscribe / Renew Form ────────────────────────────────────────── */}
        {selectedPlan && (
          <Card id="subscribe-form" className="bg-card border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                {isActive ? `Renew — ${selectedPlan.name}` : `Subscribe — ${selectedPlan.name}`}
                {isActive && (
                  <Badge variant="outline" className="text-xs border-primary/40 text-primary bg-primary/10 ml-1">
                    Extends current subscription
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* Days Slider */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Trading Days</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-primary">{days}</span>
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                </div>
                <Slider
                  min={minDays}
                  max={maxDays}
                  step={1}
                  value={[days]}
                  onValueChange={([v]) => setDays(v)}
                  className="py-1"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Min: {minDays}d</span>
                  <span className="text-primary font-medium">{tradingDaysLabel(days)}</span>
                  <span>Max: {maxDays}d</span>
                </div>
              </div>

              {/* Pricing Preview Panel */}
              <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Subscription Preview
                </div>

                {previewLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total Cost</span>
                      <span className="text-xl font-bold text-primary">
                        KES {(preview?.totalAmount ?? totalAmount).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Duration</span>
                      <span className="font-medium">
                        {preview?.tradingDaysDescription ?? tradingDaysLabel(days)}
                      </span>
                    </div>
                    {preview ? (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {preview.isRenewal ? "Renewal starts" : "Starts"}
                          </span>
                          <span className="font-medium">{fmt(preview.startDate)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Expires</span>
                          <span className="font-medium">{fmt(preview.endDate)}</span>
                        </div>
                        {preview.isRenewal && (
                          <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 flex items-start gap-2 mt-1">
                            <RefreshCw className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                            <p className="text-xs text-primary">
                              This renewal stacks onto your current subscription and starts {fmt(preview.existingEndDate)}.
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Rate</span>
                        <span className="font-medium">KES {parseFloat(selectedPlan.pricePerDay).toFixed(0)} / day</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Phone Number */}
              <div className="space-y-1.5">
                <Label htmlFor="phone">M-Pesa Phone Number</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">+</span>
                  <Input
                    id="phone"
                    type="tel"
                    className="pl-6"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="254712345678"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Format: 254XXXXXXXXX (Safaricom number)</p>
              </div>

              {/* Pay Button */}
              <div className="flex items-center justify-between pt-1 border-t border-border/40">
                <div className="text-sm text-muted-foreground">
                  {days} trading days ·{" "}
                  <span className="font-semibold text-foreground">
                    KES {(preview?.totalAmount ?? totalAmount).toLocaleString()}
                  </span>
                </div>
                <Button
                  onClick={() => setConfirmOpen(true)}
                  disabled={!canPay}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isActive && preview?.isRenewal ? "Renew with M-Pesa" : "Pay with M-Pesa"}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Payment History ───────────────────────────────────────────────── */}
        {payments.length > 0 && (
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-2 pr-4 text-xs text-muted-foreground uppercase tracking-wider">Date</th>
                      <th className="text-left py-2 pr-4 text-xs text-muted-foreground uppercase tracking-wider">Amount</th>
                      <th className="text-left py-2 pr-4 text-xs text-muted-foreground uppercase tracking-wider">Phone</th>
                      <th className="text-left py-2 pr-4 text-xs text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-left py-2 text-xs text-muted-foreground uppercase tracking-wider">Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-accent/20">
                        <td className="py-2.5 pr-4 text-muted-foreground">{fmt(p.createdAt)}</td>
                        <td className="py-2.5 pr-4 font-medium">KES {parseFloat(p.amount).toLocaleString()}</td>
                        <td className="py-2.5 pr-4 font-mono text-sm">{p.phone}</td>
                        <td className="py-2.5 pr-4">
                          <Badge variant="outline" className={`text-xs capitalize ${statusColors[p.status] ?? ""}`}>{p.status}</Badge>
                        </td>
                        <td className="py-2.5 font-mono text-xs text-muted-foreground">{p.mpesaRef ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Subscription History ──────────────────────────────────────────── */}
        {subs.length > 0 && (
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Subscription History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-2 pr-4 text-xs text-muted-foreground uppercase tracking-wider">Started</th>
                      <th className="text-left py-2 pr-4 text-xs text-muted-foreground uppercase tracking-wider">Expires</th>
                      <th className="text-left py-2 pr-4 text-xs text-muted-foreground uppercase tracking-wider">Days</th>
                      <th className="text-left py-2 pr-4 text-xs text-muted-foreground uppercase tracking-wider">Paid</th>
                      <th className="text-left py-2 text-xs text-muted-foreground uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {subs.map((s) => (
                      <tr key={s.id} className="hover:bg-accent/20">
                        <td className="py-2.5 pr-4 text-muted-foreground">{fmt(s.startDate)}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground">{fmt(s.endDate)}</td>
                        <td className="py-2.5 pr-4">{s.numberOfDays}d</td>
                        <td className="py-2.5 pr-4">KES {parseFloat(s.amountPaid).toLocaleString()}</td>
                        <td className="py-2.5">
                          <Badge variant="outline" className={`text-xs capitalize ${statusColors[s.status] ?? ""}`}>{s.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── STK Confirm Dialog ────────────────────────────────────────────────── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Payment</DialogTitle>
            <DialogDescription>
              An STK push will be sent to <strong>{phone}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium">{selectedPlan?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">{tradingDaysLabel(days)}</span>
              </div>
              {preview && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{preview.isRenewal ? "Renewal starts" : "Starts"}</span>
                    <span className="font-medium">{fmt(preview.startDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expires</span>
                    <span className="font-medium">{fmt(preview.endDate)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between border-t border-border/40 pt-2 mt-1">
                <span className="text-muted-foreground font-medium">Total</span>
                <span className="font-bold text-primary text-lg">
                  KES {(preview?.totalAmount ?? totalAmount).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handlePay}
              disabled={stkPending || initiateMutation.isPending || renewMutation.isPending}
              className="flex-1 bg-primary text-primary-foreground"
            >
              {stkPending || initiateMutation.isPending || renewMutation.isPending
                ? "Sending..."
                : "Confirm & Pay"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Cancel Confirmation ───────────────────────────────────────────────── */}
      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Cancel Subscription?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately disable copy trading and remove your CopyFactory relationship. Any remaining days will be forfeited. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Cancelling..." : "Yes, Cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
