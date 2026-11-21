import assert from 'node:assert/strict';
import { test } from 'node:test';
import { splitShelf } from './shelf.ts';
import type { Coffee } from './types.ts';

const coffee = (id: string, createdAt: string, pinnedAt: string | null = null) =>
  ({ id, createdAt, pinnedAt }) as Coffee;
const ids = (list: Coffee[]) => list.map((c) => c.id);

test('pinned coffees come first, the latest pin on top; the rest newest first', () => {
  const { pinned, rest } = splitShelf([
    coffee('old', '2026-01-01'),
    coffee('pinned-early', '2026-03-01', '2026-04-01'),
    coffee('new', '2026-03-05'),
    coffee('pinned-late', '2026-02-01', '2026-04-02'),
  ]);
  assert.deepEqual(ids(pinned), ['pinned-late', 'pinned-early']);
  assert.deepEqual(ids(rest), ['new', 'old']);
});

test('an empty shelf, or one with nothing pinned, splits cleanly', () => {
  assert.deepEqual(splitShelf([]), { pinned: [], rest: [] });
  const { pinned, rest } = splitShelf([coffee('a', '2026-01-01')]);
  assert.deepEqual(ids(pinned), []);
  assert.deepEqual(ids(rest), ['a']);
});

test('leaves the list it was given alone', () => {
  const list = [coffee('a', '2026-01-01'), coffee('b', '2026-02-01')];
  splitShelf(list);
  assert.deepEqual(ids(list), ['a', 'b']);
});
