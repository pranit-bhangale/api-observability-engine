import React from 'react';
import type { SessionInfo, ViewTab } from '../types';

interface HeaderNavProps {
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  session: SessionInfo | null;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  onClearTraces: () => void;
  traceCount: number;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  activeTab,
  onTabChange,
  session,
  autoRefresh,
  onToggleAutoRefresh,
  onClearTraces,
  traceCount,
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3.5 backdrop-blur-xl bg-[#090b14]/75 border-b border-white/[0.07] shadow-2xl">
      {/* Brand & Live Indicator */}
      <div className="flex items-center gap-3.5">
        <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-[1px] shadow-lg shadow-blue-500/20">
          <div className="w-full h-full bg-[#0d0f18] rounded-[11px] flex items-center justify-center">
            <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12h5l3 7 4-14 3 7h5" />
            </svg>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold tracking-tight text-white text-[15px]">API Observability</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Live Engine
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">io.github.pranit • Spring Boot 4.1</span>
        </div>
      </div>

      {/* Floating Pill Navigation (Image 2 style) */}
      <nav className="flex items-center p-1.5 rounded-full bg-[#10131f]/90 border border-white/[0.09] shadow-inner backdrop-blur-2xl">
        <button
          onClick={() => onTabChange('dashboard')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
            activeTab === 'dashboard'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
          }`}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect width="7" height="9" x="3" y="3" rx="1" />
            <rect width="7" height="5" x="14" y="3" rx="1" />
            <rect width="7" height="9" x="14" y="12" rx="1" />
            <rect width="7" height="5" x="3" y="16" rx="1" />
          </svg>
          Dashboard
        </button>

        <button
          onClick={() => onTabChange('trace')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
            activeTab === 'trace'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
          }`}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="6" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <path d="M18 9a9 9 0 0 1-9 9" />
          </svg>
          Trace Graph
          {traceCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white">
              {traceCount}
            </span>
          )}
        </button>

        <button
          onClick={() => onTabChange('endpoint')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
            activeTab === 'endpoint'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
          }`}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="6 3 20 12 6 21 6 3" />
          </svg>
          Endpoint Runner
        </button>

        <button
          onClick={() => onTabChange('jsonUpload')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
            activeTab === 'jsonUpload'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
          }`}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          JSON Upload
        </button>
      </nav>

      {/* Right Actions: Auto-refresh, Clear, User Role */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onToggleAutoRefresh}
          title={autoRefresh ? 'Auto-refresh ON (every 3s)' : 'Auto-refresh OFF'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            autoRefresh
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-white/[0.03] text-slate-400 border-white/[0.07] hover:bg-white/[0.06]'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
          Auto
        </button>

        <button
          onClick={onClearTraces}
          title="Clear all stored traces"
          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-white/[0.07] hover:border-rose-500/20 transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
        </button>

        {/* Role Badge */}
        <div className="flex items-center gap-2 pl-2 border-l border-white/10">
          <div className="flex flex-col text-right">
            <span className="text-[11px] font-semibold text-white tracking-wide">
              {session?.username || 'admin'}
            </span>
            <span className="text-[9px] font-mono text-cyan-400 font-semibold tracking-wider">
              {session?.role || 'ADMIN / DEVELOPER'}
            </span>
          </div>
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center text-xs font-bold text-white shadow-md">
            {(session?.username || 'A')[0].toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
};
