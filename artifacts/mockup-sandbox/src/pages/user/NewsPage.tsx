import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Newspaper,
  TrendingUp,
  Calendar,
  Search,
  Loader2,
  ArrowRight,
  Clock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";

type NewsCategory = "all" | "article" | "market_update" | "economic_calendar";

const CATEGORY_LABELS: Record<string, string> = {
  all: "All",
  article: "Articles",
  market_update: "Market Updates",
  economic_calendar: "Economic Calendar",
};

const CATEGORY_ICONS: Record<string, typeof Newspaper> = {
  article: Newspaper,
  market_update: TrendingUp,
  economic_calendar: Calendar,
};

const CATEGORY_COLORS: Record<string, string> = {
  article: "bg-blue-500/15 text-blue-400",
  market_update: "bg-green-500/15 text-green-400",
  economic_calendar: "bg-orange-500/15 text-orange-400",
};

export default function NewsPage() {
  const [category, setCategory] = useState<NewsCategory>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<import("@/lib/api").NewsItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["news"],
    queryFn: () => api.news.list(),
  });

  const items = (data?.news ?? []).filter((n) => {
    const matchCat = category === "all" || n.category === category;
    const matchSearch =
      !search ||
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      (n.excerpt ?? "").toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const latest = items[0];
  const rest = items.slice(1);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Trading News</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Market updates, articles and economic calendar
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search news…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["all", "article", "market_update", "economic_calendar"] as NewsCategory[]).map((c) => (
            <Button
              key={c}
              variant={category === c ? "default" : "outline"}
              size="sm"
              onClick={() => setCategory(c)}
            >
              {CATEGORY_LABELS[c]}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="size-5 animate-spin" />
          <span>Loading news…</span>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3 text-center">
          <Newspaper className="size-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">No news found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Featured latest */}
          {latest && !search && category === "all" && (
            <Card
              className="bg-card border-border hover:border-primary/40 cursor-pointer transition-colors overflow-hidden"
              onClick={() => setSelected(latest)}
            >
              <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row">
                  {latest.imageUrl && (
                    <div className="sm:w-64 h-48 sm:h-auto flex-shrink-0 overflow-hidden">
                      <img
                        src={latest.imageUrl}
                        alt={latest.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-5 space-y-3 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[10px] ${CATEGORY_COLORS[latest.category] ?? ""}`}>
                        Latest
                      </Badge>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {CATEGORY_LABELS[latest.category]}
                      </Badge>
                    </div>
                    <h2 className="text-lg font-bold text-foreground leading-snug">
                      {latest.title}
                    </h2>
                    {latest.excerpt && (
                      <p className="text-sm text-muted-foreground line-clamp-3">{latest.excerpt}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="size-3" />
                        {latest.publishedAt ? formatDate(latest.publishedAt) : ""}
                      </span>
                      <span className="text-xs text-primary flex items-center gap-1 font-medium">
                        Read more <ArrowRight className="size-3" />
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rest */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(search || category !== "all" ? items : rest).map((item) => {
              const CatIcon = CATEGORY_ICONS[item.category] ?? Newspaper;
              return (
                <Card
                  key={item.id}
                  className="bg-card border-border hover:border-primary/40 cursor-pointer transition-colors overflow-hidden"
                  onClick={() => setSelected(item)}
                >
                  <CardContent className="p-0">
                    {item.imageUrl && (
                      <div className="h-40 overflow-hidden">
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}
                    <div className="p-4 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <CatIcon className="size-3.5 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground capitalize">
                          {CATEGORY_LABELS[item.category]}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">
                        {item.title}
                      </p>
                      {item.excerpt && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{item.excerpt}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="size-3" />
                        {item.publishedAt ? formatDate(item.publishedAt) : ""}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-[10px] capitalize">
                {selected ? CATEGORY_LABELS[selected.category] : ""}
              </Badge>
              {selected?.publishedAt && (
                <span className="text-xs text-muted-foreground">
                  {formatDate(selected.publishedAt)}
                </span>
              )}
            </div>
            <DialogTitle className="text-lg leading-snug">{selected?.title}</DialogTitle>
          </DialogHeader>
          {selected?.imageUrl && (
            <img
              src={selected.imageUrl}
              alt={selected.title}
              className="w-full rounded-lg object-cover max-h-64"
            />
          )}
          <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {selected?.content}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
