import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate, formatCurrency } from "@/lib/format";
import { DollarSign, Loader2, Search, CreditCard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-500/15 text-green-400",
  pending: "bg-yellow-500/15 text-yellow-400",
  processing: "bg-blue-500/15 text-blue-400",
  failed: "bg-red-500/15 text-red-400",
  cancelled: "bg-gray-500/15 text-gray-400",
};

export default function AdminPaymentsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["admin/payments", page],
    queryFn: () => api.admin.payments({ page, limit }),
  });

  const payments = (data?.payments ?? []).filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.phone?.toLowerCase().includes(q) ||
      p.mpesaRef?.toLowerCase().includes(q) ||
      p.status.toLowerCase().includes(q)
    );
  });

  const totalRevenue = (data?.payments ?? [])
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Payments</h1>
        <p className="text-sm text-muted-foreground mt-0.5">All M-Pesa transactions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Transactions</p>
            <p className="text-xl font-bold text-foreground mt-1">{data?.total ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Revenue (Completed)</p>
            <p className="text-xl font-bold text-primary mt-1">{formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Completed</p>
            <p className="text-xl font-bold text-green-400 mt-1">
              {(data?.payments ?? []).filter((p) => p.status === "completed").length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Failed</p>
            <p className="text-xl font-bold text-red-400 mt-1">
              {(data?.payments ?? []).filter((p) => p.status === "failed").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by phone, M-Pesa ref…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : payments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <CreditCard className="size-12 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">No payments found</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phone</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>M-Pesa Ref</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <span className="text-sm font-mono text-foreground">{p.phone}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-semibold text-foreground">
                      {formatCurrency(parseFloat(p.amount))}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] capitalize ${STATUS_COLORS[p.status] ?? ""}`}>
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-mono text-muted-foreground">
                      {p.mpesaRef ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">{formatDate(p.createdAt)}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {(data?.total ?? 0) > limit && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, data?.total ?? 0)} of {data?.total ?? 0}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-xs text-primary disabled:text-muted-foreground px-2 py-1 rounded border border-border disabled:border-transparent"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * limit >= (data?.total ?? 0)}
              className="text-xs text-primary disabled:text-muted-foreground px-2 py-1 rounded border border-border disabled:border-transparent"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
