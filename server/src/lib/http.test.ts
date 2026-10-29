import assert from 'node:assert/strict';
import test from 'node:test';
import { UPSTREAM_FAILED } from './http.ts';

test('an upstream failure is never a status Cloudflare replaces with its own page', () => {
  assert.ok(![502, 504].includes(UPSTREAM_FAILED));
  assert.ok(UPSTREAM_FAILED >= 400 && UPSTREAM_FAILED < 500);
});
