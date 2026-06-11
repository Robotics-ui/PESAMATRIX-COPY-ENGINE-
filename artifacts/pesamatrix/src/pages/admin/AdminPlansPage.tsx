import { useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import {
  useAdminListPlans,
  useAdminCreatePlan,
  useAdminUpdatePlan,
  getAdminListPlansQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Edit2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Plan } from "@workspace/api-client-react";

const emptyForm = {
  name: "",
  pricePerDay: "",
  minimumDays: "7",
  maximumDays: "365",
  features: [""],
};

export default function AdminPlansPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useAdminListPlans({
    query: { queryKey: getAdminListPlansQueryKey() },
  });
  const createMutation = useAdminCreatePlan();
  const updateMutation = useAdminUpdatePlan();

  const plans = data?.plans ?? [];

  const openCreate = () => {
    setEditPlan(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (p: Plan) => {
    setEditPlan(p);
    setForm({
      name: p.name,
      pricePerDay: p.pricePerDay,
      minimumDays: String(p.minimumDays),
      maximumDays: String(p.maximumDays),
      features: p.features?.length ? p.features : [""],
    });
    setOpen(true);
  };

  const handleSave = () => {
    const payload = {
      name: form.name,
      pricePerDay: form.pricePerDay,
      minimumDays: parseInt(form.minimumDays),
      maximumDays: parseInt(form.maximumDays),
      features: form.features.filter((f) => f.trim()),
    };

    if (editPlan) {
      updateMutation.mutate(
        { id: editPlan.id, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Plan Updated" });
            queryClient.invalidateQueries({ queryKey: getAdminListPlansQueryKey() });
            setOpen(false);
          },
          onError: (err: unknown) => {
            toast({ variant: "destructive", title: "Update failed", description: err instanceof Error ? err.message : undefined });
          },
        },
      );
    } else {
      createMutation.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast({ title: "Plan Created" });
            queryClient.invalidateQueries({ queryKey: getAdminListPlansQueryKey() });
            setOpen(false);
          },
          onError: (err: unknown) => {
            toast({ variant: "destructive", title: "Create failed", description: err instanceof Error ? err.message : undefined });
          },
        },
      );
    }
  };

  const toggleActive = (p: Plan) => {
    updateMutation.mutate(
      { id: p.id, data: { isActive: !p.isActive } },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getAdminListPlansQueryKey() }),
        onError: () => toast({ variant: "destructive", title: "Update failed" }),
      },
    );
  };

  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Plans</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Manage subscription plans</p>
          </div>
          <Button onClick={openCreate} className="bg-primary text-primary-foreground shrink-0">
            <Plus className="h-4 w-4 mr-2" />
            New Plan
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        ) : plans.length === 0 ? (
          <Card className="bg-card border-border/50">
            <CardContent className="py-12 text-center text-muted-foreground text-sm">No plans created yet</CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((p) => (
              <Card key={p.id} className={`bg-card border-border/50 ${!p.isActive ? "opacity-60" : ""}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold">{p.name}</CardTitle>
                      <p className="text-2xl font-bold text-primary mt-1">
                        KES {parseFloat(p.pricePerDay).toFixed(0)}
                        <span className="text-sm font-normal text-muted-foreground">/day</span>
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs ${p.isActive ? "border-primary/40 text-primary bg-primary/10" : "text-muted-foreground"}`}
                    >
                      {p.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">{p.minimumDays}–{p.maximumDays} days</p>
                  {p.features?.length > 0 && (
                    <ul className="space-y-1">
                      {p.features.map((f, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <div className="h-1 w-1 rounded-full bg-primary shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-border/40">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch
                        checked={p.isActive}
                        onCheckedChange={() => toggleActive(p)}
                      />
                      <span>{p.isActive ? "Active" : "Inactive"}</span>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(p)} className="h-7 px-2">
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editPlan ? "Edit Plan" : "Create Plan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Plan Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Starter" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Price/Day (KES)</Label>
                <Input value={form.pricePerDay} onChange={(e) => setForm((f) => ({ ...f, pricePerDay: e.target.value }))} placeholder="100" />
              </div>
              <div className="space-y-1.5">
                <Label>Min Days</Label>
                <Input type="number" value={form.minimumDays} onChange={(e) => setForm((f) => ({ ...f, minimumDays: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Max Days</Label>
                <Input type="number" value={form.maximumDays} onChange={(e) => setForm((f) => ({ ...f, maximumDays: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Features</Label>
              {form.features.map((feat, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={feat}
                    onChange={(e) => {
                      const feats = [...form.features];
                      feats[i] = e.target.value;
                      setForm((f) => ({ ...f, features: feats }));
                    }}
                    placeholder={`Feature ${i + 1}`}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0"
                    onClick={() => setForm((f) => ({ ...f, features: f.features.filter((_, j) => j !== i) }))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setForm((f) => ({ ...f, features: [...f.features, ""] }))}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Feature
              </Button>
            </div>
            <Button
              className="w-full bg-primary text-primary-foreground"
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending || !form.name || !form.pricePerDay}
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : editPlan ? "Save Changes" : "Create Plan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
