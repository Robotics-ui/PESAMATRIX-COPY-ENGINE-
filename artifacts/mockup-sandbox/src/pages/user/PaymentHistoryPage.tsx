import { useState, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, Receipt, CheckCircle2, XCircle, Clock, RefreshCw, AlertCircle, Smartphone
} from "lucide-react";
import { api, type Payment } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

function PaymentBadge({ status }: { status: Payment["status"] }) {
  const map: Record<string, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
    completed:  { label: "Completed",  cls: "bg-primary/20 text-primary border-primary/30",            icon: CheckCircle2 },
    pending:    { label: "Pending",    cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",   icon: Clock        },
    failed:     { label: "Failed",     cls: "bg-destructive/20 text-destructive border-destructive/30", icon: XCircle     },
    refunded:   { label: "Refunded",   cls: "bg-blue-500/20 text-blue-400 border-blue-500/30",         icon: RefreshCw    },
    cancelled:  { label: "Cancelled",  cls: "bg-muted text-muted-foreground border-border",             icon: XCircle     },
    processing: { label: "Processing", cls: "bg-blue-500/20 text-blue-400 border-blue-500/30",         icon: RefreshCw    },
  };
  const v = map[status] ?? map["pending"]!;
  const Icon = v.icon;
  return (
    <Badge variant="outline" className={v.cls}>
      <Icon className="size-3 mr-1" />
      {v.label}
    </Badge>
  );
}

type CheckState =
  | { stage: "idle" }
  | { stage: "checking" }
  | { stage: "done-success"; mpesaRef: string | null }
  | { stage: "done-failed"; reason: string };

const MAX_POLLS = 20;
const POLL_INTERVAL_MS = 3000;

export default function PaymentHistoryPage() {
  const qc = useQueryClient();
  const { data: payments = [], isLoading, refetch } = useQuery({
    queryKey: ["payments"],
    queryFn: () => api.payments.list(),
  });

  const [checkStates, setCheckStates] = useState<Record<string, CheckState>>({});
  const pollRefs = useRef<Record<string, number>>({});

  const setCheck = (id: string, state: CheckState) =>
    setCheckStates((prev) => ({ ...prev, [id]: state }));

  const checkPayment = useCallback(
    async (p: Payment) => {
      if (!p.checkoutRequestId) {
        toast.error("No checkout ID — cannot check this payment.");
        return;
      }

      setCheck(p.id, { stage: "checking" });
      let attempts = 0;

      const poll = async () => {
        attempts++;
        try {
          const result = await api.payments.checkStatus({
            paymentId: p.id,
            checkoutRequestId: p.checkoutRequestId!,
          });

          if (result.status === "completed") {
            setCheck(p.id, { stage: "done-success", mpesaRef: result.mpesaRef ?? null });
            void qc.invalidateQueries({ queryKey: ["payments"] });
            void qc.invalidateQueries({ queryKey: ["subscriptions/active"] });
            toast.success("Payment confirmed! Your subscription is now active.");
            return;
          }

          if (result.status === "failed") {
            const reason = result.resultDesc ?? "Payment was declined by M-Pesa.";
            setCheck(p.id, { stage: "done-failed", reason });
            void qc.invalidateQueries({ queryKey: ["payments"] });
            toast.error(`Payment failed: ${reason}`);
            return;
          }

          // still processing — keep polling
          if (attempts < MAX_POLLS) {
            pollRefs.current[p.id] = window.setTimeout(poll, POLL_INTERVAL_MS);
          } else {
            setCheck(p.id, { stage: "done-failed", reason: "Timed out waiting for M-Pesa confirmation." });
          }
        } catch {
          if (attempts < MAX_POLLS) {
            pollRefs.current[p.id] = window.setTimeout(poll, POLL_INTERVAL_MS);
          } else {
            setCheck(p.id, { stage: "done-failed", reason: "Could not reach server. Try again later." });
          }
        }
      };

      await poll();
    },
    [qc],
  );

  function resetCheck(id: string) {
    clearTimeout(pollRefs.current[id]);
    setCheck(id, { stage: "idle" });
  }

  const actionable = (p: Payment) =>
    (p.status === "pending" || p.status === "processing" || p.status === "failed") &&
    !!p.checkoutRequestId;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payment History</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your M-Pesa transaction history</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refetch()} className="gap-1.5">
          <RefreshCw className="size-3.5" />
          Refresh
        </Button>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3 flex-row items-center gap-3">
          <Receipt className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="size-8 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">No payments yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Date</TableHead>
                  <TableHead className="text-muted-foreground">Amount</TableHead>
                  <TableHead className="text-muted-foreground">Phone</TableHead>
                  <TableHead className="text-muted-foreground">M-Pesa Ref</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => {
                  const cs = checkStates[p.id] ?? { stage: "idle" };
                  return (
                    <TableRow key={p.id} className="border-border hover:bg-muted/30 align-top">
                      <TableCell className="text-sm text-foreground">{formatDateTime(p.createdAt)}</TableCell>
                      <TableCell className="text-sm font-semibold text-foreground">{formatCurrency(p.amount)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.phone}</TableCell>
                      <TableCell className="text-sm font-mono">
                        {cs.stage === "done-success" && cs.mpesaRef ? (
                          <span className="text-primary font-semibold">{cs.mpesaRef}</span>
                        ) : (
                          <span className="text-muted-foreground">{p.mpesaRef ?? "—"}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {cs.stage === "done-success" ? (
                            <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
                              <CheckCircle2 className="size-3 mr-1" /> Confirmed
                            </Badge>
                          ) : cs.stage === "done-failed" ? (
                            <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30">
                              <XCircle className="size-3 mr-1" /> Failed
                            </Badge>
                          ) : (
                            <PaymentBadge status={p.status} />
                          )}
                          {cs.stage === "done-failed" && (
                            <p className="text-[10px] text-muted-foreground max-w-[160px]">{cs.reason}</p>
                          )}
                          {cs.stage === "done-success" && (
                            <p className="text-[10px] text-primary">Subscription activated</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        {actionable(p) && cs.stage === "idle" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                            onClick={() => void checkPayment(p)}
                          >
                            <Smartphone className="size-3" />
                            Already Paid?
                          </Button>
                        )}
                        {cs.stage === "checking" && (
                          <div className="flex items-center gap-1.5 justify-end">
                            <Loader2 className="size-3.5 animate-spin text-primary" />
                            <span className="text-xs text-primary">Checking…</span>
                          </div>
                        )}
                        {(cs.stage === "done-success" || cs.stage === "done-failed") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-muted-foreground"
                            onClick={() => resetCheck(p.id)}
                          >
                            Dismiss
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Help tip */}
      <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-muted/20">
        <AlertCircle className="size-4 text-muted-foreground mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground">Paid but status not updated?</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            If you completed the M-Pesa STK prompt on your phone but the status still shows pending or processing, click{" "}
            <span className="text-primary font-medium">Already Paid?</span> to force a status check against Safaricom.
          </p>
        </div>
      </div>
    </div>
  );
}
