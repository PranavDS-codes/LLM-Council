'use client';

import { Clock, Cpu, Hash, Info } from 'lucide-react';

import { useCouncilStore } from '@/store/councilStore';

export function PhaseArchitect() {
  const { currentSessionId, sessions } = useCouncilStore();
  const currentSession = sessions.find((session) => session.id === currentSessionId);
  const architectData = currentSession?.architectData;

  if (!architectData) {
    return null;
  }

  const { structure, missing_facts_to_add, tone_guidelines } = architectData;

  return (
    <div className="relative rounded-[24px] border border-[var(--border-base)] bg-[var(--bg-panel)] p-6 font-mono text-sm shadow-sm">
      <div className="absolute -mr-3 -mt-3 right-0 top-0 rotate-12 bg-indigo-600 px-2 py-1 text-xs text-white shadow-lg">
        BLUEPRINT
      </div>

      <div className="mb-6">
        <h4 className="mb-2 text-xs font-bold uppercase text-indigo-500 dark:text-indigo-400">
          Target Structure
        </h4>
        <ul className="space-y-2">
          {structure?.map((item, index) => (
            <li key={item} className="flex items-start gap-3 text-[var(--text-main)]">
              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border border-[var(--border-base)] bg-[var(--bg-panel-secondary)] text-indigo-500">
                {index + 1}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-6 border-t border-[var(--border-base)] pt-4 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase text-[var(--text-muted)]">
            Missing Facts to Inject
          </h4>
          <ul className="space-y-1">
            {missing_facts_to_add?.map((fact) => (
              <li key={fact} className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <div className="h-1 w-1 rounded-full bg-red-500" />
                {fact}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase text-[var(--text-muted)]">
            Critique Integration
          </h4>
          <div className="rounded border border-[var(--border-base)] bg-[var(--bg-panel-secondary)] p-3 text-xs text-indigo-700 dark:text-indigo-300">
            {architectData.critique_integration || 'No specific critique integration notes.'}
          </div>
        </div>
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase text-[var(--text-muted)]">
            Tone Guidelines
          </h4>
          <div className="rounded border border-[var(--border-base)] bg-[var(--bg-panel-secondary)] p-3 text-xs text-indigo-700 dark:text-indigo-300">
            <Info className="mr-2 inline h-3 w-3 text-indigo-500" />
            {tone_guidelines}
          </div>
        </div>
      </div>

      {currentSession?.metrics?.architect && (
        <div className="mt-6 flex items-center justify-end gap-4 border-t border-dashed border-[var(--border-base)] pt-3 font-mono text-[10px] uppercase text-[var(--text-muted)] opacity-80">
          <div className="flex items-center gap-1.5" title="Execution Time">
            <Clock className="h-3 w-3" />
            <span>{currentSession.metrics.architect.time.toFixed(2)}s</span>
          </div>
          <div className="flex items-center gap-1.5" title="Total Tokens">
            <Hash className="h-3 w-3" />
            <span>{currentSession.metrics.architect.usage?.total || 0} Tok</span>
          </div>
          <div className="flex items-center gap-1.5" title="Model ID">
            <Cpu className="h-3 w-3" />
            <span>{currentSession.metrics.architect.model.split('/').pop()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
