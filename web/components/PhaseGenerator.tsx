'use client';

import { useCouncilStore } from '@/store/councilStore';
import { useState } from 'react';
import { Activity, Maximize2, Minimize2, Cpu, Clock, Hash } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';

export function PhaseGenerator() {
    const { currentSessionId, sessions } = useCouncilStore();
    const currentSession = sessions.find(s => s.id === currentSessionId);
    const generatorStreams = currentSession?.generatorStreams || {};
    const agentModels = currentSession?.agentModels || {};
    const activeAgentNames = Object.keys(generatorStreams);
    const [isExpanded, setIsExpanded] = useState<boolean>(true);

    // Default to the first active stream or the first selected agent
    const [userSelectedTab, setUserSelectedTab] = useState<string>('');
    const currentTab = userSelectedTab || (activeAgentNames.length > 0 ? activeAgentNames[0] : '');

    if (activeAgentNames.length === 0) return null;

    return (
        <div className={`bg-[var(--bg-panel)] border border-[var(--border-base)] rounded-lg overflow-hidden flex flex-col shadow-sm transition-all duration-300 ${isExpanded ? 'min-h-[400px]' : ''}`}>
            <div className="bg-[var(--bg-panel-secondary)] border-b border-[var(--border-base)] flex items-center justify-between pr-2">
                <div className="flex gap-2 overflow-x-auto p-2 no-scrollbar">
                    {activeAgentNames.map((agentName) => (
                        <button
                            key={agentName}
                            onClick={() => setUserSelectedTab(agentName)}
                            className={`
                  flex items-center gap-2 px-3 py-2 rounded text-xs font-mono uppercase tracking-wider transition-colors whitespace-nowrap
                  ${currentTab === agentName
                                    ? 'bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30'
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel)] border border-transparent'}
                `}
                        >
                            {currentTab === agentName && <Activity className="w-3 h-3 animate-pulse" />}
                            {agentName}
                        </button>
                    ))}
                </div>

                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel)] rounded transition-colors ml-2 flex-shrink-0"
                    title={isExpanded ? "Collapse" : "Expand"}
                >
                    {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
            </div>

            <div className={`p-6 text-sm leading-relaxed text-[var(--text-main)] transition-all duration-300 ${!isExpanded ? 'line-clamp-3 overflow-hidden' : ''}`}>
                {currentTab && generatorStreams[currentTab] ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none font-mono prose-headings:text-[var(--text-main)] prose-p:text-[var(--text-main)] prose-strong:text-[var(--text-main)] prose-li:text-[var(--text-main)] prose-code:text-[var(--text-main)]">
                        <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>{generatorStreams[currentTab]}</ReactMarkdown>
                    </div>
                ) : (
                    <span className="text-[var(--text-muted)] italic">Waiting for signal...</span>
                )}
                {isExpanded && <span className="inline-block w-2 h-4 bg-cyan-500 animate-pulse ml-1 align-middle"></span>}

                {/* Metrics Footer */}
                {currentTab && generatorStreams[currentTab] && (
                    <div className="mt-6 pt-3 border-t border-[var(--border-base)] border-dashed flex items-center justify-end gap-4 text-[10px] uppercase font-mono text-[var(--text-muted)] opacity-80">
                        {currentSession?.metrics?.generators?.[currentTab] && (
                            <>
                                <div className="flex items-center gap-1.5" title="Execution Time">
                                    <Clock className="w-3 h-3" />
                                    <span>{currentSession.metrics.generators[currentTab].time.toFixed(2)}s</span>
                                </div>
                                <div className="flex items-center gap-1.5" title="Total Tokens">
                                    <Hash className="w-3 h-3" />
                                    <span>{currentSession.metrics.generators[currentTab].usage?.total || 0} Tok</span>
                                </div>
                            </>
                        )}
                        {agentModels[currentTab] && (
                            <div className="flex items-center gap-1.5" title="Model ID">
                                <Cpu className="w-3 h-3" />
                                <span>{agentModels[currentTab].split('/').pop()}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
