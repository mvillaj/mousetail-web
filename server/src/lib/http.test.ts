import assert from 'node:assert/strict';
import test from 'node:test';
import { GENERIC_SERVER_ERROR, UPSTREAM_FAILED, errorResponse } from './http.ts';

test('an upstream failure is never a status Cloudflare replaces with its own page', () => {
  assert.ok(![502, 504].includes(UPSTREAM_FAILED));
  assert.ok(UPSTREAM_FAILED >= 400 && UPSTREAM_FAILED < 500);
});

test('a server error never echoes its message to the user', () => {
  const err = new Error('BREWLAB_ENCRYPTION_KEY is not set, see .env.example');
  assert.deepEqual(errorResponse(err), { status: 500, body: { error: GENERIC_SERVER_ERROR } });
});

test('a 5xx marked with a status still hides its message', () => {
  const err = Object.assign(new Error('db is locked'), { status: 503, expose: false });
  assert.deepEqual(errorResponse(err), { status: 500, body: { error: GENERIC_SERVER_ERROR } });
});

test('a client error marked safe to show keeps its status and message', () => {
  const err = Object.assign(new Error('request entity too large'), { status: 413, expose: true });
  assert.deepEqual(errorResponse(err), {
    status: 413,
    body: { error: 'request entity too large' },
  });
});

test('a client error not marked safe is treated as a server error', () => {
  const err = Object.assign(new Error('internal detail'), { status: 400 });
  assert.equal(errorResponse(err).body.error, GENERIC_SERVER_ERROR);
});
