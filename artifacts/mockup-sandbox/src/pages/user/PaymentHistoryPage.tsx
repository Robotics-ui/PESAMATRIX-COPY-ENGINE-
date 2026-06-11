import { useQuery } from "@tanstack/react-query";
import { Loader2, Receipt, CheckCircle2, XCircle, Clock, RefreshCw } from "lucide-react";
import { api, type Payment } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function PaymentBadge({ status }: { status: Payment["status"] }) {
  const map = {
    completed: { label: "Completed", cls: "bg-primary/20 text-primary border-primary/30", icon: CheckCircle2 },
    pending: { label: "Pending", cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Clock },
    failed: { label: "Failed", cls: "bg-destructive/20 text-destructive border-destructive/30", icon: XCircle },
    refunded: { label: "Refunded", cls: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: RefreshCw },
  };
  const v = map[status] ?? map.pending;
  const Icon = v.icon;
  return (
    <Badge variant="outline" className={v.cls}>
      <Icon className="size-3 mr-1" />
      {v.label}
    </Badge>
  );
}

export default function PaymentHistoryPage() {
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: () => api.payments.list(),
  });

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Payment History</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your M-Pesa transaction history</p>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id} className="border-border hover:bg-muted/30">
                    <TableCell className="text-sm text-foreground">{formatDateTime(p.createdAt)}</TableCell>
                    <TableCell className="text-sm font-semibold text-foreground">{formatCurrency(p.amount)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.phone}</TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {p.mpesaRef ?? "—"}
                    </TableCell>
                    <TableCell>
                      <PaymentBadge status={p.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
