import React, { useState, useEffect, useMemo } from 'react';
import type { ObservedEndpoint, TraceRecord } from '../types';
import { executeEndpointRequest } from '../api';

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
  const [method, setMethod] = useState<string>('GET');
  const [url, setUrl] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [mobileTab, setMobileTab] = useState<'sidebar' | 'runner'>('runner');
  const [runningEndpointId, setRunningEndpointId] = useState<string | null>(null);

  // Request state
  const [requestTab, setRequestTab] = useState<'body' | 'pathParams' | 'headers' | 'params'>('body');
  const [bodyText, setBodyText] = useState<string>('');
  const [pathParams, setPathParams] = useState<Record<string, string>>({});
  const [headers, setHeaders] = useState<Array<{ key: string; value: string }>>([
    { key: 'Content-Type', value: 'application/json' },
    { key: 'Accept', value: 'application/json' },
  ]);
  const [params, setParams] = useState<Array<{ key: string; value: string }>>([]);

  // Execution state
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: any;
    durationMs: number;
    sizeBytes: number;
  } | null>(null);
  const [copiedRes, setCopiedRes] = useState(false);

  // Sync initial endpoint
  useEffect(() => {
    if (initialEndpoint) {
      selectEndpoint(initialEndpoint);
    } else if (endpoints.length > 0 && !selectedEndpoint) {
      selectEndpoint(endpoints[0]);
    }
  }, [initialEndpoint, endpoints]);

  // Extract path parameters from URL pattern (e.g. /api/todos/{id})
  const detectedPathVars = useMemo(() => {
    const matches = url.match(/\{([a-zA-Z0-9_]+)\}/g);
    if (!matches) return [];
    return Array.from(new Set(matches.map((m) => m.slice(1, -1))));
  }, [url]);

  // Compute resolved URL with path parameters substituted
  const resolvedUrl = useMemo(() => {
    let res = url;
    Object.entries(pathParams).forEach(([k, val]) => {
      res = res.replace(new RegExp(`\\{${k}\\}`, 'g'), val || '1');
    });
    return res;
  }, [url, pathParams]);

  // Generate sensible sample payload for testing
  const generateSamplePayload = (epPath: string, reqType?: string | null): string => {
    const p = epPath.toLowerCase();
    const rt = (reqType || '').toLowerCase();

    if (p.includes('todo') || rt.includes('todo')) {
      return JSON.stringify(
        {
          title: 'Complete Observability Verification',
          description: 'Testing deep method trace execution with child spans',
          priority: 'HIGH',
          assignedUserId: 'USR-DEV-001',
        },
        null,
        2
      );
    }

    if (p.includes('user') || rt.includes('user')) {
      return JSON.stringify(
        {
          username: 'alice_admin',
          email: 'alice@company.com',
          role: 'ADMIN',
          active: true,
        },
        null,
        2
      );
    }

    // Generic JSON
    return JSON.stringify(
      {
        title: 'Sample Item',
        description: 'Testing payload',
        status: 'ACTIVE',
        timestamp: new Date().toISOString(),
      },
      null,
      2
    );
  };

  const selectEndpoint = (ep: ObservedEndpoint) => {
    setSelectedEndpoint(ep);
    setMethod(ep.method);
    setUrl(ep.path);
    setMobileTab('runner');
    setResponse(null);

    // Extract path variables like {id} and initialize dummy value '1'
    const vars = ep.path.match(/\{([a-zA-Z0-9_]+)\}/g)?.map((m) => m.slice(1, -1)) || [];
    const pMap: Record<string, string> = {};
    vars.forEach((v) => {
      pMap[v] = '1';
    });
    setPathParams(pMap);

    // Setup body
    if (['POST', 'PUT', 'PATCH'].includes(ep.method.toUpperCase())) {
      if (ep.body && ep.body.trim()) {
        setBodyText(ep.body);
      } else {
        setBodyText(generateSamplePayload(ep.path, ep.requestType));
      }
      setRequestTab(vars.length > 0 ? 'pathParams' : 'body');
    } else {
      setBodyText('');
      setRequestTab(vars.length > 0 ? 'pathParams' : 'headers');
    }

    // Setup headers
    if (ep.headers && Object.keys(ep.headers).length > 0) {
      setHeaders(
        Object.entries(ep.headers).map(([key, value]) => ({ key, value }))
      );
    } else {
      setHeaders([
        { key: 'Content-Type', value: 'application/json' },
        { key: 'Accept', value: 'application/json' },
      ]);
    }
  };

  const handleSend = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setResponse(null);

    // Build headers map
    const headerMap: Record<string, string> = {};
    headers.forEach((h) => {
      if (h.key.trim()) {
        headerMap[h.key.trim()] = h.value;
      }
    });

    // Resolve URL with path parameters
    let finalUrl = url.trim();
    Object.entries(pathParams).forEach(([k, val]) => {
      finalUrl = finalUrl.replace(new RegExp(`\\{${k}\\}`, 'g'), val.trim() || '1');
    });
    // Fallback: replace any remaining {..} with '1'
    finalUrl = finalUrl.replace(/\{[a-zA-Z0-9_]+\}/g, '1');

    // Append query params
    const validParams = params.filter((p) => p.key.trim() !== '');
    if (validParams.length > 0) {
      const q = new URLSearchParams();
      validParams.forEach((p) => q.append(p.key.trim(), p.value));
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
      // Keep as-is if invalid JSON
    }
  };

  const handlePrefillDummyBody = () => {
    setBodyText(generateSamplePayload(url, selectedEndpoint?.requestType));
  };

  const handleApplyResolvedUrl = () => {
    setUrl(resolvedUrl);
  };

  const handleQuickRun = async (ep: ObservedEndpoint) => {
    setRunningEndpointId(ep.id);
    selectEndpoint(ep);

    // 1. Resolve path variables (e.g. {id} -> 1)
    let targetUrl = ep.path.trim();
    targetUrl = targetUrl.replace(/\{[a-zA-Z0-9_]+\}/g, '1');

    // 2. Prepare headers
    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(ep.headers || {}),
    };

    // 3. Prepare payload for POST / PUT / PATCH
    let reqBody: string | undefined = undefined;
    if (['POST', 'PUT', 'PATCH'].includes(ep.method.toUpperCase())) {
      if (ep.body && ep.body.trim()) {
        reqBody = ep.body;
      } else {
        reqBody = generateSamplePayload(ep.path, ep.requestType);
      }
    }

    try {
      // 4. Actually hit the endpoint on the server!
      const result = await executeEndpointRequest(ep.method, targetUrl, reqHeaders, reqBody);
      setResponse(result);

      // 5. Allow backend to register and persist trace
      await new Promise((resolve) => setTimeout(resolve, 200));
      const updatedTraces = await onRefreshTraces();

      // 6. Find newly generated trace
      if (updatedTraces && updatedTraces.length > 0) {
        const cleanPath = ep.path.split('{')[0].replace(/\/$/, '').toLowerCase();
        const mName = (ep.methodName || '').toLowerCase();
        const cName = (ep.controllerName || '').toLowerCase();

        const matched =
          updatedTraces.find((t) => {
            const tName = (t.name || '').toLowerCase();
            return (
              (mName && tName.includes(mName)) ||
              (cName && tName.includes(cName)) ||
              (cleanPath.length > 2 && tName.includes(cleanPath)) ||
              (t.spans && t.spans.some((s) => (s.name || '').toLowerCase().includes(mName)))
            );
          }) || updatedTraces[0];

        // 7. Redirect to Trace Graph view to view data!
        onOpenGeneratedTrace(matched);
      }
    } catch (err) {
      console.error('Quick run failed:', err);
    } finally {
      setRunningEndpointId(null);
    }
  };

  const handleSendAndRedirect = async () => {
    await handleSend();
    await new Promise((resolve) => setTimeout(resolve, 300));
    const updatedTraces = await onRefreshTraces();
    if (updatedTraces && updatedTraces.length > 0) {
      // Always select the latest newly-generated trace
      onOpenGeneratedTrace(updatedTraces[0]);
    }
  };

  const handleViewTrace = async () => {
    const updatedTraces = await onRefreshTraces();
    if (updatedTraces && updatedTraces.length > 0) {
      // Always select the latest newly-generated trace
      onOpenGeneratedTrace(updatedTraces[0]);
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
    <div className="w-full h-[calc(100vh-66px)] mt-[66px] flex flex-col md:flex-row overflow-hidden bg-[#F1F3F5] select-none">
      {/* Mobile-Only Tab Switcher (hidden on desktop & tablet) */}
      <div className="md:hidden flex items-center justify-between p-2.5 border-b border-[#CBD5E1] bg-white shrink-0">
        <div className="flex items-center gap-1 p-0.5 rounded-full bg-[#F1F5F9] border border-[#CBD5E1] text-xs font-bold w-full">
          <button
            onClick={() => setMobileTab('sidebar')}
            className={`flex-1 py-1.5 rounded-full text-center transition-all ${
              mobileTab === 'sidebar'
                ? 'bg-white text-[#2563EB] shadow-xs'
                : 'text-[#475569]'
            }`}
          >
            📋 API Registry ({endpoints.length})
          </button>
          <button
            onClick={() => setMobileTab('runner')}
            className={`flex-1 py-1.5 rounded-full text-center transition-all ${
              mobileTab === 'runner'
                ? 'bg-white text-[#2563EB] shadow-xs'
                : 'text-[#475569]'
            }`}
          >
            ⚡ Execution Console
          </button>
        </div>
      </div>

      {/* =========================================================================
          LEFT PANEL: DISCOVERED API REGISTRY (Always visible on desktop & tablet)
          ========================================================================= */}
      <aside
        className={`w-full md:w-[360px] lg:w-[380px] h-full border-r border-[#CBD5E1] bg-white flex flex-col shrink-0 overflow-hidden ${
          mobileTab === 'sidebar' ? 'flex' : 'hidden md:flex'
        }`}
      >
        {/* Registry Header & Filters */}
        <div className="p-3.5 border-b border-[#CBD5E1] space-y-2 bg-[#F8FAFC]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-[#263238] uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              API Registry ({endpoints.length})
            </span>
            <span className="text-[10px] font-mono text-[#64748B]">Spring Contracts</span>
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="Search by path or method..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-2.5 py-1.5 rounded-lg text-xs bg-white border border-[#CBD5E1] text-[#263238] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] transition-colors"
            />
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg text-xs bg-white border border-[#CBD5E1] text-[#263238] focus:outline-none font-bold"
            >
              <option value="ALL">All</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
        </div>

        {/* Endpoints List with Direct "Run →" Button on every item */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
          {filteredEndpoints.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#64748B]">
              No matching endpoints found.
            </div>
          ) : (
            filteredEndpoints.map((ep) => {
              const isSelected = selectedEndpoint?.id === ep.id;
              return (
                <div
                  key={ep.id}
                  onClick={() => selectEndpoint(ep)}
                  className={`p-2.5 rounded-xl cursor-pointer transition-all border flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-[#EFF6FF] border-[#2563EB] text-[#1E3A8A] shadow-xs'
                      : 'hover:bg-[#F8FAFC] text-[#334155] border-[#E2E8F0]'
                  }`}
                >
                  <div className="min-w-0 pr-1 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[9px] font-extrabold font-mono px-2 py-0.5 rounded-full uppercase border shrink-0 ${
                          ep.method === 'GET'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : ep.method === 'POST'
                            ? 'bg-blue-50 text-blue-700 border-blue-300'
                            : ep.method === 'PUT'
                            ? 'bg-amber-50 text-amber-700 border-amber-300'
                            : ep.method === 'PATCH'
                            ? 'bg-purple-50 text-purple-700 border-purple-300'
                            : 'bg-rose-50 text-rose-700 border-rose-300'
                        }`}
                      >
                        {ep.method}
                      </span>
                      <span className="text-xs font-mono font-bold text-[#263238] truncate">{ep.path}</span>
                    </div>
                    <div className="text-[11px] text-[#64748B] truncate pl-0.5">
                      {ep.controllerName}.{ep.methodName}()
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickRun(ep);
                    }}
                    disabled={runningEndpointId === ep.id}
                    className="btn-run px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    title="Execute endpoint & view trace immediately"
                  >
                    {runningEndpointId === ep.id ? (
                      <>
                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Running...</span>
                      </>
                    ) : (
                      <>
                        <span>Run</span>
                        <span>→</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* =========================================================================
          RIGHT PANEL: EXECUTION CONSOLE & WORKSPACE (Always visible on desktop)
          ========================================================================= */}
      <main
        className={`flex-1 min-w-0 h-full flex flex-col overflow-hidden bg-white ${
          mobileTab === 'runner' ? 'flex' : 'hidden md:flex'
        }`}
      >
        {/* Selected Endpoint Info & URL Bar */}
        <div className="p-3.5 border-b border-[#CBD5E1] bg-[#F8FAFC] flex flex-col gap-2.5 shrink-0">
          {/* Endpoint details summary */}
          {selectedEndpoint && (
            <div className="flex items-center justify-between text-xs pb-1 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2 truncate">
                <span className="font-extrabold text-[#263238] truncate">
                  {selectedEndpoint.controllerName}.{selectedEndpoint.methodName}()
                </span>
                <span className="text-[#64748B] hidden sm:inline">
                  • {selectedEndpoint.description || 'Spring Boot Annotated @Observe Endpoint'}
                </span>
              </div>
              <span className="text-[10px] font-mono text-[#2563EB] font-bold shrink-0">
                ID: {selectedEndpoint.id}
              </span>
            </div>
          )}

          {/* URL Input Bar with Big Send Request Button */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setMobileTab('sidebar')}
              className="md:hidden px-3 py-1.5 rounded-lg bg-white border border-[#CBD5E1] text-xs font-bold text-[#263238] flex items-center gap-1"
            >
              <span>📋 APIs</span>
            </button>

            {/* Method selector */}
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="px-3 py-2 rounded-lg text-xs font-extrabold font-mono bg-white text-[#263238] border border-[#CBD5E1] focus:outline-none focus:border-[#2563EB]"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>

            {/* URL input */}
            <div className="flex-1 min-w-[220px]">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="/api/todos or /api/todos/{id}"
                className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-white border border-[#CBD5E1] text-[#263238] placeholder-slate-400 focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            {/* SEND REQUEST BUTTON */}
            <button
              onClick={handleSend}
              disabled={loading}
              className="btn-run px-4 py-2 rounded-lg text-xs font-bold text-white shadow-sm flex items-center gap-1.5 shrink-0"
              title="Execute request against Spring Boot server"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
              <span>{loading ? 'Executing...' : '⚡ Send Request'}</span>
            </button>

            {/* SEND & VIEW TRACE BUTTON */}
            <button
              onClick={handleSendAndRedirect}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-xs font-bold text-[#2563EB] bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] shadow-xs flex items-center gap-1.5 shrink-0 transition-colors"
              title="Execute request and immediately open trace graph"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="6" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M18 9a9 9 0 0 1-9 9" />
              </svg>
              <span>⚡ Run &amp; View Trace</span>
            </button>
          </div>

          {/* Swagger Dynamic Path Variable Banner */}
          {detectedPathVars.length > 0 && (
            <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-[#1E3A8A] text-[11px] flex items-center gap-1">
                  <span>⚡ Swagger Path Variable:</span>
                </span>
                {detectedPathVars.map((varName) => (
                  <div key={varName} className="inline-flex items-center gap-1.5 bg-white px-2 py-0.5 rounded-md border border-[#BFDBFE]">
                    <span className="font-mono text-[11px] font-bold text-[#2563EB]">
                      {`{${varName}}`} =
                    </span>
                    <input
                      type="text"
                      value={pathParams[varName] ?? '1'}
                      onChange={(e) =>
                        setPathParams((prev) => ({ ...prev, [varName]: e.target.value }))
                      }
                      className="w-14 px-1 text-[11px] font-mono text-[#263238] border-b border-[#CBD5E1] focus:outline-none focus:border-[#2563EB]"
                      placeholder="1"
                    />
                  </div>
                ))}
                <span className="text-[#475569] text-[11px] font-mono">
                  → Target: <strong className="text-[#263238]">{resolvedUrl}</strong>
                </span>
              </div>

              {url !== resolvedUrl && (
                <button
                  onClick={handleApplyResolvedUrl}
                  className="text-[11px] font-bold text-[#2563EB] hover:underline shrink-0"
                >
                  Use Resolved URL
                </button>
              )}
            </div>
          )}
        </div>

        {/* Split Request & Response Workspace */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-[#CBD5E1]">
          {/* ================= Request Configuration (Left/Top) ================= */}
          <div className="flex-1 h-full flex flex-col overflow-hidden bg-white">
            {/* Request Tabs Header */}
            <div className="flex items-center justify-between px-3.5 pt-2 border-b border-[#CBD5E1] bg-[#F8FAFC]">
              <div className="flex items-center gap-1">
                {['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && (
                  <button
                    onClick={() => setRequestTab('body')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-t-lg transition-colors border-b-2 ${
                      requestTab === 'body'
                        ? 'text-[#2563EB] border-[#2563EB] bg-white'
                        : 'text-[#64748B] border-transparent hover:text-[#263238]'
                    }`}
                  >
                    Body (JSON)
                  </button>
                )}
                {detectedPathVars.length > 0 && (
                  <button
                    onClick={() => setRequestTab('pathParams')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-t-lg transition-colors border-b-2 ${
                      requestTab === 'pathParams'
                        ? 'text-[#2563EB] border-[#2563EB] bg-white'
                        : 'text-[#64748B] border-transparent hover:text-[#263238]'
                    }`}
                  >
                    Path Variables ({detectedPathVars.length})
                  </button>
                )}
                <button
                  onClick={() => setRequestTab('headers')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-t-lg transition-colors border-b-2 ${
                    requestTab === 'headers'
                      ? 'text-[#2563EB] border-[#2563EB] bg-white'
                      : 'text-[#64748B] border-transparent hover:text-[#263238]'
                  }`}
                >
                  Headers ({headers.length})
                </button>
                <button
                  onClick={() => setRequestTab('params')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-t-lg transition-colors border-b-2 ${
                    requestTab === 'params'
                      ? 'text-[#2563EB] border-[#2563EB] bg-white'
                      : 'text-[#64748B] border-transparent hover:text-[#263238]'
                  }`}
                >
                  Query Params ({params.length})
                </button>
              </div>

              {/* Action buttons on request tab */}
              <div className="flex items-center gap-2 mb-1">
                {requestTab === 'body' && (
                  <>
                    <button
                      onClick={handlePrefillDummyBody}
                      className="text-[11px] font-bold text-[#2563EB] hover:underline"
                    >
                      ⚡ Sample Payload
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={handleFormatJson}
                      className="text-[11px] font-bold text-[#475569] hover:underline"
                    >
                      Format JSON
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Request Content */}
            <div className="flex-1 p-3.5 overflow-y-auto">
              {requestTab === 'body' && (
                <div className="h-full flex flex-col space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                    <span>Request Body (JSON format)</span>
                    <button onClick={() => setBodyText('')} className="text-rose-600 hover:underline">
                      Clear Body
                    </button>
                  </div>
                  <textarea
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    placeholder="Enter JSON request body..."
                    className="w-full flex-1 min-h-[220px] p-3 rounded-xl text-xs font-mono bg-[#F8FAFC] border border-[#CBD5E1] text-[#263238] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] focus:bg-white resize-none leading-relaxed"
                  />
                </div>
              )}

              {requestTab === 'pathParams' && (
                <div className="space-y-3">
                  <p className="text-xs text-[#64748B]">
                    Path parameters are automatically injected into the request URL:
                  </p>
                  <div className="border border-[#CBD5E1] rounded-xl overflow-hidden divide-y divide-[#CBD5E1]">
                    <div className="grid grid-cols-12 bg-[#F8FAFC] p-2.5 text-[11px] font-bold text-[#475569] uppercase tracking-wider">
                      <span className="col-span-4">Parameter Name</span>
                      <span className="col-span-8">Value (Dummy)</span>
                    </div>
                    {detectedPathVars.map((varName) => (
                      <div key={varName} className="grid grid-cols-12 p-2.5 items-center gap-2 bg-white">
                        <span className="col-span-4 font-mono font-bold text-xs text-[#2563EB]">
                          {varName} <span className="text-rose-500">*</span>
                        </span>
                        <div className="col-span-8">
                          <input
                            type="text"
                            value={pathParams[varName] ?? '1'}
                            onChange={(e) =>
                              setPathParams((prev) => ({ ...prev, [varName]: e.target.value }))
                            }
                            placeholder="1"
                            className="w-full px-2.5 py-1.5 rounded-lg text-xs font-mono bg-[#F8FAFC] border border-[#CBD5E1] text-[#263238] focus:outline-none focus:border-[#2563EB] focus:bg-white"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-[11px] text-[#64748B] bg-[#F8FAFC] p-3 rounded-xl border border-[#CBD5E1]">
                    <strong>Target URL:</strong> <code className="text-[#2563EB] font-bold">{resolvedUrl}</code>
                  </div>
                </div>
              )}

              {requestTab === 'headers' && (
                <div className="space-y-2.5">
                  {headers.map((h, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Header Key (e.g. Content-Type)"
                        value={h.key}
                        onChange={(e) => {
                          const next = [...headers];
                          next[i].key = e.target.value;
                          setHeaders(next);
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg text-xs font-mono bg-[#F8FAFC] border border-[#CBD5E1] text-[#263238] focus:outline-none focus:border-[#2563EB] focus:bg-white"
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
                        className="flex-1 px-3 py-1.5 rounded-lg text-xs font-mono bg-[#F8FAFC] border border-[#CBD5E1] text-[#263238] focus:outline-none focus:border-[#2563EB] focus:bg-white"
                      />
                      <button
                        onClick={() => setHeaders(headers.filter((_, idx) => idx !== i))}
                        className="w-7 h-7 rounded text-[#64748B] hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setHeaders([...headers, { key: '', value: '' }])}
                    className="text-xs font-bold text-[#2563EB] hover:underline pt-1 block"
                  >
                    + Add Header
                  </button>
                </div>
              )}

              {requestTab === 'params' && (
                <div className="space-y-2.5">
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
                        className="flex-1 px-3 py-1.5 rounded-lg text-xs font-mono bg-[#F8FAFC] border border-[#CBD5E1] text-[#263238] focus:outline-none focus:border-[#2563EB] focus:bg-white"
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
                        className="flex-1 px-3 py-1.5 rounded-lg text-xs font-mono bg-[#F8FAFC] border border-[#CBD5E1] text-[#263238] focus:outline-none focus:border-[#2563EB] focus:bg-white"
                      />
                      <button
                        onClick={() => setParams(params.filter((_, idx) => idx !== i))}
                        className="w-7 h-7 rounded text-[#64748B] hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={() => setParams([...params, { key: '', value: '' }])}
                      className="text-xs font-bold text-[#2563EB] hover:underline"
                    >
                      + Add Parameter
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={() =>
                        setParams([
                          { key: 'page', value: '0' },
                          { key: 'size', value: '10' },
                        ])
                      }
                      className="text-xs font-bold text-[#475569] hover:underline"
                    >
                      + Quick Pagination (page=0, size=10)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ================= Response Viewer (Right/Bottom) ================= */}
          <div className="flex-1 h-full flex flex-col overflow-hidden bg-white">
            {/* Response Status Bar */}
            <div className="flex items-center justify-between p-3.5 border-b border-[#CBD5E1] bg-[#F8FAFC] shrink-0">
              <span className="text-xs font-extrabold text-[#263238] uppercase tracking-wider">
                Execution Response
              </span>

              {response && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${
                      response.status >= 200 && response.status < 300
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'bg-rose-50 text-rose-700 border-rose-300'
                    }`}
                  >
                    {response.status} {response.statusText}
                  </span>

                  <span className="text-xs font-mono text-[#2563EB] font-bold">
                    ⏱ {response.durationMs} ms
                  </span>

                  {/* Button to view generated trace in Graph view */}
                  <button
                    onClick={handleViewTrace}
                    className="btn-run px-3 py-1 rounded-md text-xs font-bold text-white shadow-xs flex items-center gap-1"
                  >
                    <span>⚡ View in Graph</span>
                  </button>
                </div>
              )}
            </div>

            {/* Response Body Area */}
            <div className="flex-1 p-3.5 overflow-y-auto bg-white">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full text-[#64748B] text-xs gap-3 py-8">
                  <div className="w-8 h-8 border-2 border-[#CBD5E1] border-t-[#2563EB] rounded-full animate-spin" />
                  <span className="font-bold text-[#263238]">Executing request against Spring Boot...</span>
                  <span className="text-[11px] text-[#64748B]">Method interception will record call trace automatically</span>
                </div>
              ) : response ? (
                <div className="relative h-full flex flex-col space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-[#64748B]">Response Body (JSON):</span>
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
                      className="text-xs font-mono text-[#2563EB] hover:underline font-bold"
                    >
                      {copiedRes ? '✓ Copied' : 'Copy JSON'}
                    </button>
                  </div>
                  <pre className="flex-1 p-3.5 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] text-xs font-mono text-[#1E293B] overflow-auto leading-relaxed select-text">
                    {typeof response.body === 'object'
                      ? JSON.stringify(response.body, null, 2)
                      : String(response.body)}
                  </pre>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-[#64748B] text-xs text-center p-6">
                  <div className="w-12 h-12 rounded-2xl bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB] text-2xl shadow-xs mb-3">
                    ⚡
                  </div>
                  <p className="font-extrabold text-[#263238] mb-1 text-sm">Swagger Execution Console</p>
                  <p className="max-w-xs text-[#64748B] text-xs leading-relaxed mb-4">
                    Select any endpoint on the left, check your parameters or body, then click the blue <strong>⚡ Send Request</strong> button above.
                  </p>
                  <button
                    onClick={handleSend}
                    className="btn-run px-4 py-2 rounded-lg text-xs font-bold text-white shadow-sm flex items-center gap-1.5"
                  >
                    <span>⚡ Send Request Now</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EndpointRunner;
