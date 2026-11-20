import { Router, type Response } from 'express';
import { DIALED_IN_MIN_RATING, coffeeInputSchema } from '@brewlab/shared';
import { bool, db, id, nowIso } from '../lib/db';
import { optionalAuth, requireAuth, type AuthedRequest } from '../lib/auth';
import { required, toCoffee } from '../lib/rows';
import { SHELF_ORDER, forViewer, setPinned } from '../lib/pins';

export const coffeeRouter: Router = Router();

const SELECT = `
  SELECT c.*, u.display_name AS owner_name,
         (SELECT COUNT(*) FROM shots s WHERE s.coffee_id = c.id) AS shot_count,
         (SELECT ROUND(AVG(s.rating), 2) FROM shots s WHERE s.coffee_id = c.id AND s.rating IS NOT NULL) AS avg_rating,
         (SELECT COUNT(*) FROM shots s WHERE s.coffee_id = c.id AND s.rating >= ${DIALED_IN_MIN_RATING}) AS well_rated_count,
         (SELECT COUNT(*) FROM coffees k WHERE k.cloned_from_id = c.id) AS clone_count
  FROM coffees c JOIN users u ON u.id = c.owner_id
`;

/** The shared library. Anyone can browse it, signed in or not. */
coffeeRouter.get('/public', optionalAuth, (req: AuthedRequest, res) => {
  const q = String(req.query.q ?? '').trim();
  const roast = String(req.query.roast ?? '').trim();
  const clauses = ['c.is_public = 1'];
  const params: unknown[] = [];
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
    .all(...(params as any[])) as any[];
  res.json(rows.map((r) => forViewer(toCoffee(r), req.userId)));
});

coffeeRouter.get('/:id', optionalAuth, (req: AuthedRequest, res) => {
  const row = db.prepare(`${SELECT} WHERE c.id = ?`).get(req.params.id) as any;
  if (!row || (!row.is_public && row.owner_id !== req.userId)) {
    res.status(404).json({ error: 'Coffee not found' });
    return;
  }
  res.json(forViewer(toCoffee(row), req.userId));
});

coffeeRouter.use(requireAuth);

coffeeRouter.get('/', (req: AuthedRequest, res) => {
  const rows = db
    .prepare(`${SELECT} WHERE c.owner_id = ? ORDER BY ${SHELF_ORDER}`)
    .all(req.userId!) as any[];
  res.json(rows.map(toCoffee));
});

function writeCoffee(
  cid: string,
  ownerId: string,
  data: any,
  clonedFromId: string | null,
  createdAt: string,
) {
  db.prepare(
    `INSERT INTO coffees (id, owner_id, name, roaster, origin, region, producer, varietal, process,
       roast_level, altitude_masl, roast_date, tasting_notes, url, notes, is_public, cloned_from_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    cid,
    ownerId,
    data.name,
    data.roaster,
    data.origin ?? null,
    data.region ?? null,
    data.producer ?? null,
    data.varietal ?? null,
    data.process ?? null,
    data.roastLevel ?? null,
    data.altitudeMasl ?? null,
    data.roastDate ?? null,
    JSON.stringify(data.tastingNotes ?? []),
    data.url || null,
    data.notes ?? null,
    bool(data.isPublic),
    clonedFromId,
    createdAt,
  );
}

coffeeRouter.post('/', (req: AuthedRequest, res) => {
  const parsed = coffeeInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid coffee' });
    return;
  }
  const cid = id('cof');
  writeCoffee(cid, req.userId!, parsed.data, null, nowIso());
  res
    .status(201)
    .json(toCoffee(required(db.prepare(`${SELECT} WHERE c.id = ?`).get(cid), 'coffee')));
});

coffeeRouter.patch('/:id', (req: AuthedRequest, res) => {
  const existing = db
    .prepare('SELECT * FROM coffees WHERE id = ? AND owner_id = ?')
    .get(req.params.id, req.userId!) as any;
  if (!existing) {
    res.status(404).json({ error: 'Coffee not found' });
    return;
  }
  const parsed = coffeeInputSchema.safeParse({ ...toCoffee(existing), ...req.body });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid coffee' });
    return;
  }
  const d = parsed.data;
  db.prepare(
    `UPDATE coffees SET name=?, roaster=?, origin=?, region=?, producer=?, varietal=?, process=?,
       roast_level=?, altitude_masl=?, roast_date=?, tasting_notes=?, url=?, notes=?, is_public=?
     WHERE id=? AND owner_id=?`,
  ).run(
    d.name,
    d.roaster,
    d.origin ?? null,
    d.region ?? null,
    d.producer ?? null,
    d.varietal ?? null,
    d.process ?? null,
    d.roastLevel ?? null,
    d.altitudeMasl ?? null,
    d.roastDate ?? null,
    JSON.stringify(d.tastingNotes ?? []),
    d.url || null,
    d.notes ?? null,
    bool(d.isPublic),
    req.params.id,
    req.userId!,
  );
  res.json(toCoffee(required(db.prepare(`${SELECT} WHERE c.id = ?`).get(req.params.id), 'coffee')));
});

coffeeRouter.delete('/:id', (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM coffees WHERE id = ? AND owner_id = ?').run(req.params.id, req.userId!);
  res.status(204).end();
});

/** Pin a coffee to the top of my shelf, or unpin it. Mine only. */
function pin(pinned: boolean) {
  return (req: AuthedRequest, res: Response) => {
    const coffeeId = String(req.params.id);
    if (!setPinned(db, coffeeId, req.userId!, pinned, nowIso())) {
      res.status(404).json({ error: 'Coffee not found' });
      return;
    }
    res.json(toCoffee(required(db.prepare(`${SELECT} WHERE c.id = ?`).get(coffeeId), 'coffee')));
  };
}
coffeeRouter.put('/:id/pin', pin(true));
coffeeRouter.delete('/:id/pin', pin(false));

/** Copy someone else's published bag onto my shelf, private by default. */
coffeeRouter.post('/:id/clone', (req: AuthedRequest, res) => {
  const src = db.prepare('SELECT * FROM coffees WHERE id = ?').get(req.params.id) as any;
  if (!src || (!src.is_public && src.owner_id !== req.userId)) {
    res.status(404).json({ error: 'Coffee not found' });
    return;
  }
  const cid = id('cof');
  writeCoffee(
    cid,
    req.userId!,
    { ...toCoffee(src), isPublic: false, roastDate: null },
    src.id,
    nowIso(),
  );
  res
    .status(201)
    .json(toCoffee(required(db.prepare(`${SELECT} WHERE c.id = ?`).get(cid), 'coffee')));
});
