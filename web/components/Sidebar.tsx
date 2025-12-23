'use client';

import { RotateCcw, MessageSquare, History, Sun, Moon, FileClock, Trash2 } from 'lucide-react';
import { useCouncilStore } from '@/store/councilStore';
import { ThemeSync } from './ThemeSync';

export function Sidebar() {
    const { resetAll, theme, toggleTheme, sessions, loadSession, deleteSession } = useCouncilStore();

    // Helper to format date
    const formatDate = (isoString: string) => {
        try {
            const date = new Date(isoString);
            return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
        } catch (e) {
            return 'Unknown Date';
        }
    };

    return (
        <aside className="w-64 border-r border-[var(--border-base)] bg-[var(--bg-panel)] flex flex-col h-full z-10 transition-colors duration-300">
            <ThemeSync />

            <div className="p-4 border-b border-[var(--border-base)]">
                <h1 className="text-xl font-bold tracking-tighter text-cyan-500 uppercase flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    LLM COUNCIL
                </h1>
                <p className="text-xs text-[var(--text-muted)] mt-1">v2.1 Mission Control</p>
            </div>

            <div className="p-4">
                <button
                    onClick={resetAll}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white py-2 px-4 rounded-md font-mono text-sm uppercase tracking-wide shadow-lg shadow-indigo-500/20"
                >
                    <RotateCcw className="w-4 h-4" />
                    Summon New
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)] uppercase mb-3 text-opacity-70">
                    <History className="w-3 h-3" />
                    Session History
                </div>

                <div className="space-y-2">
                    {sessions.length === 0 && (
                        <div className="text-xs text-[var(--text-muted)] italic text-center py-4 opacity-50">
                            No recorded mandates.
                        </div>
                    )}

                    {sessions.map((session) => (
                        <div
                            key={session.id}
                            onClick={() => loadSession(session)}
                            className="w-full text-left p-3 rounded-lg hover:bg-[var(--bg-panel-secondary)] border border-transparent hover:border-[var(--border-base)] transition-all group relative cursor-pointer"
                        >
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    deleteSession(session.id);
                                }}
                                className="absolute top-2 right-2 p-1.5 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                                title="Delete Session"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>

                            <div className="flex justify-between items-start mb-1">
                                <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
                                    {formatDate(session.date)}
                                </span>
                            </div>
                            <div className="text-sm font-medium text-[var(--text-main)] truncate mb-0.5 line-clamp-2 leading-tight pr-6">
                                {session.query}
                            </div>
                            <div className="text-[10px] text-[var(--text-muted)] truncate opacity-70">
                                {session.summary}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-4 border-t border-[var(--border-base)] flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)]">Cluster Active</span>

                <button
                    onClick={toggleTheme}
                    className="p-2 rounded-full hover:bg-[var(--bg-panel-secondary)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                    title="Toggle Theme"
                >
                    {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
            </div>
        </aside>
    );
}
