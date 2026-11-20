import type { DatabaseSync } from 'node:sqlite';
import type { Coffee } from '@brewlab/shared';

/**
 * Pinning a coffee to the top of its owner's shelf. The database is passed in
 * so this can be tested against an in-memory one.
 */

/**
 * Pins or unpins a coffee for its owner. Only the owner's own coffee matches,
 * so returns false (and changes nothing) for anyone else's, or a missing one.
 * Pinning an already pinned coffee moves it back to the top.
 */
export function setPinned(
  db: DatabaseSync,
  coffeeId: string,
  ownerId: string,
  pinned: boolean,
  now: string,
): boolean {
  const { changes } = db
    .prepare('UPDATE coffees SET pinned_at = ? WHERE id = ? AND owner_id = ?')
    .run(pinned ? now : null, coffeeId, ownerId);
  return Number(changes) > 0;
}

/**
 * The shelf's order, as an ORDER BY over coffees aliased `c`: pinned first,
 * most recently pinned on top, then everything else newest first.
 */
export const SHELF_ORDER = 'c.pinned_at IS NULL, c.pinned_at DESC, c.created_at DESC';

/** A pin is personal: anyone but the owner sees the coffee unpinned. */
export function forViewer(coffee: Coffee, viewerId: string | undefined): Coffee {
  return coffee.ownerId === viewerId ? coffee : { ...coffee, pinnedAt: null };
}
