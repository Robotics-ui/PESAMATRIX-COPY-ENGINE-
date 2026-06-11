import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Play,
  Image as ImageIcon,
  ExternalLink,
  Youtube,
  Loader2,
  Search,
  Film,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type MediaType = "all" | "image" | "video" | "youtube" | "external";

const TYPE_LABELS: Record<string, string> = {
  all: "All",
  image: "Images",
  video: "Videos",
  youtube: "YouTube",
  external: "External",
};

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
  return m ? m[1] : null;
}

function getYouTubeThumbnail(url: string): string {
  const id = getYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : "";
}

export default function GalleryPage() {
  const [filter, setFilter] = useState<MediaType>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<import("@/lib/api").MediaItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["media"],
    queryFn: () => api.media.list(),
  });

  const items = (data?.media ?? []).filter((m) => {
    const matchType = filter === "all" || m.type === filter;
    const matchSearch =
      !search ||
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      (m.description ?? "").toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gallery</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Trading videos, images and educational content
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search media…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["all", "image", "video", "youtube", "external"] as MediaType[]).map((t) => (
            <Button
              key={t}
              variant={filter === t ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(t)}
            >
              {TYPE_LABELS[t]}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="size-5 animate-spin" />
          <span>Loading media…</span>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3 text-center">
          <Film className="size-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">No media found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => (
            <MediaCard key={item.id} item={item} onOpen={() => setSelected(item)} />
          ))}
        </div>
      )}

      {/* Preview dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
          </DialogHeader>
          {selected && <MediaPreview item={selected} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MediaCard({
  item,
  onOpen,
}: {
  item: import("@/lib/api").MediaItem;
  onOpen: () => void;
}) {
  const thumb =
    item.thumbnailUrl ||
    (item.type === "youtube" ? getYouTubeThumbnail(item.url) : null);

  const TypeIcon =
    item.type === "image"
      ? ImageIcon
      : item.type === "youtube"
        ? Youtube
        : item.type === "video"
          ? Play
          : ExternalLink;

  return (
    <div
      className="group rounded-xl border border-border bg-card overflow-hidden cursor-pointer hover:border-primary/50 transition-all hover:shadow-md"
      onClick={onOpen}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-muted overflow-hidden">
        {thumb ? (
          <img
            src={thumb}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <TypeIcon className="size-10 text-muted-foreground/40" />
          </div>
        )}
        {(item.type === "video" || item.type === "youtube") && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-12 rounded-full bg-black/60 flex items-center justify-center group-hover:bg-primary/80 transition-colors">
              <Play className="size-5 text-white fill-white ml-0.5" />
            </div>
          </div>
        )}
        <Badge
          variant="secondary"
          className="absolute top-2 left-2 text-[10px] capitalize"
        >
          {item.type}
        </Badge>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-sm font-medium text-foreground line-clamp-1">{item.title}</p>
        {item.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {item.description}
          </p>
        )}
      </div>
    </div>
  );
}

function MediaPreview({ item }: { item: import("@/lib/api").MediaItem }) {
  if (item.type === "youtube") {
    const id = getYouTubeId(item.url);
    return (
      <div className="space-y-3">
        <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
          {id ? (
            <iframe
              src={`https://www.youtube.com/embed/${id}`}
              className="w-full h-full"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          ) : (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-primary underline p-4 block">
              Open on YouTube
            </a>
          )}
        </div>
        {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
      </div>
    );
  }

  if (item.type === "image") {
    return (
      <div className="space-y-3">
        <img src={item.url} alt={item.title} className="w-full rounded-lg object-contain max-h-[60vh]" />
        {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
      </div>
    );
  }

  if (item.type === "video") {
    return (
      <div className="space-y-3">
        <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
          <video src={item.url} controls className="w-full h-full" />
        </div>
        {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-primary hover:underline"
      >
        <ExternalLink className="size-4" />
        Open Link
      </a>
    </div>
  );
}
