import React, { useState, useEffect } from 'react';
import type { ObservedEndpoint, TraceRecord } from '../types';
import { executeEndpointRequest, type EndpointExecutionResult } from '../api';

interface EndpointRunnerProps {
  endpoints: ObservedEndpoint[];
  initialEndpoint?: ObservedEndpoint | null;
  onOpenGeneratedTrace: (trace: TraceRecord) => void;
  onRefreshTraces: () => Promise<TraceRecord[]>;
}

export const EndpointRunner: React.FC<EndpointRunnerProps> = ({
  endpoints,
  initialEndpoint,
  onOpenGeneratedTrace,
  onRefreshTraces,
}) => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<ObservedEndpoint | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');

  // Request form state
  const [method, setMethod] = useState<string>('GET');
  const [url, setUrl] = useState<string>('');
  const [requestTab, setRequestTab] = useState<'body' | 'headers' | 'params'>('body');
  const [bodyText, setBodyText] = useState<string>('');
  const [headers, setHeaders] = useState<Array<{ key: string; value: string }>>([
    { key: 'Content-Type', value: 'application/json' },
  ]);
  const [params, setParams] = useState<Array<{ key: string; value: string }>>([]);

  // Execution state
  const [loading, setLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<EndpointExecutionResult | null>(null);
  const [copiedRes, setCopiedRes] = useState<boolean>(false);

  // Set initial selected endpoint or first available
  useEffect(() => {
    if (initialEndpoint) {
      selectEndpoint(initialEndpoint);
    } else if (endpoints.length > 0 && !selectedEndpoint) {
      selectEndpoint(endpoints[0]);
    }
  }, [initialEndpoint, endpoints]);

  const selectEndpoint = (ep: ObservedEndpoint) => {
    setSelectedEndpoint(ep);
    setMethod(ep.method);
    setUrl(ep.path);

    if (ep.sampleBody) {
      setBodyText(ep.sampleBody);
      setRequestTab('body');
    } else {
      setBodyText('');
      setRequestTab('headers');
    }

    if (ep.sampleHeaders && Object.keys(ep.sampleHeaders).length > 0) {
      setHeaders(
        Object.entries(ep.sampleHeaders).map(([key, value]) => ({ key, value }))
      );
    } else {
      setHeaders([{ key: 'Content-Type', value: 'application/json' }]);
    }
  };

  const handleSend = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setResponse(null);

    // Build headers map
    const headerMap: Record<string, string> = {};
    headers.forEach((h) => {
      if (h.key.trim()) headerMap[h.key.trim()] = h.value.trim();
    });

    // Build query params
    let finalUrl = url.trim();
    const validParams = params.filter((p) => p.key.trim());
    if (validParams.length > 0) {
      const q = new URLSearchParams();
      validParams.forEach((p) => q.append(p.key.trim(), p.value.trim()));
      finalUrl += (finalUrl.includes('?') ? '&' : '?') + q.toString();
    }

    const result = await executeEndpointRequest(method, finalUrl, headerMap, bodyText);
    setResponse(result);
    setLoading(false);
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(bodyText);
      setBodyText(JSON.stringify(parsed, null, 2));
    } catch {
      // invalid json
    }
  };

  const handleViewTrace = async () => {
    const updated = await onRefreshTraces();
    if (updated.length > 0) {
      onOpenGeneratedTrace(updated[0]);
    }
  };

  const filteredEndpoints = endpoints.filter((ep) => {
    const matchesSearch =
      ep.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ep.controllerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ep.methodName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMethod = methodFilter === 'ALL' || ep.method === methodFilter;
    return matchesSearch && matchesMethod;
  });

  return (
    <div className="w-full h-[calc(100vh-65px)] mt-[65px] flex overflow-hidden bg-[#070911]">
      {/* Left Sidebar: Discovered Endpoints list */}
      <aside className="w-80 h-full border-r border-white/[0.08] bg-[#0c0f1c]/90 backdrop-blur-xl flex flex-col shrink-0">
        <div className="p-4 border-b border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              API Registry ({endpoints.length})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Filter endpoints..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-black/40 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/50"
            />
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="px-2 py-1.5 rounded-lg text-xs bg-black/40 border border-white/10 text-slate-300 focus:outline-none"
            >
              <option value="ALL">All</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
        </div>

        {/* Endpoints List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredEndpoints.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No matching endpoints discovered.
            </div>
          ) : (
            filteredEndpoints.map((ep) => {
              const isSelected = selectedEndpoint?.id === ep.id;
              return (
                <div
                  key={ep.id}
                  onClick={() => selectEndpoint(ep)}
                  className={`p-2.5 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-600/20 border border-blue-500/40 text-white'
                      : 'hover:bg-white/[0.04] text-slate-300 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[9px] font-bold font-mono px-1.5 py-0.2 rounded uppercase ${
                        ep.method === 'GET'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : ep.method === 'POST'
                          ? 'bg-blue-500/15 text-blue-400'
                          : ep.method === 'PUT'
                          ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-rose-500/15 text-rose-400'
                      }`}
                    >
                      {ep.method}
                    </span>
                    <span className="text-xs font-mono font-medium truncate">{ep.path}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate pl-0.5">
                    {ep.controllerName}.{ep.methodName}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Request & Response Runner Area */}
      <main className="flex-1 h-full flex flex-col overflow-hidden">
        {/* Top URL Bar */}
        <div className="p-4 border-b border-white/[0.08] bg-[#0c0f1c]/60 flex items-center gap-3">
          {/* Method selector */}
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-bold font-mono bg-[#141828] text-white border border-white/15 focus:outline-none focus:border-cyan-400"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="PATCH">PATCH</option>
          </select>

          {/* URL Input */}
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://localhost:8080/api/v1/resource or relative /api/..."
            className="flex-1 px-4 py-2 rounded-xl text-xs font-mono bg-black/40 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:opacity-50 shadow-lg shadow-blue-500/25 transition-all shrink-0"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
            Send Request
          </button>
        </div>

        {/* Split Runner Workspace (Request Top / Response Bottom) */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-white/[0.08]">
          {/* Request Configuration Panel */}
          <div className="flex-1 h-full flex flex-col overflow-hidden bg-[#090b14]">
            {/* Request Tabs Header */}
            <div className="flex items-center justify-between px-4 pt-3 border-b border-white/[0.06] bg-[#0c0f1c]/30">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setRequestTab('body')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 ${
                    requestTab === 'body'
                      ? 'text-cyan-400 border-cyan-400 bg-white/[0.04]'
                      : 'text-slate-400 border-transparent hover:text-slate-200'
                  }`}
                >
                  Body (JSON)
                </button>
                <button
                  onClick={() => setRequestTab('headers')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 ${
                    requestTab === 'headers'
                      ? 'text-cyan-400 border-cyan-400 bg-white/[0.04]'
                      : 'text-slate-400 border-transparent hover:text-slate-200'
                  }`}
                >
                  Headers ({headers.length})
                </button>
                <button
                  onClick={() => setRequestTab('params')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 ${
                    requestTab === 'params'
                      ? 'text-cyan-400 border-cyan-400 bg-white/[0.04]'
                      : 'text-slate-400 border-transparent hover:text-slate-200'
                  }`}
                >
                  Params ({params.length})
                </button>
              </div>

              {requestTab === 'body' && (
                <button
                  onClick={handleFormatJson}
                  className="text-[11px] font-mono text-cyan-400 hover:underline mb-1"
                >
                  Format JSON
                </button>
              )}
            </div>

            {/* Request Tab Contents */}
            <div className="flex-1 p-4 overflow-y-auto">
              {requestTab === 'body' && (
                <textarea
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  placeholder="Enter request JSON body here..."
                  className="w-full h-full min-h-[240px] p-3 rounded-xl text-xs font-mono bg-black/50 border border-white/10 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-400/50 resize-none leading-relaxed"
                />
              )}

              {requestTab === 'headers' && (
                <div className="space-y-2">
                  {headers.map((h, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Header Key (e.g. Authorization)"
                        value={h.key}
                        onChange={(e) => {
                          const next = [...headers];
                          next[i].key = e.target.value;
                          setHeaders(next);
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg text-xs font-mono bg-black/40 border border-white/10 text-white placeholder-slate-600 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Header Value"
                        value={h.value}
                        onChange={(e) => {
                          const next = [...headers];
                          next[i].value = e.target.value;
                          setHeaders(next);
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg text-xs font-mono bg-black/40 border border-white/10 text-white placeholder-slate-600 focus:outline-none"
                      />
                      <button
                        onClick={() => setHeaders(headers.filter((_, idx) => idx !== i))}
                        className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setHeaders([...headers, { key: '', value: '' }])}
                    className="text-xs font-semibold text-cyan-400 hover:underline pt-2 block"
                  >
                    + Add Header
                  </button>
                </div>
              )}

              {requestTab === 'params' && (
                <div className="space-y-2">
                  {params.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Parameter Name"
                        value={p.key}
                        onChange={(e) => {
                          const next = [...params];
                          next[i].key = e.target.value;
                          setParams(next);
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg text-xs font-mono bg-black/40 border border-white/10 text-white placeholder-slate-600 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Parameter Value"
                        value={p.value}
                        onChange={(e) => {
                          const next = [...params];
                          next[i].value = e.target.value;
                          setParams(next);
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg text-xs font-mono bg-black/40 border border-white/10 text-white placeholder-slate-600 focus:outline-none"
                      />
                      <button
                        onClick={() => setParams(params.filter((_, idx) => idx !== i))}
                        className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setParams([...params, { key: '', value: '' }])}
                    className="text-xs font-semibold text-cyan-400 hover:underline pt-2 block"
                  >
                    + Add Parameter
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Response Viewer Panel */}
          <div className="flex-1 h-full flex flex-col overflow-hidden bg-[#070912]">
            {/* Response Status Bar */}
            <div className="flex items-center justify-between p-3.5 border-b border-white/[0.08] bg-[#0c0f1c]/40">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Response</span>

              {response && (
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                      response.status >= 200 && response.status < 300
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {response.status} {response.statusText}
                  </span>

                  <span className="text-xs font-mono text-cyan-400">
                    ⏱ {response.durationMs} ms
                  </span>

                  <span className="text-xs font-mono text-slate-400">
                    {(response.sizeBytes / 1024).toFixed(2)} KB
                  </span>

                  {/* Button to jump into generated trace */}
                  <button
                    onClick={handleViewTrace}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/30 transition-all"
                  >
                    <span>⚡ View Live Trace</span>
                  </button>
                </div>
              )}
            </div>

            {/* Response Body Viewer */}
            <div className="flex-1 p-4 overflow-y-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs gap-3">
                  <div className="w-8 h-8 border-2 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin" />
                  <span>Executing request against server...</span>
                </div>
              ) : response ? (
                <div className="relative h-full flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono text-slate-400">JSON Payload Response:</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          typeof response.body === 'object'
                            ? JSON.stringify(response.body, null, 2)
                            : String(response.body)
                        );
                        setCopiedRes(true);
                        setTimeout(() => setCopiedRes(false), 2000);
                      }}
                      className="text-xs font-mono text-cyan-400 hover:underline"
                    >
                      {copiedRes ? '✓ Copied' : 'Copy Response'}
                    </button>
                  </div>
                  <pre className="flex-1 p-4 rounded-xl bg-black/60 border border-white/10 text-xs font-mono text-slate-200 overflow-auto leading-relaxed">
                    {typeof response.body === 'object'
                      ? JSON.stringify(response.body, null, 2)
                      : String(response.body)}
                  </pre>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs text-center p-6">
                  <div className="text-3xl mb-2">🚀</div>
                  <p className="font-semibold text-slate-400 mb-1">Send a request to inspect live response</p>
                  <p className="max-w-xs text-slate-500 text-[11px]">
                    Requests execute against the application backend and automatically record full method execution traces.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
