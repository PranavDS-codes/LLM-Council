'use client';

import { useState } from 'react';
import { AlertTriangle, BarChart3, Clock, Cpu, Hash, Trophy, User } from 'lucide-react';

import { useCouncilStore } from '@/store/councilStore';

const METRICS = ['accuracy', 'relevance', 'completeness', 'clarity', 'practical_usefulness'];

export function PhaseCritic() {
  const { currentSessionId, sessions } = useCouncilStore();
  const currentSession = sessions.find((session) => session.id === currentSessionId);
  const criticData = currentSession?.criticData;
  const [activeTab, setActiveTab] = useState('Overview');

  if (!criticData) {
    if (!currentSession?.criticProgress) return null;
    return (
      <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/5 p-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-400">Peer review in progress</p>
        <p className="mt-3 text-sm text-[var(--text-muted)]">The critic is reviewing batch {currentSession.criticProgress.batch} of {currentSession.criticProgress.totalBatches}. Structured findings will appear once validated.</p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--border-base)]"><div className="h-full w-2/3 animate-pulse rounded-full bg-indigo-500" /></div>
      </div>
    );
  }

  const { winner_id, reasoning, scores, flaws } = criticData;
  const scorecards = criticData.scorecards || {};
  const rankedAgents = criticData.rankings.length > 0 ? criticData.rankings : Object.keys(scores || {});
  const finalists = criticData.finalists?.length ? criticData.finalists : rankedAgents.slice(0, 2);
  const tabs = ['Overview', ...rankedAgents.filter((agent) => !finalists.includes(agent))];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto border-b border-[var(--border-base)] pb-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-t-lg border-b-2 px-3 py-2 text-xs font-bold uppercase transition-colors ${
              activeTab === tab
                ? 'border-indigo-500 bg-[var(--bg-panel-secondary)] text-indigo-500'
                : 'border-transparent text-[var(--text-muted)] hover:bg-[var(--bg-panel-secondary)] hover:text-[var(--text-main)]'
            }`}
          >
            {tab === 'Overview' ? <BarChart3 className="h-3 w-3" /> : <User className="h-3 w-3" />}
            {tab}
          </button>
        ))}
      </div>

      <div className="min-h-[300px]">
        {activeTab === 'Overview' ? (
          <div className="flex flex-col gap-4 animate-in fade-in duration-500">
            <div className="relative overflow-hidden rounded-lg border border-[var(--border-base)] bg-[var(--bg-panel)] p-6 shadow-sm">
                <div className="absolute right-0 top-0 p-4 opacity-10">
                  <Trophy className="h-24 w-24 text-yellow-500" />
                </div>

                <div className="relative z-10">
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-yellow-600 dark:text-yellow-500">
                    <Trophy className="h-4 w-4" />
                    Top Finalists
                  </div>
                  <h2 className="mb-4 text-2xl font-bold text-[var(--text-main)]">{winner_id}</h2>
                  <p className="border-l-2 border-yellow-500/50 pl-4 text-sm italic text-[var(--text-muted)]">
                    &ldquo;{reasoning}&rdquo;
                  </p>
                </div>
              </div>

            <div className="overflow-x-auto rounded-lg border border-[var(--border-base)] bg-[var(--bg-panel-secondary)]">
              <div className="min-w-[900px]">
                <div className="grid grid-cols-[minmax(12rem,1.4fr)_repeat(6,minmax(6rem,1fr))] border-b border-[var(--border-base)] bg-[var(--bg-panel)] px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                  <span>Performance Metrics</span>
                  {METRICS.map((metric) => <span key={metric} className="text-center">{metric.replace('_', ' ')}</span>)}
                  <span className="text-center">Average</span>
                </div>
                {rankedAgents.map((agent) => {
                  const card = scorecards[agent];
                  const average = card?.average ?? Number(scores[agent] || 0);
                  return <div key={agent} className={`grid grid-cols-[minmax(12rem,1.4fr)_repeat(6,minmax(6rem,1fr))] items-center border-b border-[var(--border-base)] px-4 py-3 text-sm last:border-b-0 ${finalists.includes(agent) ? 'bg-yellow-500/5' : ''}`}>
                    <span className={finalists.includes(agent) ? 'font-semibold text-yellow-500' : 'text-[var(--text-main)]'}>{agent}</span>
                    {METRICS.map((metric) => <span key={metric} className="text-center font-mono text-[var(--text-muted)]">{card ? `${card.metric_scores[metric]}/10` : '-'}</span>)}
                    <span className="text-center font-mono font-bold text-indigo-400">{average.toFixed(2)}</span>
                  </div>;
                })}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {finalists.map((agent) => {
                const card = scorecards[agent];
                const critique = card?.critique || flaws?.[agent] || 'No critique was available.';
                const average = card?.average ?? Number(scores[agent] || 0);
                return <article key={agent} className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-5">
                  <h3 className="text-base font-bold text-yellow-500">{agent} ({average.toFixed(2)})</h3>
                  <p className="mt-3 break-words text-sm leading-relaxed text-[var(--text-muted)]">{Array.isArray(critique) ? critique.join(' ') : critique}</p>
                </article>;
              })}
            </div>

          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-left-4 duration-300">
            <div className="rounded-lg border border-[var(--border-base)] bg-[var(--bg-panel)] p-6">
              <h3 className="mb-6 flex items-center justify-between gap-2 text-xs font-bold uppercase text-red-500">
                <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Critique Analysis: {activeTab}</span>
                <span className="font-mono text-[var(--text-muted)]">{Number(scores[activeTab] ?? scorecards[activeTab]?.average ?? 0).toFixed(2)}/10</span>
              </h3>

              {scorecards[activeTab] && (
                <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
                  {Object.entries(scorecards[activeTab].metric_scores).map(([metric, score]) => (
                    <div key={metric} className="rounded-lg border border-[var(--border-base)] bg-[var(--bg-panel-secondary)] p-3 text-center">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{metric.replace('_', ' ')}</div>
                      <div className="mt-1 font-mono text-lg font-bold text-indigo-400">{score}/10</div>
                    </div>
                  ))}
                </div>
              )}

              <ul className="space-y-3">
                {(() => {
                  const currentFlaws = scorecards[activeTab]?.critique || (flaws ? flaws[activeTab] : null);
                  if (!currentFlaws) {
                    return (
                      <li className="italic text-[var(--text-muted)]">
                        No specific flaws identified.
                      </li>
                    );
                  }

                  const flawList = Array.isArray(currentFlaws) ? currentFlaws : [currentFlaws];

                  return flawList.map((flaw, index) => (
                    <li key={index} className="flex gap-3 break-words text-sm text-[var(--text-main)]">
                      <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
                      <span className="leading-relaxed">{flaw}</span>
                    </li>
                  ));
                })()}
              </ul>
            </div>
          </div>
        )}
      </div>

      {currentSession?.metrics?.critic && (
        <div className="flex flex-wrap items-center justify-end gap-4 border-t border-dashed border-[var(--border-base)] pt-3 font-mono text-[10px] uppercase text-[var(--text-muted)] opacity-80">
          <div className="flex items-center gap-1.5" title="Execution Time"><Clock className="h-3 w-3" /><span>{currentSession.metrics.critic.time.toFixed(2)}s</span></div>
          <div className="flex items-center gap-1.5" title="Input Tokens"><Hash className="h-3 w-3" /><span>In {currentSession.metrics.critic.usage?.prompt || 0}</span></div>
          <div className="flex items-center gap-1.5" title="Output Tokens"><Hash className="h-3 w-3" /><span>Out {currentSession.metrics.critic.usage?.completion || 0}</span></div>
          <div className="flex items-center gap-1.5" title="Total Tokens"><Hash className="h-3 w-3" /><span>Total {currentSession.metrics.critic.usage?.total || 0}</span></div>
          <div className="flex items-center gap-1.5" title="Model ID"><Cpu className="h-3 w-3" /><span>{currentSession.metrics.critic.model.split('/').pop()}</span></div>
        </div>
      )}
    </div>
  );
}
