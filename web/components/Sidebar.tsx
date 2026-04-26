'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileClock,
  Globe,
  History,
  Linkedin,
  MessageSquare,
  Moon,
  PauseCircle,
  PlusCircle,
  Settings,
  Sun,
  Trash2,
} from 'lucide-react';

import { useCouncilStore } from '@/store/councilStore';

import { ThemeSync } from './ThemeSync';

export function Sidebar() {
  const {
    resetAll,
    theme,
    toggleTheme,
    sessions,
    loadSession,
    deleteSession,
    currentSessionId,
  } = useCouncilStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const router = useRouter();

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(date);
    } catch {
      return 'Unknown date';
    }
  };

  return (
    <aside
      className={`relative z-10 flex h-full flex-col border-r border-[var(--border-base)] bg-[var(--bg-panel)]/95 transition-all duration-300 ${
        isCollapsed ? 'w-24' : 'w-80'
      }`}
    >
      <button
        onClick={() => setIsCollapsed((value) => !value)}
        className="absolute -right-4 top-6 z-50 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-base)] bg-[var(--bg-panel)] text-[var(--text-muted)] shadow-md transition-colors hover:text-cyan-500"
        title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
      >
        {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
      </button>

      <ThemeSync />

      <div
        className={`flex h-20 items-center overflow-hidden border-b border-[var(--border-base)] p-4 ${
          isCollapsed ? 'justify-center' : ''
        }`}
      >
        <button
          onClick={() => setIsCollapsed((value) => !value)}
          className="flex-shrink-0 text-cyan-500 transition-transform hover:scale-110 hover:text-cyan-400 active:scale-95"
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          <MessageSquare className="h-6 w-6" />
        </button>
        <div
          className={`ml-2 overflow-hidden transition-all duration-300 ${
            isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
          }`}
        >
          <h1 className="cursor-default whitespace-nowrap text-xl font-bold tracking-[-0.08em] text-cyan-500">
            LLM COUNCIL
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Mission Control for critique-driven answers
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <button
          onClick={() => {
            resetAll();
            router.push('/');
          }}
          className={`flex items-center justify-center gap-2 rounded-md bg-indigo-600 font-mono text-sm uppercase tracking-wide text-white shadow-lg shadow-indigo-500/20 transition-colors hover:bg-indigo-500 ${
            isCollapsed ? 'h-8 w-8 rounded-full p-0' : 'w-full px-4 py-2'
          }`}
          title="Summon New Council"
        >
          <PlusCircle className="h-4 w-4" />
          {!isCollapsed && <span>Summon New</span>}
        </button>

        <a
          href="/config"
          className={`flex items-center justify-center gap-2 rounded-md border border-[var(--border-base)] bg-[var(--bg-panel-secondary)] font-mono text-sm uppercase tracking-wide text-[var(--text-main)] transition-colors hover:bg-[var(--bg-app)] ${
            isCollapsed ? 'h-8 w-8 rounded-full p-0' : 'w-full px-4 py-2'
          }`}
          title="System Config"
        >
          <Settings className="h-4 w-4" />
          {!isCollapsed && <span>Config</span>}
        </a>

        <div
          className={`rounded-xl border border-[var(--border-base)] bg-[var(--bg-panel-secondary)]/80 p-3 transition-all ${
            isCollapsed ? 'flex flex-col items-center gap-2' : 'space-y-3'
          }`}
        >
          {!isCollapsed && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-500">
                Built by Pranav
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Portfolio and LinkedIn
              </p>
            </div>
          )}

          <div className={`grid gap-2 ${isCollapsed ? 'w-full' : 'grid-cols-2'}`}>
            <a
              href="https://pranavds-codes.github.io/portfolio/"
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/10 text-cyan-100 transition-colors hover:bg-cyan-500/20 ${
                isCollapsed ? 'h-9 w-9 self-center rounded-full p-0' : 'px-3 py-2 text-sm font-medium'
              }`}
              title="Portfolio"
            >
              <Globe className="h-4 w-4" />
              {!isCollapsed && <span>Portfolio</span>}
            </a>

            <a
              href="https://www.linkedin.com/in/pranav-pant-ds/"
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center justify-center gap-2 rounded-lg border border-sky-500/20 bg-sky-500/10 text-sky-100 transition-colors hover:bg-sky-500/20 ${
                isCollapsed ? 'h-9 w-9 self-center rounded-full p-0' : 'px-3 py-2 text-sm font-medium'
              }`}
              title="LinkedIn"
            >
              <Linkedin className="h-4 w-4" />
              {!isCollapsed && <span>LinkedIn</span>}
            </a>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {!isCollapsed && (
          <div className="mb-3 flex items-center gap-2 px-2 text-xs font-bold uppercase text-[var(--text-muted)] text-opacity-70 animate-in fade-in duration-300">
            <History className="h-3 w-3" />
            Session History
          </div>
        )}

        <div className="space-y-2">
          {sessions.length === 0 && !isCollapsed && (
            <div className="py-4 text-center text-xs italic text-[var(--text-muted)] opacity-50">
              No recorded mandates.
            </div>
          )}

          {sessions.map((session) => {
            const isActive = session.id === currentSessionId;
            return (
              <div
                key={session.id}
                onClick={() => {
                  loadSession(session.id);
                  router.push('/');
                }}
                className={`group relative cursor-pointer transition-all ${
                  isCollapsed
                    ? 'flex flex-col items-center justify-center gap-1 rounded-none p-2 md:rounded-lg'
                    : 'rounded-none p-3 text-left md:rounded-lg'
                } ${
                  isActive
                    ? 'border-l-4 border-l-cyan-500 rounded-l-none bg-[var(--bg-panel-secondary)] md:rounded-l-lg'
                    : 'border-y border-l-4 border-l-transparent border-transparent hover:border-[var(--border-base)] hover:bg-[var(--bg-panel-secondary)]'
                }`}
                title={isCollapsed ? `Session from ${formatDate(session.date)}` : ''}
              >
                {isCollapsed ? (
                  <>
                    <FileClock
                      className={`h-5 w-5 ${
                        isActive
                          ? 'text-cyan-500'
                          : 'text-[var(--text-muted)] group-hover:text-indigo-500'
                      }`}
                    />
                    <span className="w-full truncate px-0.5 text-center text-[9px] text-[var(--text-muted)] opacity-80">
                      {session.query}
                    </span>
                  </>
                ) : (
                  <>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteSession(session.id);
                      }}
                      className="absolute right-2 top-2 z-10 rounded-full p-1.5 text-[var(--text-muted)] opacity-0 transition-all hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100"
                      title="Delete Session"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>

                    <div className="mb-1 flex items-start justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                        {formatDate(session.date)}
                      </span>
                      <div className="flex items-center gap-2">
                        {session.status === 'completed' && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        )}
                        {session.status === 'stopped' && (
                          <PauseCircle className="h-3.5 w-3.5 text-amber-500" />
                        )}
                        {session.status === 'error' && (
                          <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                        )}
                        {isActive && <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-500" />}
                      </div>
                    </div>

                    <div
                      className={`mb-1 break-words pr-6 text-sm font-medium leading-snug line-clamp-4 ${
                        isActive
                          ? 'text-cyan-600 dark:text-cyan-400'
                          : 'text-[var(--text-main)]'
                      }`}
                    >
                      {session.query}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[var(--border-base)] bg-[var(--bg-panel)] px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        {session.agents.filter((agent) => agent.selected).length} agents
                      </span>
                      <span className="rounded-full border border-[var(--border-base)] bg-[var(--bg-panel)] px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        {session.status}
                      </span>
                    </div>

                    <div className="mt-2 line-clamp-3 text-[10px] text-[var(--text-muted)] opacity-70">
                      {session.summary}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div
        className={`flex items-center border-t border-[var(--border-base)] p-4 ${
          isCollapsed ? 'justify-center' : 'justify-between'
        }`}
      >
        {!isCollapsed && (
          <span className="whitespace-nowrap text-xs text-[var(--text-muted)]">
            Council state saved locally
          </span>
        )}

        <button
          onClick={toggleTheme}
          className="rounded-full p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-panel-secondary)] hover:text-[var(--text-main)]"
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
