import { AdminShell } from "@/components/layout/AdminShell";
import { useAdminListUsers, getAdminListUsersQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Users } from "lucide-react";
import { useState } from "react";

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useAdminListUsers({
    query: { queryKey: getAdminListUsersQueryKey() },
  });

  const users = data?.users ?? [];
  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.firstName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (u.lastName ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Users</h1>
            <p className="text-muted-foreground text-sm mt-0.5">All registered platform users</p>
          </div>
          <Badge variant="outline" className="text-sm px-3 py-1 shrink-0">
            <Users className="h-3.5 w-3.5 mr-1.5" />
            {data?.total ?? 0} total
          </Badge>
        </div>

        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No users found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-2 pr-4 text-xs text-muted-foreground uppercase tracking-wider">User</th>
                      <th className="text-left py-2 pr-4 text-xs text-muted-foreground uppercase tracking-wider">Email</th>
                      <th className="text-left py-2 pr-4 text-xs text-muted-foreground uppercase tracking-wider">Role</th>
                      <th className="text-left py-2 pr-4 text-xs text-muted-foreground uppercase tracking-wider">Phone</th>
                      <th className="text-left py-2 text-xs text-muted-foreground uppercase tracking-wider">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {filtered.map((u) => (
                      <tr key={u.id} className="hover:bg-accent/20 transition-colors">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold uppercase shrink-0">
                              {u.firstName?.[0] ?? u.email?.[0] ?? "U"}
                            </div>
                            <span className="font-medium">
                              {u.firstName ? `${u.firstName} ${u.lastName ?? ""}`.trim() : "—"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">{u.email}</td>
                        <td className="py-3 pr-4">
                          <Badge
                            variant="outline"
                            className={`text-xs capitalize ${u.role === "admin" ? "border-primary/40 text-primary bg-primary/10" : "border-muted-foreground/30 text-muted-foreground"}`}
                          >
                            {u.role}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{u.phone ?? "—"}</td>
                        <td className="py-3 text-muted-foreground text-xs">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
