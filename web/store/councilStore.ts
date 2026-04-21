import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { getApiUrl } from '@/lib/api';

import { cleanModelOverrides } from './configState';
import { parseSseChunk } from './sse';
import { applyCouncilEvent, createSession, deriveLoadPhase, stopSessionState } from './sessionState';
import type { Agent, CouncilSession } from './types';

const INITIAL_AGENTS: Agent[] = [
  { id: 'The Academic', name: 'The Academic', selected: true },
  { id: 'The Layman', name: 'The Layman', selected: true },
  { id: 'The Skeptic', name: 'The Skeptic', selected: true },
  { id: 'The Futurist', name: 'The Futurist', selected: true },
  { id: 'The Ethical Guardian', name: 'The Ethical Guardian', selected: true },
];

export interface CouncilState {
  query: string;
  agents: Agent[];
  isStreaming: boolean;
  abortController: AbortController | null;
  theme: 'dark' | 'light';
  settings: {
    apiKey: string;
    modelOverrides: Record<string, string>;
  };
  sessions: CouncilSession[];
  currentSessionId: string | null;
  setQuery: (query: string) => void;
  toggleAgent: (id: string) => void;
  toggleAllAgents: (selected: boolean) => void;
  resetAll: () => void;
  toggleTheme: () => void;
  setSettings: (settings: Partial<CouncilState['settings']>) => void;
  startSession: () => Promise<void>;
  stopSession: () => void;
  loadSession: (sessionId: string) => void;
  deleteSession: (id: string) => void;
}

function updateSession(
  sessions: CouncilSession[],
  sessionId: string,
  updater: (session: CouncilSession) => CouncilSession,
): CouncilSession[] {
  return sessions.map((session) => (session.id === sessionId ? updater(session) : session));
}

export const useCouncilStore = create<CouncilState>()(
  persist(
    (set, get) => ({
      query: '',
      agents: INITIAL_AGENTS,
      isStreaming: false,
      abortController: null,
      theme: 'dark',
      settings: {
        apiKey: '',
        modelOverrides: {},
      },
      sessions: [],
      currentSessionId: null,

      setQuery: (query) => set({ query }),
      toggleAgent: (id) =>
        set((state) => ({
          agents: state.agents.map((agent) =>
            agent.id === id ? { ...agent, selected: !agent.selected } : agent,
          ),
        })),
      toggleAllAgents: (selected) =>
        set((state) => ({
          agents: state.agents.map((agent) => ({ ...agent, selected })),
        })),
      resetAll: () =>
        set({
          query: '',
          agents: INITIAL_AGENTS,
          currentSessionId: null,
          isStreaming: false,
          abortController: null,
        }),
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'dark' ? 'light' : 'dark',
        })),
      setSettings: (newSettings) =>
        set((state) => ({
          settings: {
            ...state.settings,
            ...newSettings,
            modelOverrides: newSettings.modelOverrides
              ? cleanModelOverrides(newSettings.modelOverrides)
              : state.settings.modelOverrides,
          },
        })),
      deleteSession: (id) =>
        set((state) => ({
          sessions: state.sessions.filter((session) => session.id !== id),
          currentSessionId: state.currentSessionId === id ? null : state.currentSessionId,
        })),
      loadSession: (sessionId) => {
        const session = get().sessions.find((candidate) => candidate.id === sessionId);
        if (!session) {
          return;
        }

        set({
          currentSessionId: sessionId,
          query: session.query,
          agents: session.agents,
          sessions: updateSession(get().sessions, sessionId, (currentSession) => ({
            ...currentSession,
            activePhase: currentSession.activePhase || deriveLoadPhase(currentSession),
          })),
        });
      },
      stopSession: () => {
        const { abortController, isStreaming, currentSessionId } = get();
        if (!isStreaming || !abortController || !currentSessionId) {
          return;
        }

        abortController.abort();
        set((state) => ({
          isStreaming: false,
          abortController: null,
          sessions: updateSession(state.sessions, currentSessionId, stopSessionState),
        }));
      },
      startSession: async () => {
        const state = get();
        const selectedAgents = state.agents.filter((agent) => agent.selected);
        if (!state.query.trim() || selectedAgents.length === 0) {
          return;
        }

        const controller = new AbortController();
        const sessionId = crypto.randomUUID();
        const session = createSession(sessionId, state.query, state.agents);

        set((currentState) => ({
          isStreaming: true,
          abortController: controller,
          currentSessionId: sessionId,
          sessions: [session, ...currentState.sessions],
        }));

        try {
          const response = await fetch(getApiUrl('/api/summon'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: state.query,
              selected_agents: selectedAgents.map((agent) => agent.id),
              custom_api_key: state.settings.apiKey || undefined,
              custom_model_map: Object.keys(state.settings.modelOverrides).length > 0
                ? state.settings.modelOverrides
                : undefined,
            }),
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
          }

          if (!response.body) {
            throw new Error('No response body was returned by the backend.');
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              const flushed = parseSseChunk(buffer, '\n\n');
              buffer = flushed.buffer;
              if (flushed.events.length > 0) {
                set((currentState) => ({
                  sessions: updateSession(currentState.sessions, sessionId, (currentSession) =>
                    flushed.events.reduce(applyCouncilEvent, currentSession),
                  ),
                }));
              }
              break;
            }

            const parsed = parseSseChunk(buffer, decoder.decode(value, { stream: true }));
            buffer = parsed.buffer;
            if (parsed.events.length === 0) {
              continue;
            }

            set((currentState) => ({
              sessions: updateSession(currentState.sessions, sessionId, (currentSession) =>
                parsed.events.reduce(applyCouncilEvent, currentSession),
              ),
            }));
          }
        } catch (error) {
          if ((error as Error).name !== 'AbortError') {
            set((currentState) => ({
              sessions: updateSession(currentState.sessions, sessionId, (currentSession) =>
                applyCouncilEvent(currentSession, {
                  type: 'error',
                  message: (error as Error).message || 'The stream ended unexpectedly.',
                  recoverable: false,
                  phase: `phase-${currentSession.activePhase}`,
                }),
              ),
            }));
          }
        } finally {
          set({ isStreaming: false, abortController: null });
        }
      },
    }),
    {
      name: 'council-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessions: state.sessions,
        currentSessionId: state.currentSessionId,
        theme: state.theme,
        settings: state.settings,
      }),
      merge: (persistedState, currentState) => {
        const typedState = persistedState as Partial<CouncilState>;
        return {
          ...currentState,
          ...typedState,
          isStreaming: false,
          abortController: null,
          settings: {
            ...currentState.settings,
            ...(typedState.settings || {}),
          },
          sessions: (typedState.sessions || []).map((session) => ({
            ...session,
            activePhase: session.activePhase || deriveLoadPhase(session),
          })),
        };
      },
    },
  ),
);
