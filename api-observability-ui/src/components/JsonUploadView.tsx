import React, { useState } from 'react';
import type { Span, TraceRecord } from '../types';

interface JsonUploadViewProps {
  onVisualizeTrace: (trace: TraceRecord) => void;
}

export const JsonUploadView: React.FC<JsonUploadViewProps> = ({ onVisualizeTrace }) => {
  const [jsonText, setJsonText] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);

  const handleParseAndVisualize = () => {
    setParseError(null);
    if (!jsonText.trim()) {
      setParseError('Please enter or upload JSON text first.');
      return;
    }

    try {
      const parsed = JSON.parse(jsonText);
      const traceRecord = normalizeToTraceRecord(parsed);
      onVisualizeTrace(traceRecord);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setParseError(`JSON Syntax Error: ${msg}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonText(content);
      setParseError(null);
    };
    reader.readAsText(file);
  };

  // Convert generic JSON or array into TraceRecord
  const normalizeToTraceRecord = (input: unknown): TraceRecord => {
    if (typeof input !== 'object' || input === null) {
      throw new Error('JSON root must be an object or array.');
    }

    // Already a TraceRecord
    const obj = input as Record<string, unknown>;
    if (Array.isArray(obj.spans) && obj.spans.length > 0) {
      return input as TraceRecord;
    }

    // Array of Spans
    if (Array.isArray(input)) {
      const spans = input as Span[];
      const root = spans[0];
      return {
        traceId: root?.traceId || 'custom-uploaded-trace',
        name: root?.name || 'custom-pipeline',
        category: root?.category || 'CONTROLLER',
        status: spans.some((s) => s.status === 'ERROR') ? 'ERROR' : 'OK',
        startTime: new Date().toISOString(),
        startLabel: new Date().toLocaleTimeString(),
        durationMs: spans.reduce((max, s) => Math.max(max, s.durationMs || 0), 0),
        spanCount: spans.length,
        errorCount: spans.filter((s) => s.status === 'ERROR').length,
        dropped: 0,
        spans: spans.map((s, idx) => ({
          ...s,
          spanId: s.spanId || `node-${idx}`,
          parentSpanId: s.parentSpanId !== undefined ? s.parentSpanId : idx > 0 ? `node-${idx - 1}` : null,
          depth: s.depth ?? (idx === 0 ? 0 : 1),
          category: s.category || 'SERVICE',
          name: s.name || `operation-${idx + 1}`,
          class: s.class || 'CustomClass',
          method: s.method || 'execute',
          thread: s.thread || 'main',
          startTime: s.startTime || new Date().toISOString(),
          durationMs: s.durationMs || 10,
          offsetMs: s.offsetMs || idx * 10,
          offsetPct: s.offsetPct || 0,
          widthPct: s.widthPct || 10,
          status: s.status || 'OK'
        }))
      };
    }

    // Convert arbitrary JSON object into a tree
    const spans: Span[] = [];
    let idCounter = 0;

    const traverse = (data: unknown, name: string, parentId: string | null, depth: number) => {
      const spanId = `node-${++idCounter}`;
      const isErr = name.toLowerCase().includes('error') || name.toLowerCase().includes('fail');
      spans.push({
        traceId: 'parsed-json-trace',
        spanId,
        parentSpanId: parentId,
        depth,
        category: depth === 0 ? 'CONTROLLER' : 'SERVICE',
        name,
        class: typeof data === 'object' && data !== null ? 'JSONObject' : 'JSONProperty',
        method: name,
        thread: 'worker-1',
        startTime: new Date().toISOString(),
        durationMs: Math.max(5, 50 - depth * 8),
        offsetMs: (idCounter - 1) * 12,
        offsetPct: 0,
        widthPct: 15,
        status: isErr ? 'ERROR' : 'OK',
        result: data
      });

      if (typeof data === 'object' && data !== null && depth < 4) {
        Object.entries(data).forEach(([key, val]) => {
          traverse(val, key, spanId, depth + 1);
        });
      }
    };

    traverse(input, 'root-json-payload', null, 0);

    return {
      traceId: 'uploaded-json-tree',
      name: 'uploaded-json-tree',
      category: 'CONTROLLER',
      status: spans.some((s) => s.status === 'ERROR') ? 'ERROR' : 'OK',
      startTime: new Date().toISOString(),
      startLabel: new Date().toLocaleTimeString(),
      durationMs: spans.reduce((sum, s) => sum + s.durationMs, 0),
      spanCount: spans.length,
      errorCount: spans.filter((s) => s.status === 'ERROR').length,
      dropped: 0,
      spans
    };
  };

  return (
    <div className="w-full min-h-[calc(100vh-65px)] mt-[65px] p-8 max-w-5xl mx-auto space-y-6">
      <div className="pb-4 border-b border-white/[0.08]">
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
          <span>JSON Trace Importer</span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            Node Graph Parser
          </span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Upload or paste any JSON telemetry trace or payload to view it immediately in both horizontal and vertical circular node graph format.
        </p>
      </div>

      {/* File Drag & Drop / Input */}
      <div className="p-6 rounded-2xl bg-[#0e1222]/80 border border-dashed border-white/15 flex flex-col items-center justify-center text-center hover:border-cyan-500/40 transition-colors">
        <input
          type="file"
          accept=".json"
          id="file-upload"
          onChange={handleFileUpload}
          className="hidden"
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer flex flex-col items-center gap-2 text-xs text-slate-400 hover:text-white"
        >
          <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center text-cyan-400 text-lg">
            📂
          </div>
          <span className="font-semibold text-slate-200">
            Click to upload a .json file or drag & drop here
          </span>
          <span className="text-[11px] text-slate-500">
            Supports TraceRecord, list of Spans, or nested JSON structures
          </span>
        </label>
      </div>

      {/* Text Area */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
          <span>JSON Text Payload</span>
          {jsonText && (
            <button
              onClick={() => setJsonText('')}
              className="text-slate-400 hover:text-rose-400 text-[11px]"
            >
              Clear
            </button>
          )}
        </div>
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder="Paste JSON trace content here..."
          className="w-full h-80 p-4 rounded-2xl text-xs font-mono bg-black/60 border border-white/10 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-400/60 resize-none leading-relaxed"
        />
      </div>

      {parseError && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-mono">
          {parseError}
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={handleParseAndVisualize}
        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-sm shadow-xl shadow-blue-500/30 transition-all flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="6" cy="6" r="3" />
          <circle cx="18" cy="18" r="3" />
          <path d="M8.5 8.5l7 7" />
        </svg>
        Parse JSON & Render Graph Form
      </button>
    </div>
  );
};
