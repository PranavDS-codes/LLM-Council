'use client';

import { RotateCcw, MessageSquare, History, Sun, Moon, FileClock, Trash2, ChevronLeft, ChevronRight, Settings, PlusCircle } from 'lucide-react';
import { useCouncilStore } from '@/store/councilStore';
import { useState } from 'react';
import { ThemeSync } from './ThemeSync';
import { useRouter } from 'next/navigation';

export function Sidebar() {
    const { resetAll, theme, toggleTheme, sessions, loadSession, deleteSession, currentSessionId } = useCouncilStore();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const router = useRouter();

    // Helper to format date
    const formatDate = (isoString: string) => {
        try {
            const date = new Date(isoString);
            return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
        } catch {
            return 'Unknown Date';
        }
    };

    return (
        <aside className={`${isCollapsed ? 'w-24' : 'w-72'} border-r border-[var(--border-base)] bg-[var(--bg-panel)] flex flex-col h-full z-10 transition-all duration-300 relative`}>
            {/* Collapse Toggle */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute -right-4 top-6 bg-[var(--bg-panel)] border border-[var(--border-base)] rounded-full h-8 w-8 flex items-center justify-center text-[var(--text-muted)] hover:text-cyan-500 z-50 shadow-md transition-colors"
                title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
                {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>

            {/* Theme Sync (Invisible) */}
            <ThemeSync />

            {/* Header */}
            <div className={`p-4 border-b border-[var(--border-base)] flex items-center ${isCollapsed ? 'justify-center' : ''} h-16 box-border overflow-hidden`}>
                <button
                    onClick={() => {
                        setIsCollapsed(!isCollapsed);
                    }}
                    className="flex-shrink-0 text-cyan-500 hover:text-cyan-400 focus:outline-none transition-transform hover:scale-110 active:scale-95"
                    title={isCollapsed ? "Expand" : "Collapse"}
                >
                    <MessageSquare className="w-6 h-6" />
                </button>
                <div className={`ml-2 overflow-hidden transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}>
                    <h1 className="text-xl font-bold tracking-tighter text-cyan-500 uppercase whitespace-nowrap cursor-default">
                        LLM COUNCIL
                    </h1>
                    <p className="text-xs text-[var(--text-muted)]">v2.1 Mission Control</p>
                </div>
            </div>

            {/* Actions */}
            <div className="p-4 flex flex-col gap-3 justify-center">
                <button
                    onClick={() => {
                        resetAll();
                        router.push('/');
                    }}
                    className={`
                        flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white rounded-md font-mono text-sm uppercase tracking-wide shadow-lg shadow-indigo-500/20
                        ${isCollapsed ? 'w-8 h-8 p-0 rounded-full' : 'w-full py-2 px-4'}
                    `}
                    title="Summon New Council"
                >
                    <PlusCircle className="w-4 h-4" />
                    {!isCollapsed && <span>Summon New</span>}
                </button>

                <a
                    href="/config"
                    className={`
                        flex items-center justify-center gap-2 bg-[var(--bg-panel-secondary)] border border-[var(--border-base)] hover:bg-[var(--bg-app)] transition-colors text-[var(--text-main)] rounded-md font-mono text-sm uppercase tracking-wide
                        ${isCollapsed ? 'w-8 h-8 p-0 rounded-full' : 'w-full py-2 px-4'}
                    `}
                    title="System Config"
                >
                    <Settings className="w-4 h-4" />
                    {!isCollapsed && <span>Config</span>}
                </a>
            </div>

            {/* Session History */}
            <div className="flex-1 overflow-y-auto px-2 py-2">
                {!isCollapsed && (
                    <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)] uppercase mb-3 px-2 text-opacity-70 animate-in fade-in duration-300">
                        <History className="w-3 h-3" />
                        Session History
                    </div>
                )}

                <div className="space-y-2">
                    {sessions.length === 0 && !isCollapsed && (
                        <div className="text-xs text-[var(--text-muted)] italic text-center py-4 opacity-50">
                            No recorded mandates.
                        </div>
                    )}

                    {sessions.map((session) => {
                        const isActive = session.id === currentSessionId;
                        return (
                            <div
                                key={session.id}
                                onClick={() => {
                                    loadSession(session);
                                    router.push('/');
                                }}
                                className={`
                                w-full rounded-none md:rounded-lg hover:bg-[var(--bg-panel-secondary)] border-y border-transparent transition-all group relative cursor-pointer
                                ${isCollapsed ? 'p-2 flex flex-col items-center justify-center gap-1' : 'p-3 text-left'}
                                ${isActive ? 'bg-[var(--bg-panel-secondary)] border-l-4 border-l-cyan-500 rounded-l-none md:rounded-l-lg' : 'hover:border-[var(--border-base)] border-l-4 border-l-transparent'}
                            `}
                                title={isCollapsed ? `Session from ${formatDate(session.date)}` : ''}
                            >
                                {isCollapsed ? (
                                    <>
                                        <FileClock className={`w-5 h-5 ${isActive ? 'text-cyan-500' : 'text-[var(--text-muted)] group-hover:text-indigo-500'}`} />
                                        <span className="text-[9px] text-[var(--text-muted)] w-full text-center truncate px-0.5 opacity-80">
                                            {session.query}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteSession(session.id);
                                            }}
                                            className="absolute top-2 right-2 p-1.5 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-full opacity-0 group-hover:opacity-100 transition-all z-10"
                                            title="Delete Session"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>

                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
                                                {formatDate(session.date)}
                                            </span>
                                            {isActive && <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>}
                                        </div>
                                        <div className={`text-sm font-medium mb-0.5 line-clamp-4 leading-snug pr-6 break-words ${isActive ? 'text-cyan-600 dark:text-cyan-400' : 'text-[var(--text-main)]'}`}>
                                            {session.query}
                                        </div>
                                        <div className="text-[10px] text-[var(--text-muted)] truncate opacity-70">
                                            {session.summary}
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Footer / Theme */}
            <div className={`p-4 border-t border-[var(--border-base)] flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
                {!isCollapsed && <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">Cluster Active</span>}

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
