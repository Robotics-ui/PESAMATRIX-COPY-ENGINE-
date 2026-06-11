import { LineChart } from "lucide-react";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] w-full flex bg-background">
      {/* Visual Side */}
      <div className="hidden lg:flex flex-1 flex-col justify-between bg-zinc-900 border-r border-border/50 p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-background/20"></div>
        
        <div className="relative z-10 flex items-center gap-3 text-primary font-bold text-3xl tracking-tight">
          <LineChart className="h-8 w-8" />
          <span>PesaMatrix</span>
        </div>

        <div className="relative z-10 max-w-lg">
          <h1 className="text-4xl font-bold text-white mb-6 leading-tight">
            Institutional-grade automated trading for serious investors.
          </h1>
          <p className="text-lg text-zinc-400">
            Connect your MetaTrader 5 account and automatically mirror strategies from our master account with zero latency.
          </p>
        </div>
      </div>

      {/* Form Side */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 lg:p-12 relative">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex justify-center mb-8">
            <div className="flex items-center gap-2 text-primary font-bold text-2xl tracking-tight">
              <LineChart className="h-6 w-6" />
              <span>PesaMatrix</span>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
