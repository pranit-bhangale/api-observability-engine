import { useState, useEffect, useCallback } from 'react';
import type { ObservedEndpoint, SessionInfo, TraceRecord, ViewTab } from './types';
import { clearTraces, fetchEndpoints, fetchSession, fetchTraces } from './api';
import { HeaderNav } from './components/HeaderNav';
import { DashboardView } from './components/DashboardView';
import { GraphView } from './components/GraphView';
import { EndpointRunner } from './components/EndpointRunner';
import { JsonUploadView } from './components/JsonUploadView';

export function App() {
  const [activeTab, setActiveTab] = useState<ViewTab>('dashboard');
  const [traces, setTraces] = useState<TraceRecord[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<TraceRecord | null>(null);
  const [endpoints, setEndpoints] = useState<ObservedEndpoint[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<ObservedEndpoint | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Load live data from the backend
  const loadData = useCallback(async () => {
    const [fetchedTraces, fetchedEndpoints, fetchedSession] = await Promise.all([
      fetchTraces(),
      fetchEndpoints(),
      fetchSession(),
    ]);

    setTraces(fetchedTraces);
    setSelectedTrace((prev) => {
      if (!prev) return fetchedTraces.length > 0 ? fetchedTraces[0] : null;
      const match = fetchedTraces.find((t) => t.traceId === prev.traceId);
      return match || (fetchedTraces.length > 0 ? fetchedTraces[0] : null);
    });

    setEndpoints(fetchedEndpoints);

    if (fetchedSession) {
      setSession(fetchedSession);
    }

    return fetchedTraces;
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh timer
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadData();
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  // Actions
  const handleSelectTrace = (trace: TraceRecord) => {
    setSelectedTrace(trace);
    setActiveTab('trace');
  };

  const handleOpenRunner = (endpoint?: ObservedEndpoint) => {
    if (endpoint) {
      setSelectedEndpoint(endpoint);
    }
    setActiveTab('endpoint');
  };

  const handleVisualizeTrace = (trace: TraceRecord) => {
    setTraces((prev) => [trace, ...prev.filter((t) => t.traceId !== trace.traceId)]);
    setSelectedTrace(trace);
    setActiveTab('trace');
  };

  const handleClearTraces = async () => {
    if (window.confirm('Are you sure you want to clear all in-memory traces?')) {
      await clearTraces();
      await loadData();
      setSelectedTrace(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#07080d] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Floating Pill Navigation */}
      <HeaderNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        session={session}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={() => setAutoRefresh((prev) => !prev)}
        onClearTraces={handleClearTraces}
        traceCount={traces.length}
      />

      {/* Main View Router */}
      <main className="flex-1 w-full flex flex-col">
        {activeTab === 'dashboard' && (
          <DashboardView
            traces={traces}
            endpoints={endpoints}
            onSelectTrace={handleSelectTrace}
            onOpenRunner={handleOpenRunner}
          />
        )}

        {activeTab === 'trace' && (
          <GraphView
            trace={selectedTrace}
            traces={traces}
            onSelectTrace={setSelectedTrace}
            onBackToDashboard={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'endpoint' && (
          <EndpointRunner
            endpoints={endpoints}
            initialEndpoint={selectedEndpoint}
            onOpenGeneratedTrace={handleSelectTrace}
            onRefreshTraces={loadData}
          />
        )}

        {activeTab === 'jsonUpload' && (
          <JsonUploadView onVisualizeTrace={handleVisualizeTrace} />
        )}
      </main>
    </div>
  );
}

export default App;
