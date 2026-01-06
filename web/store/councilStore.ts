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
    agentModels?: Record<string, string>; // Metadata: Model ID used for generation
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
    agentModels: Record<string, string>;
    setAgentModel: (agent: string, model: string) => void;
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

    // Settings
    settings: {
        apiKey: string;
        modelOverrides: Record<string, string>;
    };
    setSettings: (settings: Partial<CouncilState['settings']>) => void;

    // Session Management
    sessions: Session[];
    currentSessionId: string | null;
    createSession: (query: string) => void;
    updateCurrentSession: () => void;
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

            // Initial Settings
            settings: {
                apiKey: '',
                modelOverrides: {}
            },
            setSettings: (newSettings) => set((state) => ({
                settings: { ...state.settings, ...newSettings }
            })),

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
            agentModels: {},
            setAgentModel: (agent, model) => set((state) => ({
                agentModels: { ...state.agentModels, [agent]: model }
            })),
            appendToGenerator: (agent, text) => set((state) => {
                return {
                    // Note: activePhase setting is redundant if createSession sets it, 
                    // but good for safety if called directly.
                    // createSession handles initial activePhase.
                    generatorStreams: {
                        ...state.generatorStreams,
                        [agent]: (state.generatorStreams[agent] || '') + text
                    }
                };
            }),
            resetGenerators: () => set({ generatorStreams: {} }),

            criticData: null,
            setCriticData: (data) => set((state) => {
                const existing = state.criticData || {};
                return {
                    activePhase: 2,
                    criticData: {
                        ...existing,
                        ...data,
                        scores: { ...(existing.scores || {}), ...(data.scores || {}) },
                        flaws: { ...(existing.flaws || {}), ...(data.flaws || {}) },
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
                query: '',
                generatorStreams: {},
                agentModels: {},
                criticData: null,
                architectData: null,
                finalizerText: '',
                messages: [],
                currentSessionId: null
            })),

            theme: 'dark',
            toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

            sessions: [],
            currentSessionId: null,

            createSession: (query) => set((state) => {
                const newId = Date.now().toString();
                const newSession: Session = {
                    id: newId,
                    query: query,
                    date: new Date().toISOString(),
                    summary: 'Council in session...',
                    agents: state.agents,
                    generatorStreams: {},
                    agentModels: {},
                    criticData: null,
                    architectData: null,
                    finalizerText: ''
                };
                return {
                    currentSessionId: newId,
                    sessions: [newSession, ...state.sessions],
                    query: query,
                    activePhase: 1,
                    isProcessing: true,
                    generatorStreams: {},
                    agentModels: {},
                    criticData: null,
                    architectData: null,
                    finalizerText: '',
                    messages: []
                };
            }),

            updateCurrentSession: () => set((state) => {
                if (!state.currentSessionId) return state;

                const updatedSessions = state.sessions.map(session => {
                    if (session.id === state.currentSessionId) {
                        return {
                            ...session,
                            summary: state.criticData?.winner_id ? `${state.criticData.winner_id} won.` : 'Council Adjourned.',
                            agents: state.agents,
                            generatorStreams: state.generatorStreams,
                            agentModels: state.agentModels,
                            criticData: state.criticData,
                            architectData: state.architectData,
                            finalizerText: state.finalizerText
                        };
                    }
                    return session;
                });

                return { sessions: updatedSessions };
            }),

            deleteSession: (id) => set((state) => ({
                sessions: state.sessions.filter(s => s.id !== id),
                currentSessionId: state.currentSessionId === id ? null : state.currentSessionId
            })),

            loadSession: (session) => set({
                currentSessionId: session.id,
                query: session.query,
                agents: session.agents,
                generatorStreams: session.generatorStreams,
                agentModels: session.agentModels || {},
                criticData: session.criticData,
                architectData: session.architectData,
                finalizerText: session.finalizerText,
                activePhase: 4,
                isProcessing: false
            })
        }),
        {
            name: 'council-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ sessions: state.sessions, theme: state.theme, settings: state.settings }),
        }
    )
);
