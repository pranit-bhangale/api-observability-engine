import React, { useState, useMemo } from 'react';
import type { ObservedEndpoint, TraceRecord } from '../types';

interface DashboardViewProps {
  traces: TraceRecord[];
  endpoints: ObservedEndpoint[];
  onSelectTrace: (trace: TraceRecord) => void;
  onOpenRunner: (endpoint?: ObservedEndpoint) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  traces,
  endpoints,
  onSelectTrace,
  onOpenRunner,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OK' | 'ERROR'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Compute Metrics
  const metrics = useMemo(() => {
    const totalTraces = traces.length;
    const errorTraces = traces.filter((t) => t.status === 'ERROR').length;
    const successTraces = totalTraces - errorTraces;
    const successRate = totalTraces > 0 ? (successTraces / totalTraces) * 100 : 100;

    const durations = traces.map((t) => t.durationMs).sort((a, b) => a - b);
    const avgDuration = totalTraces > 0 ? durations.reduce((a, b) => a + b, 0) / totalTraces : 0;
    const p95Index = Math.floor(durations.length * 0.95);
    const p95Duration = durations.length > 0 ? durations[p95Index] : 0;

    return {
      totalApis: endpoints.length,
      totalTraces,
      successRate: Math.round(successRate * 10) / 10,
      avgDuration: Math.round(avgDuration * 100) / 100,
      p95Duration: Math.round(p95Duration * 100) / 100,
      errorTraces,
    };
  }, [traces, endpoints]);

  // Filter traces
  const filteredTraces = useMemo(() => {
    return traces.filter((t) => {
      const matchesSearch =
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.traceId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
      const matchesCategory = categoryFilter === 'ALL' || t.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [traces, searchTerm, statusFilter, categoryFilter]);

  return (
    <div className="w-full min-h-[calc(100vh-65px)] mt-[65px] p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Banner & Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <span>Observability Dashboard</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Active Engine
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time execution telemetry, discovered Spring Boot endpoints, and automated bottleneck analysis.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onOpenRunner()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs shadow-lg shadow-blue-600/25 transition-all"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="6 3 20 12 6 21 6 3" />
            </svg>
            Launch Endpoint Runner
          </button>
        </div>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Metric 1: Total Registered APIs */}
        <div className="p-5 rounded-2xl bg-[#0f1322]/80 border border-white/[0.08] backdrop-blur-xl shadow-lg relative overflow-hidden group hover:border-cyan-500/30 transition-all">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-2">
            <span>Registered APIs</span>
            <span className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold">
              ⚡
            </span>
          </div>
          <div className="text-3xl font-extrabold text-white font-mono tracking-tight">
            {metrics.totalApis}
          </div>
          <span className="text-[11px] text-cyan-400/80 font-medium block mt-1">
            Discovered via @Observe / @Trace
          </span>
        </div>

        {/* Metric 2: Total Traces */}
        <div className="p-5 rounded-2xl bg-[#0f1322]/80 border border-white/[0.08] backdrop-blur-xl shadow-lg relative overflow-hidden group hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-2">
            <span>Total Traces</span>
            <span className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
              📊
            </span>
          </div>
          <div className="text-3xl font-extrabold text-white font-mono tracking-tight">
            {metrics.totalTraces}
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            In-memory ring buffer (bounded)
          </span>
        </div>

        {/* Metric 3: Success Rate */}
        <div className="p-5 rounded-2xl bg-[#0f1322]/80 border border-white/[0.08] backdrop-blur-xl shadow-lg relative overflow-hidden group hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-2">
            <span>Success Rate</span>
            <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
              ✓
            </span>
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 font-mono tracking-tight">
            {metrics.successRate}%
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            {metrics.errorTraces} failing traces recorded
          </span>
        </div>

        {/* Metric 4: Avg Duration */}
        <div className="p-5 rounded-2xl bg-[#0f1322]/80 border border-white/[0.08] backdrop-blur-xl shadow-lg relative overflow-hidden group hover:border-indigo-500/30 transition-all">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-2">
            <span>Avg Latency</span>
            <span className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
              ⏱
            </span>
          </div>
          <div className="text-3xl font-extrabold text-indigo-300 font-mono tracking-tight">
            {metrics.avgDuration} <span className="text-sm font-sans font-normal text-slate-400">ms</span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            P95: <span className="font-mono text-slate-200">{metrics.p95Duration} ms</span>
          </span>
        </div>

        {/* Metric 5: Authorized Roles */}
        <div className="p-5 rounded-2xl bg-[#0f1322]/80 border border-white/[0.08] backdrop-blur-xl shadow-lg relative overflow-hidden group hover:border-purple-500/30 transition-all">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-2">
            <span>Authorized Roles</span>
            <span className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold">
              🛡️
            </span>
          </div>
          <div className="text-lg font-bold text-purple-300 font-mono tracking-tight truncate">
            ADMIN &amp; DEV
          </div>
          <span className="text-[11px] text-purple-400/80 font-medium block mt-1">
            ADMIN / DEVELOPER
          </span>
        </div>
      </div>

      {/* Discovered Endpoints Quick Strip */}
      <div className="p-5 rounded-2xl bg-[#0f1322]/80 border border-white/[0.08] backdrop-blur-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Discovered Endpoints ({endpoints.length})
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            Click any endpoint to open and test in Endpoint Runner
          </span>
        </div>

        {endpoints.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">
            No endpoints discovered yet. Annotate your controller methods with @Observe or @Trace to register APIs.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {endpoints.map((ep) => (
              <div
                key={ep.id}
                onClick={() => onOpenRunner(ep)}
                className="p-3.5 rounded-xl bg-black/40 border border-white/[0.06] hover:border-cyan-400/50 hover:bg-[#141a2f] cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded uppercase shrink-0 ${
                      ep.method === 'GET'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : ep.method === 'POST'
                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                        : ep.method === 'PUT'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {ep.method}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-mono font-medium text-slate-200 truncate group-hover:text-cyan-300">
                      {ep.path}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {ep.controllerName}.{ep.methodName}()
                    </div>
                  </div>
                </div>
                <span className="text-xs text-slate-500 group-hover:text-cyan-400 font-bold ml-2">
                  Run →
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Captured Traces Table & Filters */}
      <div className="p-6 rounded-2xl bg-[#0f1322]/80 border border-white/[0.08] backdrop-blur-xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Recent Execution Traces</h2>
            <p className="text-xs text-slate-400">Click any trace to launch its interactive graph view.</p>
          </div>

          {/* Search & Filters */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <input
              type="text"
              placeholder="Search traces..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs bg-black/40 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/60 min-w-[180px]"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'OK' | 'ERROR')}
              className="px-3 py-1.5 rounded-lg text-xs bg-black/40 border border-white/10 text-slate-300 focus:outline-none"
            >
              <option value="ALL">All Status</option>
              <option value="OK">Success (OK)</option>
              <option value="ERROR">Errors Only</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs bg-black/40 border border-white/10 text-slate-300 focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              <option value="CONTROLLER">CONTROLLER</option>
              <option value="SERVICE">SERVICE</option>
              <option value="REPOSITORY">REPOSITORY</option>
              <option value="LLM">LLM</option>
            </select>
          </div>
        </div>

        {/* Traces Table */}
        <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#121626]/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-white/[0.06]">
              <tr>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Trace Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Spans</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] font-medium text-slate-300">
              {filteredTraces.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No traces match your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredTraces.map((t) => (
                  <tr
                    key={t.traceId}
                    onClick={() => onSelectTrace(t)}
                    className="hover:bg-white/[0.03] cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          t.status === 'OK'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            t.status === 'OK' ? 'bg-emerald-400' : 'bg-rose-400 animate-pulse'
                          }`}
                        />
                        {t.status === 'OK' ? 'SUCCESS' : 'ERROR'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white group-hover:text-cyan-300 transition-colors">
                        {t.name}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">
                        {t.traceId.substring(0, 16)}...
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-white/[0.05] text-slate-300 border border-white/5">
                        {t.category}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-cyan-400 font-bold">
                          {t.durationMs.toFixed(2)} ms
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-400">
                      {t.spanCount} spans
                      {t.errorCount > 0 && (
                        <span className="text-rose-400 ml-1.5 font-bold">({t.errorCount} err)</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-400 text-[11px]">
                      {t.startLabel || new Date(t.startTime).toLocaleTimeString()}
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTrace(t);
                        }}
                        className="px-3 py-1 rounded-lg text-xs font-semibold bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 transition-all"
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
  );
};
