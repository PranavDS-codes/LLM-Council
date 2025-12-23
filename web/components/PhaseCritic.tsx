'use client';

import { useCouncilStore } from '@/store/councilStore';
import { Trophy, AlertTriangle, BarChart3, User } from 'lucide-react';
import { useState } from 'react';

export function PhaseCritic() {
    const { criticData } = useCouncilStore();
    const [activeTab, setActiveTab] = useState<string>('Overview');

    if (!criticData) return null;

    const { winner_id, reasoning, scores, flaws } = criticData;
    const maxScore = 10;

    // Collect all tabs: Overview + Agent Names
    const tabs = ['Overview', ...Object.keys(scores || {})];

    return (
        <div className="space-y-4">
            {/* Tabs Header */}
            <div className="flex gap-2 overflow-x-auto pb-2 border-b border-[var(--border-base)]">
                {tabs.map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`
                flex items-center gap-2 px-3 py-2 rounded-t-lg border-b-2 text-xs font-bold uppercase transition-colors whitespace-nowrap
                ${activeTab === tab
                                ? 'border-indigo-500 text-indigo-500 bg-[var(--bg-panel-secondary)]'
                                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel-secondary)]'}
              `}
                    >
                        {tab === 'Overview' ? <BarChart3 className="w-3 h-3" /> : <User className="w-3 h-3" />}
                        {tab}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="min-h-[300px]">
                {activeTab === 'Overview' ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-500">
                        {/* Winner Card */}
                        <div className="md:col-span-2 bg-[var(--bg-panel)] border border-[var(--border-base)] rounded-lg p-6 relative overflow-hidden shadow-sm">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Trophy className="w-24 h-24 text-yellow-500" />
                            </div>

                            <div className="relative z-10">
                                <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500 font-bold uppercase tracking-widest text-xs mb-2">
                                    <Trophy className="w-4 h-4" />
                                    Consensus Winner
                                </div>
                                <h2 className="text-2xl font-bold text-[var(--text-main)] mb-4">{winner_id}</h2>
                                <p className="text-[var(--text-muted)] text-sm italic border-l-2 border-yellow-500/50 pl-4">
                                    "{reasoning}"
                                </p>
                            </div>
                        </div>

                        {/* Scores Card */}
                        <div className="bg-[var(--bg-panel-secondary)] border border-[var(--border-base)] rounded-lg p-4">
                            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase mb-4">Performance Metrics</h3>
                            <div className="space-y-3">
                                {Object.entries(scores || {}).map(([agent, score]: [string, any]) => (
                                    <div key={agent} className="group">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className={agent === winner_id ? 'text-yellow-600 dark:text-yellow-400 font-bold' : 'text-[var(--text-muted)]'}>
                                                {agent}
                                            </span>
                                            <span className="font-mono text-[var(--text-muted)]">{score}/10</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-[var(--border-base)] rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-1000 ${agent === winner_id ? 'bg-yellow-500' : 'bg-slate-400 dark:bg-slate-700 group-hover:bg-slate-500'
                                                    }`}
                                                style={{ width: `${(score / maxScore) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                        <div className="bg-[var(--bg-panel)] border border-[var(--border-base)] rounded-lg p-6">
                            <h3 className="flex items-center gap-2 text-red-500 font-bold uppercase text-xs mb-6">
                                <AlertTriangle className="w-4 h-4" />
                                Critique Analysis: {activeTab}
                            </h3>

                            <ul className="space-y-3">
                                {(() => {
                                    const currentFlaws = flaws ? flaws[activeTab] : null;
                                    if (!currentFlaws) return <li className="text-[var(--text-muted)] italic">No specific flaws identified.</li>;

                                    // Handle both string (single flaw) and array (list of flaws)
                                    const flawList = Array.isArray(currentFlaws) ? currentFlaws : [currentFlaws];

                                    return flawList.map((flaw: string, i: number) => (
                                        <li key={i} className="flex gap-3 text-sm text-[var(--text-main)]">
                                            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-400 mt-2" />
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
