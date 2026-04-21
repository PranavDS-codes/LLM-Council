import test from 'node:test';
import assert from 'node:assert/strict';

import { parseSseChunk } from '../store/sse.ts';
import { applyCouncilEvent, createSession } from '../store/sessionState.ts';

const agents = [
  { id: 'The Academic', name: 'The Academic', selected: true },
  { id: 'The Skeptic', name: 'The Skeptic', selected: true },
];

test('a mocked SSE stream drives the session to a completed state', () => {
  const chunks = [
    'event: generator_start\ndata: {"type":"generator_start","agent":"The Academic","model":"demo/model"}\n\n',
    'event: generator_chunk\ndata: {"type":"generator_chunk","agent":"The Academic","chunk":"Draft"}\n\n',
    'event: generator_done\ndata: {"type":"generator_done","agent":"The Academic","time_taken":1.2,"model":"demo/model","usage":{"total":10,"prompt":4,"completion":6}}\n\n',
    'event: finalizer_chunk\ndata: {"type":"finalizer_chunk","chunk":"Final verdict"}\n\n',
    'event: done\ndata: {"type":"done","total_execution_time":3.5,"total_tokens":{"total":40,"prompt":18,"completion":22}}\n\n',
  ];

  let session = createSession('stream', 'Test stream', agents);
  let buffer = '';

  for (const chunk of chunks) {
    const parsed = parseSseChunk(buffer, chunk);
    buffer = parsed.buffer;
    session = parsed.events.reduce(applyCouncilEvent, session);
  }

  assert.equal(buffer, '');
  assert.equal(session.status, 'completed');
  assert.equal(session.finalizerText, 'Final verdict');
  assert.equal(session.metrics.totalTokens.total, 40);
});
