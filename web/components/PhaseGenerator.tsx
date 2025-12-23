'use client';

import { useCouncilStore } from '@/store/councilStore';
import { useState, useEffect } from 'react';
import { User, Activity } from 'lucide-react';

export function PhaseGenerator() {
    const { generatorStreams, agents } = useCouncilStore();
    const activeAgentNames = Object.keys(generatorStreams);

    // Default to the first active stream or the first selected agent
    const [activeTab, setActiveTab] = useState<string>('');

    useEffect(() => {
        if (!activeTab && activeAgentNames.length > 0) {
            setActiveTab(activeAgentNames[0]);
        }
    }, [activeAgentNames, activeTab]);

    if (activeAgentNames.length === 0) return null;

    return (
        <div className="bg-[var(--bg-panel)] border border-[var(--border-base)] rounded-lg overflow-hidden flex flex-col min-h-[400px] shadow-sm">
            <div className="bg-[var(--bg-panel-secondary)] border-b border-[var(--border-base)] p-2 flex gap-2 overflow-x-auto">
                {activeAgentNames.map((agentName) => (
                    <button
                        key={agentName}
                        onClick={() => setActiveTab(agentName)}
                        className={`
              flex items-center gap-2 px-3 py-2 rounded text-xs font-mono uppercase tracking-wider transition-colors whitespace-nowrap
              ${activeTab === agentName
                                ? 'bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30'
                                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel)] border border-transparent'}
            `}
                    >
                        {activeTab === agentName && <Activity className="w-3 h-3 animate-pulse" />}
                        {agentName}
                    </button>
                ))}
            </div>

            <div className="p-6 font-mono text-sm leading-relaxed text-[var(--text-main)] whitespace-pre-wrap">
                {activeTab && generatorStreams[activeTab] ? (
                    generatorStreams[activeTab]
                ) : (
                    <span className="text-[var(--text-muted)] italic">Waiting for signal...</span>
                )}
                <span className="inline-block w-2 h-4 bg-cyan-500 animate-pulse ml-1 align-middle"></span>
            </div>
        </div>
    );
}
