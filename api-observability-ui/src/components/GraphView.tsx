import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { GraphMode, Span, TraceRecord } from '../types';
import { calculateGraphLayout } from '../utils/graphLayout';

interface GraphViewProps {
  trace: TraceRecord | null;
  traces: TraceRecord[];
  onSelectTrace: (trace: TraceRecord) => void;
  onBackToDashboard: () => void;
}

// Line-Numbered Code Viewer for the White Theme with NO overlapping Copy button
interface CodeViewerProps {
  jsonString: string;
  title?: string;
  badge?: string;
}

const CodeViewer: React.FC<CodeViewerProps> = ({ jsonString, title, badge }) => {
  const [copied, setCopied] = useState(false);
  const lines = jsonString.split('\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col w-full h-full rounded-xl border border-[#CBD5E1] bg-white overflow-hidden shadow-xs">
      {/* Dedicated Top Toolbar with Header & Copy Button (Zero Overlap on Code Text) */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-[#CBD5E1] bg-[#F1F5F9] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-[#263238]">{title || 'JSON Schema'}</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono text-[#64748B] bg-white border border-[#CBD5E1]">
            {lines.length} lines
          </span>
          {badge && (
            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
              {badge}
            </span>
          )}
        </div>

        <button
          onClick={handleCopy}
          className="btn-run px-3 py-1 rounded-md text-[11px] font-bold text-white shadow-xs flex items-center gap-1 cursor-pointer transition-all"
          title="Copy code to clipboard"
        >
          <span>{copied ? '✓ Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* Code Container with Line Numbers in Left Gutter */}
      <div className="relative flex-1 flex overflow-auto font-mono text-xs leading-relaxed bg-[#F8FAFC]">
        {/* Line Numbers Gutter */}
        <div
          className="flex flex-col select-none border-r border-[#CBD5E1] bg-[#F1F5F9] px-2.5 py-3 text-right text-[#94A3B8] font-mono text-[11px] min-w-[42px] shrink-0"
          aria-hidden="true"
        >
          {lines.map((_, i) => (
            <div key={i} className="leading-5">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Code Pre Area: Cleanly starts at Line 1 without any overlapping element */}
        <div className="relative flex-1 overflow-auto p-3 text-[#1E293B]">
          <pre className="font-mono text-xs leading-5 whitespace-pre selection:bg-[#BFDBFE]">
            <code>{jsonString}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

export const GraphView: React.FC<GraphViewProps> = ({
  trace,
  traces,
  onSelectTrace,
  onBackToDashboard,
}) => {
  const [layoutMode, setLayoutMode] = useState<'horizontal' | 'vertical' | 'pipeline'>('horizontal');
  const [mode, setMode] = useState<GraphMode>('graph');
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);
  const [highlightBottleneck, setHighlightBottleneck] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<boolean>(false);

  // Inspector Drawer State & Tabs
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);
  const [inspectorTab, setInspectorTab] = useState<'overview' | 'io' | 'attributes' | 'rawJson'>('overview');

  // Node Hover State
  const [hoveredNode, setHoveredNode] = useState<{
    node: any;
    span: Span;
  } | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  const handleNodeMouseEnter = (node: any, span: Span) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredNode({ node, span });
  };

  const handleNodeMouseLeave = () => {
    hoverTimeoutRef.current = window.setTimeout(() => {
      setHoveredNode(null);
    }, 250);
  };

  const handleTooltipMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const handleTooltipMouseLeave = () => {
    setHoveredNode(null);
  };

  // Zoom & Pan state
  const [scale, setScale] = useState<number>(0.75);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 50, y: 100 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Track current traceId so we ONLY reset selectedSpan when switching to a DIFFERENT trace
  const currentTraceIdRef = useRef<string | null>(null);

  // Auto-select root span on trace change
  useEffect(() => {
    if (!trace || trace.spans.length === 0) {
      setSelectedSpan(null);
      currentTraceIdRef.current = null;
      return;
    }

    // Only reset selectedSpan if we switched to a different trace!
    if (currentTraceIdRef.current !== trace.traceId) {
      currentTraceIdRef.current = trace.traceId;
      setSelectedSpan(trace.spans[0]);
      return;
    }

    // When the same trace is refreshed in the background, retain user's selected span
    setSelectedSpan((prev) => {
      if (!prev) return trace.spans[0];
      const match = trace.spans.find((s) => s.spanId === prev.spanId);
      return match || trace.spans[0];
    });
  }, [trace]);

  // Identify bottleneck span (longest duration span)
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

  // Calculate layout using the smart graphLayout algorithm
  const layout = useMemo(() => {
    if (!trace || trace.spans.length === 0) {
      return {
        nodes: [],
        edges: [],
        bounds: { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600 },
        nodeMap: new Map(),
      };
    }
    return calculateGraphLayout(trace.spans, trace.durationMs, layoutMode);
  }, [trace, layoutMode]);

  // Copy Trace ID
  const handleCopyTraceId = () => {
    if (!trace) return;
    navigator.clipboard.writeText(trace.traceId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Native non-passive Wheel Zoom to strictly prevent browser whole-page zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;

      setScale((prevScale) => {
        const newScale = Math.min(Math.max(prevScale * zoomFactor, 0.2), 2.5);
        setPan((prevPan) => ({
          x: mouseX - (mouseX - prevPan.x) * (newScale / prevScale),
          y: mouseY - (mouseY - prevPan.y) * (newScale / prevScale),
        }));
        return newScale;
      });
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', onWheel);
    };
  }, []);

  // Pan controls
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
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
    if (!containerRef.current || layout.nodes.length === 0) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const zoomX = (clientWidth - 100) / Math.max(layout.bounds.width, 300);
    const zoomY = (clientHeight - 100) / Math.max(layout.bounds.height, 200);
    const fitScale = Math.min(Math.max(Math.min(zoomX, zoomY), 0.25), 1.1);

    setScale(fitScale);
    setPan({
      x: 50,
      y: layoutMode === 'vertical' ? 50 : 80,
    });
  };

  const handleResetZoom = () => {
    setScale(1.0);
    setPan({ x: 60, y: 80 });
  };

  if (!trace) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-66px)] mt-[66px] text-center p-6 bg-[#F1F3F5]">
        <div className="w-14 h-14 rounded-2xl bg-white border border-[#CBD5E1] shadow-card flex items-center justify-center mb-3 text-[#2563EB]">
          <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-[#263238] mb-1">No Trace Selected</h3>
        <p className="text-xs text-[#475569] max-w-md mb-4 leading-relaxed">
          Execute an API request in the Endpoint Runner, select a captured trace from the Dashboard, or upload JSON to visualize its execution graph.
        </p>
        <button
          onClick={onBackToDashboard}
          className="btn-run px-4 py-2 rounded-lg text-white font-bold text-xs shadow-sm"
        >
          View Dashboard Traces
        </button>
      </div>
    );
  }

  // Active span for JSON inspector & Drawer
  const activeSpan = selectedSpan || (trace.spans.length > 0 ? trace.spans[0] : null);

  // Compute hierarchical breadcrumbs from root to active span (matching Image 2)
  const spanBreadcrumbs = useMemo(() => {
    if (!activeSpan || !trace) return [];
    const spanMap = new Map<string, Span>(trace.spans.map((s) => [s.spanId, s]));
    const path: Span[] = [];
    let curr: Span | undefined = activeSpan;
    const visited = new Set<string>();

    while (curr && !visited.has(curr.spanId)) {
      visited.add(curr.spanId);
      path.unshift(curr);
      if (!curr.parentSpanId) break;
      curr = spanMap.get(curr.parentSpanId);
    }
    return path;
  }, [activeSpan, trace]);

  return (
    <div className="relative flex flex-col w-full h-[calc(100vh-66px)] mt-[66px] bg-[#F1F3F5] select-none overflow-hidden">
      {/* =========================================================================
          TOP HEADER BAR (Matching Images 1, 2, 3)
          ========================================================================= */}
      <div className="flex items-center justify-between px-3 sm:px-5 py-2.5 bg-white border-b border-[#CBD5E1] z-20 flex-wrap gap-2 shadow-xs">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Traces selector pill */}
          <div className="relative">
            <select
              value={trace.traceId}
              onChange={(e) => {
                const found = traces.find((t) => t.traceId === e.target.value);
                if (found) onSelectTrace(found);
              }}
              className="appearance-none pl-3 pr-7 py-1 rounded-lg text-xs font-bold bg-[#F8FAFC] text-[#263238] border border-[#CBD5E1] cursor-pointer focus:outline-none focus:border-[#2563EB]"
            >
              {traces.map((t, idx) => (
                <option key={t.traceId} value={t.traceId}>
                  Traces ({idx + 1}/{traces.length})
                </option>
              ))}
            </select>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-[10px]">▼</span>
          </div>

          {/* Status Badge: ● SUCCESS (emerald) or ● ERROR (rose) */}
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border ${
              trace.status === 'OK'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-rose-50 text-rose-700 border-rose-300'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${trace.status === 'OK' ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
            {trace.status === 'OK' ? 'SUCCESS' : 'ERROR'}
          </span>

          {/* Trace Name (Bold) */}
          <h2 className="text-xs sm:text-sm font-extrabold text-[#263238] tracking-tight truncate max-w-[220px] sm:max-w-none">
            {trace.name}
          </h2>

          {/* Timing & Spans */}
          <div className="flex items-center gap-2 text-xs font-mono text-[#64748B]">
            <span className="font-bold text-[#2563EB]">
              ⏱ {trace.durationMs.toFixed(2)} ms
            </span>
            <span>•</span>
            <span>{trace.spanCount} spans</span>
          </div>

          {/* Trace ID Copy */}
          <button
            onClick={handleCopyTraceId}
            title="Click to copy Trace ID"
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-[#F8FAFC] text-[#64748B] hover:text-[#263238] border border-[#CBD5E1] transition-colors"
          >
            <span>ID: {trace.traceId.substring(0, 8)}...</span>
            <span className="text-[11px]">{copiedId ? '✓' : '📋'}</span>
          </button>
        </div>

        {/* View Switcher: Layout Pills + Modes [Graph] | [Node ↔ JSON] | [JSON] */}
        <div className="flex items-center gap-2">
          {/* Layout Orientation (Horizontal Tree vs Vertical Tree vs Pipeline) */}
          {mode !== 'json' && (
            <div className="flex items-center p-0.5 rounded-lg bg-[#F1F5F9] border border-[#CBD5E1] text-xs font-bold">
              <button
                onClick={() => setLayoutMode('horizontal')}
                className={`px-2 py-1 rounded-md text-[11px] transition-all ${
                  layoutMode === 'horizontal' ? 'bg-white text-[#2563EB] shadow-xs' : 'text-[#64748B]'
                }`}
                title="Horizontal Tree Hierarchy (Left-to-Right)"
              >
                Tree ⇆
              </button>
              <button
                onClick={() => setLayoutMode('vertical')}
                className={`px-2 py-1 rounded-md text-[11px] transition-all ${
                  layoutMode === 'vertical' ? 'bg-white text-[#2563EB] shadow-xs' : 'text-[#64748B]'
                }`}
                title="Vertical Tree Hierarchy (Top-to-Bottom)"
              >
                Tree ⇅
              </button>
              <button
                onClick={() => setLayoutMode('pipeline')}
                className={`px-2 py-1 rounded-md text-[11px] transition-all ${
                  layoutMode === 'pipeline' ? 'bg-white text-[#2563EB] shadow-xs' : 'text-[#64748B]'
                }`}
                title="Sequential Pipeline Chain"
              >
                Chain ➔
              </button>
            </div>
          )}

          {/* Three Mode Tabs: Graph | Node <-> JSON | JSON */}
          <div className="flex items-center p-0.5 rounded-lg bg-[#F1F5F9] border border-[#CBD5E1] text-xs font-semibold">
            <button
              onClick={() => setMode('graph')}
              className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                mode === 'graph'
                  ? 'bg-white text-[#2563EB] border border-[#CBD5E1] shadow-xs'
                  : 'text-[#475569] hover:text-[#263238]'
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="6" cy="6" r="3" />
                <circle cx="18" cy="18" r="3" />
                <path d="M8.5 8.5l7 7" />
              </svg>
              <span>Graph</span>
            </button>

            <button
              onClick={() => setMode('node-json')}
              className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                mode === 'node-json'
                  ? 'bg-white text-[#2563EB] border border-[#CBD5E1] shadow-xs'
                  : 'text-[#475569] hover:text-[#263238]'
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 3h5v5" />
                <path d="M4 20L21 3" />
                <path d="M21 16v5h-5" />
                <path d="M15 15l6 6" />
                <path d="M4 4l5 5" />
              </svg>
              <span>Node ↔ JSON</span>
            </button>

            <button
              onClick={() => setMode('json')}
              className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                mode === 'json'
                  ? 'bg-white text-[#2563EB] border border-[#CBD5E1] shadow-xs'
                  : 'text-[#475569] hover:text-[#263238]'
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span>JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MAIN WORKSPACE
          ========================================================================= */}
      <div className="relative flex-1 w-full h-full overflow-hidden flex">
        {mode === 'json' ? (
          // ======================== MODE 3: FULL JSON VIEW ========================
          <div className="w-full h-full p-4 sm:p-6 overflow-auto bg-[#F1F3F5]">
            <div className="max-w-5xl mx-auto h-full flex flex-col rounded-2xl bg-white border border-[#CBD5E1] shadow-card overflow-hidden">
              <CodeViewer
                jsonString={JSON.stringify(trace, null, 2)}
                title="Full TraceRecord Schema JSON"
                badge={`${trace.spanCount} Spans`}
              />
            </div>
          </div>
        ) : (
          // ======================== MODES 1 & 2: GRAPH WORKSPACE ========================
          <div className="relative flex-1 w-full h-full flex flex-row overflow-hidden">
            {/* Left Interactive Canvas Area */}
            <div
              ref={containerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              style={{ minWidth: 0, touchAction: 'none' }}
              className={`relative flex-1 h-full cursor-grab active:cursor-grabbing overflow-hidden dot-grid-bg select-none ${
                isInspectorOpen ? 'border-r border-[#CBD5E1]' : ''
              }`}
            >
              {/* Floating Canvas Controls (Top-Left inside canvas: Zoom, Fit, 100%, Bottleneck) */}
              <div
                className="absolute top-4 left-4 z-30 flex items-center gap-1.5 p-1 rounded-xl bg-white border border-[#CBD5E1] shadow-card text-[#263238]"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setScale((prev) => Math.max(prev - 0.1, 0.2))}
                  className="w-6 h-6 rounded-md bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#263238] flex items-center justify-center text-xs font-bold"
                  title="Zoom Out"
                >
                  −
                </button>
                <span className="text-[11px] font-mono text-[#263238] min-w-[36px] text-center font-bold">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={() => setScale((prev) => Math.min(prev + 0.1, 2.5))}
                  className="w-6 h-6 rounded-md bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#263238] flex items-center justify-center text-xs font-bold"
                  title="Zoom In"
                >
                  +
                </button>

                <div className="w-[1px] h-3.5 bg-[#CBD5E1] mx-0.5" />

                <button
                  onClick={handleFit}
                  className="px-2 py-0.5 rounded-md text-[11px] font-bold text-[#475569] hover:text-[#263238] hover:bg-[#F1F5F9]"
                  title="Fit to screen"
                >
                  ⛶ Fit
                </button>

                <button
                  onClick={handleResetZoom}
                  className="px-2 py-0.5 rounded-md text-[11px] font-bold text-[#475569] hover:text-[#263238] hover:bg-[#F1F5F9]"
                  title="Reset to 100%"
                >
                  ↺ 100%
                </button>

                <div className="w-[1px] h-3.5 bg-[#CBD5E1] mx-0.5" />

                {/* Bottleneck Highlighter Button */}
                <button
                  onClick={() => setHighlightBottleneck((prev) => !prev)}
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                    highlightBottleneck
                      ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-xs'
                      : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
                  }`}
                  title="Highlight slowest bottleneck span"
                >
                  <span>🔥 Bottleneck</span>
                </button>
              </div>

              {/* Status Pill for Mode 2: Live Connected Graph <-> JSON */}
              {mode === 'node-json' && (
                <div className="absolute top-4 right-4 z-20 hidden sm:flex items-center gap-2 rounded-full border border-[#BFDBFE] bg-white/95 px-3 py-1 text-xs text-[#2563EB] shadow-xs backdrop-blur-md">
                  <span className="w-2 h-2 rounded-full bg-[#2563EB] animate-pulse" />
                  <span className="font-bold">Live Connected Graph ↔ JSON</span>
                </div>
              )}

              {/* SVG Canvas for Connectors & Scaled Nodes */}
              <div
                className="absolute inset-0 origin-top-left will-change-transform"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                }}
              >
                {/* SVG Connecting Flow Lines with Arrowheads */}
                <svg
                  className="absolute top-0 left-0 pointer-events-none overflow-visible"
                  style={{
                    width: layout.bounds.width + 1000,
                    height: layout.bounds.height + 1000,
                  }}
                >
                  <defs>
                    {/* GREEN ARROW FOR SUCCESS CALLS */}
                    <marker
                      id="arrow-green"
                      viewBox="0 0 10 10"
                      refX="8.5"
                      refY="5"
                      markerUnits="userSpaceOnUse"
                      markerWidth="9"
                      markerHeight="9"
                      orient="auto"
                    >
                      <path
                        d="M 1.5 1.75 L 8.5 5 L 1.5 8.25 L 3 5 Z"
                        fill="#10B981"
                        stroke="#10B981"
                        strokeWidth="0.5"
                        strokeLinejoin="round"
                      />
                    </marker>

                    {/* RED ARROW FOR FAILURE CALLS */}
                    <marker
                      id="arrow-red"
                      viewBox="0 0 10 10"
                      refX="8.5"
                      refY="5"
                      markerUnits="userSpaceOnUse"
                      markerWidth="9"
                      markerHeight="9"
                      orient="auto"
                    >
                      <path
                        d="M 1.5 1.75 L 8.5 5 L 1.5 8.25 L 3 5 Z"
                        fill="#EF4444"
                        stroke="#EF4444"
                        strokeWidth="0.5"
                        strokeLinejoin="round"
                      />
                    </marker>

                    {/* BLUE ARROW FOR ACTIVE/SELECTED EDGES */}
                    <marker
                      id="arrow-active"
                      viewBox="0 0 10 10"
                      refX="8.5"
                      refY="5"
                      markerUnits="userSpaceOnUse"
                      markerWidth="9"
                      markerHeight="9"
                      orient="auto"
                    >
                      <path
                        d="M 1.5 1.75 L 8.5 5 L 1.5 8.25 L 3 5 Z"
                        fill="#2563EB"
                        stroke="#2563EB"
                        strokeWidth="0.5"
                        strokeLinejoin="round"
                      />
                    </marker>

                    {/* AMBER ARROW FOR BOTTLENECK EDGES */}
                    <marker
                      id="arrow-amber"
                      viewBox="0 0 10 10"
                      refX="8.5"
                      refY="5"
                      markerUnits="userSpaceOnUse"
                      markerWidth="9"
                      markerHeight="9"
                      orient="auto"
                    >
                      <path
                        d="M 1.5 1.75 L 8.5 5 L 1.5 8.25 L 3 5 Z"
                        fill="#D97706"
                        stroke="#D97706"
                        strokeWidth="0.5"
                        strokeLinejoin="round"
                      />
                    </marker>
                  </defs>

                  {/* RENDER ALL EDGES: GREEN FOR SUCCESS, RED FOR FAILURE */}
                  {layout.edges.map((edge) => {
                    const isSourceSelected = activeSpan?.spanId === edge.sourceId;
                    const isTargetSelected = activeSpan?.spanId === edge.targetId;
                    const isEdgeActive = isSourceSelected || isTargetSelected;

                    const isTargetBottleneck =
                      highlightBottleneck && edge.targetId === bottleneckSpanId;
                    const isError = edge.isError;

                    // COLOR ASSIGNMENT: Green for success, Red for failure
                    const strokeColor = isError
                      ? '#EF4444' // RED FOR FAILURE
                      : isTargetBottleneck
                      ? '#D97706' // AMBER FOR BOTTLENECK
                      : isEdgeActive
                      ? '#2563EB' // BRIGHT BLUE FOR ACTIVE
                      : '#10B981'; // GREEN FOR SUCCESS

                    const markerUrl = isError
                      ? 'url(#arrow-red)'
                      : isTargetBottleneck
                      ? 'url(#arrow-amber)'
                      : isEdgeActive
                      ? 'url(#arrow-active)'
                      : 'url(#arrow-green)';

                    return (
                      <g key={edge.id}>
                        {/* Animated Flow Arrow: Clear single line, no outer pipe surround */}
                        <path
                          d={edge.path}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={isEdgeActive ? 2.5 : 2}
                          className={
                            isError
                              ? 'flow-line-error'
                              : isTargetBottleneck
                              ? 'flow-line-bottleneck'
                              : 'flow-line-success'
                          }
                          markerEnd={markerUrl}
                        />
                      </g>
                    );
                  })}
                </svg>

                {/* =============================================================
                    RENDER NODES WITH ROUNDED CORNER STRUCTURE (White Theme)
                    ============================================================= */}
                {layout.nodes.map((node) => {
                  const span = node.span as Span;
                  const isSelected = activeSpan?.spanId === node.id;
                  const isBottleneck = highlightBottleneck && node.isSlowest;
                  const isError = node.isError;

                  return (
                    <div
                      key={node.id}
                      onMouseEnter={() => handleNodeMouseEnter(node, span)}
                      onMouseLeave={handleNodeMouseLeave}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSpan(span);
                        setIsInspectorOpen(true);
                      }}
                      style={{
                        transform: `translate(${node.x}px, ${node.y}px)`,
                        width: `${node.width}px`,
                        height: `${node.height}px`,
                        borderRadius: '16px', // Rounded corner structure as requested
                      }}
                      className={`group absolute transition-all duration-150 cursor-pointer p-3 flex flex-col justify-between select-none ${
                        isSelected
                          ? 'bg-white border-2 border-[#2563EB] ring-4 ring-[#2563EB]/25 shadow-lg shadow-[#2563EB]/15'
                          : isBottleneck
                          ? 'bg-white border-2 border-amber-500 ring-2 ring-amber-500/20 shadow-md'
                          : isError
                          ? 'bg-white border-2 border-rose-500 ring-2 ring-rose-500/20 shadow-md'
                          : 'bg-white border border-[#CBD5E1] hover:border-[#10B981] shadow-xs hover:shadow-md'
                      }`}
                    >
                      {/* Top Row: Category Badge + Duration + Status Indicator */}
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wide uppercase border ${
                              span.category === 'CONTROLLER'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : span.category === 'SERVICE'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : span.category === 'REPOSITORY'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : (span.category as string) === 'DATABASE'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                          >
                            {span.category || 'SPAN'}
                          </span>

                          <span className="font-mono text-[11px] font-bold text-[#263238]">
                            {node.durationMs.toFixed(1)} ms
                          </span>
                        </div>

                        {/* Status Dot: Green for Success, Red for Failure */}
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isError ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'
                          }`}
                          title={isError ? 'Error in span' : 'Success'}
                        />
                      </div>

                      {/* Middle: Method / Operation Name */}
                      <div
                        className="font-bold text-xs text-[#263238] tracking-tight truncate my-0.5 leading-snug group-hover:text-[#2563EB] transition-colors"
                        title={span.name}
                      >
                        {span.name}
                      </div>

                      {/* Bottom Row: Rounded-Full Duration Bar + Details */}
                      <div className="w-full space-y-1">
                        <div className="w-full h-1.5 rounded-full bg-[#E2E8F0] overflow-hidden">
                          <div
                            style={{ width: `${Math.min(100, Math.max(5, node.durationPct))}%` }}
                            className={`h-full rounded-full transition-all duration-300 ${
                              isBottleneck
                                ? 'bg-amber-500'
                                : isError
                                ? 'bg-rose-500'
                                : 'bg-emerald-500'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* =============================================================
                    FLOATING NODE HOVER INSPECT POPUP (Matching Image 2)
                    ============================================================= */}
                {hoveredNode && (
                  <div
                    onMouseEnter={handleTooltipMouseEnter}
                    onMouseLeave={handleTooltipMouseLeave}
                    style={{
                      position: 'absolute',
                      left: `${hoveredNode.node.x + hoveredNode.node.width / 2}px`,
                      top:
                        hoveredNode.node.y > 150
                          ? `${hoveredNode.node.y - 12}px`
                          : `${hoveredNode.node.y + hoveredNode.node.height + 12}px`,
                      transform: hoveredNode.node.y > 150 ? 'translate(-50%, -100%)' : 'translateX(-50%)',
                      zIndex: 60,
                      width: '270px',
                    }}
                    className="bg-white border border-[#CBD5E1] rounded-2xl shadow-xl p-3.5 flex flex-col gap-2 select-none pointer-events-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Top Row: Category Badge + Status */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wide uppercase border ${
                          hoveredNode.span.category === 'CONTROLLER'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : hoveredNode.span.category === 'SERVICE'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : hoveredNode.span.category === 'REPOSITORY'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border-slate-300'
                        }`}
                      >
                        {hoveredNode.span.category || 'SPAN'}
                      </span>

                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                          hoveredNode.span.status === 'OK' ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            hoveredNode.span.status === 'OK' ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                        {hoveredNode.span.status === 'OK' ? 'Success' : 'Error'}
                      </span>
                    </div>

                    {/* Title */}
                    <div className="font-extrabold text-xs text-[#263238] tracking-tight truncate leading-tight">
                      {hoveredNode.span.name}
                    </div>

                    {/* Metrics Row */}
                    <div className="flex items-center gap-2.5 text-[11px] font-mono text-[#64748B]">
                      <span className="flex items-center gap-1 font-bold text-[#263238]">
                        <span>⏱ Duration:</span>
                        <span className="text-[#2563EB]">{hoveredNode.span.durationMs.toFixed(1)} ms</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <span>Depth:</span>
                        <span className="font-bold text-[#263238]">Level {hoveredNode.span.depth ?? 0}</span>
                      </span>
                    </div>

                    {/* Inspect Details Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSpan(hoveredNode.span);
                        setIsInspectorOpen(true);
                        setHoveredNode(null);
                      }}
                      className="btn-run w-full py-1.5 px-3 rounded-lg text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                    >
                      <span>Inspect Details</span>
                      <span>↗</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Toggle to open Inspect Panel if closed */}
              {!isInspectorOpen && (
                <button
                  onClick={() => setIsInspectorOpen(true)}
                  className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-[#CBD5E1] shadow-card text-xs font-bold text-[#2563EB] hover:bg-[#EFF6FF] transition-all cursor-pointer"
                  title="Open Inspect Panel"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <line x1="15" y1="3" x2="15" y2="21" />
                  </svg>
                  <span>Inspect Panel</span>
                </button>
              )}
            </div>

            {/* =============================================================
                RIGHT PANEL: SEGREGATED INSPECT DETAILS DRAWER (Matching Image 2)
                ============================================================= */}
            {isInspectorOpen && activeSpan && (
              <aside
                style={{
                  width: '460px',
                  minWidth: '360px',
                  maxWidth: '45vw',
                  height: '100%',
                  flexShrink: 0,
                }}
                className="h-full bg-white border-l border-[#CBD5E1] flex flex-col shrink-0 overflow-hidden shadow-card z-20"
              >
                {/* Header (Matching Image 2) */}
                <div className="p-4 border-b border-[#CBD5E1] bg-[#F8FAFC] space-y-2 shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                          activeSpan.category === 'CONTROLLER'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : activeSpan.category === 'SERVICE'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : activeSpan.category === 'REPOSITORY'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border-slate-300'
                        }`}
                      >
                        {activeSpan.category || 'SPAN'}
                      </span>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          activeSpan.status === 'OK'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-rose-50 text-rose-700 border-rose-300'
                        }`}
                      >
                        {activeSpan.status === 'OK' ? 'SUCCESS' : 'ERROR'}
                      </span>

                      <span className="text-xs font-mono font-bold text-[#2563EB]">
                        ⏱ {activeSpan.durationMs.toFixed(2)} ms
                      </span>
                    </div>

                    {/* Close button ✕ */}
                    <button
                      onClick={() => setIsInspectorOpen(false)}
                      className="p-1 rounded-lg text-[#64748B] hover:text-[#263238] hover:bg-[#E2E8F0] transition-colors cursor-pointer"
                      title="Close Inspector"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-extrabold text-[#263238] tracking-tight break-all">
                    {activeSpan.name}
                  </h3>

                  {/* Breadcrumb Path (Matching Image 2) */}
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#64748B] overflow-x-auto no-scrollbar">
                    <span className="font-bold text-[#475569] shrink-0">Path:</span>
                    {spanBreadcrumbs.map((s, idx) => (
                      <React.Fragment key={s.spanId}>
                        {idx > 0 && <span className="text-slate-400 shrink-0">›</span>}
                        <button
                          onClick={() => {
                            setSelectedSpan(s);
                          }}
                          className={`shrink-0 hover:underline truncate max-w-[130px] cursor-pointer ${
                            s.spanId === activeSpan.spanId ? 'font-bold text-[#2563EB]' : 'text-[#64748B]'
                          }`}
                          title={s.name}
                        >
                          {s.name}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Tab Navigation: Overview | Input / Output | Attributes | Raw JSON */}
                <div className="flex items-center gap-1 px-4 py-2 border-b border-[#CBD5E1] bg-white overflow-x-auto no-scrollbar shrink-0">
                  <button
                    onClick={() => setInspectorTab('overview')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      inspectorTab === 'overview'
                        ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                        : 'text-[#64748B] hover:text-[#263238]'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setInspectorTab('io')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      inspectorTab === 'io'
                        ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                        : 'text-[#64748B] hover:text-[#263238]'
                    }`}
                  >
                    Input / Output
                  </button>
                  <button
                    onClick={() => setInspectorTab('attributes')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      inspectorTab === 'attributes'
                        ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                        : 'text-[#64748B] hover:text-[#263238]'
                    }`}
                  >
                    Attributes
                  </button>
                  <button
                    onClick={() => setInspectorTab('rawJson')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      inspectorTab === 'rawJson'
                        ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                        : 'text-[#64748B] hover:text-[#263238]'
                    }`}
                  >
                    Raw JSON
                  </button>
                </div>

                {/* ===================== TAB 1: OVERVIEW (Segregated Cards) ===================== */}
                {inspectorTab === 'overview' && (
                  <div className="p-4 space-y-3 overflow-y-auto flex-1 bg-[#F8FAFC]">
                    {/* Grid with 2 columns */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* SPAN ID */}
                      <div className="p-3 rounded-xl bg-white border border-[#CBD5E1] shadow-2xs space-y-1">
                        <span className="text-[10px] font-mono font-bold text-[#64748B] uppercase tracking-wider block">
                          SPAN ID
                        </span>
                        <div className="font-mono text-xs font-extrabold text-[#2563EB] break-all select-all">
                          {activeSpan.spanId}
                        </div>
                      </div>

                      {/* DURATION */}
                      <div className="p-3 rounded-xl bg-white border border-[#CBD5E1] shadow-2xs space-y-1">
                        <span className="text-[10px] font-mono font-bold text-[#64748B] uppercase tracking-wider block">
                          DURATION
                        </span>
                        <div className="font-mono text-xs font-extrabold text-emerald-600">
                          {activeSpan.durationMs.toFixed(2)} ms
                        </div>
                      </div>

                      {/* PARENT SPAN */}
                      <div className="p-3 rounded-xl bg-white border border-[#CBD5E1] shadow-2xs space-y-1">
                        <span className="text-[10px] font-mono font-bold text-[#64748B] uppercase tracking-wider block">
                          PARENT SPAN
                        </span>
                        <div className="font-mono text-xs font-bold text-[#334155] break-all">
                          {activeSpan.parentSpanId || 'root (none)'}
                        </div>
                      </div>

                      {/* THREAD */}
                      <div className="p-3 rounded-xl bg-white border border-[#CBD5E1] shadow-2xs space-y-1">
                        <span className="text-[10px] font-mono font-bold text-[#64748B] uppercase tracking-wider block">
                          THREAD
                        </span>
                        <div className="font-mono text-xs font-bold text-[#334155] truncate">
                          {activeSpan.thread || 'main'}
                        </div>
                      </div>
                    </div>

                    {/* METHOD EXECUTED (Full width) */}
                    <div className="p-3.5 rounded-xl bg-white border border-[#CBD5E1] shadow-2xs space-y-1.5">
                      <span className="text-[10px] font-mono font-bold text-[#64748B] uppercase tracking-wider block">
                        METHOD EXECUTED
                      </span>
                      <div className="font-mono text-xs font-bold text-[#263238] break-all select-all bg-[#F1F5F9] p-2.5 rounded-lg border border-[#E2E8F0]">
                        {activeSpan.class ? `${activeSpan.class}.${activeSpan.method}()` : activeSpan.name}
                      </div>
                    </div>

                    {/* TIMING BREAKDOWN */}
                    <div className="p-3.5 rounded-xl bg-white border border-[#CBD5E1] shadow-2xs space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[10px] font-mono font-bold text-[#64748B] uppercase tracking-wider">
                          TIMING RELATIVE TO TRACE
                        </span>
                        <span className="font-mono text-[11px] font-bold text-[#2563EB]">
                          +{activeSpan.offsetMs?.toFixed(1) ?? 0} ms from start
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#E2E8F0] overflow-hidden">
                        <div
                          style={{ width: `${Math.min(100, Math.max(5, activeSpan.widthPct || 10))}%` }}
                          className="h-full rounded-full bg-emerald-500"
                        />
                      </div>
                    </div>

                    {/* ERROR CARD IF ERROR */}
                    {activeSpan.status === 'ERROR' && (
                      <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 space-y-1.5 shadow-2xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                          <span>⚠️</span>
                          <span>ERROR DETAILS</span>
                        </span>
                        <div className="font-mono text-xs font-bold break-all">
                          {activeSpan.errorMessage || activeSpan.error || 'Execution encountered an unhandled exception'}
                        </div>
                        {activeSpan.errorDetail && (
                          <pre className="font-mono text-[11px] text-rose-600 bg-white/80 p-2 rounded-lg border border-rose-200 overflow-auto max-h-32">
                            {activeSpan.errorDetail}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ===================== TAB 2: INPUT / OUTPUT ===================== */}
                {inspectorTab === 'io' && (
                  <div className="p-4 space-y-4 overflow-y-auto flex-1 bg-[#F8FAFC]">
                    {/* Input Arguments */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#263238] uppercase tracking-wider flex items-center gap-1.5">
                          <span>📥</span>
                          <span>Input Arguments ({activeSpan.inputArgs?.length || 0})</span>
                        </span>
                      </div>

                      {activeSpan.inputArgs && activeSpan.inputArgs.length > 0 ? (
                        <div className="space-y-2">
                          {activeSpan.inputArgs.map((arg, idx) => (
                            <div key={idx} className="p-3 rounded-xl bg-white border border-[#CBD5E1] shadow-2xs space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-mono font-bold text-[#2563EB]">{arg.name || `arg[${idx}]`}</span>
                                <span className="font-mono text-[10px] text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded border border-[#CBD5E1]">
                                  {arg.type || 'Object'}
                                </span>
                              </div>
                              <pre className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] text-xs font-mono text-[#1E293B] overflow-auto max-h-40 leading-relaxed select-text">
                                {typeof arg.value === 'object'
                                  ? JSON.stringify(arg.value, null, 2)
                                  : String(arg.value ?? 'null')}
                              </pre>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl bg-white border border-[#CBD5E1] text-center text-xs text-[#64748B]">
                          No input arguments captured for this method.
                        </div>
                      )}
                    </div>

                    {/* Output / Return Value */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#263238] uppercase tracking-wider flex items-center gap-1.5">
                          <span>📤</span>
                          <span>Output / Return Value</span>
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-white border border-[#CBD5E1] shadow-2xs space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-bold text-emerald-600">return</span>
                          <span className="font-mono text-[10px] text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded border border-[#CBD5E1]">
                            {activeSpan.outputArgs?.type || 'void'}
                          </span>
                        </div>
                        <pre className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] text-xs font-mono text-[#1E293B] overflow-auto max-h-48 leading-relaxed select-text">
                          {activeSpan.outputArgs?.value !== undefined
                            ? typeof activeSpan.outputArgs.value === 'object'
                              ? JSON.stringify(activeSpan.outputArgs.value, null, 2)
                              : String(activeSpan.outputArgs.value)
                            : 'void / executed without return payload'}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}

                {/* ===================== TAB 3: ATTRIBUTES (Segregated Table) ===================== */}
                {inspectorTab === 'attributes' && (
                  <div className="p-4 overflow-y-auto flex-1 bg-[#F8FAFC]">
                    <div className="rounded-xl bg-white border border-[#CBD5E1] shadow-2xs overflow-hidden">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-[#F1F5F9] text-[#475569] uppercase text-[10px] border-b border-[#CBD5E1]">
                          <tr>
                            <th className="py-2.5 px-3.5 font-bold">Attribute Key</th>
                            <th className="py-2.5 px-3.5 font-bold">Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E8F0]">
                          <tr>
                            <td className="py-2 px-3.5 text-[#64748B] font-bold">spanId</td>
                            <td className="py-2 px-3.5 text-[#2563EB] select-all font-bold">{activeSpan.spanId}</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3.5 text-[#64748B] font-bold">traceId</td>
                            <td className="py-2 px-3.5 text-[#334155] select-all">{activeSpan.traceId}</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3.5 text-[#64748B] font-bold">parentSpanId</td>
                            <td className="py-2 px-3.5 text-[#334155]">{activeSpan.parentSpanId || 'root'}</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3.5 text-[#64748B] font-bold">category</td>
                            <td className="py-2 px-3.5 text-[#334155]">{activeSpan.category}</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3.5 text-[#64748B] font-bold">depth</td>
                            <td className="py-2 px-3.5 text-[#334155]">{activeSpan.depth}</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3.5 text-[#64748B] font-bold">durationMs</td>
                            <td className="py-2 px-3.5 text-emerald-600 font-bold">{activeSpan.durationMs.toFixed(3)} ms</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3.5 text-[#64748B] font-bold">offsetMs</td>
                            <td className="py-2 px-3.5 text-[#334155]">+{activeSpan.offsetMs?.toFixed(3) ?? 0} ms</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3.5 text-[#64748B] font-bold">thread</td>
                            <td className="py-2 px-3.5 text-[#334155]">{activeSpan.thread || 'main'}</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3.5 text-[#64748B] font-bold">status</td>
                            <td className="py-2 px-3.5">
                              <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                activeSpan.status === 'OK' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                              }`}>
                                {activeSpan.status}
                              </span>
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3.5 text-[#64748B] font-bold">class</td>
                            <td className="py-2 px-3.5 text-[#334155] break-all">{activeSpan.class || 'N/A'}</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3.5 text-[#64748B] font-bold">method</td>
                            <td className="py-2 px-3.5 text-[#334155] break-all">{activeSpan.method || 'N/A'}</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3.5 text-[#64748B] font-bold">startTime</td>
                            <td className="py-2 px-3.5 text-[#334155]">{activeSpan.startTime || 'N/A'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ===================== TAB 4: RAW JSON ===================== */}
                {inspectorTab === 'rawJson' && (
                  <div className="p-3 overflow-hidden flex-1 bg-[#F1F3F5]">
                    <CodeViewer
                      jsonString={JSON.stringify(activeSpan, null, 2)}
                      title={`Span: ${activeSpan.name}`}
                      badge={`${activeSpan.category}`}
                    />
                  </div>
                )}
              </aside>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GraphView;
