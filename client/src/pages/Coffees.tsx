import { useNavigate } from 'react-router-dom';
import { Pin, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { LayoutGroup } from 'motion/react';
import * as m from 'motion/react-m';
import { splitShelf, type Coffee } from '@brewlab/shared';
import { api, useApi } from '../lib/api';
import { Banner, Empty, Modal } from '../components/ui';
import CoffeeCard from '../components/CoffeeCard';
import CoffeeForm from '../components/CoffeeForm';

/** How a card moves when pinning shifts the shelf. */
const SHELF_MOVE = { type: 'spring', stiffness: 320, damping: 30 } as const;

export default function Coffees() {
  const navigate = useNavigate();
  const coffees = useApi<Coffee[]>('/coffees');
  const [editing, setEditing] = useState<Coffee | null | undefined>(undefined);
  const [pinError, setPinError] = useState<string | null>(null);

  async function remove(c: Coffee) {
    await api(`/coffees/${c.id}`, { method: 'DELETE' });
    void coffees.reload();
  }

  /** Moves straight away, then saves; puts it back if the save fails. */
  async function togglePin(c: Coffee) {
    const pin = c.pinnedAt == null;
    const replace = (next: Coffee) =>
      coffees.setData((list) => list?.map((x) => (x.id === next.id ? next : x)) ?? list);
    setPinError(null);
    replace({ ...c, pinnedAt: pin ? new Date().toISOString() : null });
    try {
      replace(await api<Coffee>(`/coffees/${c.id}/pin`, { method: pin ? 'PUT' : 'DELETE' }));
    } catch (e) {
      replace(c);
      setPinError(`Couldn't ${pin ? 'pin' : 'unpin'} ${c.name}: ${(e as Error).message}`);
    }
  }

  const { pinned, rest } = splitShelf(coffees.data ?? []);

  const card = (c: Coffee) => (
    // Keyed and laid out by coffee, so a card glides between the groups, and
    // the others close up behind it, rather than jumping.
    <m.div key={c.id} layoutId={`shelf-${c.id}`} layout="position" transition={SHELF_MOVE}>
      <CoffeeCard
        coffee={c}
        action={
          <div className="row">
            <button
              className="btn btn-ghost btn-icon pin-toggle"
              onClick={() => togglePin(c)}
              aria-label={`Pin ${c.name}`}
              aria-pressed={c.pinnedAt != null}
              title={c.pinnedAt ? 'Unpin' : 'Pin to the top'}
            >
              <Pin aria-hidden="true" />
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(c)}>
              Edit
            </button>
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => remove(c)}
              aria-label={`Delete ${c.name}`}
              title="Delete"
            >
              <Trash2 aria-hidden="true" />
            </button>
          </div>
        }
      />
    </m.div>
  );

  return (
    <>
      <div className="page-head spread">
        <div>
          <h1>My coffees</h1>
          <p>The bags on your shelf. Publish one and it shows up in Explore for everyone else.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing(null)}>
          Add coffee
        </button>
      </div>

      {pinError ? <Banner kind="bad">{pinError}</Banner> : null}

      {coffees.data?.length ? (
        <LayoutGroup>
          {/* Pinned bags sit in their own group on top. The group comes and
              goes at once: the cards themselves glide (layoutId), and a group
              fading out would carry a ghost copy of the card that just left. */}
          {pinned.length ? (
            <m.section
              className="shelf-group"
              aria-labelledby="shelf-pinned"
              layout="position"
              transition={SHELF_MOVE}
            >
              <h2 className="shelf-label" id="shelf-pinned">
                Pinned
              </h2>
              <div className="grid grid-2 shelf-grid">{pinned.map(card)}</div>
            </m.section>
          ) : null}
          {rest.length ? (
            <m.section
              className="shelf-group"
              aria-labelledby={pinned.length ? 'shelf-rest' : undefined}
              aria-label={pinned.length ? undefined : 'Shelf'}
              layout="position"
              transition={SHELF_MOVE}
            >
              {pinned.length ? (
                <h2 className="shelf-label" id="shelf-rest">
                  On the shelf
                </h2>
              ) : null}
              <div className="grid grid-2 shelf-grid">{rest.map(card)}</div>
            </m.section>
          ) : null}
        </LayoutGroup>
      ) : (
        <Empty title="Nothing on the shelf">
          Add the bag you are drinking now — everything else hangs off it.
        </Empty>
      )}

      {editing !== undefined ? (
        <Modal
          title={editing ? 'Edit coffee' : 'Add coffee'}
          onClose={() => setEditing(undefined)}
          wide
        >
          <CoffeeForm
            existing={editing}
            onSaved={(saved) => {
              const wasNew = !editing;
              setEditing(undefined);
              void coffees.reload();
              // Straight to the new coffee, where the profile suggestion is.
              if (wasNew) navigate(`/coffees/${saved.id}`);
            }}
          />
        </Modal>
      ) : null}
    </>
  );
}
