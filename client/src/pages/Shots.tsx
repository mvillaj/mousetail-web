import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import ShotGlass from '../components/ShotGlass';
import type { BrewProfileRecord, Coffee, Grinder, Shot } from '@brewlab/shared';
import { api, useApi } from '../lib/api';
import { Empty, Modal, Stars } from '../components/ui';
import ShotForm from '../components/ShotForm';
import { TASTE_LABELS, fmt, relativeDate, tempF } from '../lib/format';

export default function Shots() {
  const [coffeeFilter, setCoffeeFilter] = useState('');
  const shots = useApi<Shot[]>(`/shots${coffeeFilter ? `?coffeeId=${coffeeFilter}` : ''}`, [
    coffeeFilter,
  ]);
  const coffees = useApi<Coffee[]>('/coffees');
  const grinders = useApi<Grinder[]>('/grinders');
  const profiles = useApi<BrewProfileRecord[]>('/profiles');
  const [logging, setLogging] = useState(false);
  const [repeat, setRepeat] = useState<Shot | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function remove(id: string) {
    await api(`/shots/${id}`, { method: 'DELETE' });
    void shots.reload();
  }

  return (
    <>
      <div className="page-head spread">
        <div>
          <h1>Shot log</h1>
          <p>Every pull, with the setting that produced it. Click a row for the full detail.</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setRepeat(null);
            setLogging(true);
          }}
        >
          Log a shot
        </button>
      </div>

      <div className="row mb-4">
        <select
          className="max-w-md"
          value={coffeeFilter}
          onChange={(e) => setCoffeeFilter(e.target.value)}
        >
          <option value="">All coffees</option>
          {(coffees.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.roaster}
            </option>
          ))}
        </select>
        <span className="small faint">{shots.data?.length ?? 0} shots</span>
      </div>

      <div className="card">
        {shots.data?.length ? (
          <table className="table">
            <thead>
              <tr>
                <th aria-label="Glass" />
                <th>When</th>
                <th>Coffee</th>
                <th>Grinder</th>
                <th className="num">Grind</th>
                <th className="num">Dose → Yield</th>
                <th className="num">Ratio</th>
                <th className="num">Time</th>
                <th>Rating</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shots.data.map((s) => (
                <tr
                  className="clickable"
                  key={s.id}
                  onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                >
                  <td className="glass-cell">
                    <ShotGlass yieldG={s.yieldG} taste={s.tasteBalance} width={26} />
                  </td>
                  <td data-label="When" className="dim">
                    {relativeDate(s.brewedAt)}
                  </td>
                  <td data-label="Coffee">{s.coffeeName ?? <span className="faint">—</span>}</td>
                  <td data-label="Grinder" className="dim">
                    {s.grinderName ?? <span className="faint">—</span>}
                  </td>
                  <td data-label="Grind" className="num">
                    {s.grindSetting ?? '—'}
                    {s.grindMicrons ? <span className="faint"> · {s.grindMicrons}µm</span> : null}
                  </td>
                  <td data-label="Dose → Yield" className="num">
                    {fmt(s.doseG)} → {fmt(s.yieldG)}
                  </td>
                  <td data-label="Ratio" className="num dim">
                    1:{(s.yieldG / s.doseG).toFixed(1)}
                  </td>
                  <td data-label="Time" className="num">
                    {fmt(s.shotTimeS)}s
                  </td>
                  <td data-label="Rating">
                    <Stars value={s.rating} />
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRepeat(s);
                        setLogging(true);
                      }}
                      title="Log another with these numbers"
                      aria-label="Log another with these numbers"
                    >
                      <RotateCcw aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty title="No shots here yet">
            Pull one and log it — the numbers only get useful in a row.
          </Empty>
        )}
      </div>

      {expanded && shots.data
        ? (() => {
            const s = shots.data.find((x) => x.id === expanded);
            if (!s) return null;
            return (
              <Modal title={s.coffeeName ?? 'Shot'} onClose={() => setExpanded(null)}>
                <div className="stack">
                  <div className="grid grid-3">
                    <div>
                      <div className="stat-label">Brewed</div>
                      <div>{new Date(s.brewedAt).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="stat-label">Profile</div>
                      <div>{s.profileName ?? '—'}</div>
                    </div>
                    <div>
                      <div className="stat-label">Basket</div>
                      <div>{s.basket ?? '—'}</div>
                    </div>
                  </div>
                  <div className="grid grid-4">
                    <div>
                      <div className="stat-label">Grind</div>
                      <div className="mono">
                        {s.grindSetting ?? '—'} {s.grindMicrons ? `· ${s.grindMicrons}µm` : ''}
                      </div>
                    </div>
                    <div>
                      <div className="stat-label">Pre-infusion</div>
                      <div className="mono">
                        {s.preInfusionS != null ? `${s.preInfusionS}s` : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="stat-label">Temperature</div>
                      <div className="mono">{tempF(s.brewTempC)}</div>
                    </div>
                    <div>
                      <div className="stat-label">Taste</div>
                      <div>{s.tasteBalance != null ? TASTE_LABELS[s.tasteBalance] : '—'}</div>
                    </div>
                  </div>
                  {s.flavourNotes.length ? (
                    <div className="row-wrap">
                      {s.flavourNotes.map((n) => (
                        <span key={n} className="tag accent">
                          {n}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {s.notes ? <p className="dim m-0">{s.notes}</p> : null}
                  <div className="row">
                    <button
                      className="btn"
                      onClick={() => {
                        setRepeat(s);
                        setExpanded(null);
                        setLogging(true);
                      }}
                    >
                      Log another like this
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={async () => {
                        await remove(s.id);
                        setExpanded(null);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </Modal>
            );
          })()
        : null}

      {logging ? (
        <Modal
          title={repeat ? 'Log another like that one' : 'Log a shot'}
          onClose={() => setLogging(false)}
          wide
        >
          <ShotForm
            coffees={coffees.data ?? []}
            grinders={grinders.data ?? []}
            profiles={profiles.data ?? []}
            basedOn={repeat}
            onSaved={() => {
              setLogging(false);
              void shots.reload();
            }}
          />
        </Modal>
      ) : null}
    </>
  );
}
