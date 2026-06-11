import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Newspaper, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  excerpt: z.string().optional(),
  imageUrl: z.string().optional(),
  category: z.enum(["article", "market_update", "economic_calendar"]),
  isPublished: z.boolean().default(false),
});
type FormData = z.infer<typeof schema>;

const CATEGORY_LABELS: Record<string, string> = {
  article: "Article",
  market_update: "Market Update",
  economic_calendar: "Economic Calendar",
};

export default function NewsManagementPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<import("@/lib/api").NewsItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["news/admin"],
    queryFn: () => api.news.adminList(),
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { category: "article", isPublished: false },
  });

  const categoryValue = watch("category");
  const isPublishedValue = watch("isPublished");

  const openCreate = () => {
    setEditItem(null);
    reset({ category: "article", isPublished: false, title: "", content: "" });
    setDialogOpen(true);
  };

  const openEdit = (item: import("@/lib/api").NewsItem) => {
    setEditItem(item);
    reset({
      title: item.title,
      content: item.content,
      excerpt: item.excerpt ?? "",
      imageUrl: item.imageUrl ?? "",
      category: item.category as FormData["category"],
      isPublished: item.isPublished,
    });
    setDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: (data: FormData) => api.news.create(data),
    onSuccess: () => {
      toast.success("News item created");
      qc.invalidateQueries({ queryKey: ["news"] });
      qc.invalidateQueries({ queryKey: ["news/admin"] });
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FormData> }) =>
      api.news.update(id, data),
    onSuccess: () => {
      toast.success("News item updated");
      qc.invalidateQueries({ queryKey: ["news"] });
      qc.invalidateQueries({ queryKey: ["news/admin"] });
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.news.delete(id),
    onSuccess: () => {
      toast.success("News item deleted");
      qc.invalidateQueries({ queryKey: ["news"] });
      qc.invalidateQueries({ queryKey: ["news/admin"] });
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = (data: FormData) => {
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const items = data?.news ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">News Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Market updates, articles and economic calendar</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" /> Add News
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Newspaper className="size-12 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">No news items yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Published</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium text-foreground line-clamp-1">{item.title}</p>
                      {item.excerpt && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{item.excerpt}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {CATEGORY_LABELS[item.category] ?? item.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.isPublished ? "default" : "secondary"} className="text-[10px]">
                      {item.isPublished ? "Published" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {item.publishedAt ? formatDate(item.publishedAt) : "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="size-7 p-0" onClick={() => openEdit(item)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="size-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteId(item.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit News" : "Add News"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={categoryValue} onValueChange={(v) => setValue("category", v as FormData["category"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="article">Article</SelectItem>
                    <SelectItem value="market_update">Market Update</SelectItem>
                    <SelectItem value="economic_calendar">Economic Calendar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-0.5">
                <div className="flex items-center gap-3">
                  <Switch checked={isPublishedValue} onCheckedChange={(v) => setValue("isPublished", v)} />
                  <Label>Published</Label>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input {...register("title")} placeholder="News headline" />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Excerpt (short summary, optional)</Label>
              <Input {...register("excerpt")} placeholder="Brief summary shown in card view" />
            </div>
            <div className="space-y-1.5">
              <Label>Image URL (optional)</Label>
              <Input {...register("imageUrl")} placeholder="https://example.com/image.jpg" />
            </div>
            <div className="space-y-1.5">
              <Label>Content</Label>
              <Textarea {...register("content")} rows={8} placeholder="Full article content…" />
              {errors.content && <p className="text-xs text-destructive">{errors.content.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="size-4 animate-spin mr-2" />}
                {editItem ? "Save" : "Publish"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this news item?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
