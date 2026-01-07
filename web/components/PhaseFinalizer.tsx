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
        </div>
    );
}
