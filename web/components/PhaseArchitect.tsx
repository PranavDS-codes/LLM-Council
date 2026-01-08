'use client';

import { useCouncilStore } from '@/store/councilStore';
import { CheckSquare, Info, Clock, Hash, Cpu } from 'lucide-react';

export function PhaseArchitect() {
    const { currentSessionId, sessions } = useCouncilStore();
    const currentSession = sessions.find(s => s.id === currentSessionId);
    const architectData = currentSession?.architectData;

    if (!architectData) return null;

    const { structure, missing_facts_to_add, tone_guidelines } = architectData;

    return (
        <div className="bg-[var(--bg-panel)] border border-[var(--border-base)] rounded-lg p-6 font-mono text-sm relative shadow-sm">
            <div className="absolute top-0 right-0 -mt-3 -mr-3 bg-indigo-600 text-white text-xs px-2 py-1 transform rotate-12 shadow-lg">
                BLUEPRINT
            </div>

            <div className="mb-6">
                <h4 className="text-indigo-500 dark:text-indigo-400 text-xs font-bold uppercase mb-2">Target Structure</h4>
                <ul className="space-y-2">
                    {structure?.map((item: string, i: number) => (
                        <li key={i} className="flex gap-3 items-start text-[var(--text-main)]">
                            <span className="flex-shrink-0 w-5 h-5 bg-[var(--bg-panel-secondary)] border border-[var(--border-base)] rounded flex items-center justify-center text-indigo-500 mt-0.5">
                                {i + 1}
                            </span>
                            <span>{item}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[var(--border-base)]">
                <div>
                    <h4 className="text-[var(--text-muted)] text-xs font-bold uppercase mb-2">Missing Facts to Inject</h4>
                    <ul className="space-y-1">
                        {missing_facts_to_add?.map((fact: string, i: number) => (
                            <li key={i} className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                                <div className="w-1 h-1 bg-red-500 rounded-full" />
                                {fact}
                            </li>
                        ))}
                    </ul>
                </div>
                <div>
                    <h4 className="text-[var(--text-muted)] text-xs font-bold uppercase mb-2">Critique Integration</h4>
                    <div className="bg-[var(--bg-panel-secondary)] p-3 rounded border border-[var(--border-base)] text-xs text-indigo-700 dark:text-indigo-300">
                        {architectData.critique_integration || 'No specific critique integration notes.'}
                    </div>
                </div>
                <div>
                    <h4 className="text-[var(--text-muted)] text-xs font-bold uppercase mb-2">Tone Guidelines</h4>
                    <div className="bg-[var(--bg-panel-secondary)] p-3 rounded border border-[var(--border-base)] text-xs text-indigo-700 dark:text-indigo-300">
                        <Info className="w-3 h-3 inline mr-2 text-indigo-500" />
                        {tone_guidelines}
                    </div>
                </div>
            </div>

            {currentSession?.metrics?.architect && (
                <div className="mt-6 pt-3 border-t border-[var(--border-base)] border-dashed flex items-center justify-end gap-4 text-[10px] uppercase font-mono text-[var(--text-muted)] opacity-80">
                    <div className="flex items-center gap-1.5" title="Execution Time">
                        <Clock className="w-3 h-3" />
                        <span>{currentSession.metrics.architect.time.toFixed(2)}s</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Total Tokens">
                        <Hash className="w-3 h-3" />
                        <span>{currentSession.metrics.architect.usage?.total || 0} Tok</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Model ID">
                        <Cpu className="w-3 h-3" />
                        <span>{currentSession.metrics.architect.model.split('/').pop()}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
