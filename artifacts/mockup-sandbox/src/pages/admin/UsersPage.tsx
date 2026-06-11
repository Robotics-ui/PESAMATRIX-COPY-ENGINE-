import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Search,
  Loader2,
  ShieldCheck,
  User,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { api, type AdminUser } from "@/lib/api";
import { formatDate, formatRelative } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function UserRow({ user }: { user: AdminUser }) {
  const [expanded, setExpanded] = useState(false);
  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();

  return (
    <>
      <TableRow
        className="border-border hover:bg-muted/30 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell>
          <div className="flex items-center gap-3">
            <Avatar className="size-7">
              <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="text-sm font-medium text-foreground">
                {user.firstName} {user.lastName}
              </div>
              <div className="text-xs text-muted-foreground">{user.email}</div>
            </div>
          </div>
        </TableCell>
        <TableCell>
          <Badge
            variant="outline"
            className={
              user.role === "admin"
                ? "bg-primary/20 text-primary border-primary/30"
                : "bg-muted text-muted-foreground"
            }
          >
            {user.role === "admin" ? (
              <ShieldCheck className="size-3 mr-1" />
            ) : (
              <User className="size-3 mr-1" />
            )}
            {user.role}
          </Badge>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">{user.phone ?? "—"}</TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {formatRelative(user.createdAt)}
        </TableCell>
        <TableCell>
          {user.activeSubscription ? (
            <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30 text-xs">
              Active
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">None</span>
          )}
        </TableCell>
        <TableCell className="text-right">
          {expanded ? (
            <ChevronDown className="size-4 text-muted-foreground ml-auto" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground ml-auto" />
          )}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="border-border bg-muted/10 hover:bg-muted/10">
          <TableCell colSpan={6} className="py-4 px-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">User ID</div>
                <div className="font-mono text-xs text-foreground mt-0.5 truncate">{user.id}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Joined</div>
                <div className="text-foreground mt-0.5">{formatDate(user.createdAt)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Subscriptions</div>
                <div className="text-foreground mt-0.5">{user.subscriptionCount ?? 0}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">MT5 Accounts</div>
                <div className="text-foreground mt-0.5">{user.mt5AccountCount ?? 0}</div>
              </div>
              {user.activeSubscription && (
                <div>
                  <div className="text-xs text-muted-foreground">Sub expires</div>
                  <div className="text-foreground mt-0.5">
                    {user.activeSubscription.endDate
                      ? formatDate(user.activeSubscription.endDate)
                      : "—"}
                  </div>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 25;

  const { data, isLoading } = useQuery({
    queryKey: ["admin/users", page, search],
    queryFn: () => api.admin.users({ page, limit, search: search || undefined }),
    placeholderData: (prev) => prev,
  });

  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Users</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {total > 0 ? `${total} total users` : "Manage platform users"}
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-4 flex-row items-center justify-between gap-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            All Users
          </CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email…"
              className="pl-9 h-8 text-sm"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <Users className="size-8 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">
                {search ? "No users found matching your search" : "No users yet"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">User</TableHead>
                  <TableHead className="text-muted-foreground">Role</TableHead>
                  <TableHead className="text-muted-foreground">Phone</TableHead>
                  <TableHead className="text-muted-foreground">Joined</TableHead>
                  <TableHead className="text-muted-foreground">Subscription</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <UserRow key={user.id} user={user} />
                ))}
              </TableBody>
            </Table>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
