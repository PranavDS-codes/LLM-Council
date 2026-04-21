'use client';

import { useState } from 'react';
import { AlertTriangle, BarChart3, Clock, Cpu, Hash, Trophy, User } from 'lucide-react';

import { useCouncilStore } from '@/store/councilStore';

export function PhaseCritic() {
  const { currentSessionId, sessions } = useCouncilStore();
  const currentSession = sessions.find((session) => session.id === currentSessionId);
  const criticData = currentSession?.criticData;
  const [activeTab, setActiveTab] = useState('Overview');

  if (!criticData) {
    return null;
  }

  const { winner_id, reasoning, scores, flaws } = criticData;
  const maxScore = 10;
  const tabs = ['Overview', ...Object.keys(scores || {})];

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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="relative overflow-hidden rounded-lg border border-[var(--border-base)] bg-[var(--bg-panel)] p-6 shadow-sm md:col-span-2">
                <div className="absolute right-0 top-0 p-4 opacity-10">
                  <Trophy className="h-24 w-24 text-yellow-500" />
                </div>

                <div className="relative z-10">
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-yellow-600 dark:text-yellow-500">
                    <Trophy className="h-4 w-4" />
                    Consensus Winner
                  </div>
                  <h2 className="mb-4 text-2xl font-bold text-[var(--text-main)]">{winner_id}</h2>
                  <p className="border-l-2 border-yellow-500/50 pl-4 text-sm italic text-[var(--text-muted)]">
                    &ldquo;{reasoning}&rdquo;
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-[var(--border-base)] bg-[var(--bg-panel-secondary)] p-4">
                <h3 className="mb-4 text-xs font-bold uppercase text-[var(--text-muted)]">
                  Performance Metrics
                </h3>
                <div className="space-y-3">
                  {Object.entries(scores || {}).map(([agent, score]) => (
                    <div key={agent} className="group">
                      <div className="mb-1 flex justify-between text-xs">
                        <span
                          className={
                            agent === winner_id
                              ? 'font-bold text-yellow-600 dark:text-yellow-400'
                              : 'text-[var(--text-muted)]'
                          }
                        >
                          {agent}
                        </span>
                        <span className="font-mono text-[var(--text-muted)]">{score}/10</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-base)]">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${
                            agent === winner_id
                              ? 'bg-yellow-500'
                              : 'bg-slate-400 group-hover:bg-slate-500 dark:bg-slate-700'
                          }`}
                          style={{ width: `${(score / maxScore) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {currentSession?.metrics?.critic && (
              <div className="flex items-center justify-end gap-4 border-t border-dashed border-[var(--border-base)] pt-3 font-mono text-[10px] uppercase text-[var(--text-muted)] opacity-80">
                <div className="flex items-center gap-1.5" title="Execution Time">
                  <Clock className="h-3 w-3" />
                  <span>{currentSession.metrics.critic.time.toFixed(2)}s</span>
                </div>
                <div className="flex items-center gap-1.5" title="Total Tokens">
                  <Hash className="h-3 w-3" />
                  <span>{currentSession.metrics.critic.usage?.total || 0} Tok</span>
                </div>
                <div className="flex items-center gap-1.5" title="Model ID">
                  <Cpu className="h-3 w-3" />
                  <span>{currentSession.metrics.critic.model.split('/').pop()}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-left-4 duration-300">
            <div className="rounded-lg border border-[var(--border-base)] bg-[var(--bg-panel)] p-6">
              <h3 className="mb-6 flex items-center gap-2 text-xs font-bold uppercase text-red-500">
                <AlertTriangle className="h-4 w-4" />
                Critique Analysis: {activeTab}
              </h3>

              <ul className="space-y-3">
                {(() => {
                  const currentFlaws = flaws ? flaws[activeTab] : null;
                  if (!currentFlaws) {
                    return (
                      <li className="italic text-[var(--text-muted)]">
                        No specific flaws identified.
                      </li>
                    );
                  }

                  const flawList = Array.isArray(currentFlaws) ? currentFlaws : [currentFlaws];

                  return flawList.map((flaw, index) => (
                    <li key={index} className="flex gap-3 text-sm text-[var(--text-main)]">
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
    </div>
  );
}
