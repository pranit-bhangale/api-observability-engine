import React, { useState, useMemo } from 'react';
import type { ObservedEndpoint, TraceRecord } from '../types';

interface DashboardViewProps {
  traces: TraceRecord[];
  endpoints: ObservedEndpoint[];
  onSelectTrace: (trace: TraceRecord) => void;
  onOpenRunner: (endpoint?: ObservedEndpoint) => void;
  onNavigateToGraph?: () => void;
  onNavigateToJsonUpload?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  traces,
  endpoints,
  onSelectTrace,
  onOpenRunner,
  onNavigateToGraph,
  onNavigateToJsonUpload,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [traceFilter, setTraceFilter] = useState<'ALL' | 'OK' | 'ERROR' | 'SLOW'>('ALL');

  // Compute Metrics & Layer Distribution
  const { metrics, layerCounts, totalSpans } = useMemo(() => {
    const totalTraces = traces.length;
    let errorTraces = 0;
    let totalSpansCount = 0;
    const layers = { CONTROLLER: 0, SERVICE: 0, REPOSITORY: 0, DATABASE: 0, OTHER: 0 };

    const durations = traces.map((t) => t.durationMs || 0).sort((a, b) => a - b);
    const sumDuration = durations.reduce((a, b) => a + b, 0);
    const avgDuration = totalTraces > 0 ? sumDuration / totalTraces : 0;
    const p95Index = Math.floor(durations.length * 0.95);
    const p95Duration = durations.length > 0 ? durations[p95Index] : 0;

    traces.forEach((t) => {
      if (t.status === 'ERROR' || (t.errorCount || 0) > 0) errorTraces++;
      t.spans?.forEach((s) => {
        totalSpansCount++;
        const cat = (s.category || '').toUpperCase();
        if (cat === 'CONTROLLER') layers.CONTROLLER++;
        else if (cat === 'SERVICE') layers.SERVICE++;
        else if (cat === 'REPOSITORY') layers.REPOSITORY++;
        else if (cat === 'DATABASE' || (s.class || '').toLowerCase().includes('repo')) layers.DATABASE++;
        else layers.OTHER++;
      });
    });

    const successTraces = totalTraces - errorTraces;
    const errorRate = totalTraces > 0 ? ((errorTraces / totalTraces) * 100).toFixed(1) : '0.0';

    return {
      metrics: {
        totalApis: endpoints.length,
        totalTraces,
        errorRate,
        avgDuration: Math.round(avgDuration * 100) / 100,
        p95Duration: Math.round(p95Duration * 100) / 100,
        errorTraces,
        successTraces,
      },
      layerCounts: layers,
      totalSpans: totalSpansCount,
    };
  }, [traces, endpoints]);

  // Filter traces
  const filteredTraces = useMemo(() => {
    return traces.filter((t) => {
      const matchesSearch =
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.traceId.toLowerCase().includes(searchTerm.toLowerCase());

      let matchesFilter = true;
      if (traceFilter === 'OK') matchesFilter = t.status === 'OK' && (t.errorCount || 0) === 0;
      else if (traceFilter === 'ERROR') matchesFilter = t.status === 'ERROR' || (t.errorCount || 0) > 0;
      else if (traceFilter === 'SLOW') matchesFilter = (t.durationMs || 0) >= 50;

      return matchesSearch && matchesFilter;
    });
  }, [traces, searchTerm, traceFilter]);

  return (
    <div className="w-full min-h-[calc(100vh-66px)] mt-[66px] pt-6 sm:pt-8 pb-12 px-3 sm:px-6 max-w-7xl mx-auto space-y-4 select-none">
      
      {/* Top Banner & Quick Actions */}
      <div className="rounded-2xl bg-white border border-[#CBD5E1] p-4 sm:p-5 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-extrabold text-[#263238] tracking-tight">
              Observability Dashboard
            </h1>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Engine Active</span>
            </div>
          </div>
          <p className="text-xs text-[#475569] mt-0.5 leading-relaxed">
            Real-time trace telemetry and discovered Spring Boot REST contracts.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onNavigateToJsonUpload && (
            <button
              onClick={onNavigateToJsonUpload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#475569] bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#CBD5E1] transition-colors"
            >
              <span>📂 Import JSON</span>
            </button>
          )}

          {onNavigateToGraph && (
            <button
              onClick={onNavigateToGraph}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#2563EB] bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] transition-colors"
            >
              <span>⚡ Trace Graph</span>
            </button>
          )}

          <button
            onClick={() => onOpenRunner()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors shadow-sm"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="6 3 20 12 6 21 6 3" />
            </svg>
            Endpoint Runner
          </button>
        </div>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Metric 1: Total Traces */}
        <div className="p-3.5 rounded-xl bg-white border border-[#CBD5E1] shadow-card">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-[#475569] uppercase tracking-wider">
              Total Traces
            </span>
            <span className="w-5 h-5 rounded bg-[#F1F5F9] text-[#263238] flex items-center justify-center text-xs font-bold border border-[#CBD5E1]">
              📊
            </span>
          </div>
          <div className="text-2xl font-extrabold text-[#263238] font-mono tracking-tight">
            {metrics.totalTraces}
          </div>
          <span className="text-[10px] text-[#64748B] block mt-0.5 truncate">
            {totalSpans} spans recorded
          </span>
        </div>

        {/* Metric 2: Avg Latency */}
        <div className="p-3.5 rounded-xl bg-white border border-[#CBD5E1] shadow-card">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-[#475569] uppercase tracking-wider">
              Avg Latency
            </span>
            <span className="w-5 h-5 rounded bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center text-xs font-bold border border-[#BFDBFE]">
              ⏱
            </span>
          </div>
          <div className="text-2xl font-extrabold text-[#2563EB] font-mono tracking-tight">
            {metrics.avgDuration} <span className="text-xs font-normal text-[#64748B]">ms</span>
          </div>
          <span className="text-[10px] text-[#64748B] block mt-0.5 truncate">
            Across all requests
          </span>
        </div>

        {/* Metric 3: P95 Latency */}
        <div className="p-3.5 rounded-xl bg-white border border-[#CBD5E1] shadow-card">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-[#475569] uppercase tracking-wider">
              P95 Latency
            </span>
            <span className="w-5 h-5 rounded bg-[#F1F5F9] text-purple-600 flex items-center justify-center text-xs font-bold border border-purple-200">
              ⚡
            </span>
          </div>
          <div className="text-2xl font-extrabold text-purple-600 font-mono tracking-tight">
            {metrics.p95Duration} <span className="text-xs font-normal text-[#64748B]">ms</span>
          </div>
          <span className="text-[10px] text-[#64748B] block mt-0.5 truncate">
            95th percentile worst case
          </span>
        </div>

        {/* Metric 4: Error Rate */}
        <div className="p-3.5 rounded-xl bg-white border border-[#CBD5E1] shadow-card">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-[#475569] uppercase tracking-wider">
              Error Rate
            </span>
            <span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${
              Number(metrics.errorRate) > 0 ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
            }`}>
              {Number(metrics.errorRate) > 0 ? '⚠️' : '✓'}
            </span>
          </div>
          <div className={`text-2xl font-extrabold font-mono tracking-tight ${
            Number(metrics.errorRate) > 0 ? 'text-rose-600' : 'text-emerald-600'
          }`}>
            {metrics.errorRate}%
          </div>
          <span className="text-[10px] text-[#64748B] block mt-0.5 truncate">
            {metrics.errorTraces} err / {metrics.successTraces} ok
          </span>
        </div>

        {/* Metric 5: Discovered APIs */}
        <div className="col-span-2 lg:col-span-1 p-3.5 rounded-xl bg-white border border-[#CBD5E1] shadow-card">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-[#475569] uppercase tracking-wider">
              Discovered APIs
            </span>
            <span className="w-5 h-5 rounded bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center text-xs font-bold border border-[#BFDBFE]">
              🌐
            </span>
          </div>
          <div className="text-2xl font-extrabold text-[#263238] font-mono tracking-tight">
            {metrics.totalApis}
          </div>
          <span className="text-[10px] text-[#64748B] block mt-0.5 truncate">
            Scanned Spring routes
          </span>
        </div>
      </div>

      {/* Layer Call Stack Distribution Bar */}
      {totalSpans > 0 && (
        <div className="rounded-xl bg-white border border-[#CBD5E1] p-3 shadow-card space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#263238] flex items-center gap-1.5 text-[11px]">
              <span>🥞 Call Stack Distribution by Layer</span>
            </span>
            <span className="font-mono text-[10px] text-[#64748B]">
              {totalSpans} method spans captured
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-[#E2E8F0] overflow-hidden flex">
            {layerCounts.CONTROLLER > 0 && (
              <div
                title={`Controller: ${layerCounts.CONTROLLER} spans`}
                className="h-full bg-[#2563EB] transition-all"
                style={{ width: `${(layerCounts.CONTROLLER / totalSpans) * 100}%` }}
              />
            )}
            {layerCounts.SERVICE > 0 && (
              <div
                title={`Service: ${layerCounts.SERVICE} spans`}
                className="h-full bg-indigo-500 transition-all"
                style={{ width: `${(layerCounts.SERVICE / totalSpans) * 100}%` }}
              />
            )}
            {layerCounts.REPOSITORY > 0 && (
              <div
                title={`Repository: ${layerCounts.REPOSITORY} spans`}
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${(layerCounts.REPOSITORY / totalSpans) * 100}%` }}
              />
            )}
            {layerCounts.DATABASE > 0 && (
              <div
                title={`Database: ${layerCounts.DATABASE} spans`}
                className="h-full bg-amber-500 transition-all"
                style={{ width: `${(layerCounts.DATABASE / totalSpans) * 100}%` }}
              />
            )}
            {layerCounts.OTHER > 0 && (
              <div
                title={`Other: ${layerCounts.OTHER} spans`}
                className="h-full bg-slate-400 transition-all"
                style={{ width: `${(layerCounts.OTHER / totalSpans) * 100}%` }}
              />
            )}
          </div>
          <div className="flex items-center gap-3 text-[10px] text-[#64748B] flex-wrap pt-0.5">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#2563EB]" /> Controller ({layerCounts.CONTROLLER})</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500" /> Service ({layerCounts.SERVICE})</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Repository ({layerCounts.REPOSITORY})</span>
            {layerCounts.DATABASE > 0 && (
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> DB ({layerCounts.DATABASE})</span>
            )}
          </div>
        </div>
      )}

      {/* Two-Column Balanced Layout: Discovered Endpoints (Left 5 cols) & Live Telemetry Traces (Right 7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Left: Discovered Controller Endpoints */}
        <div className="lg:col-span-5 rounded-2xl bg-white border border-[#CBD5E1] shadow-card flex flex-col overflow-hidden">
          <div className="p-3.5 border-b border-[#CBD5E1] bg-[#F8FAFC] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <h2 className="text-xs font-bold text-[#263238] uppercase tracking-wider">
                Discovered Endpoints
              </h2>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
              {endpoints.length} APIs
            </span>
          </div>

          <div className="p-2 flex-1 overflow-y-auto max-h-[360px] space-y-1.5 divide-y divide-[#F1F5F9]">
            {endpoints.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#64748B]">
                No <code>@Observe</code> controller endpoints discovered yet.
              </div>
            ) : (
              endpoints.map((ep) => (
                <div
                  key={ep.id}
                  onClick={() => onOpenRunner(ep)}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[#F8FAFC] transition-all cursor-pointer group pt-2"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold font-mono border ${
                          ep.method === 'GET'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : ep.method === 'POST'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : ep.method === 'PUT'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : ep.method === 'PATCH'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {ep.method}
                      </span>
                      <span className="font-mono text-xs font-bold text-[#263238] group-hover:text-[#2563EB] truncate transition-colors">
                        {ep.path}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#64748B] mt-0.5 truncate pl-0.5">
                      {ep.controllerName}.{ep.methodName}()
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenRunner(ep);
                    }}
                    className="btn-run px-3 py-1 rounded-md text-xs font-bold transition-all shrink-0 flex items-center gap-1 shadow-sm"
                    title="Test / Execute this endpoint"
                  >
                    <span>Run</span>
                    <span className="text-[10px]">→</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Live Recent Traces Stream */}
        <div className="lg:col-span-7 rounded-2xl bg-white border border-[#CBD5E1] shadow-card flex flex-col overflow-hidden">
          <div className="p-3.5 border-b border-[#CBD5E1] bg-[#F8FAFC] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
              <h2 className="text-xs font-bold text-[#263238] uppercase tracking-wider">
                Live Telemetry Stream
              </h2>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-[#F1F5F9] p-0.5 rounded-lg text-xs">
              {(['ALL', 'OK', 'ERROR', 'SLOW'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTraceFilter(filter)}
                  className={`px-2 py-0.5 rounded-md font-bold text-[10px] transition-all ${
                    traceFilter === filter
                      ? 'bg-white text-[#2563EB] shadow-xs'
                      : 'text-[#64748B] hover:text-[#263238]'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Search Bar */}
          <div className="p-2 border-b border-[#CBD5E1] bg-white">
            <input
              type="text"
              placeholder="Search traces by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-1 rounded-lg text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#263238] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] transition-colors"
            />
          </div>

          {/* Stream List */}
          <div className="p-2 flex-1 overflow-y-auto max-h-[310px] space-y-1 divide-y divide-[#F1F5F9]">
            {filteredTraces.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#64748B]">
                No traces match your filter criteria.
              </div>
            ) : (
              filteredTraces.map((t) => (
                <div
                  key={t.traceId}
                  onClick={() => onSelectTrace(t)}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-[#F8FAFC] transition-colors cursor-pointer group"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                          t.status === 'OK'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        <span className={`w-1 h-1 rounded-full ${t.status === 'OK' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {t.status === 'OK' ? 'OK' : 'ERR'}
                      </span>
                      <span className="font-bold text-xs text-[#263238] group-hover:text-[#2563EB] truncate transition-colors">
                        {t.name}
                      </span>
                      <span className="text-[9px] font-mono text-[#64748B] hidden sm:inline">
                        {t.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-[#64748B] font-mono mt-0.5">
                      <span>{t.spanCount} spans</span>
                      <span>•</span>
                      <span>{t.startLabel || new Date(t.startTime).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="font-mono text-xs font-bold text-[#2563EB]">
                      {t.durationMs.toFixed(1)} ms
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTrace(t);
                      }}
                      className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-xs transition-colors"
                    >
                      Graph →
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
};
