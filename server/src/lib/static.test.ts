import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import express from 'express';
import { serveClient } from './static.ts';

let base = '';
let dist = '';
let close = () => {};

before(async () => {
  dist = mkdtempSync(join(tmpdir(), 'brewlab-dist-'));
  mkdirSync(join(dist, 'assets'));
  writeFileSync(join(dist, 'index.html'), '<!doctype html><title>shell</title>');
  writeFileSync(join(dist, 'sw.js'), 'self.addEventListener("fetch", () => {});');
  writeFileSync(join(dist, 'manifest.webmanifest'), '{"name":"Mousetail"}');
  writeFileSync(join(dist, 'assets', 'index-abc123.js'), 'console.log(1)');

  const app = express();
  serveClient(app, dist);
  app.use((_req, res) => res.status(404).json({ error: 'not found' }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
});

after(() => {
  close();
  rmSync(dist, { recursive: true, force: true });
});

test('the service worker always revalidates, so clients pick up new builds', async () => {
  const res = await fetch(`${base}/sw.js`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-cache');
});

test('the manifest revalidates and carries its own media type', async () => {
  const res = await fetch(`${base}/manifest.webmanifest`);
  assert.equal(res.headers.get('cache-control'), 'no-cache');
  assert.match(res.headers.get('content-type') ?? '', /^application\/manifest\+json/);
});

test('fingerprinted assets are cached for good', async () => {
  const res = await fetch(`${base}/assets/index-abc123.js`);
  assert.equal(res.headers.get('cache-control'), 'public, max-age=31536000, immutable');
});

test('deep links get the shell, never a cached copy of it', async () => {
  const res = await fetch(`${base}/shots`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-cache');
  assert.match(await res.text(), /<title>shell<\/title>/);
});

test('a missing worker script is a 404, not the shell served as script', async () => {
  rmSync(join(dist, 'sw.js'));
  const res = await fetch(`${base}/sw.js`);
  assert.equal(res.status, 404);
  writeFileSync(join(dist, 'sw.js'), '');
});

test('unknown API paths fall through to the JSON 404', async () => {
  const res = await fetch(`${base}/api/nope`);
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'not found' });
});
