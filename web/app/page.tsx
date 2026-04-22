'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, Square } from 'lucide-react';

import { AgentSelector } from '@/components/AgentSelector';
import { CouncilTimeline } from '@/components/CouncilTimeline';
import { getSelectedAgents } from '@/lib/councilMeta';
import { useCouncilStore } from '@/store/councilStore';

export default function Home() {
  const {
    query,
    setQuery,
    isStreaming,
    startSession,
    stopSession,
    currentSessionId,
    sessions,
    agents,
  } = useCouncilStore();
  const currentSession = sessions.find((session) => session.id === currentSessionId);
  const activePhase = currentSession?.activePhase || 0;
  const selectedCount = getSelectedAgents(agents).length;
  const hasActiveSession = activePhase > 0;

  const handleSummon = async (event: React.FormEvent) => {
    event.preventDefault();

    if (isStreaming) {
      stopSession();
      return;
    }

    if (!query.trim() || selectedCount === 0) {
      return;
    }

    await startSession();
  };

  const [scrollState, setScrollState] = useState(false);

  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) {
      return;
    }

    const handleScroll = () => {
      setScrollState(main.scrollTop > 40);
    };

    main.addEventListener('scroll', handleScroll);
    return () => main.removeEventListener('scroll', handleScroll);
  }, []);

  const shouldShrink = hasActiveSession || scrollState;
  const latestIssue = currentSession?.issues[currentSession.issues.length - 1];
  const canSubmit = query.trim().length > 0 && selectedCount > 0;

  return (
    <div className="min-h-full">
      {!hasActiveSession && (
        <section
          className={`sticky top-0 z-20 border-b border-[var(--border-base)] bg-[var(--bg-app)]/85 backdrop-blur-xl transition-all duration-700 ${
            shouldShrink ? 'py-4 shadow-[0_18px_60px_-30px_rgba(15,23,42,0.7)]' : 'py-16'
          }`}
        >
          <div className="mx-auto max-w-4xl px-6 text-center">
            {activePhase === 0 && !scrollState && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-500">
                  Council-grade synthesis
                </div>
                <h1 className="bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-500 bg-clip-text text-4xl font-black tracking-[-0.08em] text-transparent md:text-6xl">
                  ASSEMBLE THE COUNCIL
                </h1>
                <p className="mx-auto mt-4 max-w-2xl text-base text-[var(--text-muted)] md:text-lg">
                  Launch a multi-agent review board that argues from competing perspectives,
                  critiques itself, and delivers a tighter final answer with visible reasoning
                  and metrics.
                </p>
              </div>
            )}

            <form onSubmit={handleSummon} className="mt-8 space-y-5">
              <div className="transition-all duration-500">
                <AgentSelector />
              </div>

              <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                <span className="rounded-full border border-[var(--border-base)] bg-[var(--bg-panel)] px-3 py-1.5">
                  {selectedCount} agent{selectedCount === 1 ? '' : 's'} selected
                </span>
                <span className="rounded-full border border-[var(--border-base)] bg-[var(--bg-panel)] px-3 py-1.5">
                  {isStreaming ? 'Live session in progress' : 'Ready to brief'}
                </span>
                {currentSession?.status === 'stopped' && (
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-amber-500">
                    Session interrupted
                  </span>
                )}
              </div>

              <div
                className={`group relative mx-auto max-w-3xl origin-top transition-all duration-700 ${
                  shouldShrink ? 'scale-[0.97]' : 'scale-100'
                }`}
              >
                <div className="absolute -inset-[1px] rounded-[28px] bg-gradient-to-r from-cyan-500/30 via-sky-400/20 to-indigo-500/30 blur-sm transition duration-700 group-hover:opacity-100" />
                <div className="relative overflow-hidden rounded-[28px] border border-[var(--border-base)] bg-[var(--bg-panel)]/95 p-3 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.9)]">
                  <div className="mb-3 flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    <span>Mandate</span>
                    <span>{query.trim().length}/4000</span>
                  </div>
                  <div className="flex items-end gap-3">
                    <textarea
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Enter the question, decision, or topic you want the council to pressure-test..."
                      rows={Math.min(10, Math.max(2, query.split('\n').length))}
                      className="min-h-[92px] max-h-[320px] flex-1 resize-none overflow-y-auto bg-transparent px-4 py-3 text-[var(--text-main)] placeholder-[var(--text-muted)] outline-none"
                      disabled={isStreaming}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          void handleSummon(event);
                        }
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!isStreaming && !canSubmit}
                      className={`mb-2 inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition-all ${
                        isStreaming
                          ? 'bg-red-500 hover:bg-red-600'
                          : 'bg-gradient-to-r from-cyan-600 to-indigo-600 hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50'
                      }`}
                    >
                      {isStreaming ? (
                        <>
                          <Square className="h-4 w-4 fill-current" />
                          Stop
                        </>
                      ) : (
                        <>
                          Summon
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3 px-2 text-sm text-[var(--text-muted)]">
                    <span>Press Enter to launch. Shift+Enter adds a new line.</span>
                    {!canSubmit && !isStreaming && (
                      <span className="text-amber-500">
                        Pick at least one agent and enter a prompt.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </form>

            {latestIssue && (
              <div className="mx-auto mt-5 max-w-3xl rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left text-sm text-amber-100">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-400" />
                  <div>
                    <div className="font-semibold text-amber-200">Council recovered from an issue</div>
                    <p className="mt-1 text-amber-100/80">{latestIssue.message}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <div className="min-h-screen bg-[var(--bg-app)]">
        <CouncilTimeline />
      </div>
    </div>
  );
}
