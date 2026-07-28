import test from 'node:test';
import assert from 'node:assert/strict';

import { parseSseChunk } from '../store/sse.ts';

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
