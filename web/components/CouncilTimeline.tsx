'use client';

import { useCouncilStore } from '@/store/councilStore';
import { PhaseGenerator } from './PhaseGenerator';
import { PhaseCritic } from './PhaseCritic';
import { PhaseArchitect } from './PhaseArchitect';
import { PhaseFinalizer } from './PhaseFinalizer';
import { CheckCircle2, Circle, Loader2, Clock, Hash } from 'lucide-react';

export function CouncilTimeline() {
    const { isStreaming, currentSessionId, sessions } = useCouncilStore();
    const currentSession = sessions.find(s => s.id === currentSessionId);
    const activePhase = currentSession?.activePhase || 0;

    return (
        <div className="max-w-4xl mx-auto px-6 py-12 space-y-12 pb-32">
            {/* 1. Generators */}
            {(activePhase >= 1) && (
                <TimelineItem phase={1} activePhase={activePhase} isStreaming={isStreaming} title="The Council Speaks" description="Divergent generation from selected agents.">
                    <PhaseGenerator />
                </TimelineItem>
            )}

            {/* 2. Critic */}
            {(activePhase >= 2) && (
                <TimelineItem phase={2} activePhase={activePhase} isStreaming={isStreaming} title="Peer Review" description="Critique and scoring of initial proposals.">
                    <PhaseCritic />
                </TimelineItem>
            )}

            {/* 3. Architect */}
            {(activePhase >= 3) && (
                <TimelineItem phase={3} activePhase={activePhase} isStreaming={isStreaming} title="The Blueprint" description="Synthesis of best ideas into a structured plan.">
                    <PhaseArchitect />
                </TimelineItem>
            )}

            {/* 4. Finalizer */}
            {(activePhase >= 4) && (
                <TimelineItem phase={4} activePhase={activePhase} isStreaming={isStreaming} title="The Verdict" description="Final cohesive response drafting.">
                    <PhaseFinalizer />
                </TimelineItem>
            )}

            {/* End Message */}
            {/* End Message & Stats */}
            {activePhase === 4 && !isStreaming && (
                <div className="text-center py-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 space-y-8">
                    <div className="inline-block p-4 border border-[var(--border-base)] bg-[var(--bg-panel)] rounded-lg shadow-lg">
                        <h3 className="text-lg font-bold text-cyan-500 uppercase tracking-widest mb-1">Council Adjourned</h3>
                        <p className="text-xs text-[var(--text-muted)]">Session mandate fulfilled. Records archived.</p>
                    </div>

                    {currentSession?.metrics && (
                        <div className="flex justify-center gap-8 text-sm animate-in zoom-in duration-500 delay-300">
                            <div className="flex flex-col items-center gap-2">
                                <div className="text-[var(--text-muted)] uppercase text-[10px] font-bold tracking-wider">Total Duration</div>
                                <div className="font-mono text-cyan-500 text-lg font-bold flex items-center gap-2 bg-[var(--bg-panel-secondary)] px-4 py-2 rounded border border-[var(--border-base)]">
                                    <Clock className="w-4 h-4 opacity-70" />
                                    {currentSession.metrics.totalTime?.toFixed(2) || '0.00'}s
                                </div>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <div className="text-[var(--text-muted)] uppercase text-[10px] font-bold tracking-wider">Total Tokens</div>
                                <div className="font-mono text-cyan-500 text-lg font-bold flex items-center gap-2 bg-[var(--bg-panel-secondary)] px-4 py-2 rounded border border-[var(--border-base)]">
                                    <Hash className="w-4 h-4 opacity-70" />
                                    {currentSession.metrics.totalTokens?.total || 0}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function TimelineItem({
    phase,
    phase: phaseIndex, // Renamed to phaseIndex to avoid conflict with internal 'phase' variable
    title,
    description,
    children,
    activePhase,
    isStreaming
}: {
    phase: number,
    title: string,
    description: string,
    children: React.ReactNode,
    activePhase: number,
    isStreaming: boolean
}) {
    // Determine Status
    // If activePhase > phaseIndex -> Completed
    // If activePhase == phaseIndex && isProcessing -> Streaming
    // Else -> Idle/Pending
    // SPECIAL CASE: For the last phase (4), if activePhase == 4 and !isProcessing, it's completed.

    let status: 'idle' | 'streaming' | 'completed' = 'idle';

    if (activePhase > phaseIndex) {
        status = 'completed';
    } else if (activePhase === phaseIndex) {
        // If it's the last phase (4), check isStreaming
        if (phaseIndex === 4) {
            status = isStreaming ? 'streaming' : 'completed';
        } else {
            // Check if we are actively streaming this phase.
            // If the user stopped the stream (isStreaming == false), but activePhase == phaseIndex, it means we are stopped here.
            // So we show 'completed' (or we could show a distinct 'stopped' state, but 'completed' icon is safer than infinite spinner).
            status = isStreaming ? 'streaming' : 'completed';
        }
    }

    // If we haven't reached this phase yet
    if (activePhase < phaseIndex) {
        status = 'idle';
    }

    // Override: If phase is 1 (Generators) and we are now at phase 2, 3, or 4 -> Completed.
    // The simple `activePhase > phaseIndex` handles this.

    return (
        <div className="relative pl-8 md:pl-0">

            {/* Timeline Connector Line */}
            <div className="absolute left-3 top-10 bottom-0 w-0.5 bg-[var(--border-base)] md:hidden" />

            <div className="flex gap-4 md:gap-8 items-start">
                {/* Status Icon */}
                <div className={`flex-shrink-0 mt-1 relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 bg-[var(--bg-app)] transition-colors duration-500
          ${status === 'completed' ? 'border-cyan-500 text-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]' :
                        status === 'streaming' ? 'border-indigo-500 text-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] animate-pulse' :
                            'border-[var(--border-base)] text-[var(--text-muted)]'}
        `}>
                    {status === 'completed' ? (
                        <CheckCircle2 className="w-5 h-5" />
                    ) : status === 'streaming' ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <span className="font-mono text-xs">{phaseIndex}</span>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 space-y-4">
                    <div>
                        <h3 className={`text-xl font-bold ${status === 'streaming' ? 'text-indigo-500 dark:text-indigo-400' : 'text-[var(--text-main)]'}`}>
                            {title}
                        </h3>
                        <p className="text-[var(--text-muted)] text-sm">{description}</p>
                    </div>
                    <div className={`transition-all duration-700 ${status === 'streaming' ? 'opacity-100 translate-y-0' : 'opacity-100'}`}>
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
