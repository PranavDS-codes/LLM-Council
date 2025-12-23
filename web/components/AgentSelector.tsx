'use client';

import { useCouncilStore } from '@/store/councilStore';
import { User, Shield, Brain, Zap, Gavel } from 'lucide-react';

const ICONS: Record<string, any> = {
    'The Academic': Brain,
    'The Layman': User,
    'The Skeptic': Shield, // Or maybe Eye?
    'The Futurist': Zap,
    'The Ethical Guardian': Gavel,
};

export function AgentSelector() {
    const { agents, toggleAgent } = useCouncilStore();

    return (
        <div className="flex flex-wrap gap-3 justify-center">
            {agents.map((agent) => {
                const Icon = ICONS[agent.name] || User;
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
                        <Icon className={`w-4 h-4 ${agent.selected ? 'text-cyan-500' : 'text-[var(--text-muted)]'}`} />
                        <span className="text-sm font-medium">{agent.name}</span>

                        {/* Active Indicator Dot */}
                        {agent.selected && (
                            <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
