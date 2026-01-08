'use client';

import { useCouncilStore } from '@/store/councilStore';
import { FileText, Copy, Check, Clock, Hash, Cpu } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';

export function PhaseFinalizer() {
    const { currentSessionId, sessions } = useCouncilStore();
    const currentSession = sessions.find(s => s.id === currentSessionId);
    const finalizerText = currentSession?.finalizerText;
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (!finalizerText) return;
        navigator.clipboard.writeText(finalizerText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!finalizerText) return null;

    return (
        <div className="bg-[var(--bg-panel)] border border-[var(--border-base)] rounded-lg shadow-2xl overflow-hidden relative min-h-[500px] transition-colors duration-300">
            {/* Document Header */}
            <div className="bg-[var(--bg-panel-secondary)] border-b border-[var(--border-base)] p-3 flex justify-between items-center text-[var(--text-main)]">
                <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs font-bold uppercase">
                    <FileText className="w-4 h-4" />
                    Final Consensus Document
                </div>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-3 py-1 bg-[var(--bg-panel)] border border-[var(--border-base)] rounded hover:bg-[var(--bg-panel-secondary)] text-xs font-medium text-[var(--text-main)] transition"
                >
                    {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied' : 'Copy'}
                </button>
            </div>

            {/* Document Body */}
            <div className="p-8 font-serif text-lg leading-relaxed max-w-none text-[var(--text-main)]">
                <div className="prose prose-lg dark:prose-invert max-w-none prose-headings:text-[var(--text-main)] prose-p:text-[var(--text-main)] prose-strong:text-[var(--text-main)] prose-li:text-[var(--text-main)]">
                    <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>{finalizerText}</ReactMarkdown>
                </div>
            </div>

            {/* Metrics Footer */}
            {currentSession?.metrics?.finalizer && (
                <div className="bg-[var(--bg-panel-secondary)] border-t border-[var(--border-base)] p-3 flex items-center justify-end gap-4 text-[10px] uppercase font-mono text-[var(--text-muted)] opacity-80">
                    <div className="flex items-center gap-1.5" title="Execution Time">
                        <Clock className="w-3 h-3" />
                        <span>{currentSession.metrics.finalizer.time.toFixed(2)}s</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Total Tokens">
                        <Hash className="w-3 h-3" />
                        <span>{currentSession.metrics.finalizer.usage?.total || 0} Tok</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Model ID">
                        <Cpu className="w-3 h-3" />
                        <span>{currentSession.metrics.finalizer.model.split('/').pop()}</span>
                    </div>
                </div>
            )}

            {/* Comprehensive Metrics Table */}
            {currentSession?.metrics && (
                <div className="bg-[var(--bg-panel)] border-t border-[var(--border-base)] p-4 overflow-x-auto">
                    <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase mb-3">Council Execution Metrics</h4>
                    <table className="w-full text-xs text-left border-collapse">
                        <thead>
                            <tr className="border-b border-[var(--border-base)] text-[var(--text-muted)]">
                                <th className="py-2 font-mono uppercase tracking-wider">Agent / Phase</th>
                                <th className="py-2 font-mono uppercase tracking-wider">Model ID</th>
                                <th className="py-2 font-mono uppercase tracking-wider text-right">Time (s)</th>
                                <th className="py-2 font-mono uppercase tracking-wider text-right">Tokens</th>
                            </tr>
                        </thead>
                        <tbody className="text-[var(--text-main)] font-mono">
                            {/* Generators */}
                            {Object.entries(currentSession.metrics.generators).map(([name, data]) => (
                                <tr key={name} className="border-b border-[var(--border-base)] hover:bg-[var(--bg-panel-secondary)]">
                                    <td className="py-2 font-medium">{name}</td>
                                    <td className="py-2 opacity-70">{data.model.split('/').pop()}</td>
                                    <td className="py-2 text-right opacity-80">{data?.time?.toFixed(2) || '0.00'}</td>
                                    <td className="py-2 text-right opacity-80">{data?.usage?.total || 0}</td>
                                </tr>
                            ))}

                            {/* Critic */}
                            {currentSession.metrics.critic && (
                                <tr className="border-b border-[var(--border-base)] hover:bg-[var(--bg-panel-secondary)]">
                                    <td className="py-2 font-medium text-indigo-500">Critic Phase</td>
                                    <td className="py-2 opacity-70">{currentSession.metrics.critic.model.split('/').pop()}</td>
                                    <td className="py-2 text-right opacity-80">{currentSession.metrics.critic.time.toFixed(2)}</td>
                                    <td className="py-2 text-right opacity-80">{currentSession.metrics.critic.usage.total}</td>
                                </tr>
                            )}

                            {/* Architect */}
                            {currentSession.metrics.architect && (
                                <tr className="border-b border-[var(--border-base)] hover:bg-[var(--bg-panel-secondary)]">
                                    <td className="py-2 font-medium text-indigo-500">Architect Phase</td>
                                    <td className="py-2 opacity-70">{currentSession.metrics.architect.model.split('/').pop()}</td>
                                    <td className="py-2 text-right opacity-80">{currentSession.metrics.architect.time.toFixed(2)}</td>
                                    <td className="py-2 text-right opacity-80">{currentSession.metrics.architect.usage.total}</td>
                                </tr>
                            )}

                            {/* Finalizer */}
                            {currentSession.metrics.finalizer && (
                                <tr className="border-b border-[var(--border-base)] hover:bg-[var(--bg-panel-secondary)]">
                                    <td className="py-2 font-medium text-indigo-500">Finalizer Phase</td>
                                    <td className="py-2 opacity-70">{currentSession.metrics.finalizer.model.split('/').pop()}</td>
                                    <td className="py-2 text-right opacity-80">{currentSession.metrics.finalizer.time.toFixed(2)}</td>
                                    <td className="py-2 text-right opacity-80">{currentSession.metrics.finalizer.usage?.total || 0}</td>
                                </tr>
                            )}

                            {/* Total Row */}
                            <tr className="bg-[var(--bg-panel-secondary)] font-bold">
                                <td className="py-2 font-mono uppercase tracking-wider text-cyan-500">Total Session</td>
                                <td className="py-2 opacity-50">-</td>
                                <td className="py-2 text-right text-cyan-500">{currentSession.metrics.totalTime?.toFixed(2) || '0.00'}</td>
                                <td className="py-2 text-right text-cyan-500">{currentSession.metrics.totalTokens?.total || 0}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
