import type { DatabaseSync } from 'node:sqlite';
import { DIALED_IN_MIN_RATING, type Coffee } from '@brewlab/shared';
import { forViewer, setPinned } from './pins.ts';
import { required, toCoffee } from './rows.ts';

/**
 * Reading coffees, for routes/coffees.ts. Who may see what, and what a pin
 * shows, is decided here rather than in the routes, so it can be tested
 * against an in-memory database. The database is passed in.
 */

const SELECT = `
  SELECT c.*, u.display_name AS owner_name,
         (SELECT COUNT(*) FROM shots s WHERE s.coffee_id = c.id) AS shot_count,
         (SELECT ROUND(AVG(s.rating), 2) FROM shots s WHERE s.coffee_id = c.id AND s.rating IS NOT NULL) AS avg_rating,
         (SELECT COUNT(*) FROM shots s WHERE s.coffee_id = c.id AND s.rating >= ${DIALED_IN_MIN_RATING}) AS well_rated_count,
         (SELECT COUNT(*) FROM coffees k WHERE k.cloned_from_id = c.id) AS clone_count
  FROM coffees c JOIN users u ON u.id = c.owner_id
`;

/**
 * An owner's coffees, newest first. Not pinned first: the shot forms take the
 * first one as the coffee you're drinking now. My coffees groups the pins
 * itself (splitShelf in @brewlab/shared).
 */
export function shelfOf(db: DatabaseSync, ownerId: string): Coffee[] {
  return (
    db.prepare(`${SELECT} WHERE c.owner_id = ? ORDER BY c.created_at DESC`).all(ownerId) as any[]
  ).map(toCoffee);
}

/** The shared library, for anyone, signed in or not. */
export function publicCoffees(
  db: DatabaseSync,
  viewerId: string | undefined,
  { q = '', roast = '' }: { q?: string; roast?: string },
): Coffee[] {
  const clauses = ['c.is_public = 1'];
  const params: string[] = [];
  if (q) {
    clauses.push('(c.name LIKE ? OR c.roaster LIKE ? OR c.origin LIKE ? OR c.varietal LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (roast) {
    clauses.push('c.roast_level = ?');
    params.push(roast);
  }
  const rows = db
    .prepare(
      `${SELECT} WHERE ${clauses.join(' AND ')} ORDER BY shot_count DESC, c.created_at DESC LIMIT 200`,
    )
    .all(...params) as any[];
  return rows.map((r) => forViewer(toCoffee(r), viewerId));
}

/** One coffee as `viewerId` may see it: their own, or a public one. Null otherwise. */
export function coffeeFor(
  db: DatabaseSync,
  coffeeId: string,
  viewerId: string | undefined,
): Coffee | null {
  const row = db.prepare(`${SELECT} WHERE c.id = ?`).get(coffeeId) as any;
  if (!row || (!row.is_public && row.owner_id !== viewerId)) return null;
  return forViewer(toCoffee(row), viewerId);
}

/** A coffee just written by its owner, read back whole. */
export function ownCoffee(db: DatabaseSync, coffeeId: string): Coffee {
  return toCoffee(required(db.prepare(`${SELECT} WHERE c.id = ?`).get(coffeeId), 'coffee'));
}

/** Pins or unpins the owner's own coffee. Null when it isn't theirs, or isn't there. */
export function pinCoffee(
  db: DatabaseSync,
  coffeeId: string,
  ownerId: string,
  pinned: boolean,
  now: string,
): Coffee | null {
  return setPinned(db, coffeeId, ownerId, pinned, now) ? ownCoffee(db, coffeeId) : null;
}
