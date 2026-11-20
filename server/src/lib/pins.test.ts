import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import type { Coffee } from '@brewlab/shared';
import { runMigrations } from './migrate.ts';
import { SHELF_ORDER, forViewer, setPinned } from './pins.ts';

/**
 * The failures worth catching: someone pinning a coffee that isn't theirs, a
 * pin leaking onto another person's view, and the shelf losing its order.
 */
function shelf() {
  const db = new DatabaseSync(':memory:');
  runMigrations(db);
  for (const user of ['usr_me', 'usr_them']) {
    db.prepare('INSERT INTO users (id, email, display_name, created_at) VALUES (?, ?, ?, ?)').run(
      user,
      `${user}@example.com`,
      user,
      '2026-01-01',
    );
  }
  const add = (id: string, owner: string, createdAt: string) =>
    db
      .prepare(
        'INSERT INTO coffees (id, owner_id, name, roaster, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(id, owner, id, 'Roaster', createdAt);
  add('cof_old', 'usr_me', '2026-01-01');
  add('cof_mid', 'usr_me', '2026-02-01');
  add('cof_new', 'usr_me', '2026-03-01');
  add('cof_theirs', 'usr_them', '2026-03-01');
  return db;
}

const pinnedAt = (db: DatabaseSync, id: string) =>
  (db.prepare('SELECT pinned_at FROM coffees WHERE id = ?').get(id) as { pinned_at: string | null })
    .pinned_at;

const order = (db: DatabaseSync) =>
  (
    db
      .prepare(`SELECT c.id FROM coffees c WHERE c.owner_id = 'usr_me' ORDER BY ${SHELF_ORDER}`)
      .all() as { id: string }[]
  ).map((r) => r.id);

test('coffees start unpinned, including ones already on the shelf', () => {
  const db = shelf();
  assert.equal(pinnedAt(db, 'cof_old'), null);
  assert.deepEqual(order(db), ['cof_new', 'cof_mid', 'cof_old']);
});

test('an owner pins and unpins their own coffee', () => {
  const db = shelf();
  assert.equal(setPinned(db, 'cof_old', 'usr_me', true, '2026-04-01T10:00:00Z'), true);
  assert.equal(pinnedAt(db, 'cof_old'), '2026-04-01T10:00:00Z');
  assert.equal(setPinned(db, 'cof_old', 'usr_me', false, '2026-04-02T10:00:00Z'), true);
  assert.equal(pinnedAt(db, 'cof_old'), null);
});

test("nobody can pin someone else's coffee, or one that isn't there", () => {
  const db = shelf();
  assert.equal(setPinned(db, 'cof_theirs', 'usr_me', true, '2026-04-01'), false);
  assert.equal(pinnedAt(db, 'cof_theirs'), null);
  assert.equal(setPinned(db, 'cof_missing', 'usr_me', true, '2026-04-01'), false);
});

test('the shelf puts pins first, the latest pin on top, then the newest coffee', () => {
  const db = shelf();
  setPinned(db, 'cof_old', 'usr_me', true, '2026-04-01');
  setPinned(db, 'cof_mid', 'usr_me', true, '2026-04-02');
  assert.deepEqual(order(db), ['cof_mid', 'cof_old', 'cof_new']);

  // Pinning again moves it back to the top.
  setPinned(db, 'cof_old', 'usr_me', true, '2026-04-03');
  assert.deepEqual(order(db), ['cof_old', 'cof_mid', 'cof_new']);
});

test('a pin is only ever shown to its owner', () => {
  const coffee = { id: 'cof_1', ownerId: 'usr_me', pinnedAt: '2026-04-01' } as Coffee;
  assert.equal(forViewer(coffee, 'usr_me').pinnedAt, '2026-04-01');
  assert.equal(forViewer(coffee, 'usr_them').pinnedAt, null);
  assert.equal(forViewer(coffee, undefined).pinnedAt, null);
});
