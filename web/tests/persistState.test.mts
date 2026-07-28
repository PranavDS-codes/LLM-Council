import test from 'node:test';
import assert from 'node:assert/strict';

import { mergePersistedCouncilState } from '../store/persistState.ts';

const currentState = {
  query: '',
  agents: [],
  isStreaming: true,
  abortController: new AbortController(),
  theme: 'dark' as const,
  settings: {
    apiKey: '',
    modelOverrides: {},
  },
  agentRegistry: [],
  agentDraft: [],
  sessions: [],
  currentSessionId: null,
};

test('mergePersistedCouncilState ignores malformed persisted slices', () => {
  const merged = mergePersistedCouncilState(
    {
      settings: 'bad-shape',
      sessions: { not: 'an-array' },
      theme: 'neon',
      currentSessionId: 42,
    },
    currentState,
  );

  assert.equal(merged.theme, 'dark');
  assert.equal(merged.currentSessionId, null);
  assert.deepEqual(merged.settings, { apiKey: '', modelOverrides: {} });
  assert.deepEqual(merged.sessions, []);
  assert.equal(merged.isStreaming, false);
  assert.equal(merged.abortController, null);
});

test('mergePersistedCouncilState derives a safe active phase for legacy sessions', () => {
  const merged = mergePersistedCouncilState(
    {
      theme: 'light',
      currentSessionId: 'session-1',
      settings: {
        apiKey: 'demo-key',
        modelOverrides: {
          critic: 'critic/model',
          ignored: 123,
        },
      },
      sessions: [
        {
          id: 'session-1',
          query: 'Should we ship?',
          date: '2026-04-22T00:00:00.000Z',
          finalizerText: 'Final answer',
          architectData: null,
          criticData: null,
          metrics: {},
        },
      ],
    },
    currentState,
  );

  assert.equal(merged.theme, 'light');
  assert.equal(merged.currentSessionId, 'session-1');
  assert.equal(merged.settings.apiKey, '');
  assert.deepEqual(merged.settings.modelOverrides, { critic: 'critic/model' });
  assert.equal(merged.sessions[0]?.activePhase, 4);
  assert.equal(merged.sessions[0]?.status, 'completed');
});

test('mergePersistedCouncilState clears legacy provider settings but retains saved sessions', () => {
  const merged = mergePersistedCouncilState(
    {
      settings: {
        apiKey: 'sk-or-v1-legacy-key',
        modelOverrides: {
          generator_1: 'nvidia/nemotron-nano-12b-v2-vl:free',
          critic: 'openai/gpt-oss-120b',
        },
      },
      sessions: [
        {
          id: 'session-1',
          query: 'Retain this history',
          agents: [],
        },
      ],
    },
    currentState,
  );

  assert.equal(merged.settings.apiKey, '');
  assert.deepEqual(merged.settings.modelOverrides, { critic: 'openai/gpt-oss-120b' });
  assert.equal(merged.sessions[0]?.query, 'Retain this history');
  assert.equal(merged.agentRegistry[0]?.model, 'openai/gpt-oss-20b');
  assert.equal(merged.agentRegistry.length, 5);
});

test('legacy generator models migrate into the browser-local agent registry', () => {
  const merged = mergePersistedCouncilState({ settings: { modelOverrides: { generator_1: 'custom/model', critic: 'phase/model' } } }, currentState);
  assert.equal(merged.agentRegistry[0]?.model, 'custom/model');
  assert.deepEqual(merged.settings.modelOverrides, { critic: 'phase/model' });
  assert.equal(merged.agents.length, merged.agentRegistry.length);
});

test('agent drafts survive hydration without replacing the applied registry', () => {
  const merged = mergePersistedCouncilState({
    agentRegistry: [{ id: 'saved', name: 'Saved', personaInstruction: 'Saved prompt', model: 'model/saved' }],
    agentDraft: [{ id: 'draft', name: 'Draft', personaInstruction: 'Draft prompt', model: 'model/draft' }],
  }, currentState);
  assert.equal(merged.agentRegistry[0]?.name, 'Saved');
  assert.equal(merged.agentDraft[0]?.name, 'Draft');
});
