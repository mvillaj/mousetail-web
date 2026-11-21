import { Router, type Response } from 'express';
import { coffeeInputSchema } from '@brewlab/shared';
import { bool, db, id, nowIso } from '../lib/db';
import { optionalAuth, requireAuth, type AuthedRequest } from '../lib/auth';
import { toCoffee } from '../lib/rows';
import { coffeeFor, ownCoffee, pinCoffee, publicCoffees, shelfOf } from '../lib/coffees';

export const coffeeRouter: Router = Router();

/** The shared library. Anyone can browse it, signed in or not. */
coffeeRouter.get('/public', optionalAuth, (req: AuthedRequest, res) => {
  res.json(
    publicCoffees(db, req.userId, {
      q: String(req.query.q ?? '').trim(),
      roast: String(req.query.roast ?? '').trim(),
    }),
  );
});

coffeeRouter.get('/:id', optionalAuth, (req: AuthedRequest, res) => {
  const coffee = coffeeFor(db, String(req.params.id), req.userId);
  if (!coffee) {
    res.status(404).json({ error: 'Coffee not found' });
    return;
  }
  res.json(coffee);
});

coffeeRouter.use(requireAuth);

coffeeRouter.get('/', (req: AuthedRequest, res) => {
  res.json(shelfOf(db, req.userId!));
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
  res.status(201).json(ownCoffee(db, cid));
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
  res.json(ownCoffee(db, String(req.params.id)));
});

coffeeRouter.delete('/:id', (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM coffees WHERE id = ? AND owner_id = ?').run(req.params.id, req.userId!);
  res.status(204).end();
});

/** Pin a coffee to the top of my shelf, or unpin it. Mine only. */
function pin(pinned: boolean) {
  return (req: AuthedRequest, res: Response) => {
    const coffee = pinCoffee(db, String(req.params.id), req.userId!, pinned, nowIso());
    if (!coffee) {
      res.status(404).json({ error: 'Coffee not found' });
      return;
    }
    res.json(coffee);
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
  res.status(201).json(ownCoffee(db, cid));
});
