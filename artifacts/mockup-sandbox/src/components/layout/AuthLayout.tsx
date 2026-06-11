import type { ReactNode } from "react";
import { TrendingUp } from "lucide-react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Left panel */}
      <div className="hidden md:flex md:w-1/2 bg-card border-r border-border flex-col justify-between p-10">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-primary flex items-center justify-center">
            <TrendingUp className="size-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold text-foreground">PesaMatrix</span>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground leading-tight">
              Automated Copy Trading<br />Powered by MetaApi
            </h1>
            <p className="text-muted-foreground text-base">
              Mirror the master trader's signals directly to your MT5 account in real-time — 
              fully automated, cloud-to-cloud.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Active Subscribers", value: "2,000+" },
              { label: "Trades Copied", value: "50K+" },
              { label: "Avg Win Rate", value: "74%" },
              { label: "Uptime", value: "99.9%" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg border border-border bg-background/50 p-4">
                <div className="text-2xl font-bold text-primary">{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} PesaMatrix. Cloud copy trading platform.
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 md:hidden">
            <div className="size-8 rounded-lg bg-primary flex items-center justify-center">
              <TrendingUp className="size-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold">PesaMatrix</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
