import test from 'node:test';
import assert from 'node:assert/strict';

import { applyCouncilEvent, applyFollowUpChatEvent, createSession, stopFollowUpChatState, stopSessionState } from '../store/sessionState.ts';

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

test('live phase buffers preserve generator tabs and structured progress', () => {
  let session = createSession('3', 'Stream this', agents);
  session = applyCouncilEvent(session, { type: 'generator_chunk', agent: 'The Academic', chunk: 'Academic ' });
  session = applyCouncilEvent(session, { type: 'generator_chunk', agent: 'The Skeptic', chunk: 'Skeptic ' });
  session = applyCouncilEvent(session, { type: 'generator_chunk', agent: 'The Academic', chunk: 'draft' });
  session = applyCouncilEvent(session, { type: 'critic_start', model: 'openai/gpt-oss-120b', batch: 1, total_batches: 2 });
  session = applyCouncilEvent(session, { type: 'critic_chunk', chunk: '{"scores":' });
  session = applyCouncilEvent(session, { type: 'architect_start', model: 'openai/gpt-oss-120b' });
  session = applyCouncilEvent(session, { type: 'architect_chunk', chunk: '{"structure":' });

  assert.equal(session.generatorStreams['The Academic'], 'Academic draft');
  assert.equal(session.generatorStreams['The Skeptic'], 'Skeptic ');
  assert.equal(session.criticProgress?.totalBatches, 2);
  assert.equal(session.criticStream, '{"scores":');
  assert.equal(session.architectStream, '{"structure":');
});

test('critic thinking remains live only until its critic batch completes', () => {
  let session = createSession('thinking', 'Review this', agents);
  session = applyCouncilEvent(session, { type: 'critic_start', model: 'openai/gpt-oss-120b', batch: 1, total_batches: 2 });
  session = applyCouncilEvent(session, { type: 'critic_thinking', batch: 1, chunk: 'Assessing accuracy.' });
  assert.equal(session.criticThinking[1], 'Assessing accuracy.');
  session = applyCouncilEvent(session, { type: 'critic_thinking_done', batch: 1 });
  assert.equal(session.criticThinking[1], undefined);
});

test('generator, architect, and finalizer thinking clears when each phase completes', () => {
  let session = createSession('all-thinking', 'Review this', agents);
  session = applyCouncilEvent(session, { type: 'generator_thinking', agent: 'The Academic', chunk: 'Drafting.' });
  session = applyCouncilEvent(session, { type: 'generator_thinking_done', agent: 'The Academic' });
  session = applyCouncilEvent(session, { type: 'architect_thinking', chunk: 'Planning.' });
  session = applyCouncilEvent(session, { type: 'architect_thinking_done' });
  session = applyCouncilEvent(session, { type: 'finalizer_thinking', chunk: 'Synthesizing.' });
  session = applyCouncilEvent(session, { type: 'finalizer_thinking_done' });

  assert.equal(session.generatorThinking['The Academic'], undefined);
  assert.equal(session.architectThinking, '');
  assert.equal(session.finalizerThinking, '');
});

test('follow-up chat keeps reasoning, answer, and usage in the session', () => {
  let session = createSession('4', 'Follow up', agents);
  session.status = 'completed';
  session.finalizerText = 'Final report';
  session.followUpChat.messages = [
    { id: 'user', role: 'user', content: 'Explain this', reasoning: '', timestamp: 1 },
    { id: 'assistant', role: 'assistant', content: '', reasoning: '', timestamp: 2, model: 'openai/gpt-oss-20b', status: 'streaming' },
  ];
  session = applyFollowUpChatEvent(session, { type: 'chat_reasoning_chunk', chunk: 'Checking ' });
  session = applyFollowUpChatEvent(session, { type: 'chat_content_chunk', chunk: 'Here is why.' });
  session = applyFollowUpChatEvent(session, { type: 'chat_done', model: 'openai/gpt-oss-120b', usage: { prompt: 4, completion: 5, total: 9 } });

  const reply = session.followUpChat.messages[1];
  assert.equal(reply.reasoning, 'Checking ');
  assert.equal(reply.content, 'Here is why.');
  assert.equal(reply.model, 'openai/gpt-oss-120b');
  assert.equal(reply.usage?.total, 9);

  session.followUpChat.messages.push({ id: 'stopped', role: 'assistant', content: '', reasoning: '', timestamp: 3, status: 'streaming' });
  assert.equal(stopFollowUpChatState(session).followUpChat.messages.at(-1)?.status, 'stopped');
});
