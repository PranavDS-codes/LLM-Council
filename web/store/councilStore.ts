import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Agent {
    id: string;
    name: string;
    selected: boolean;
}

export interface Session {
    id: string;
    query: string;
    date: string; // ISO string
    summary: string;
    // Full State Snapshot
    agents: Agent[];
    generatorStreams: Record<string, string>;
    criticData: any;
    architectData: any;
    finalizerText: string;
}

export interface CouncilState {
    // Setup
    query: string;
    agents: Agent[];
    setQuery: (q: string) => void;
    toggleAgent: (id: string) => void;
    toggleAllAgents: (selected: boolean) => void;

    // Execution State
    isProcessing: boolean;
    activePhase: 1 | 2 | 3 | 4 | 0; // 0 = Idle

    // Phase 1: Generators
    generatorStreams: Record<string, string>;
    appendToGenerator: (agent: string, text: string) => void;
    resetGenerators: () => void;

    // Phase 2: Critic
    criticData: any | null;
    setCriticData: (data: any) => void;

    // Phase 3: Architect
    architectData: any | null;
    setArchitectData: (data: any) => void;

    // Phase 4: Finalizer
    finalizerText: string;
    appendToFinalizer: (text: string) => void;

    // Meta
    messages: string[];
    addMessage: (msg: string) => void;
    resetAll: () => void;

    // Theme
    theme: 'dark' | 'light';
    toggleTheme: () => void;

    // Session Management
    sessions: Session[];
    saveCurrentSession: () => void;
    deleteSession: (id: string) => void;
    loadSession: (session: Session) => void;
}

const INITIAL_AGENTS = [
    { id: 'The Academic', name: 'The Academic', selected: true },
    { id: 'The Layman', name: 'The Layman', selected: true },
    { id: 'The Skeptic', name: 'The Skeptic', selected: true },
    { id: 'The Futurist', name: 'The Futurist', selected: true },
    { id: 'The Ethical Guardian', name: 'The Ethical Guardian', selected: true },
];

export const useCouncilStore = create<CouncilState>()(
    persist(
        (set, get) => ({
            query: '',
            agents: INITIAL_AGENTS,

            setQuery: (q) => set({ query: q }),

            toggleAgent: (id) => set((state) => ({
                agents: state.agents.map(a =>
                    a.id === id ? { ...a, selected: !a.selected } : a
                )
            })),

            toggleAllAgents: (selected) => set((state) => ({
                agents: state.agents.map(a => ({ ...a, selected }))
            })),

            isProcessing: false,
            activePhase: 0,

            generatorStreams: {},
            appendToGenerator: (agent, text) => set((state) => {
                return {
                    activePhase: 1,
                    isProcessing: true,
                    generatorStreams: {
                        ...state.generatorStreams,
                        [agent]: (state.generatorStreams[agent] || '') + text
                    }
                };
            }),
            resetGenerators: () => set({ generatorStreams: {} }),

            criticData: null,
            setCriticData: (data) => set((state) => {
                // Merge strategies
                const existing = state.criticData || {};

                // If it's a completely new run (e.g. no existing winner), just take it. 
                // BUT we are streaming batches. So we must merge.
                // We'll prioritize the NEW winner/reasoning but MERGE scores and flaws.

                return {
                    activePhase: 2,
                    criticData: {
                        ...existing,
                        ...data, // Overwrite primitives (winner, reasoning) with latest batch (or keep first?)
                        // Actually, generally we want to ACCUMULATE scores and flaws.
                        scores: { ...(existing.scores || {}), ...(data.scores || {}) },
                        flaws: { ...(existing.flaws || {}), ...(data.flaws || {}) },
                        // For winner/reasoning: simplest is to just overwrite with latest batch's opinion
                        winner_id: data.winner_id || existing.winner_id,
                        reasoning: data.reasoning || existing.reasoning
                    }
                }
            }),

            architectData: null,
            setArchitectData: (data) => set({ architectData: data, activePhase: 3 }),

            finalizerText: '',
            appendToFinalizer: (text) => set((state) => ({
                activePhase: 4,
                finalizerText: state.finalizerText + text
            })),

            messages: [],
            addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),

            resetAll: () => set((state) => ({
                isProcessing: false,
                activePhase: 0,
                query: '', // Optional: clear query too
                generatorStreams: {},
                criticData: null,
                architectData: null,
                finalizerText: '',
                messages: []
            })),

            theme: 'dark',
            toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

            sessions: [],
            saveCurrentSession: () => set((state) => {
                // Don't save empty sessions
                if (!state.finalizerText && !state.criticData) return state;

                const newSession: Session = {
                    id: Date.now().toString(),
                    query: state.query,
                    date: new Date().toISOString(),
                    summary: state.criticData?.winner_id ? `${state.criticData.winner_id} won.` : 'Council Adjourned.',
                    agents: state.agents,
                    generatorStreams: state.generatorStreams,
                    criticData: state.criticData,
                    architectData: state.architectData,
                    finalizerText: state.finalizerText
                };

                return { sessions: [newSession, ...state.sessions] };
            }),

            deleteSession: (id) => set((state) => ({
                sessions: state.sessions.filter(s => s.id !== id)
            })),

            loadSession: (session) => set({
                query: session.query,
                agents: session.agents,
                generatorStreams: session.generatorStreams,
                criticData: session.criticData,
                architectData: session.architectData,
                finalizerText: session.finalizerText,
                activePhase: 4, // Show completed state
                isProcessing: false
            })
        }),
        {
            name: 'council-storage', // name of the item in the storage (must be unique)
            storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
            partialize: (state) => ({ sessions: state.sessions, theme: state.theme }), // Only persist sessions and theme
        }
    )
);
