import React, { useMemo } from 'react';
import type { TraceRecord } from '../types';

interface AnalyticsViewProps {
  traces: TraceRecord[];
  onSelectTrace: (trace: TraceRecord) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ traces, onSelectTrace }) => {
  const stats = useMemo(() => {
    if (traces.length === 0) {
      return {
        total: 0,
        avgLatency: 0,
        successRate: 100,
        errors: 0,
        p50: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        byCategory: {} as Record<string, number>,
        slowest: [] as TraceRecord[],
        totalSpans: 0,
      };
    }

    const total = traces.length;
    let errorCount = 0;
    let sumDuration = 0;
    let totalSpans = 0;
    const durations = traces.map((t) => t.durationMs || 0).sort((a, b) => a - b);
    const byCategory: Record<string, number> = {};

    traces.forEach((t) => {
      sumDuration += t.durationMs || 0;
      totalSpans += t.spanCount || 0;
      if (t.status !== 'OK' || (t.errorCount || 0) > 0) errorCount++;
      const cat = t.category || 'CONTROLLER';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    });

    const avgLatency = sumDuration / total;
    const successRate = ((total - errorCount) / total) * 100;
    const p50 = durations[Math.floor(durations.length * 0.5)] || 0;
    const p90 = durations[Math.floor(durations.length * 0.9)] || 0;
    const p95 = durations[Math.floor(durations.length * 0.95)] || 0;
    const p99 = durations[Math.floor(durations.length * 0.99)] || durations[durations.length - 1] || 0;

    const slowest = [...traces]
      .sort((a, b) => (b.durationMs || 0) - (a.durationMs || 0))
      .slice(0, 5);

    return {
      total,
      avgLatency,
      successRate,
      errors: errorCount,
      p50,
      p90,
      p95,
      p99,
      byCategory,
      slowest,
      totalSpans,
    };
  }, [traces]);

  return (
    <div className="w-full min-h-[calc(100vh-66px)] mt-[66px] pt-6 sm:pt-8 pb-12 px-3 sm:px-6 max-w-7xl mx-auto space-y-4 select-none">
      {/* Top Banner */}
      <div className="rounded-2xl bg-white border border-[#CBD5E1] p-4 sm:p-5 shadow-card flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB] shadow-xs">
            <svg className="w-5 h-5 text-[#2563EB]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold text-[#263238] tracking-tight">
                Observability Analytics &amp; Percentiles
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
                {stats.total} Traces
              </span>
            </div>
            <p className="text-xs text-[#475569] mt-0.5 leading-relaxed">
              Statistical latency distributions, bottleneck percentiles, and execution layer breakdown.
            </p>
          </div>
        </div>
      </div>

      {/* Latency Percentile Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-white border border-[#CBD5E1] shadow-card">
          <div className="flex items-center justify-between text-[10px] font-bold text-[#475569] uppercase tracking-wider mb-1">
            <span>Average Latency</span>
            <span className="text-[#2563EB]">⏱</span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#2563EB] font-mono tracking-tight">
            {stats.avgLatency.toFixed(2)} <span className="text-xs font-normal text-[#64748B]">ms</span>
          </div>
          <span className="text-[11px] text-[#64748B] block mt-1">Mean duration across all calls</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#CBD5E1] shadow-card">
          <div className="flex items-center justify-between text-[10px] font-bold text-[#475569] uppercase tracking-wider mb-1">
            <span>P50 (Median)</span>
            <span className="text-slate-500">🎯</span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#263238] font-mono tracking-tight">
            {stats.p50.toFixed(2)} <span className="text-xs font-normal text-[#64748B]">ms</span>
          </div>
          <span className="text-[11px] text-[#64748B] block mt-1">50% of requests complete within</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#CBD5E1] shadow-card">
          <div className="flex items-center justify-between text-[10px] font-bold text-[#475569] uppercase tracking-wider mb-1">
            <span>P90 Percentile</span>
            <span className="text-amber-500">⚡</span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#263238] font-mono tracking-tight">
            {stats.p90.toFixed(2)} <span className="text-xs font-normal text-[#64748B]">ms</span>
          </div>
          <span className="text-[11px] text-[#64748B] block mt-1">90% of requests complete within</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#CBD5E1] shadow-card">
          <div className="flex items-center justify-between text-[10px] font-bold text-[#475569] uppercase tracking-wider mb-1">
            <span>P99 Worst Case</span>
            <span className="text-rose-500">🔥</span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-rose-600 font-mono tracking-tight">
            {stats.p99.toFixed(2)} <span className="text-xs font-normal text-[#64748B]">ms</span>
          </div>
          <span className="text-[11px] text-[#64748B] block mt-1">99th percentile tail latency</span>
        </div>
      </div>

      {/* Layer Breakdown & Slowest Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Layer Distribution */}
        <div className="lg:col-span-5 p-4 sm:p-5 rounded-2xl bg-white border border-[#CBD5E1] shadow-card space-y-3">
          <h2 className="text-xs font-bold text-[#263238] uppercase tracking-wider">
            Calls by Architectural Layer
          </h2>
          <div className="space-y-2.5">
            {Object.entries(stats.byCategory).map(([cat, count]) => {
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#263238]">{cat}</span>
                    <span className="font-mono text-[#64748B] text-[11px] font-semibold">
                      {count} traces ({pct.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#E2E8F0] overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full rounded-full transition-all duration-300 ${
                        cat === 'CONTROLLER'
                          ? 'bg-[#2563EB]'
                          : cat === 'SERVICE'
                          ? 'bg-indigo-500'
                          : cat === 'REPOSITORY'
                          ? 'bg-emerald-500'
                          : 'bg-purple-500'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Slowest Operations Ranking */}
        <div className="lg:col-span-7 p-4 sm:p-5 rounded-2xl bg-white border border-[#CBD5E1] shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#263238] uppercase tracking-wider">
              Slowest Operations Ranking
            </h2>
            <span className="text-[11px] text-[#64748B]">Click to inspect graph</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#CBD5E1]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] text-[10px] font-bold text-[#475569] uppercase border-b border-[#CBD5E1]">
                <tr>
                  <th className="py-2 px-3">Operation</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3">Duration</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] font-medium text-[#263238]">
                {stats.slowest.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-[#64748B]">
                      No traces recorded yet.
                    </td>
                  </tr>
                ) : (
                  stats.slowest.map((t) => (
                    <tr
                      key={t.traceId}
                      onClick={() => onSelectTrace(t)}
                      className="hover:bg-[#F8FAFC] cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-[#263238] truncate">{t.name}</div>
                        <div className="text-[10px] font-mono text-[#64748B]">{t.traceId.substring(0, 14)}...</div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1]">
                          {t.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-[#2563EB]">
                        {t.durationMs.toFixed(2)} ms
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTrace(t);
                          }}
                          className="px-2.5 py-1 rounded-md text-xs font-bold bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-xs transition-colors"
                        >
                          View Graph →
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
