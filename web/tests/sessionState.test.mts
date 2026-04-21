import test from 'node:test';
import assert from 'node:assert/strict';

import { applyCouncilEvent, createSession, stopSessionState } from '../store/sessionState.ts';

const agents = [
  { id: 'The Academic', name: 'The Academic', selected: true },
  { id: 'The Skeptic', name: 'The Skeptic', selected: true },
];

test('applyCouncilEvent merges critic batches and finalizes summary', () => {
  let session = createSession('1', 'Should we ship?', agents);
  session = applyCouncilEvent(session, {
    type: 'critic_result',
    winner_id: 'The Academic',
    rankings: ['The Academic'],
    reasoning: 'Stronger evidence.',
    flaws: { 'The Skeptic': 'Too broad' },
    scores: { 'The Academic': 9 },
    time_taken: 1,
    model: 'critic/model',
    usage: { total: 10, prompt: 4, completion: 6 },
  });
  session = applyCouncilEvent(session, {
    type: 'critic_result',
    winner_id: 'The Skeptic',
    rankings: ['The Skeptic'],
    reasoning: 'Better edge-case coverage.',
    flaws: { 'The Academic': 'Missed edge cases' },
    scores: { 'The Skeptic': 8 },
    time_taken: 1.5,
    model: 'critic/model',
    usage: { total: 12, prompt: 5, completion: 7 },
  });
  session = applyCouncilEvent(session, {
    type: 'finalizer_chunk',
    chunk: 'Final answer body',
  });
  session = applyCouncilEvent(session, {
    type: 'done',
    total_execution_time: 9,
    total_tokens: { total: 100, prompt: 40, completion: 60 },
  });

  assert.equal(session.criticData?.winner_id, 'The Academic & The Skeptic');
  assert.match(session.criticData?.reasoning || '', /Stronger evidence/);
  assert.match(session.criticData?.reasoning || '', /Better edge-case coverage/);
  assert.equal(session.status, 'completed');
  assert.equal(session.summary, 'Final answer body');
});

test('stopSessionState marks a session as stopped and preserves an issue', () => {
  const session = stopSessionState(createSession('2', 'Pause me', agents));
  assert.equal(session.status, 'stopped');
  assert.equal(session.issues.at(-1)?.message, 'Session stopped by user.');
});
