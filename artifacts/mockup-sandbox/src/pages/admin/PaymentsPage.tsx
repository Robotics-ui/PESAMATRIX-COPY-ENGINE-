import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate, formatCurrency } from "@/lib/format";
import { DollarSign, Loader2, Search, CreditCard, Clock, AlertCircle, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-500/15 text-green-400 border-green-500/20",
  pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  processing: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  failed: "bg-red-500/15 text-red-400 border-red-500/20",
  cancelled: "bg-gray-500/15 text-gray-400 border-gray-500/20",
};

const TABS = [
  { key: "", label: "All" },
  { key: "completed", label: "Completed" },
  { key: "processing", label: "Processing" },
  { key: "pending", label: "Pending" },
  { key: "failed", label: "Failed" },
  { key: "cancelled", label: "Cancelled" },
] as const;

type TabKey = typeof TABS[number]["key"];

export default function AdminPaymentsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<TabKey>("");
  const limit = 20;

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin/payments", page, activeTab],
    queryFn: () => api.admin.payments({ page, limit, status: activeTab || undefined }),
  });

  const payments = (data?.payments ?? []).filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.phone?.toLowerCase().includes(q) ||
      p.mpesaRef?.toLowerCase().includes(q) ||
      p.status.toLowerCase().includes(q) ||
      p.checkoutRequestId?.toLowerCase().includes(q) ||
      p.resultDesc?.toLowerCase().includes(q)
    );
  });

  const bd = data?.breakdown ?? {};
  const totalRevenue = (data?.payments ?? [])
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);

  function handleTabChange(tab: TabKey) {
    setActiveTab(tab);
    setPage(1);
    setSearch("");
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Live M-Pesa transaction history</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="gap-1.5"
        >
          <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="size-3.5 text-primary" />
              <p className="text-xs text-muted-foreground">Revenue</p>
            </div>
            <p className="text-lg font-bold text-primary">{formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="size-3.5 text-green-400" />
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
            <p className="text-lg font-bold text-green-400">{bd["completed"] ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <RefreshCw className="size-3.5 text-blue-400" />
              <p className="text-xs text-muted-foreground">Processing</p>
            </div>
            <p className="text-lg font-bold text-blue-400">{bd["processing"] ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="size-3.5 text-yellow-400" />
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <p className="text-lg font-bold text-yellow-400">{bd["pending"] ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="size-3.5 text-red-400" />
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
            <p className="text-lg font-bold text-red-400">{bd["failed"] ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.key && bd[tab.key] != null ? (
              <span className="ml-1.5 text-[10px] bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">
                {bd[tab.key]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search phone, M-Pesa ref, checkout ID…"
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
                <TableHead>Result / Reason</TableHead>
                <TableHead>Checkout ID</TableHead>
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
                    <Badge className={`text-[10px] capitalize border ${STATUS_COLORS[p.status] ?? ""}`}>
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {p.mpesaRef ? (
                      <span className="text-xs font-mono text-green-400 font-semibold">{p.mpesaRef}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[180px]">
                    {p.resultDesc ? (
                      <div className="flex items-start gap-1">
                        {p.status === "failed" ? (
                          <AlertCircle className="size-3 text-red-400 mt-0.5 shrink-0" />
                        ) : p.status === "completed" ? (
                          <CheckCircle2 className="size-3 text-green-400 mt-0.5 shrink-0" />
                        ) : null}
                        <span className="text-xs text-muted-foreground truncate" title={p.resultDesc}>
                          {p.resultDesc}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.checkoutRequestId ? (
                      <span
                        className="text-[10px] font-mono text-muted-foreground truncate block max-w-[120px]"
                        title={p.checkoutRequestId}
                      >
                        {p.checkoutRequestId.slice(-16)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(p.createdAt)}
                    </span>
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
