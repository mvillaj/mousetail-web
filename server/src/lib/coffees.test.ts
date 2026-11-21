import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

/**
 * How the coffee routes read with pins: the shelf keeps its newest-first order
 * (the shot forms' default coffee is the first one), only an owner can pin,
 * and nobody else ever sees a pin.
 */

// rows.ts opens the app's database on import; keep that one in memory too.
process.env.BREWLAB_DB = ':memory:';
const { runMigrations } = await import('./migrate.ts');
const { coffeeFor, pinCoffee, publicCoffees, shelfOf } = await import('./coffees.ts');

function bench() {
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
  const add = (id: string, owner: string, createdAt: string, isPublic: 0 | 1) =>
    db
      .prepare(
        'INSERT INTO coffees (id, owner_id, name, roaster, is_public, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(id, owner, id, 'Roaster', isPublic, createdAt);
  add('cof_old', 'usr_me', '2026-01-01', 1);
  add('cof_new', 'usr_me', '2026-03-01', 0);
  add('cof_theirs', 'usr_them', '2026-02-01', 1);
  return db;
}

test('the shelf stays newest first with a pin, so the shot forms still default to the newest bag', () => {
  const db = bench();
  pinCoffee(db, 'cof_old', 'usr_me', true, '2026-04-01');
  const shelf = shelfOf(db, 'usr_me');
  assert.deepEqual(
    shelf.map((c) => c.id),
    ['cof_new', 'cof_old'],
  );
  assert.equal(shelf[1].pinnedAt, '2026-04-01');
});

test('an owner gets the pinned coffee back; anyone else gets nothing and changes nothing', () => {
  const db = bench();
  assert.equal(pinCoffee(db, 'cof_new', 'usr_me', true, '2026-04-01')?.pinnedAt, '2026-04-01');
  assert.equal(pinCoffee(db, 'cof_new', 'usr_me', false, '2026-04-02')?.pinnedAt, null);
  assert.equal(pinCoffee(db, 'cof_theirs', 'usr_me', true, '2026-04-01'), null);
  assert.equal(pinCoffee(db, 'cof_missing', 'usr_me', true, '2026-04-01'), null);
  assert.equal(coffeeFor(db, 'cof_theirs', 'usr_them')?.pinnedAt, null);
});

test('the public library and a coffee page show a pin to its owner and to nobody else', () => {
  const db = bench();
  pinCoffee(db, 'cof_old', 'usr_me', true, '2026-04-01');

  const pinIn = (list: { id: string; pinnedAt: string | null }[]) =>
    list.find((c) => c.id === 'cof_old')?.pinnedAt;
  assert.equal(pinIn(publicCoffees(db, 'usr_me', {})), '2026-04-01');
  assert.equal(pinIn(publicCoffees(db, 'usr_them', {})), null);
  assert.equal(pinIn(publicCoffees(db, undefined, {})), null);

  assert.equal(coffeeFor(db, 'cof_old', 'usr_me')?.pinnedAt, '2026-04-01');
  assert.equal(coffeeFor(db, 'cof_old', 'usr_them')?.pinnedAt, null);
  assert.equal(coffeeFor(db, 'cof_old', undefined)?.pinnedAt, null);
});

test('a private coffee stays private, pinned or not', () => {
  const db = bench();
  pinCoffee(db, 'cof_new', 'usr_me', true, '2026-04-01');
  assert.equal(coffeeFor(db, 'cof_new', 'usr_them'), null);
  assert.equal(coffeeFor(db, 'cof_new', undefined), null);
  assert.equal(coffeeFor(db, 'cof_new', 'usr_me')?.id, 'cof_new');
});
