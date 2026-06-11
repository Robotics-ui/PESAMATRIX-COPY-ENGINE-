import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  CreditCard,
  Loader2,
  CheckCircle2,
  Clock,
  Smartphone,
  RefreshCw,
  TrendingUp,
  Shield,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

const paySchema = z.object({
  phone: z.string().regex(/^(\+?254|0)[17]\d{8}$/, "Enter a valid Kenyan phone number"),
});
type PayFormData = z.infer<typeof paySchema>;

type PaymentState =
  | { stage: "idle" }
  | { stage: "initiating" }
  | { stage: "waiting"; paymentId: string; checkoutRequestId: string }
  | { stage: "polling" }
  | { stage: "success" }
  | { stage: "failed"; reason: string };

export default function SubscribePage() {
  const { user } = useAuth();

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["subscriptions/settings"],
    queryFn: () => api.subscriptions.settings(),
  });

  const { data: activeSub } = useQuery({
    queryKey: ["subscriptions/active"],
    queryFn: () => api.subscriptions.active(),
    retry: false,
  });

  const minDays = settings?.minimumSubscriptionDays ?? 7;
  const maxDays = settings?.maximumSubscriptionDays ?? 365;
  const feePerDay = parseFloat(settings?.subscriptionFeePerDay ?? "100");

  const [days, setDays] = useState(minDays);
  const [payState, setPayState] = useState<PaymentState>({ stage: "idle" });

  useEffect(() => {
    if (settings) setDays(settings.minimumSubscriptionDays);
  }, [settings]);

  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ["subscriptions/preview", days],
    queryFn: () => api.subscriptions.preview(days),
    enabled: !!settings,
  });

  const { register, handleSubmit, formState: { errors }, watch } = useForm<PayFormData>({
    resolver: zodResolver(paySchema),
    defaultValues: { phone: user?.phone ?? "" },
  });

  const phone = watch("phone");
  const totalAmount = preview?.totalAmount
    ? parseFloat(preview.totalAmount)
    : days * feePerDay;

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  const pollStatus = useCallback(
    async (paymentId: string, checkoutRequestId: string, attempt = 0) => {
      if (attempt > 30) {
        setPayState({ stage: "failed", reason: "Payment timed out. Please try again." });
        return;
      }
      try {
        const result = await api.payments.checkStatus({ paymentId, checkoutRequestId });
        if (result.status === "completed") {
          setPayState({ stage: "success" });
          toast.success("Payment confirmed! Your subscription is now active.");
        } else if (result.status === "failed") {
          setPayState({ stage: "failed", reason: result.message ?? "Payment failed." });
        } else {
          setTimeout(() => pollStatus(paymentId, checkoutRequestId, attempt + 1), 3000);
        }
      } catch {
        setTimeout(() => pollStatus(paymentId, checkoutRequestId, attempt + 1), 5000);
      }
    },
    [],
  );

  const initiateMutation = useMutation({
    mutationFn: (data: PayFormData) =>
      api.payments.initiate({ days, phone: data.phone }),
    onMutate: () => setPayState({ stage: "initiating" }),
    onSuccess: (data) => {
      setPayState({ stage: "waiting", paymentId: data.paymentId, checkoutRequestId: data.checkoutRequestId });
      toast.info("Check your phone for the M-Pesa STK push prompt.");
      setTimeout(() => {
        setPayState((prev) => {
          if (prev.stage === "waiting") {
            pollStatus(prev.paymentId, prev.checkoutRequestId);
            return { stage: "polling" };
          }
          return prev;
        });
      }, 8000);
    },
    onError: (e: Error) => {
      setPayState({ stage: "idle" });
      toast.error(e.message);
    },
  });

  if (payState.stage === "success") {
    return (
      <div className="p-6 max-w-md mx-auto flex flex-col items-center justify-center min-h-[50vh] space-y-4 text-center">
        <div className="size-16 rounded-full bg-primary/20 flex items-center justify-center">
          <CheckCircle2 className="size-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Subscription Active!</h2>
        <p className="text-sm text-muted-foreground">
          Your copy trading subscription is now active. Trades will be copied automatically.
        </p>
        <Button onClick={() => setPayState({ stage: "idle" })}>View Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Subscribe</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Choose your subscription duration and pay via M-Pesa
        </p>
      </div>

      {activeSub?.isActive && (
        <Alert className="border-primary/30 bg-primary/5">
          <CheckCircle2 className="size-4 text-primary" />
          <AlertDescription className="text-sm">
            You have an active subscription expiring{" "}
            {activeSub.endDate ? formatDate(activeSub.endDate) : "soon"}.
            Subscribing again will extend your access.
          </AlertDescription>
        </Alert>
      )}

      {settingsLoading ? (
        <Card className="bg-card">
          <CardContent className="pt-6 flex items-center gap-3">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading pricing…</span>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Duration slider */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Subscription Duration</CardTitle>
              <CardDescription>
                KES {feePerDay.toLocaleString()} per day · {minDays}–{maxDays} days
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Duration</span>
                  <span className="text-lg font-bold text-foreground">
                    {days} {days === 1 ? "day" : "days"}
                  </span>
                </div>
                <Slider
                  min={minDays}
                  max={maxDays}
                  step={1}
                  value={[days]}
                  onValueChange={([v]) => setDays(v)}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{minDays}d</span>
                  <span>{Math.floor((minDays + maxDays) / 2)}d</span>
                  <span>{maxDays}d</span>
                </div>
              </div>

              <Separator />

              {/* Price summary */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Rate</span>
                  <span className="text-foreground">KES {feePerDay.toLocaleString()} × {days}d</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Expires</span>
                  <span className="text-foreground">{formatDate(endDate)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="font-semibold text-foreground">Total</span>
                  {previewLoading ? (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  ) : (
                    <span className="text-xl font-bold text-primary">
                      {formatCurrency(totalAmount)}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment form */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Smartphone className="size-4 text-primary" />
                M-Pesa Payment
              </CardTitle>
              <CardDescription>
                You'll receive an STK push on your Safaricom line
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit((d) => initiateMutation.mutate(d))} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="phone">M-Pesa Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="0712345678"
                    {...register("phone")}
                  />
                  {errors.phone && (
                    <p className="text-xs text-destructive">{errors.phone.message}</p>
                  )}
                </div>

                {(payState.stage === "waiting" || payState.stage === "polling") && (
                  <Alert className="border-yellow-500/30 bg-yellow-500/10">
                    <RefreshCw className="size-4 text-yellow-400 animate-spin" />
                    <AlertDescription className="text-sm text-yellow-300">
                      {payState.stage === "waiting"
                        ? "STK push sent! Enter your M-Pesa PIN on your phone…"
                        : "Confirming payment…"}
                    </AlertDescription>
                  </Alert>
                )}

                {payState.stage === "failed" && (
                  <Alert className="border-destructive/30 bg-destructive/10">
                    <AlertDescription className="text-sm text-destructive">
                      {payState.reason}
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={
                    initiateMutation.isPending ||
                    payState.stage === "waiting" ||
                    payState.stage === "polling"
                  }
                >
                  {initiateMutation.isPending || payState.stage === "waiting" || payState.stage === "polling" ? (
                    <Loader2 className="size-4 animate-spin mr-2" />
                  ) : (
                    <CreditCard className="size-4 mr-2" />
                  )}
                  Pay {formatCurrency(totalAmount)} via M-Pesa
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Benefits */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: TrendingUp, title: "Auto Copy", desc: "Trades mirrored in real-time" },
              { icon: Shield, title: "Secure", desc: "MetaApi encrypted connection" },
              { icon: Clock, title: "Instant Activation", desc: "Active within minutes" },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border">
                <item.icon className="size-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-foreground">{item.title}</div>
                  <div className="text-xs text-muted-foreground">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
