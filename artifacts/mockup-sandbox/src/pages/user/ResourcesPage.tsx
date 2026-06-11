import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  FileText,
  Download,
  ExternalLink,
  Search,
  BookOpen,
  Loader2,
  Filter,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

const TYPE_ICONS: Record<string, typeof FileText> = {
  pdf: FileText,
  document: FileText,
  guide: BookOpen,
  ebook: BookOpen,
  link: ExternalLink,
};

const TYPE_COLORS: Record<string, string> = {
  pdf: "text-red-400",
  document: "text-blue-400",
  guide: "text-green-400",
  ebook: "text-purple-400",
  link: "text-yellow-400",
};

const CATEGORIES = ["all", "general", "forex", "crypto", "stocks", "risk management", "psychology"];

export default function ResourcesPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["resources"],
    queryFn: () => api.resources.list(),
  });

  const downloadMutation = useMutation({
    mutationFn: (id: string) => api.resources.download(id),
    onSuccess: (data) => {
      window.open(data.url, "_blank");
    },
    onError: () => toast.error("Failed to open resource"),
  });

  const items = (data?.resources ?? []).filter((r) => {
    const matchCat = category === "all" || r.category === category;
    const matchSearch =
      !search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      (r.description ?? "").toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Trading Resources</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          PDFs, guides, eBooks and educational links
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search resources…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((c) => (
            <Button
              key={c}
              variant={category === c ? "default" : "outline"}
              size="sm"
              onClick={() => setCategory(c)}
              className="capitalize"
            >
              {c}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="size-5 animate-spin" />
          <span>Loading resources…</span>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3 text-center">
          <BookOpen className="size-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">No resources found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const Icon = TYPE_ICONS[item.type] ?? FileText;
            const colorClass = TYPE_COLORS[item.type] ?? "text-muted-foreground";
            const isLink = item.type === "link";

            return (
              <Card key={item.id} className="bg-card border-border hover:border-primary/40 transition-colors">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="size-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Icon className={`size-5 ${colorClass}`} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">
                        {item.title}
                      </p>
                      <Badge variant="secondary" className="text-[10px] capitalize flex-shrink-0">
                        {item.type}
                      </Badge>
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-muted-foreground capitalize">{item.category}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => downloadMutation.mutate(item.id)}
                        disabled={downloadMutation.isPending}
                      >
                        {isLink ? (
                          <>
                            <ExternalLink className="size-3" />
                            Open
                          </>
                        ) : (
                          <>
                            <Download className="size-3" />
                            Download
                          </>
                        )}
                      </Button>
                    </div>
                    {item.downloadCount > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        {item.downloadCount} downloads
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
