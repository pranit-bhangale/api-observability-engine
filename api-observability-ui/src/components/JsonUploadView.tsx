import React, { useState } from 'react';
import type { TraceRecord } from '../types';
import { parseUploadedJson } from '../utils/jsonParser';

interface JsonUploadViewProps {
  onVisualizeTrace: (trace: TraceRecord, allTraces?: TraceRecord[]) => void;
}

export const JsonUploadView: React.FC<JsonUploadViewProps> = ({ onVisualizeTrace }) => {
  const [jsonText, setJsonText] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseSuccess, setParseSuccess] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleParseAndVisualize = () => {
    setParseError(null);
    setParseSuccess(null);

    if (!jsonText.trim()) {
      setParseError('Please upload a JSON file or paste JSON text first.');
      return;
    }

    try {
      const result = parseUploadedJson(jsonText);
      setParseSuccess(`Success: ${result.summary}`);
      // Give a tiny flash of success then navigate
      setTimeout(() => {
        onVisualizeTrace(result.trace, result.allTraces);
      }, 150);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setParseError(`Parser Error: ${msg}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError(null);
    setParseSuccess(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonText(content);
    };
    reader.onerror = () => {
      setParseError('Failed to read file from disk.');
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full min-h-[calc(100vh-66px)] mt-[66px] pt-6 sm:pt-8 pb-12 px-3 sm:px-6 max-w-4xl mx-auto space-y-4">
      <div className="rounded-2xl bg-white border border-[#CBD5E1] p-4 sm:p-6 shadow-card space-y-4">
        {/* Header */}
        <div className="pb-3 border-b border-[#CBD5E1] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#263238] tracking-tight flex items-center gap-2">
              <span>JSON Trace Importer</span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
                Graph Visualizer
              </span>
            </h1>
            <p className="text-xs text-[#475569] mt-1 leading-relaxed">
              Upload telemetry JSON, OpenTelemetry payloads, trace span arrays, or arbitrary JSON to instantly explore as an interactive node graph.
            </p>
          </div>
          {fileName && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-[#F8FAFC] border border-[#CBD5E1] text-[#263238] shrink-0">
              📄 {fileName}
            </span>
          )}
        </div>

        {/* File Drag & Drop / Input */}
        <div className="p-4 sm:p-5 rounded-xl bg-[#F8FAFC] border-2 border-dashed border-[#CBD5E1] flex flex-col items-center justify-center text-center hover:border-[#2563EB] hover:bg-white transition-all cursor-pointer">
          <input
            type="file"
            accept=".json,application/json"
            id="file-upload"
            onChange={handleFileUpload}
            className="hidden"
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer flex flex-col items-center gap-2 text-xs text-[#475569] hover:text-[#263238] w-full"
          >
            <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB] text-lg shadow-xs">
              📂
            </div>
            <span className="font-bold text-[#263238]">
              {fileName ? `Loaded: ${fileName} (Click to select another file)` : 'Click to select a .json file or drag & drop here'}
            </span>
            <span className="text-[11px] text-[#64748B]">
              Supports TraceRecord, OpenTelemetry spans, or arbitrary nested JSON
            </span>
          </label>
        </div>

        {/* Text Area */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-[#263238]">
            <span className="flex items-center gap-1.5">
              <span>JSON Payload</span>
              {jsonText && (
                <span className="font-mono text-[10px] text-[#64748B] font-normal">
                  ({jsonText.length.toLocaleString()} characters)
                </span>
              )}
            </span>
            {jsonText && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    try {
                      const p = JSON.parse(jsonText);
                      setJsonText(JSON.stringify(p, null, 2));
                    } catch {}
                  }}
                  className="text-[#2563EB] hover:underline text-[11px] font-semibold"
                >
                  Format JSON
                </button>
                <span>•</span>
                <button
                  onClick={() => {
                    setJsonText('');
                    setFileName(null);
                    setParseError(null);
                    setParseSuccess(null);
                  }}
                  className="text-rose-600 hover:underline text-[11px] font-semibold"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
          <textarea
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              setParseError(null);
              setParseSuccess(null);
            }}
            placeholder="Paste raw JSON trace, OpenTelemetry spans, or payload content here..."
            className="w-full h-56 sm:h-64 p-3.5 rounded-xl text-xs font-mono bg-[#F8FAFC] border border-[#CBD5E1] text-[#263238] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] focus:bg-white resize-none leading-relaxed transition-colors"
          />
        </div>

        {/* Error notification */}
        {parseError && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-mono flex items-start gap-2">
            <span className="font-bold text-sm">⚠️</span>
            <div className="flex-1 break-words">{parseError}</div>
          </div>
        )}

        {/* Success notification */}
        {parseSuccess && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <span className="text-emerald-600 text-sm">✓</span>
            <span>{parseSuccess}</span>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleParseAndVisualize}
          className="btn-run w-full py-2.5 rounded-lg text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="6" cy="6" r="3" />
            <circle cx="18" cy="18" r="3" />
            <path d="M8.5 8.5l7 7" />
          </svg>
          <span>Parse JSON &amp; Render Graph</span>
        </button>
      </div>
    </div>
  );
};
