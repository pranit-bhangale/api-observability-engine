import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { GraphLayout, GraphMode, Span, TraceRecord } from '../types';

interface GraphViewProps {
  trace: TraceRecord | null;
  traces: TraceRecord[];
  onSelectTrace: (trace: TraceRecord) => void;
  onBackToDashboard: () => void;
}

export const GraphView: React.FC<GraphViewProps> = ({
  trace,
  traces,
  onSelectTrace,
  onBackToDashboard,
}) => {
  const [layout, setLayout] = useState<GraphLayout>('horizontal');
  const [mode, setMode] = useState<GraphMode>('graph');
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);
  const [highlightBottleneck, setHighlightBottleneck] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [copiedStack, setCopiedStack] = useState<boolean>(false);

  // Zoom & Pan state
  const [scale, setScale] = useState<number>(0.75);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 60, y: 140 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-select root span on trace change
  useEffect(() => {
    if (trace && trace.spans.length > 0) {
      setSelectedSpan(trace.spans[0]);
    } else {
      setSelectedSpan(null);
    }
  }, [trace]);

  // Identify the bottleneck span (longest duration child span or root if single)
  const bottleneckSpanId = useMemo(() => {
    if (!trace || trace.spans.length === 0) return null;
    let maxSpan = trace.spans[0];
    for (const s of trace.spans) {
      if (s.durationMs > maxSpan.durationMs) {
        maxSpan = s;
      }
    }
    return maxSpan.spanId;
  }, [trace]);

  // Calculate Node Layout Coordinates
  const nodePositions = useMemo(() => {
    if (!trace || trace.spans.length === 0) return new Map<string, { x: number; y: number; w: number; h: number }>();
    const positions = new Map<string, { x: number; y: number; w: number; h: number }>();

    const nodeWidth = 230;
    const nodeHeight = 78;
    const spacingX = 55;
    const spacingY = 50;

    if (layout === 'horizontal') {
      // Horizontal sequential / tree layout
      trace.spans.forEach((span, idx) => {
        const x = idx * (nodeWidth + spacingX);
        // Slight vertical offset for child depths
        const y = span.depth * 30;
        positions.set(span.spanId, { x, y, w: nodeWidth, h: nodeHeight });
      });
    } else {
      // Vertical hierarchical layout
      const levelCounts = new Map<number, number>();
      trace.spans.forEach((span) => {
        const currentCount = levelCounts.get(span.depth) || 0;
        const x = currentCount * (nodeWidth + spacingX);
        const y = span.depth * (nodeHeight + spacingY);
        positions.set(span.spanId, { x, y, w: nodeWidth, h: nodeHeight });
        levelCounts.set(span.depth, currentCount + 1);
      });
    }

    return positions;
  }, [trace, layout]);

  // Copy Trace ID
  const handleCopyTraceId = () => {
    if (!trace) return;
    navigator.clipboard.writeText(trace.traceId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Copy Stack Trace
  const handleCopyStackTrace = (stack: string) => {
    navigator.clipboard.writeText(stack);
    setCopiedStack(true);
    setTimeout(() => setCopiedStack(false), 2000);
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setScale((prev) => Math.min(Math.max(prev * zoomFactor, 0.2), 2.5));
  };

  // Pan controls
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // only left click
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleFit = () => {
    setScale(0.65);
    setPan({ x: 50, y: 150 });
  };

  const handleResetZoom = () => {
    setScale(1.0);
    setPan({ x: 80, y: 120 });
  };

  if (!trace) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-white/10 flex items-center justify-center mb-4 text-slate-400">
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">No Trace Selected</h3>
        <p className="text-sm text-slate-400 max-w-md mb-6">
          Execute an API request in the Endpoint Runner, select a captured trace from the Dashboard, or upload JSON to visualize its execution graph.
        </p>
        <button
          onClick={onBackToDashboard}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all shadow-lg shadow-blue-600/30"
        >
          View Dashboard Traces
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col w-full h-[calc(100vh-65px)] mt-[65px] bg-[#07080d] select-none overflow-hidden">
      {/* Top Header Bar (Matching Image 1) */}
      <div className="flex items-center justify-between px-6 py-3 bg-[#0a0d18]/90 border-b border-white/[0.08] backdrop-blur-xl z-20">
        <div className="flex items-center gap-3.5 flex-wrap">
          {/* Traces selector pill */}
          <div className="relative">
            <select
              value={trace.traceId}
              onChange={(e) => {
                const found = traces.find((t) => t.traceId === e.target.value);
                if (found) onSelectTrace(found);
              }}
              className="appearance-none pl-3.5 pr-8 py-1 rounded-full text-xs font-semibold bg-[#141829] text-white border border-white/15 hover:border-white/30 cursor-pointer transition-all shadow-sm"
            >
              {traces.map((t, idx) => (
                <option key={t.traceId} value={t.traceId}>
                  Traces {idx + 1}: {t.name}
                </option>
              ))}
            </select>
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▼</span>
          </div>

          {/* Status Badge */}
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase border ${
              trace.status === 'OK'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                : 'bg-rose-500/15 text-rose-400 border-rose-500/40 shadow-[0_0_12px_rgba(239,68,68,0.25)]'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${trace.status === 'OK' ? 'bg-emerald-400' : 'bg-rose-400 animate-pulse'}`} />
            {trace.status === 'OK' ? 'SUCCESS' : 'ERROR'}
          </div>

          {/* Trace Name */}
          <h2 className="text-[15px] font-bold text-white tracking-tight flex items-center gap-2">
            {trace.name}
          </h2>

          {/* Timing & Spans */}
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1 text-cyan-400 font-semibold">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {trace.durationMs.toFixed(2)} ms
            </span>
            <span>•</span>
            <span>{trace.spanCount} spans</span>
            {trace.errorCount > 0 && (
              <>
                <span>•</span>
                <span className="text-rose-400 font-semibold">{trace.errorCount} error</span>
              </>
            )}
          </div>

          {/* Trace ID with 1-click copy */}
          <button
            onClick={handleCopyTraceId}
            title="Click to copy Trace ID"
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-mono bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] border border-white/10 transition-colors"
          >
            <span>ID: {trace.traceId.substring(0, 10)}...</span>
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
            {copiedId && <span className="text-emerald-400 text-[10px] ml-1">Copied!</span>}
          </button>
        </div>

        {/* View Mode & Layout Buttons (Image 1 style) */}
        <div className="flex items-center gap-2">
          {/* Horizontal / Vertical layout toggle */}
          <div className="flex items-center p-0.5 rounded-lg bg-[#121626] border border-white/10 text-xs">
            <button
              onClick={() => setLayout('horizontal')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                layout === 'horizontal' ? 'bg-blue-600 text-white font-medium shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              title="Horizontal pipeline view"
            >
              <span>Horizontal ⇆</span>
            </button>
            <button
              onClick={() => setLayout('vertical')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                layout === 'vertical' ? 'bg-blue-600 text-white font-medium shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              title="Vertical tree view"
            >
              <span>Vertical ⇅</span>
            </button>
          </div>

          {/* Mode switch */}
          <div className="flex items-center p-0.5 rounded-lg bg-[#121626] border border-white/10 text-xs">
            <button
              onClick={() => setMode('graph')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${
                mode === 'graph' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="6" cy="6" r="3" />
                <circle cx="18" cy="18" r="3" />
                <path d="M8.5 8.5l7 7" />
              </svg>
              Graph
            </button>

            <button
              onClick={() => setMode('node-json')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${
                mode === 'node-json' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Node ↔ JSON
            </button>

            <button
              onClick={() => setMode('json')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${
                mode === 'json' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              JSON
            </button>
          </div>
        </div>
      </div>

      {/* Floating Canvas Controls (Image 1 top-left floating pill) */}
      {mode !== 'json' && (
        <div className="absolute top-16 left-6 z-30 flex items-center gap-2 p-1.5 rounded-xl bg-[#0e1220]/90 border border-white/15 backdrop-blur-xl shadow-2xl">
          {/* Zoom Out */}
          <button
            onClick={() => setScale((prev) => Math.max(prev - 0.1, 0.2))}
            className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-slate-300 flex items-center justify-center text-sm font-bold"
            title="Zoom Out"
          >
            −
          </button>
          <span className="text-xs font-mono text-slate-200 min-w-[42px] text-center font-medium">
            {Math.round(scale * 100)}%
          </span>
          {/* Zoom In */}
          <button
            onClick={() => setScale((prev) => Math.min(prev + 0.1, 2.5))}
            className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-slate-300 flex items-center justify-center text-sm font-bold"
            title="Zoom In"
          >
            +
          </button>

          <div className="w-[1px] h-4 bg-white/10 mx-0.5" />

          {/* Fit */}
          <button
            onClick={handleFit}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.08]"
            title="Fit graph to view"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
            Fit
          </button>

          {/* 100% Reset */}
          <button
            onClick={handleResetZoom}
            className="px-2 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.08]"
            title="Reset to 100%"
          >
            100%
          </button>

          <div className="w-[1px] h-4 bg-white/10 mx-0.5" />

          {/* Bottleneck Highlighter Button */}
          <button
            onClick={() => setHighlightBottleneck((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              highlightBottleneck
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/30'
                : 'bg-white/[0.04] text-amber-400 hover:bg-white/[0.08]'
            }`}
          >
            <span>🔥</span>
            Bottleneck
          </button>
        </div>
      )}

      {/* Main Canvas Area */}
      <div className="relative flex-1 w-full h-full overflow-hidden flex">
        {mode === 'json' ? (
          // Full Raw JSON View
          <div className="w-full h-full p-6 overflow-auto bg-[#070911]">
            <div className="max-w-5xl mx-auto rounded-2xl bg-[#0c0f1d] border border-white/10 p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono text-cyan-400 font-semibold">Raw TraceRecord JSON</span>
                <button
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(trace, null, 2))}
                  className="px-3 py-1 rounded-md text-xs bg-white/10 hover:bg-white/20 text-white font-medium"
                >
                  Copy JSON
                </button>
              </div>
              <pre className="text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
                {JSON.stringify(trace, null, 2)}
              </pre>
            </div>
          </div>
        ) : (
          // Interactive Graph Workspace
          <div
            ref={containerRef}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="relative flex-1 w-full h-full cursor-grab active:cursor-grabbing overflow-hidden dot-grid-bg"
          >
            {/* SVG Canvas for Connectors and Nodes */}
            <div
              className="absolute transform-gpu transition-transform duration-75 origin-top-left"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              }}
            >
              {/* Connecting Lines SVG */}
              <svg className="absolute top-0 left-0 w-[5000px] h-[5000px] pointer-events-none overflow-visible">
                <defs>
                  <linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.8" />
                  </linearGradient>
                  <linearGradient id="line-gradient-bottleneck" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity="0.9" />
                  </linearGradient>
                </defs>

                {trace.spans.map((span) => {
                  if (!span.parentSpanId) return null;
                  const parentPos = nodePositions.get(span.parentSpanId);
                  const childPos = nodePositions.get(span.spanId);
                  if (!parentPos || !childPos) return null;

                  const isBottleneck = highlightBottleneck && span.spanId === bottleneckSpanId;

                  let pathD = '';
                  if (layout === 'horizontal') {
                    // Connect from right of parent to left of child
                    const startX = parentPos.x + parentPos.w;
                    const startY = parentPos.y + parentPos.h / 2;
                    const endX = childPos.x;
                    const endY = childPos.y + childPos.h / 2;
                    const controlX = (startX + endX) / 2;
                    pathD = `M ${startX} ${startY} C ${controlX} ${startY}, ${controlX} ${endY}, ${endX} ${endY}`;
                  } else {
                    // Connect from bottom of parent to top of child
                    const startX = parentPos.x + parentPos.w / 2;
                    const startY = parentPos.y + parentPos.h;
                    const endX = childPos.x + childPos.w / 2;
                    const endY = childPos.y;
                    const controlY = (startY + endY) / 2;
                    pathD = `M ${startX} ${startY} C ${startX} ${controlY}, ${endX} ${controlY}, ${endX} ${endY}`;
                  }

                  return (
                    <g key={`edge-${span.spanId}`}>
                      {/* Glow halo */}
                      <path
                        d={pathD}
                        fill="none"
                        stroke={isBottleneck ? '#f59e0b' : '#3b82f6'}
                        strokeWidth={isBottleneck ? 4 : 2}
                        strokeOpacity={isBottleneck ? 0.4 : 0.2}
                      />
                      {/* Core stroke */}
                      <path
                        d={pathD}
                        fill="none"
                        stroke={isBottleneck ? 'url(#line-gradient-bottleneck)' : 'url(#line-gradient)'}
                        strokeWidth={isBottleneck ? 2.5 : 1.8}
                        strokeDasharray={span.status === 'ERROR' ? '4 4' : 'none'}
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Render Nodes (Circular / Capsule Form) */}
              {trace.spans.map((span) => {
                const pos = nodePositions.get(span.spanId);
                if (!pos) return null;

                const isSelected = selectedSpan?.spanId === span.spanId;
                const isBottleneck = highlightBottleneck && span.spanId === bottleneckSpanId;
                const isError = span.status === 'ERROR';

                // Percentage bar calculation relative to trace
                const barWidthPct = Math.max(5, Math.min(100, (span.durationMs / trace.durationMs) * 100));

                return (
                  <div
                    key={span.spanId}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSpan(span);
                    }}
                    style={{
                      transform: `translate(${pos.x}px, ${pos.y}px)`,
                      width: `${pos.w}px`,
                      height: `${pos.h}px`,
                    }}
                    className={`absolute rounded-xl transition-all duration-150 cursor-pointer p-2.5 flex flex-col justify-between backdrop-blur-md ${
                      isSelected
                        ? 'bg-[#181e35] border-2 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.45)] ring-2 ring-cyan-400/30'
                        : isBottleneck
                        ? 'bg-[#1c1813] border-2 border-amber-400 shadow-[0_0_22px_rgba(245,158,11,0.5)] ring-2 ring-amber-400/20'
                        : isError
                        ? 'bg-[#1c1015] border border-rose-500/80 shadow-[0_0_16px_rgba(239,68,68,0.35)]'
                        : 'bg-[#0f1322]/95 border border-white/[0.12] hover:border-cyan-400/60 hover:bg-[#141a2e]'
                    }`}
                  >
                    {/* Node Header */}
                    <div className="flex items-center justify-between gap-1.5">
                      {/* Left: Category capsule */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        {/* Circular status indicator */}
                        <div
                          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black shrink-0 ${
                            isError
                              ? 'bg-rose-500 text-white animate-pulse'
                              : isBottleneck
                              ? 'bg-amber-400 text-black'
                              : 'bg-gradient-to-tr from-blue-500 to-cyan-400 text-black'
                          }`}
                        >
                          {isBottleneck ? '🔥' : isError ? '!' : '✓'}
                        </div>

                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                            span.category === 'CONTROLLER'
                              ? 'bg-cyan-500/15 text-cyan-300'
                              : span.category === 'LLM'
                              ? 'bg-purple-500/15 text-purple-300'
                              : span.category === 'REPOSITORY'
                              ? 'bg-indigo-500/15 text-indigo-300'
                              : 'bg-blue-500/15 text-blue-300'
                          }`}
                        >
                          {span.category}
                        </span>
                      </div>

                      {/* Right: Duration pill */}
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          isBottleneck
                            ? 'bg-amber-400/20 text-amber-300 font-extrabold'
                            : isError
                            ? 'bg-rose-400/20 text-rose-300'
                            : 'text-slate-300'
                        }`}
                      >
                        {span.durationMs.toFixed(2)} ms
                      </span>
                    </div>

                    {/* Node Title (Span Name / Method) */}
                    <div className="text-xs font-semibold text-white tracking-tight truncate my-1" title={span.name}>
                      {span.name}
                    </div>

                    {/* Duration Progress Bar (Image 1 style) */}
                    <div className="w-full">
                      <div className="w-full h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                        <div
                          style={{ width: `${barWidthPct}%` }}
                          className={`h-full rounded-full transition-all duration-300 ${
                            isBottleneck
                              ? 'bg-gradient-to-r from-amber-400 to-orange-500 shadow-[0_0_8px_#f59e0b]'
                              : isError
                              ? 'bg-rose-500 shadow-[0_0_8px_#ef4444]'
                              : 'bg-gradient-to-r from-blue-500 to-cyan-400 shadow-[0_0_8px_#06b6d4]'
                          }`}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[9px] font-mono text-slate-400 mt-1">
                        <span>+{span.offsetMs.toFixed(1)}ms</span>
                        <span>{barWidthPct.toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Minimap (Image 1 bottom-right floating card) */}
            <div className="absolute bottom-5 right-5 z-30 w-48 h-28 rounded-xl bg-[#0c0f1c]/90 border border-white/15 backdrop-blur-xl p-2.5 shadow-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                <span>Minimap</span>
                <span className="text-cyan-400 font-mono">{trace.spans.length} nodes</span>
              </div>

              {/* Minimap Visualizer */}
              <div className="relative w-full h-16 rounded-lg bg-black/40 border border-white/[0.05] p-1 flex items-center justify-center overflow-hidden">
                <div className="flex items-center gap-1 overflow-hidden px-1">
                  {trace.spans.map((s) => {
                    const isSelected = selectedSpan?.spanId === s.spanId;
                    const isBottleneck = highlightBottleneck && s.spanId === bottleneckSpanId;
                    return (
                      <div
                        key={`mini-${s.spanId}`}
                        onClick={() => setSelectedSpan(s)}
                        className={`w-2.5 h-2.5 rounded-full cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-cyan-400 ring-2 ring-cyan-300 scale-125'
                            : isBottleneck
                            ? 'bg-amber-400 ring-1 ring-amber-300'
                            : s.status === 'ERROR'
                            ? 'bg-rose-500'
                            : 'bg-slate-600 hover:bg-slate-400'
                        }`}
                        title={s.name}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Node Detail Drawer / Inspection Panel */}
        {selectedSpan && mode !== 'json' && (
          <aside className="w-[420px] h-full bg-[#0a0d1a]/95 border-l border-white/[0.1] backdrop-blur-2xl z-20 flex flex-col shadow-2xl overflow-y-auto">
            {/* Drawer Header */}
            <div className="sticky top-0 bg-[#0c1020]/95 backdrop-blur-md p-4 border-b border-white/10 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    selectedSpan.status === 'OK' ? 'bg-emerald-400' : 'bg-rose-400 animate-pulse'
                  }`}
                />
                <h3 className="text-sm font-bold text-white tracking-tight truncate max-w-[280px]">
                  {selectedSpan.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSpan(null)}
                className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Highlight if Bottleneck */}
              {highlightBottleneck && selectedSpan.spanId === bottleneckSpanId && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs">
                  <span className="text-base">🔥</span>
                  <div>
                    <span className="font-bold">Execution Bottleneck:</span> This span consumed{' '}
                    <span className="font-mono font-bold text-amber-200">{selectedSpan.durationMs.toFixed(2)} ms</span> (
                    {((selectedSpan.durationMs / trace.durationMs) * 100).toFixed(1)}% of total trace time).
                  </div>
                </div>
              )}

              {/* Error Alert Card (Displaying error, errorMessage, errorDetail) */}
              {selectedSpan.status === 'ERROR' && (
                <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
                    <span>⚠️ Execution Error</span>
                  </div>

                  {selectedSpan.error && (
                    <div className="text-xs text-rose-200 font-mono bg-rose-950/40 p-2 rounded-lg border border-rose-500/20 break-words">
                      {selectedSpan.error}
                    </div>
                  )}

                  {selectedSpan.errorMessage && (
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 block mb-1">Error Message:</span>
                      <div className="text-xs text-rose-300 font-medium bg-black/30 p-2 rounded-lg">
                        {selectedSpan.errorMessage}
                      </div>
                    </div>
                  )}

                  {selectedSpan.errorDetail && (
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1">
                        <span>Stack Trace (errorDetail):</span>
                        <button
                          onClick={() => handleCopyStackTrace(selectedSpan.errorDetail!)}
                          className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1"
                        >
                          {copiedStack ? '✓ Copied' : 'Copy Stack'}
                        </button>
                      </div>
                      <pre className="text-[10px] font-mono text-slate-300 bg-black/60 p-2.5 rounded-lg border border-white/5 overflow-x-auto max-h-48 leading-relaxed">
                        {selectedSpan.errorDetail}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Execution Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-[10px] text-slate-400 block mb-0.5">Duration</span>
                  <span className="font-mono font-bold text-cyan-400 text-sm">
                    {selectedSpan.durationMs.toFixed(2)} ms
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-[10px] text-slate-400 block mb-0.5">Timeline Offset</span>
                  <span className="font-mono font-bold text-slate-200 text-sm">
                    +{selectedSpan.offsetMs.toFixed(2)} ms
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-[10px] text-slate-400 block mb-0.5">Category</span>
                  <span className="font-semibold text-indigo-300">{selectedSpan.category}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-[10px] text-slate-400 block mb-0.5">Nesting Depth</span>
                  <span className="font-mono font-bold text-slate-200">Level {selectedSpan.depth}</span>
                </div>
              </div>

              {/* Metadata Details */}
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-[10px] text-slate-400 block mb-1">Target Class</span>
                  <code className="font-mono text-[11px] text-slate-300 break-all">{selectedSpan.class}</code>
                </div>

                <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-[10px] text-slate-400 block mb-1">Target Method</span>
                  <code className="font-mono text-[11px] text-cyan-300">{selectedSpan.method}()</code>
                </div>

                <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-[10px] text-slate-400 block mb-1">Execution Thread</span>
                  <code className="font-mono text-[11px] text-slate-300">{selectedSpan.thread}</code>
                </div>
              </div>

              {/* Input Arguments (with Masking) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>Input Arguments (inputArgs)</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {selectedSpan.inputArgs?.length || 0} args
                  </span>
                </div>
                {selectedSpan.inputArgs && selectedSpan.inputArgs.length > 0 ? (
                  <div className="space-y-2">
                    {selectedSpan.inputArgs.map((arg, idx) => (
                      <div key={idx} className="p-2 rounded-lg bg-black/40 border border-white/[0.06] text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-cyan-300 font-medium">{arg.name}</span>
                          {arg.sensitive && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold uppercase">
                              Masked
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono block mb-1">{arg.type}</span>
                        <pre className="text-[11px] font-mono text-slate-200 overflow-x-auto p-1.5 bg-black/30 rounded">
                          {typeof arg.value === 'object' ? JSON.stringify(arg.value, null, 2) : String(arg.value)}
                        </pre>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] text-xs text-slate-500 italic">
                    No input arguments captured
                  </div>
                )}
              </div>

              {/* Output Result */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>Return Result (outputArgs)</span>
                </div>
                {selectedSpan.outputArgs ? (
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06] text-xs">
                    <span className="text-[10px] text-slate-400 font-mono block mb-1">
                      {selectedSpan.outputArgs.type}
                    </span>
                    <pre className="text-[11px] font-mono text-slate-200 overflow-x-auto p-1.5 bg-black/30 rounded">
                      {typeof selectedSpan.outputArgs.value === 'object'
                        ? JSON.stringify(selectedSpan.outputArgs.value, null, 2)
                        : String(selectedSpan.outputArgs.value)}
                    </pre>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] text-xs text-slate-500 italic">
                    No return value captured
                  </div>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
