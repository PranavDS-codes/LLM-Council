import test from 'node:test';
import assert from 'node:assert/strict';

import { parseFollowUpSseChunk, parseSseChunk } from '../store/sse.ts';

test('parseSseChunk reconstructs events across chunk boundaries', () => {
  const first = parseSseChunk('', 'event: generator_start\ndata: {"type":"generator_start","agent":"The Academic"');
  assert.equal(first.events.length, 0);

  const second = parseSseChunk(first.buffer, ',"model":"demo/model"}\n\n');
  assert.equal(second.events.length, 1);
  assert.equal(second.events[0].type, 'generator_start');
  if (second.events[0].type === 'generator_start') {
    assert.equal(second.events[0].agent, 'The Academic');
  }
});

test('parseSseChunk converts malformed payloads into recoverable errors', () => {
  const parsed = parseSseChunk('', 'event: critic_result\ndata: {"oops"\n\n');
  assert.equal(parsed.events.length, 1);
  assert.equal(parsed.events[0].type, 'error');
});

test('parseSseChunk accepts structured phase progress events', () => {
  const parsed = parseSseChunk('', 'event: critic_start\ndata: {"type":"critic_start","model":"openai/gpt-oss-120b","batch":1,"total_batches":2}\n\nevent: architect_chunk\ndata: {"type":"architect_chunk","chunk":"partial"}\n\n');
  assert.deepEqual(parsed.events.map((event) => event.type), ['critic_start', 'architect_chunk']);
});

test('parseFollowUpSseChunk keeps reasoning separate from answer content', () => {
  const parsed = parseFollowUpSseChunk('', 'event: chat_reasoning_chunk\ndata: {"chunk":"Think"}\n\nevent: chat_content_chunk\ndata: {"chunk":"Answer"}\n\nevent: chat_done\ndata: {"model":"openai/gpt-oss-20b","usage":{"prompt":2,"completion":3,"total":5}}\n\n');
  assert.deepEqual(parsed.events.map((event) => event.type), ['chat_reasoning_chunk', 'chat_content_chunk', 'chat_done']);
});

test('parseSseChunk accepts temporary per-critic thinking events', () => {
  const parsed = parseSseChunk('', 'event: critic_thinking\ndata: {"batch":2,"chunk":"Checking evidence"}\n\nevent: critic_thinking_done\ndata: {"batch":2}\n\n');
  assert.deepEqual(parsed.events.map((event) => event.type), ['critic_thinking', 'critic_thinking_done']);
});

test('parseSseChunk accepts temporary thinking events for all council phases', () => {
  const parsed = parseSseChunk('', 'event: generator_thinking\ndata: {"agent":"The Academic","chunk":"Drafting"}\n\nevent: architect_thinking\ndata: {"chunk":"Planning"}\n\nevent: finalizer_thinking\ndata: {"chunk":"Synthesizing"}\n\n');
  assert.deepEqual(parsed.events.map((event) => event.type), ['generator_thinking', 'architect_thinking', 'finalizer_thinking']);
});
