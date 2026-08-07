import React from "react";
import { ArrowRight, Bot, Cpu, DollarSign, Fuel, ShieldCheck, Sparkles, TrendingUp, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="space-y-8">
      {/* Hero Banner Card */}
      <div className="relative overflow-hidden rounded-2xl glass-panel p-8 border border-white/10 shadow-glass">
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-brand-cyan/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-500 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI-Driven Cross-Chain Execution</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Intent-Based Agentic <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 via-brand-accent to-brand-cyan">Payment Router</span>
          </h1>

          <p className="text-gray-300 text-sm md:text-base leading-relaxed">
            Express your payment goals in natural language or structured parameters. Our multi-agent solvers evaluate DEX liquidity, gas costs, and bridge latencies to construct optimal execution routes in milliseconds.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-accent hover:from-brand-500 hover:to-brand-600 text-white text-sm font-semibold shadow-glow transition-all">
              <span>Create Intent</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <button className="px-5 py-2.5 rounded-xl glass-card text-gray-200 text-sm font-semibold border border-white/10 hover:border-brand-500/50 transition-all">
              Explore Active Solvers
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="glass-card p-5 rounded-2xl border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-medium">Total Volume Executed</span>
            <DollarSign className="h-4 w-4 text-brand-500" />
          </div>
          <div className="text-2xl font-bold text-white">$1,482,900</div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>+24.8% vs last week</span>
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-medium">Avg Gas Saved</span>
            <Fuel className="h-4 w-4 text-brand-cyan" />
          </div>
          <div className="text-2xl font-bold text-white">38.4%</div>
          <div className="text-xs text-gray-400">Optimal batch routing</div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-medium">Active Solvers</span>
            <Cpu className="h-4 w-4 text-brand-accent" />
          </div>
          <div className="text-2xl font-bold text-white">12 Nodes</div>
          <div className="text-xs text-emerald-400">99.98% Uptime</div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-medium">Execution Success</span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">99.4%</div>
          <div className="text-xs text-gray-400">Atomic rollback protection</div>
        </div>
      </div>

      {/* Quick Intent Preview & Solver Status Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Intent Dispatch Card */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-white/10 space-y-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2.5">
              <Zap className="h-5 w-5 text-brand-500" />
              <h2 className="text-lg font-bold text-white">Quick Intent Builder</h2>
            </div>
            <span className="text-xs text-gray-400">Auto-routes to lowest slippage</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-300">You Send (Source)</label>
              <div className="p-3.5 rounded-xl glass-input flex items-center justify-between">
                <input
                  type="text"
                  placeholder="1000"
                  defaultValue="1000"
                  className="bg-transparent text-lg font-semibold w-full focus:outline-none text-white"
                />
                <span className="px-2.5 py-1 rounded-lg bg-white/10 text-xs font-bold text-white">
                  USDC (Arbitrum)
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-300">Recipient Receives (Target)</label>
              <div className="p-3.5 rounded-xl glass-input flex items-center justify-between">
                <input
                  type="text"
                  placeholder="~998.40"
                  defaultValue="~998.40"
                  readOnly
                  className="bg-transparent text-lg font-semibold w-full focus:outline-none text-brand-cyan"
                />
                <span className="px-2.5 py-1 rounded-lg bg-white/10 text-xs font-bold text-white">
                  USDT (Polygon)
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Estimated Gas:</span>
              <span className="text-white font-medium">$0.42 (Polygon Subsidized)</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Max Slippage Tolerance:</span>
              <span className="text-emerald-400 font-medium">0.1%</span>
            </div>
          </div>

          <button className="w-full py-3.5 rounded-xl bg-gradient-to-r from-brand-600 via-brand-accent to-brand-cyan hover:from-brand-500 hover:to-brand-accent text-white font-bold text-sm shadow-glow transition-all">
            Simulate & Route Intent
          </button>
        </div>

        {/* Live Solver Status Feed */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-white/10 pb-4">
              <Bot className="h-5 w-5 text-brand-cyan" />
              <h2 className="text-lg font-bold text-white">Agent Monitor</h2>
            </div>

            <div className="mt-4 space-y-3">
              <div className="p-3 rounded-xl glass-card text-xs space-y-1">
                <div className="flex items-center justify-between text-gray-300 font-semibold">
                  <span>Solver Node #01</span>
                  <span className="text-emerald-400">Active</span>
                </div>
                <p className="text-gray-400 text-[11px]">Evaluating Arbitrum -&gt; Polygon Liquidity Pools</p>
              </div>

              <div className="p-3 rounded-xl glass-card text-xs space-y-1">
                <div className="flex items-center justify-between text-gray-300 font-semibold">
                  <span>Solver Node #02</span>
                  <span className="text-emerald-400">Active</span>
                </div>
                <p className="text-gray-400 text-[11px]">Monitoring Gas Spikes on Base</p>
              </div>

              <div className="p-3 rounded-xl glass-card text-xs space-y-1">
                <div className="flex items-center justify-between text-gray-300 font-semibold">
                  <span>Cross-Chain Bridge Engine</span>
                  <span className="text-brand-cyan">Optimized</span>
                </div>
                <p className="text-gray-400 text-[11px]">Stargate / Across Aggregator Ready</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 text-center">
            <span className="text-xs text-gray-400">Phase 1 Monorepo Workspace Initialized</span>
          </div>
        </div>
      </div>
    </div>
  );
}
