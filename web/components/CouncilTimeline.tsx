'use client';

import { AlertTriangle, Brain, CheckCircle2, Clock, Gavel, Hash, Loader2, PauseCircle, Shield, User, Zap } from 'lucide-react';

import { AGENT_ICONS, getPhaseStatusLabel, getSelectedAgents } from '@/lib/councilMeta';
import { useCouncilStore } from '@/store/councilStore';
import type { Agent } from '@/store/types';

import { PhaseArchitect } from './PhaseArchitect';
import { PhaseCritic } from './PhaseCritic';
import { PhaseFinalizer } from './PhaseFinalizer';
import { PhaseGenerator } from './PhaseGenerator';

export function CouncilTimeline() {
  const { isStreaming, currentSessionId, sessions } = useCouncilStore();
  const currentSession = sessions.find((session) => session.id === currentSessionId);
  const activePhase = currentSession?.activePhase || 0;
  const selectedAgents = currentSession ? getSelectedAgents(currentSession.agents) : [];

  if (!currentSession) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-4xl items-center px-6 py-12">
        <div className="w-full rounded-[32px] border border-[var(--border-base)] bg-[var(--bg-panel)]/90 p-10 text-center shadow-[0_28px_100px_-50px_rgba(15,23,42,0.85)]">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-500">
            <Loader2 className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-[-0.06em] text-[var(--text-main)]">
            Mission control is standing by
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--text-muted)]">
            Pick the council members you want in the room, write a strong briefing, and
            launch a run to see generation, critique, architecture, and final synthesis
            unfold in sequence.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-6 py-12 pb-32">
      <section className="rounded-[28px] border border-[var(--border-base)] bg-[var(--bg-panel)]/80 p-6 shadow-[0_28px_90px_-50px_rgba(15,23,42,0.95)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-500">
              Current session
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.06em] text-[var(--text-main)]">
              {currentSession.query}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">
              {currentSession.summary}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            <span className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 text-cyan-100">
              status: {getPhaseStatusLabel(currentSession.activePhase, currentSession.status)}
            </span>
            {selectedAgents.map((agent) => (
              <AgentBadge key={agent.id} agent={agent} />
            ))}
          </div>
        </div>
      </section>

      {currentSession.issues.length > 0 && (
        <section className="space-y-3">
          {currentSession.issues.slice(-2).map((issue) => (
            <div
              key={issue.id}
              className={`rounded-2xl border px-4 py-3 text-sm ${
                issue.recoverable
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
                  : 'border-red-500/30 bg-red-500/10 text-red-100'
              }`}
            >
              <div className="flex items-start gap-3">
                {issue.recoverable ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-400" />
                ) : (
                  <PauseCircle className="mt-0.5 h-4 w-4 text-red-400" />
                )}
                <div>
                  <div className="font-semibold">
                    {issue.recoverable ? 'Recovered issue' : 'Blocking issue'}
                  </div>
                  <p className="mt-1 opacity-85">{issue.message}</p>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {activePhase >= 1 && (
        <TimelineItem
          phase={1}
          activePhase={activePhase}
          isStreaming={isStreaming}
          title="The Council Speaks"
          description="Divergent first drafts from every selected persona."
        >
          <PhaseGenerator />
        </TimelineItem>
      )}

      {activePhase >= 2 && (
        <TimelineItem
          phase={2}
          activePhase={activePhase}
          isStreaming={isStreaming}
          title="Peer Review"
          description="The critic scores drafts, calls out weak claims, and names a winner."
        >
          <PhaseCritic />
        </TimelineItem>
      )}

      {activePhase >= 3 && (
        <TimelineItem
          phase={3}
          activePhase={activePhase}
          isStreaming={isStreaming}
          title="The Blueprint"
          description="A structure-first plan for the final answer."
        >
          <PhaseArchitect />
        </TimelineItem>
      )}

      {activePhase >= 4 && (
        <TimelineItem
          phase={4}
          activePhase={activePhase}
          isStreaming={isStreaming}
          title="The Verdict"
          description="The polished synthesis the council can stand behind."
        >
          <PhaseFinalizer />
        </TimelineItem>
      )}

      {activePhase === 4 && !isStreaming && (
        <div className="space-y-8 py-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="inline-block rounded-2xl border border-[var(--border-base)] bg-[var(--bg-panel)] px-5 py-4 shadow-lg">
            <h3 className="mb-1 text-lg font-bold uppercase tracking-[0.18em] text-cyan-500">
              {currentSession.status === 'completed'
                ? 'Council Adjourned'
                : currentSession.status === 'stopped'
                  ? 'Council Paused'
                  : 'Council Halted'}
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              {currentSession.status === 'completed'
                ? 'The final mandate is ready and archived in session history.'
                : currentSession.status === 'stopped'
                  ? 'The run was interrupted before the system fully settled.'
                  : 'The session ended with unrecoverable issues.'}
            </p>
          </div>

          {currentSession.metrics && (
            <div className="flex justify-center gap-8 text-sm animate-in zoom-in duration-500 delay-300">
              <div className="flex flex-col items-center gap-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Total Duration
                </div>
                <div className="flex items-center gap-2 rounded border border-[var(--border-base)] bg-[var(--bg-panel-secondary)] px-4 py-2 font-mono text-lg font-bold text-cyan-500">
                  <Clock className="h-4 w-4 opacity-70" />
                  {currentSession.metrics.totalTime?.toFixed(2) || '0.00'}s
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Total Tokens
                </div>
                <div className="flex items-center gap-2 rounded border border-[var(--border-base)] bg-[var(--bg-panel-secondary)] px-4 py-2 font-mono text-lg font-bold text-cyan-500">
                  <Hash className="h-4 w-4 opacity-70" />
                  {currentSession.metrics.totalTokens?.total || 0}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AgentBadge({ agent }: { agent: Agent }) {
  const fallbackIcons = {
    'The Academic': Brain,
    'The Layman': User,
    'The Skeptic': Shield,
    'The Futurist': Zap,
    'The Ethical Guardian': Gavel,
  };
  const Icon = AGENT_ICONS[agent.name] || fallbackIcons[agent.name as keyof typeof fallbackIcons] || User;

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-base)] bg-[var(--bg-panel-secondary)] px-3 py-1.5 normal-case tracking-normal text-[var(--text-main)]">
      <Icon className="h-3.5 w-3.5 text-cyan-400" />
      <span>{agent.name}</span>
    </span>
  );
}

function TimelineItem({
  phase,
  title,
  description,
  children,
  activePhase,
  isStreaming,
}: {
  phase: number;
  title: string;
  description: string;
  children: React.ReactNode;
  activePhase: number;
  isStreaming: boolean;
}) {
  let status: 'idle' | 'streaming' | 'completed' = 'idle';

  if (activePhase > phase) {
    status = 'completed';
  } else if (activePhase === phase) {
    status = isStreaming ? 'streaming' : 'completed';
  }

  return (
    <div className="relative pl-8 md:pl-0">
      <div className="absolute bottom-0 left-3 top-10 w-0.5 bg-[var(--border-base)] md:hidden" />

      <div className="flex items-start gap-4 md:gap-8">
        <div
          className={`relative z-10 mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 bg-[var(--bg-app)] transition-colors duration-500 ${
            status === 'completed'
              ? 'border-cyan-500 text-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]'
              : status === 'streaming'
                ? 'animate-pulse border-indigo-500 text-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]'
                : 'border-[var(--border-base)] text-[var(--text-muted)]'
          }`}
        >
          {status === 'completed' ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : status === 'streaming' ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <span className="font-mono text-xs">{phase}</span>
          )}
        </div>

        <div className="flex-1 space-y-4">
          <div>
            <h3
              className={`text-xl font-bold ${
                status === 'streaming'
                  ? 'text-indigo-500 dark:text-indigo-400'
                  : 'text-[var(--text-main)]'
              }`}
            >
              {title}
            </h3>
            <p className="text-sm text-[var(--text-muted)]">{description}</p>
          </div>
          <div className="transition-all duration-700">{children}</div>
        </div>
      </div>
    </div>
  );
}
