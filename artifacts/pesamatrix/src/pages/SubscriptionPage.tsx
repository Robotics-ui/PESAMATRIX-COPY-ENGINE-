import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  useGetMySubscription,
  useGetSubscriptionHistory,
  useListPlans,
  useInitiatePayment,
  useGetPaymentHistory,
  getGetMySubscriptionQueryKey,
  getGetSubscriptionHistoryQueryKey,
  getListPlansQueryKey,
  getGetPaymentHistoryQueryKey,
} from "@workspace/api-client-react";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { CheckCircle2, Clock, XCircle, CreditCard, Calendar, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const statusColors: Record<string, string> = {
  active: "border-primary/40 text-primary bg-primary/10",
  pending: "border-yellow-500/40 text-yellow-400 bg-yellow-500/10",
  expired: "border-muted-foreground/40 text-muted-foreground",
  cancelled: "border-destructive/40 text-destructive bg-destructive/10",
  completed: "border-primary/40 text-primary bg-primary/10",
  failed: "border-destructive/40 text-destructive bg-destructive/10",
};

export default function SubscriptionPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<{ id: string; name: string; pricePerDay: string; minDays: number } | null>(null);
  const [days, setDays] = useState("30");
  const [phone, setPhone] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stkPending, setStkPending] = useState(false);

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
  const initiateMutation = useInitiatePayment();

  const plans = plansData?.plans ?? [];
  const payments = paymentHistory?.payments ?? [];
  const subs = historyData?.subscriptions ?? [];

  const selectedPlanObj = selectedPlan ? plans.find((p) => p.id === selectedPlan.id) : null;
  const totalAmount = selectedPlanObj
    ? (parseFloat(selectedPlanObj.pricePerDay) * parseInt(days || "0")).toFixed(0)
    : "0";

  const handleSubscribe = () => {
    if (!selectedPlan || !phone || !days) {
      toast({ variant: "destructive", title: "Please fill all fields" });
      return;
    }
    setStkPending(true);
    initiateMutation.mutate(
      {
        data: {
          phone,
          amount: parseFloat(totalAmount),
          numberOfDays: parseInt(days),
          planId: selectedPlan.id,
        },
      },
      {
        onSuccess: (resp) => {
          setStkPending(false);
          setDialogOpen(false);
          toast({
            title: "STK Push Sent",
            description: resp.message ?? "Check your phone to complete the M-Pesa payment.",
          });
          queryClient.invalidateQueries({ queryKey: getGetMySubscriptionQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPaymentHistoryQueryKey() });
        },
        onError: (err: unknown) => {
          setStkPending(false);
          const msg = err instanceof Error ? err.message : "Payment initiation failed";
          toast({ variant: "destructive", title: "Payment Failed", description: msg });
        },
      },
    );
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscription</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage your copy-trading subscription and payments</p>
        </div>

        {/* Active subscription card */}
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
            ) : mySub?.isActive ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{mySub.plan?.name ?? "Active Plan"}</span>
                    <Badge variant="outline" className={statusColors["active"]}>Active</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Expires {mySub.subscription?.endDate ? new Date(mySub.subscription.endDate).toLocaleDateString() : "—"}
                  </p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {mySub.daysRemaining ?? 0} trading days remaining
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-primary">{mySub.daysRemaining ?? 0}</p>
                  <p className="text-xs text-muted-foreground">days left</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-muted-foreground">
                <XCircle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium text-foreground">No active subscription</p>
                  <p className="text-sm">Select a plan below to start copy trading</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plan selection */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Available Plans</h2>
          {plansLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
            </div>
          ) : plans.length === 0 ? (
            <p className="text-muted-foreground text-sm">No plans available yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`rounded-xl border p-5 cursor-pointer transition-all ${
                    selectedPlan?.id === plan.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                      : "border-border/50 hover:border-primary/30 bg-card"
                  }`}
                  onClick={() => setSelectedPlan({ id: plan.id, name: plan.name, pricePerDay: plan.pricePerDay, minDays: plan.minimumDays })}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{plan.name}</h3>
                      <p className="text-2xl font-bold text-primary mt-1">
                        KES {parseFloat(plan.pricePerDay).toFixed(0)}
                        <span className="text-sm font-normal text-muted-foreground">/day</span>
                      </p>
                    </div>
                    {selectedPlan?.id === plan.id && (
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Min {plan.minimumDays}d — Max {plan.maximumDays}d
                  </p>
                  {plan.features?.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {plan.features.map((f, i) => (
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

        {/* Subscribe form */}
        {selectedPlan && (
          <Card className="bg-card border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Subscribe via M-Pesa — {selectedPlan.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="days">Number of Days</Label>
                  <Input
                    id="days"
                    type="number"
                    min={selectedPlan.minDays}
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    placeholder={`Min ${selectedPlan.minDays} days`}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">M-Pesa Phone (254XXXXXXXXX)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="254712345678"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                <div>
                  <p className="text-sm text-muted-foreground">Total amount</p>
                  <p className="text-xl font-bold">KES {parseInt(totalAmount).toLocaleString()}</p>
                </div>
                <Button
                  onClick={() => setDialogOpen(true)}
                  disabled={!phone || !days || parseInt(days) < selectedPlan.minDays}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Pay with M-Pesa
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Confirm dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Payment</DialogTitle>
              <DialogDescription>
                An STK push will be sent to <strong>{phone}</strong> for KES {parseInt(totalAmount).toLocaleString()} ({days} days on {selectedPlan?.name}).
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 mt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">Cancel</Button>
              <Button
                onClick={handleSubscribe}
                disabled={stkPending || initiateMutation.isPending}
                className="flex-1 bg-primary text-primary-foreground"
              >
                {stkPending || initiateMutation.isPending ? "Sending..." : "Confirm & Send STK Push"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Payment history */}
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
                      <th className="text-left py-2 text-xs text-muted-foreground uppercase tracking-wider">M-Pesa Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-accent/20">
                        <td className="py-2.5 pr-4 text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</td>
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

        {/* Subscription history */}
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
                      <th className="text-left py-2 pr-4 text-xs text-muted-foreground uppercase tracking-wider">Ends</th>
                      <th className="text-left py-2 pr-4 text-xs text-muted-foreground uppercase tracking-wider">Days</th>
                      <th className="text-left py-2 pr-4 text-xs text-muted-foreground uppercase tracking-wider">Paid</th>
                      <th className="text-left py-2 text-xs text-muted-foreground uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {subs.map((s) => (
                      <tr key={s.id} className="hover:bg-accent/20">
                        <td className="py-2.5 pr-4 text-muted-foreground">{s.startDate ? new Date(s.startDate).toLocaleDateString() : "—"}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground">{s.endDate ? new Date(s.endDate).toLocaleDateString() : "—"}</td>
                        <td className="py-2.5 pr-4">{s.numberOfDays}</td>
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
    </AppShell>
  );
}
