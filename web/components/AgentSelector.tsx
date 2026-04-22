'use client';

import { useCouncilStore } from '@/store/councilStore';
import { User } from 'lucide-react';

import { AGENT_ICONS } from '@/lib/councilMeta';

export function AgentSelector() {
  const { agents, toggleAgent } = useCouncilStore();

  return (
    <div className="flex flex-wrap justify-center gap-3">
      {agents.map((agent) => {
        const Icon = AGENT_ICONS[agent.name] || User;
        return (
          <button
            key={agent.id}
            onClick={() => toggleAgent(agent.id)}
            className={`
              relative group flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300
              ${agent.selected
                ? 'bg-cyan-100 dark:bg-cyan-900/40 border-cyan-600 dark:border-cyan-400 text-cyan-900 dark:text-cyan-50 font-bold shadow-[0_0_15px_-3px_rgba(34,211,238,0.3)]'
                : 'bg-[var(--bg-panel)] border-[var(--border-base)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--text-main)] font-medium'
              }
            `}
          >
            <Icon className={`h-4 w-4 ${agent.selected ? 'text-cyan-500' : 'text-[var(--text-muted)]'}`} />
            <span className="text-sm font-medium">{agent.name}</span>

            {agent.selected && (
              <span className="absolute right-0 top-0 -mr-1 -mt-1 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-cyan-500" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
