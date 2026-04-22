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
  assert.equal(merged.settings.apiKey, 'demo-key');
  assert.deepEqual(merged.settings.modelOverrides, { critic: 'critic/model' });
  assert.equal(merged.sessions[0]?.activePhase, 4);
  assert.equal(merged.sessions[0]?.status, 'completed');
});
