import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Agent {
    id: string;
    name: string;
    selected: boolean;
}

export interface Message {
    id: string;
    sender: string;
    type: 'user' | 'system' | 'agent';
    content: string;
    timestamp: number;
}

// Metric Interfaces
export interface MetricUsage {
    total: number;
    prompt: number;
    completion: number;
}

export interface MetricData {
    time: number;
    model: string;
    usage: MetricUsage;
}

export interface Session {
    id: string;
    query: string;
    date: string; // ISO string
    summary: string;
    messages: Message[]; // The full log "DVR"
    agents: Agent[]; // Snapshot of agents used in this session

    // State of the session
    activePhase: 1 | 2 | 3 | 4 | 0; // 0 = Idle

    // Detailed Step State
    generatorStreams: Record<string, string>;
    agentModels: Record<string, string>; // Maps AgentName -> ModelID
    criticData: any;
    architectData: any;
    finalizerText: string;

    // Metrics
    metrics: {
        generators: Record<string, MetricData>;
        critic?: MetricData;
        architect?: MetricData;
        finalizer?: MetricData;
        totalTime: number;
        totalTokens: MetricUsage;
    };
}

export interface CouncilState {
    // Setup
    query: string;
    agents: Agent[];
    setQuery: (q: string) => void;
    toggleAgent: (id: string) => void;
    toggleAllAgents: (selected: boolean) => void;

    // Headless Execution State
    isStreaming: boolean;
    abortController: AbortController | null;

    // Meta
    sessionLogs: Record<string, Message[]>; // Indexed by SessionID - To be deprecated if we move completely to Session.messages
    // For now we will sync Session.messages.

    resetAll: () => void; // Clear current session state (just selection)

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
    sessions: Session[]; // Metadata list or full list
    currentSessionId: string | null;

    startSession: () => Promise<void>;
    stopSession: () => void;
    loadSession: (sessionId: string) => void;
    deleteSession: (id: string) => void;
}

const INITIAL_AGENTS = [
    { id: 'The Academic', name: 'The Academic', selected: true },
    { id: 'The Layman', name: 'The Layman', selected: true },
    { id: 'The Skeptic', name: 'The Skeptic', selected: true },
    { id: 'The Futurist', name: 'The Futurist', selected: true },
    { id: 'The Ethical Guardian', name: 'The Ethical Guardian', selected: true },
];

// Helper to get API URL
const getApiUrl = () => {
    // In a real app, strict env handling. Here, fallback to localhost if not set.
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    return `${baseUrl}/api/summon`;
};

export const useCouncilStore = create<CouncilState>()(
    persist(
        (set, get) => ({
            query: '',
            agents: INITIAL_AGENTS,
            sessionLogs: {},

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

            isStreaming: false,
            abortController: null,

            // Theme
            theme: 'dark',
            toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

            sessions: [],
            currentSessionId: null,

            resetAll: () => set({
                query: '',
                agents: INITIAL_AGENTS,
                currentSessionId: null
            }),

            deleteSession: (id) => set((state) => ({
                sessions: state.sessions.filter(s => s.id !== id),
                currentSessionId: state.currentSessionId === id ? null : state.currentSessionId
            })),

            loadSession: (sessionId) => {
                const state = get();
                const session = state.sessions.find(s => s.id === sessionId);
                if (!session) return;

                // REPAIR: Check for missing activePhase (legacy sessions)
                if (session.activePhase === undefined) {
                    const derivedPhase = session.finalizerText ? 4 : (session.architectData ? 3 : (session.criticData ? 2 : 1));
                    set((s) => ({
                        sessions: s.sessions.map(sess => sess.id === sessionId ? { ...sess, activePhase: derivedPhase } : sess),
                        currentSessionId: sessionId,
                        query: session.query,
                        agents: session.agents
                    }));
                } else {
                    set({
                        currentSessionId: sessionId,
                        query: session.query,
                        agents: session.agents,
                    });
                }
            },

            stopSession: () => {
                const { abortController, isStreaming } = get();
                if (isStreaming && abortController) {
                    abortController.abort();
                    set({ isStreaming: false, abortController: null });

                    // Create a system message in current session log
                    const state = get();
                    const currentId = state.currentSessionId;
                    if (currentId) {
                        const newMsg: Message = {
                            id: crypto.randomUUID(),
                            sender: 'Internal',
                            type: 'system',
                            content: 'Session stopped by user.', // Notification
                            timestamp: Date.now()
                        };
                        set((currentState) => {
                            const sessionIndex = currentState.sessions.findIndex(s => s.id === currentId);
                            if (sessionIndex === -1) return {};

                            const updatedSessions = [...currentState.sessions];
                            updatedSessions[sessionIndex] = {
                                ...updatedSessions[sessionIndex],
                                messages: [...updatedSessions[sessionIndex].messages, newMsg],
                                activePhase: updatedSessions[sessionIndex].activePhase // Keep phase but stop loading happens via isStreaming check
                            };
                            return { sessions: updatedSessions };
                        });
                    }
                }
            },

            startSession: async () => {
                const state = get();
                // Basic Validation
                const selectedAgents = state.agents.filter(a => a.selected);
                if (!state.query || selectedAgents.length === 0) return;

                // Reset streaming state
                set({ isStreaming: true });

                // Create AbortController
                const controller = new AbortController();
                set({ abortController: controller });

                const newSessionId = crypto.randomUUID();

                // Initialize Session
                const newSession: Session = {
                    id: newSessionId,
                    query: state.query,
                    date: new Date().toISOString(),
                    summary: 'Council in session...',
                    messages: [],
                    agents: JSON.parse(JSON.stringify(state.agents)),

                    activePhase: 1,
                    generatorStreams: {},
                    agentModels: {},
                    criticData: null,
                    architectData: null,
                    finalizerText: '',
                    metrics: {
                        generators: {},
                        totalTime: 0,
                        totalTokens: { total: 0, prompt: 0, completion: 0 }
                    }
                };

                // Add to sessions list immediately
                set((currentState) => ({
                    sessions: [newSession, ...currentState.sessions],
                    currentSessionId: newSessionId
                }));

                try {
                    const payload = {
                        query: state.query,
                        selected_agents: selectedAgents.map(a => a.id),
                        custom_api_key: state.settings.apiKey || undefined,
                        custom_model_map: Object.keys(state.settings.modelOverrides).length > 0
                            ? state.settings.modelOverrides
                            : undefined
                    };

                    const response = await fetch(getApiUrl(), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                        signal: controller.signal
                    });

                    if (!response.body) throw new Error("No response body");

                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        const chunk = decoder.decode(value);
                        const lines = chunk.split('\n');

                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                try {
                                    const jsonStr = line.replace('data: ', '').trim();
                                    if (!jsonStr) continue;
                                    const data = JSON.parse(jsonStr);

                                    // FUNCTIONAL STATE UPDATE:
                                    // 1. Get latest sessions list (must be fresh)
                                    // 2. Find current session
                                    // 3. Mutate a copy
                                    // 4. Set state
                                    set((currentState) => {
                                        const sessionIndex = currentState.sessions.findIndex(s => s.id === newSessionId);
                                        if (sessionIndex === -1) return {}; // Session deleted?

                                        // Deep clone the session to mutate safely OR spread props
                                        // Since we modify nested objects (generatorStreams), deep clone or careful spread is needed.
                                        // Spread is better for performance if careful.
                                        const session = currentState.sessions[sessionIndex];
                                        let updatedSession = { ...session };

                                        // --- Update Logic based on Event ---
                                        switch (data.type) {
                                            case 'generator_start':
                                                if (data.model) {
                                                    updatedSession.agentModels = {
                                                        ...updatedSession.agentModels,
                                                        [data.agent]: data.model
                                                    };
                                                }
                                                break;

                                            case 'generator_chunk':
                                                updatedSession.generatorStreams = {
                                                    ...updatedSession.generatorStreams,
                                                    [data.agent]: (updatedSession.generatorStreams[data.agent] || '') + data.chunk
                                                };
                                                break;

                                            case 'generator_done':
                                                updatedSession.metrics = {
                                                    ...updatedSession.metrics,
                                                    generators: {
                                                        ...updatedSession.metrics.generators,
                                                        [data.agent]: {
                                                            time: data.time_taken,
                                                            model: data.model,
                                                            usage: data.usage
                                                        }
                                                    }
                                                };
                                                break;

                                            case 'critic_result':
                                                updatedSession.activePhase = 2;
                                                // Prepare previous data
                                                const prevData = updatedSession.criticData || {};
                                                updatedSession.criticData = {
                                                    ...prevData,
                                                    ...data,
                                                    // Merge Dictionaries
                                                    scores: { ...(prevData.scores || {}), ...(data.scores || {}) },
                                                    flaws: { ...(prevData.flaws || {}), ...(data.flaws || {}) },
                                                    // Append Text Fields
                                                    reasoning: (prevData.reasoning ? prevData.reasoning + "\n\n---\n\n" : "") + (data.reasoning || ""),
                                                    winner_id: (prevData.winner_id ? prevData.winner_id + " & " : "") + (data.winner_id || "")
                                                };

                                                if (data.time_taken) {
                                                    const prevCritic = updatedSession.metrics.critic;
                                                    const newUsage = {
                                                        total: (prevCritic?.usage.total || 0) + data.usage.total,
                                                        prompt: (prevCritic?.usage.prompt || 0) + data.usage.prompt,
                                                        completion: (prevCritic?.usage.completion || 0) + data.usage.completion,
                                                    };

                                                    updatedSession.metrics = {
                                                        ...updatedSession.metrics,
                                                        critic: {
                                                            time: (prevCritic?.time || 0) + data.time_taken,
                                                            model: data.model, // Overwrite with latest model
                                                            usage: newUsage
                                                        }
                                                    }
                                                }
                                                break;

                                            case 'architect_result':
                                                updatedSession.activePhase = 3;
                                                updatedSession.architectData = data;
                                                if (data.time_taken) {
                                                    updatedSession.metrics = {
                                                        ...updatedSession.metrics,
                                                        architect: {
                                                            time: data.time_taken,
                                                            model: data.model,
                                                            usage: data.usage
                                                        }
                                                    };
                                                }
                                                break;

                                            case 'finalizer_chunk':
                                                updatedSession.activePhase = 4;
                                                updatedSession.finalizerText = (updatedSession.finalizerText || '') + data.chunk;
                                                break;

                                            case 'finalizer_done':
                                                updatedSession.metrics.finalizer = {
                                                    time: data.time_taken,
                                                    model: data.model,
                                                    usage: data.usage
                                                };
                                                // Update Summary with snippet
                                                const snippet = updatedSession.finalizerText ? updatedSession.finalizerText.slice(0, 100) + '...' : 'Council Mandate Fulfilled';
                                                updatedSession.summary = snippet;
                                                break;

                                            case 'done':
                                                updatedSession.activePhase = 4; // Ensure complete
                                                if (data.total_execution_time) {
                                                    updatedSession.metrics.totalTime = data.total_execution_time;
                                                    updatedSession.metrics.totalTokens = data.total_tokens;
                                                }
                                                // Ensure summary is set if not already
                                                if (updatedSession.summary === 'Council in session...') {
                                                    updatedSession.summary = updatedSession.finalizerText ? updatedSession.finalizerText.slice(0, 100) + '...' : 'Council Adjourned';
                                                }
                                                break;

                                            case 'error':
                                                updatedSession.messages = [
                                                    ...updatedSession.messages,
                                                    {
                                                        id: crypto.randomUUID(),
                                                        timestamp: Date.now(),
                                                        type: 'system',
                                                        sender: 'System',
                                                        content: data.message
                                                    }
                                                ];
                                                break;
                                        }

                                        // Construct new sessions array with replaced session
                                        const newSessions = [...currentState.sessions];
                                        newSessions[sessionIndex] = updatedSession;

                                        const updates: Partial<CouncilState> = {
                                            sessions: newSessions
                                        };

                                        return updates;

                                        return updates;
                                    });
                                } catch (e) {
                                    console.error("Parse Error", e);
                                }
                            }
                        }
                    }

                } catch (error: any) {
                    if (error.name === 'AbortError') {
                        set({ isStreaming: false, abortController: null });
                    } else {
                        console.error(error);
                        set({ isStreaming: false, abortController: null });
                    }
                } finally {
                    set({ isStreaming: false, abortController: null });
                }
            }
        }),
        {
            name: 'council-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                sessions: state.sessions,
                // sessionLogs: state.sessionLogs, // Deprecated, we use Session.messages
                currentSessionId: state.currentSessionId,
                theme: state.theme,
                settings: state.settings
            }),
        }
    )
);

