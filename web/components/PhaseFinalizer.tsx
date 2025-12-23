'use client';

import { useCouncilStore } from '@/store/councilStore';
import { FileText, Copy, Check } from 'lucide-react';
import { useState } from 'react';

export function PhaseFinalizer() {
    const { finalizerText } = useCouncilStore();
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(finalizerText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!finalizerText) return null;

    return (
        <div className="bg-white text-slate-900 rounded-lg shadow-2xl overflow-hidden relative min-h-[500px]">
            {/* Document Header */}
            <div className="bg-gray-50 dark:bg-slate-100 border-b border-gray-200 dark:border-slate-200 p-3 flex justify-between items-center text-slate-900">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase">
                    <FileText className="w-4 h-4" />
                    Final Consensus Document
                </div>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 text-xs font-medium text-slate-700 transition"
                >
                    {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied' : 'Copy'}
                </button>
            </div>

            {/* Document Body */}
            <div className="p-8 font-serif text-lg leading-relaxed max-w-none whitespace-pre-wrap">
                {finalizerText}
            </div>
        </div>
    );
}
