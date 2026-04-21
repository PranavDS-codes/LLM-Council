import test from 'node:test';
import assert from 'node:assert/strict';

import { canSaveSettings, cleanModelOverrides } from '../store/configState.ts';

test('cleanModelOverrides removes empty values', () => {
  assert.deepEqual(
    cleanModelOverrides({
      critic: 'model/a',
      architect: '',
      finalizer: '   ',
    }),
    { critic: 'model/a' },
  );
});

test('canSaveSettings requires verified key and verified models', () => {
  assert.equal(
    canSaveSettings(
      'sk-test',
      { status: 'valid' },
      { critic: 'model/a' },
      { critic: { status: 'valid' } },
    ),
    true,
  );

  assert.equal(
    canSaveSettings(
      'sk-test',
      { status: 'invalid' },
      { critic: 'model/a' },
      { critic: { status: 'valid' } },
    ),
    false,
  );
});
