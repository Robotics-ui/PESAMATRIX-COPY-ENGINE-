import { useRef, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  TrendingUp, Shield, Zap, BarChart2, CheckCircle2, Users, Activity,
  ArrowRight, ChevronRight, CreditCard, Smartphone, MonitorSmartphone,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import WhatsAppButton from "@/components/WhatsAppButton";
import { api } from "@/lib/api";

// ── Animated counter ──────────────────────────────────────────────────────────
function useCountUp(target: number, decimals: number, duration = 1800) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    started.current = false;
    setValue(0);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const startTime = performance.now();
          const tick = (now: number) => {
            const progress = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(parseFloat((eased * target).toFixed(decimals)));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, decimals, duration]);

  return { value, ref };
}

function AnimatedStat({
  target, suffix, label, icon: Icon, decimals = 0,
}: {
  target: number; suffix: string; label: string; icon: typeof TrendingUp; decimals?: number;
}) {
  const { value, ref } = useCountUp(target, decimals);
  return (
    <div className="space-y-1 text-center">
      <div className="flex justify-center mb-2">
        <Icon className="size-5 text-primary" />
      </div>
      <p
        ref={ref as React.RefObject<HTMLParagraphElement>}
        className="text-3xl font-extrabold text-primary tabular-nums"
      >
        {decimals > 0 ? value.toFixed(decimals) : Math.floor(value).toLocaleString()}
        {suffix}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// ── Content ───────────────────────────────────────────────────────────────────
const STEPS = [
  {
    n: "01", icon: Users, title: "Create Your Account",
    desc: "Register in under 2 minutes with your email and phone number. No credit card required to get started.",
  },
  {
    n: "02", icon: MonitorSmartphone, title: "Connect Your MT5 Account",
    desc: "Link your MetaTrader 5 account via MetaApi. Works with any MT5 broker worldwide — cloud-to-cloud, no plugins.",
  },
  {
    n: "03", icon: CreditCard, title: "Subscribe via M-Pesa",
    desc: "Pay for your chosen number of trading days using a simple M-Pesa STK push. Plans start from 5 trading days.",
  },
  {
    n: "04", icon: TrendingUp, title: "Trades Copy Automatically",
    desc: "Every trade from the master strategy is mirrored to your account instantly — while you sleep, work, or travel.",
  },
];

const FEATURES = [
  {
    icon: Zap, title: "Instant Trade Mirroring",
    desc: "CopyFactory replicates master trades to your MT5 in milliseconds — before manual traders can even see the signal.",
  },
  {
    icon: BarChart2, title: "Trading-Days Subscription",
    desc: "Weekends never reduce your balance. Your subscription counts Monday–Friday only, so you pay for real market time.",
  },
  {
    icon: Shield, title: "Non-Custodial",
    desc: "PesaMatrix never holds your funds. You keep full control of your brokerage account and all your money.",
  },
  {
    icon: Smartphone, title: "M-Pesa Payments",
    desc: "Pay and renew with a simple M-Pesa prompt. No bank cards, no wire transfers — built for Kenyan traders.",
  },
  {
    icon: Activity, title: "Live Performance Data",
    desc: "Track real-time equity, drawdown, win rate, and copied trade history directly from your dashboard.",
  },
  {
    icon: TrendingUp, title: "Proven Master Strategy",
    desc: "The master account runs a disciplined, risk-managed strategy with a consistent multi-year track record.",
  },
];

export default function LandingPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["public/stats"],
    queryFn: () => api.public.stats(),
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: false,
  });

  const liveStats = [
    {
      target: stats?.winRate ?? 74.0,
      suffix: "%",
      label: "Average Win Rate",
      icon: TrendingUp,
      decimals: 1,
    },
    {
      target: stats?.activeSubscribers ?? 2000,
      suffix: "+",
      label: "Active Subscribers",
      icon: Users,
      decimals: 0,
    },
    {
      target: stats?.totalTradesCount ?? 50000,
      suffix: "+",
      label: "Trades Auto-Copied",
      icon: Activity,
      decimals: 0,
    },
    {
      target: stats?.uptimePercent ?? 99.9,
      suffix: "%",
      label: "Platform Uptime",
      icon: Shield,
      decimals: 1,
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Nav ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-primary flex items-center justify-center">
              <TrendingUp className="size-4 text-black" />
            </div>
            <span className="text-sm font-bold tracking-tight">PesaMatrix</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#stats" className="hover:text-foreground transition-colors">Performance</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-sm">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="text-sm bg-primary text-black hover:bg-primary/90 gap-1">
                Get Started <ChevronRight className="size-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative pt-20 pb-24 px-4 sm:px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs text-primary font-medium">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            Live trading — markets are open
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]">
            Automated Copy Trading
            <span className="block text-primary">Powered by MetaApi</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Mirror the master trader's signals directly to your MetaTrader 5 account in real-time —
            fully automated, cloud-to-cloud. No plugins. No screen time. Just results.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto bg-primary text-black hover:bg-primary/90 gap-2 text-base px-8">
                Start Copy Trading <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2 text-base px-8">
                Sign In to Dashboard
              </Button>
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            From KES 100/day · Pay with M-Pesa · Cancel anytime
          </p>
        </div>
      </section>

      {/* ── Live stats strip ────────────────────────────────────── */}
      <section id="stats" className="border-y border-border bg-card/40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex items-center justify-center gap-2 mb-8">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
              {statsLoading ? "Loading live stats…" : "Live platform stats"}
            </p>
            {!statsLoading && stats && (
              <RefreshCw className="size-3 text-muted-foreground/50" />
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {liveStats.map((s) => (
              <AnimatedStat key={s.label} {...s} />
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-2">Simple process</p>
            <h2 className="text-3xl font-bold">Up and running in minutes</h2>
            <p className="text-muted-foreground mt-2 max-w-xl mx-auto text-sm">
              Four steps from registration to live copy trading — no technical knowledge required.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map(({ n, icon: Icon, title, desc }) => (
              <div
                key={n}
                className="relative rounded-xl border border-border bg-card p-5 space-y-3 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-black text-primary/20 tabular-nums leading-none">{n}</span>
                  <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="size-4 text-primary" />
                  </div>
                </div>
                <h3 className="font-semibold text-sm text-foreground">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────── */}
      <section id="features" className="py-20 px-4 sm:px-6 bg-card/20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-2">Why PesaMatrix</p>
            <h2 className="text-3xl font-bold">Built for serious traders</h2>
            <p className="text-muted-foreground mt-2 max-w-xl mx-auto text-sm">
              Professional-grade copy trading infrastructure with a fair, market-hours pricing model.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-xl border border-border bg-card p-5 space-y-3 hover:border-primary/40 transition-colors"
              >
                <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="size-4 text-primary" />
                </div>
                <h3 className="font-semibold text-sm text-foreground">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="relative rounded-2xl border border-primary/20 bg-card p-10 overflow-hidden">
            <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
            <div className="relative space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary font-medium">
                <CheckCircle2 className="size-3" />
                Non-custodial · M-Pesa payments · Cancel anytime
              </div>
              <h2 className="text-3xl font-bold">Ready to automate your trading?</h2>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Join hundreds of Kenyan traders copying the master strategy hands-free.
                Register today and your first trades start copying within minutes.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Link href="/register">
                  <Button size="lg" className="w-full sm:w-auto bg-primary text-black hover:bg-primary/90 gap-2 text-base px-8">
                    Create Free Account <ArrowRight className="size-4" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-8">
                    Sign In
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-border py-8 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded bg-primary flex items-center justify-center">
              <TrendingUp className="size-3.5 text-black" />
            </div>
            <span className="text-sm font-semibold">PesaMatrix</span>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            © {new Date().getFullYear()} PesaMatrix. Cloud copy-trading platform.
            Trading involves risk — past performance does not guarantee future results.
          </p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <Link href="/login" className="hover:text-foreground transition-colors">Sign In</Link>
            <Link href="/register" className="hover:text-foreground transition-colors">Register</Link>
          </div>
        </div>
      </footer>

      <WhatsAppButton />
    </div>
  );
}
