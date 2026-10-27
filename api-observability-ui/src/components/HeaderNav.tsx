import React from 'react';
import type { SessionInfo, ViewTab } from '../types';

interface HeaderNavProps {
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  session: SessionInfo | null;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  onClearTraces: () => void;
  onLogout: () => void;
  traceCount: number;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  activeTab,
  onTabChange,
  session,
  autoRefresh,
  onToggleAutoRefresh,
  onClearTraces,
  onLogout,
  traceCount,
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-[66px] bg-white border-b border-[#CBD5E1] shadow-xs select-none">
      {/* Centered alignment container matching Dashboard max-w-7xl */}
      <div className="max-w-7xl mx-auto w-full h-full flex items-center justify-between px-4 sm:px-6">
        {/* Brand & Live Indicator */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#2563EB] text-white shadow-xs">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12h5l3 7 4-14 3 7h5" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-[#263238] text-sm sm:text-base">
                API Observability
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="hidden xs:inline">Live</span>
              </span>
            </div>
            <span className="text-[11px] text-[#64748B] font-mono hidden md:block">
              io.github.pranit • Spring Boot
            </span>
          </div>
        </div>

        {/* Floating Pill Navigation */}
        <nav className="flex items-center p-1 rounded-full bg-[#F1F5F9] border border-[#CBD5E1] overflow-x-auto max-w-[50vw] sm:max-w-none no-scrollbar mx-1 sm:mx-2 shrink">
          <button
            onClick={() => onTabChange('dashboard')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'dashboard'
                ? 'bg-white text-[#2563EB] border border-[#CBD5E1] shadow-xs font-bold'
                : 'text-[#475569] hover:text-[#263238] hover:bg-white/60 border border-transparent'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="7" height="9" x="3" y="3" rx="1" />
              <rect width="7" height="5" x="14" y="3" rx="1" />
              <rect width="7" height="9" x="14" y="12" rx="1" />
              <rect width="7" height="5" x="3" y="16" rx="1" />
            </svg>
            <span className="hidden sm:inline">Dashboard</span>
          </button>

          <button
            onClick={() => onTabChange('trace')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'trace'
                ? 'bg-white text-[#2563EB] border border-[#CBD5E1] shadow-xs font-bold'
                : 'text-[#475569] hover:text-[#263238] hover:bg-white/60 border border-transparent'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="6" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M18 9a9 9 0 0 1-9 9" />
            </svg>
            <span className="hidden sm:inline">Trace Graph</span>
            {traceCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#2563EB] text-white font-mono font-bold">
                {traceCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onTabChange('analytics')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'analytics'
                ? 'bg-white text-[#2563EB] border border-[#CBD5E1] shadow-xs font-bold'
                : 'text-[#475569] hover:text-[#263238] hover:bg-white/60 border border-transparent'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            <span className="hidden sm:inline">Analytics</span>
          </button>

          <button
            onClick={() => onTabChange('endpoint')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'endpoint'
                ? 'bg-white text-[#2563EB] border border-[#CBD5E1] shadow-xs font-bold'
                : 'text-[#475569] hover:text-[#263238] hover:bg-white/60 border border-transparent'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="6 3 20 12 6 21 6 3" />
            </svg>
            <span className="hidden sm:inline">Runner</span>
          </button>

          <button
            onClick={() => onTabChange('jsonUpload')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'jsonUpload'
                ? 'bg-white text-[#2563EB] border border-[#CBD5E1] shadow-xs font-bold'
                : 'text-[#475569] hover:text-[#263238] hover:bg-white/60 border border-transparent'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span className="hidden sm:inline">JSON</span>
          </button>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Auto Refresh Toggle */}
          <button
            onClick={onToggleAutoRefresh}
            title={autoRefresh ? 'Auto-refresh ON (every 3s)' : 'Auto-refresh OFF'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              autoRefresh
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold'
                : 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1] hover:bg-white'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
            <span className="hidden sm:inline">Auto</span>
          </button>

          {/* Clear Traces */}
          <button
            onClick={onClearTraces}
            title="Clear in-memory traces"
            className="p-2 rounded-full text-xs text-[#64748B] hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>

          {/* Role & User Avatar */}
          <div className="flex items-center gap-2.5">
            <div className="flex flex-col text-right hidden sm:flex">
              <span className="text-xs font-bold text-[#263238] tracking-wide leading-tight">
                {session?.username || 'admin'}
              </span>
              <span className="text-[10px] font-mono text-[#64748B] font-semibold">
                {session?.role || 'ADMIN'}
              </span>
            </div>

            <div
              className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center text-xs font-extrabold text-white shadow-xs"
              title={`Logged in as ${session?.username || 'admin'}`}
            >
              {(session?.username || 'A')[0].toUpperCase()}
            </div>

            {/* Logout Button */}
            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-2 rounded-full text-xs text-[#64748B] hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
