import { useState, useEffect, useCallback } from 'react';
import type { ObservedEndpoint, SessionInfo, TraceRecord, ViewTab } from './types';
import { clearTraces, fetchEndpoints, fetchSession, fetchTraces, logout } from './api';
import { HeaderNav } from './components/HeaderNav';
import { DashboardView } from './components/DashboardView';
import { GraphView } from './components/GraphView';
import { AnalyticsView } from './components/AnalyticsView';
import { EndpointRunner } from './components/EndpointRunner';
import { JsonUploadView } from './components/JsonUploadView';
import { LoginView } from './components/LoginView';

export function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [activeTab, setActiveTab] = useState<ViewTab>('dashboard');
  const [traces, setTraces] = useState<TraceRecord[]>([]);
  const [customTraces, setCustomTraces] = useState<TraceRecord[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<TraceRecord | null>(null);
  const [endpoints, setEndpoints] = useState<ObservedEndpoint[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<ObservedEndpoint | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Load session & live data from backend
  const loadData = useCallback(async () => {
    try {
      const fetchedSession = await fetchSession();
      setSession(fetchedSession);
      setIsCheckingSession(false);

      if (fetchedSession && fetchedSession.authenticated) {
        const [fetchedTraces, fetchedEndpoints] = await Promise.all([
          fetchTraces(),
          fetchEndpoints(),
        ]);

        // Merge custom imported traces with fetched server traces
        const merged = [
          ...customTraces,
          ...fetchedTraces.filter((ft) => !customTraces.some((ct) => ct.traceId === ft.traceId)),
        ];
        setTraces(merged);

        setSelectedTrace((prev) => {
          if (!prev) return customTraces.length > 0 ? customTraces[0] : (fetchedTraces.length > 0 ? fetchedTraces[0] : null);
          // Check if previously selected trace is in custom traces
          const customMatch = customTraces.find((t) => t.traceId === prev.traceId);
          if (customMatch) return customMatch;
          // Check if previously selected trace is in fetched traces
          const fetchedMatch = fetchedTraces.find((t) => t.traceId === prev.traceId);
          return fetchedMatch || prev;
        });

        setEndpoints(fetchedEndpoints);
        return fetchedTraces;
      }
    } catch {
      setIsCheckingSession(false);
    }
    return [];
  }, [customTraces]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh timer (only if authenticated)
  useEffect(() => {
    if (!autoRefresh || !session?.authenticated) return;
    const interval = setInterval(() => {
      loadData();
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, session?.authenticated, loadData]);

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

  const handleVisualizeTrace = (trace: TraceRecord, allTraces?: TraceRecord[]) => {
    const tracesToAdd = allTraces && allTraces.length > 0 ? allTraces : [trace];
    setCustomTraces((prev) => {
      const ids = new Set(tracesToAdd.map((t) => t.traceId));
      return [...tracesToAdd, ...prev.filter((t) => !ids.has(t.traceId))];
    });
    setTraces((prev) => {
      const ids = new Set(tracesToAdd.map((t) => t.traceId));
      return [...tracesToAdd, ...prev.filter((t) => !ids.has(t.traceId))];
    });
    setSelectedTrace(trace);
    setActiveTab('trace');
  };

  const handleClearTraces = async () => {
    if (window.confirm('Are you sure you want to clear all in-memory traces?')) {
      await clearTraces();
      setCustomTraces([]);
      await loadData();
      setSelectedTrace(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    setSession({
      authenticated: false,
      title: 'API Observability',
      username: '',
      role: 'ADMIN',
    });
    setTraces([]);
    setCustomTraces([]);
    setEndpoints([]);
    setSelectedTrace(null);
  };

  // Loading spinner during initial session check
  if (isCheckingSession) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#F1F3F5]">
        <div className="flex flex-col items-center gap-2.5">
          <div className="w-8 h-8 border-2 border-[#CBD5E1] border-t-[#2563EB] rounded-full animate-spin" />
          <span className="text-xs font-bold text-[#263238]">Loading Observability Session...</span>
        </div>
      </div>
    );
  }

  // If not authenticated -> show Login Screen
  if (!session || !session.authenticated) {
    return (
      <div className="min-h-screen w-full bg-[#F1F3F5]">
        <LoginView
          onLoginSuccess={loadData}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      </div>
    );
  }

  // Authenticated Dashboard
  return (
    <div className="min-h-screen bg-[#F1F3F5] flex flex-col font-sans transition-colors duration-150">
      {/* Top Floating Pill Navigation */}
      <HeaderNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        session={session}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={() => setAutoRefresh((prev) => !prev)}
        onClearTraces={handleClearTraces}
        onLogout={handleLogout}
        traceCount={traces.length}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main View Router */}
      <main className="flex-1 w-full flex flex-col">
        {activeTab === 'dashboard' && (
          <DashboardView
            traces={traces}
            endpoints={endpoints}
            onSelectTrace={handleSelectTrace}
            onOpenRunner={handleOpenRunner}
            onNavigateToGraph={() => setActiveTab('trace')}
            onNavigateToJsonUpload={() => setActiveTab('jsonUpload')}
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

        {activeTab === 'analytics' && (
          <AnalyticsView
            traces={traces}
            onSelectTrace={handleSelectTrace}
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
