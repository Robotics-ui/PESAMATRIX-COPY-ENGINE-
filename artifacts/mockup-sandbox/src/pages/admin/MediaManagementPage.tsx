import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Image as ImageIcon,
  Play,
  Youtube,
  ExternalLink,
  Loader2,
  Film,
  Eye,
  EyeOff,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  type: z.enum(["image", "video", "youtube", "external"]),
  url: z.string().min(1, "URL is required"),
  thumbnailUrl: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const TYPE_ICONS: Record<string, typeof ImageIcon> = {
  image: ImageIcon,
  video: Play,
  youtube: Youtube,
  external: ExternalLink,
};

export default function MediaManagementPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<import("@/lib/api").MediaItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["media"],
    queryFn: () => api.media.list(),
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: "youtube" },
  });

  const typeValue = watch("type");

  const openCreate = () => {
    setEditItem(null);
    reset({ type: "youtube", title: "", description: "", url: "", thumbnailUrl: "" });
    setDialogOpen(true);
  };

  const openEdit = (item: import("@/lib/api").MediaItem) => {
    setEditItem(item);
    reset({
      title: item.title,
      description: item.description ?? "",
      type: item.type as FormData["type"],
      url: item.url,
      thumbnailUrl: item.thumbnailUrl ?? "",
    });
    setDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: (data: FormData) => api.media.create(data),
    onSuccess: () => {
      toast.success("Media added");
      qc.invalidateQueries({ queryKey: ["media"] });
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FormData> }) =>
      api.media.update(id, data),
    onSuccess: () => {
      toast.success("Media updated");
      qc.invalidateQueries({ queryKey: ["media"] });
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.media.delete(id),
    onSuccess: () => {
      toast.success("Media deleted");
      qc.invalidateQueries({ queryKey: ["media"] });
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

  const items = data?.media ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Media Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Upload and manage trading videos and images
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" /> Add Media
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3 text-center">
          <Film className="size-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">No media yet. Add your first item.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const Icon = TYPE_ICONS[item.type] ?? Film;
            return (
              <Card key={item.id} className="bg-card border-border overflow-hidden">
                <div className="relative aspect-video bg-muted">
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                  ) : item.type === "youtube" && item.url.includes("youtube") ? (
                    <img
                      src={`https://img.youtube.com/vi/${item.url.match(/(?:v=|youtu\.be\/)([^&?/]+)/)?.[1]}/hqdefault.jpg`}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Icon className="size-10 text-muted-foreground/40" />
                    </div>
                  )}
                  <Badge variant="secondary" className="absolute top-2 left-2 text-[10px] capitalize">
                    {item.type}
                  </Badge>
                </div>
                <CardContent className="p-3 space-y-2">
                  <p className="text-sm font-medium text-foreground line-clamp-1">{item.title}</p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">{formatDate(item.createdAt)}</p>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 flex-1" onClick={() => openEdit(item)}>
                      <Pencil className="size-3" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive hover:text-destructive flex-1" onClick={() => setDeleteId(item.id)}>
                      <Trash2 className="size-3" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Media" : "Add Media"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={typeValue} onValueChange={(v) => setValue("type", v as FormData["type"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="youtube">YouTube Video</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="video">Video File / URL</SelectItem>
                  <SelectItem value="external">External Link</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input {...register("title")} placeholder="Enter title" />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>
                {typeValue === "youtube" ? "YouTube URL" : typeValue === "image" ? "Image URL" : typeValue === "video" ? "Video URL" : "Link URL"}
              </Label>
              <Input
                {...register("url")}
                placeholder={
                  typeValue === "youtube"
                    ? "https://youtube.com/watch?v=..."
                    : typeValue === "image"
                      ? "https://example.com/image.jpg"
                      : "https://..."
                }
              />
              {errors.url && <p className="text-xs text-destructive">{errors.url.message}</p>}
            </div>
            {(typeValue === "video" || typeValue === "external") && (
              <div className="space-y-1.5">
                <Label>Thumbnail URL (optional)</Label>
                <Input {...register("thumbnailUrl")} placeholder="https://example.com/thumb.jpg" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Textarea {...register("description")} placeholder="Describe this media…" rows={3} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="size-4 animate-spin mr-2" />}
                {editItem ? "Save Changes" : "Add Media"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete media?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
