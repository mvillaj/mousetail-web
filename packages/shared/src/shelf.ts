import type { Coffee } from './types.ts';

/**
 * A shelf of coffees in the order My coffees shows them: the pinned ones,
 * most recently pinned first, then the rest, newest first. The server sorts
 * the same way (SHELF_ORDER in server/src/lib/pins.ts); the client needs it to
 * re-sort straight away when a pin changes.
 */
export function splitShelf(coffees: readonly Coffee[]): { pinned: Coffee[]; rest: Coffee[] } {
  const newest = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);
  const pinned = coffees
    .filter((c) => c.pinnedAt != null)
    .sort((a, b) => newest(a.pinnedAt!, b.pinnedAt!) || newest(a.createdAt, b.createdAt));
  const rest = coffees
    .filter((c) => c.pinnedAt == null)
    .sort((a, b) => newest(a.createdAt, b.createdAt));
  return { pinned, rest };
}
