import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  suggestNextShot,
  type BrewProfileRecord,
  type Coffee,
  type Grinder,
  type Shot,
} from '@brewlab/shared';
import { useApi } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useAi } from '../lib/ai';
import { useMachines } from '../lib/machines';
import { useSuggestProfile } from '../lib/suggestProfile';
import { Banner, Empty, Modal, Stars, Stat, Working, useElapsed } from '../components/ui';
import { DialInChart } from '../components/charts';
import ShotForm from '../components/ShotForm';
import { daysOffRoast, fmt, relativeDate } from '../lib/format';
import { baristaLine } from '../lib/coach';

export default function CoffeeDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const ai = useAi();
  const { capabilities } = useMachines();
  const { suggest, suggesting: suggestingFor, error: suggestError } = useSuggestProfile();
  const suggesting = suggestingFor != null;
  // The profile call thinks before it answers, so it can run for tens of
  // seconds. Real elapsed time beats a fake progress bar.
  const designingFor = useElapsed(suggesting);
  const coffee = useApi<Coffee>(`/coffees/${id}`, [id]);
  const shots = useApi<Shot[]>(`/shots?coffeeId=${id}`, [id]);
  const coffees = useApi<Coffee[]>('/coffees');
  const grinders = useApi<Grinder[]>('/grinders');
  const profiles = useApi<BrewProfileRecord[]>('/profiles');
  const [logging, setLogging] = useState(false);

  if (coffee.error) return <Banner kind="bad">{coffee.error}</Banner>;
  if (!coffee.data) return <p className="faint">Loading…</p>;

  const c = coffee.data;
  const mine = c.ownerId === user?.id;
  const list = shots.data ?? [];
  const best =
    [...list]
      .filter((s) => s.rating != null)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0] ?? null;
  const latest = list[0] ?? null;
  const suggestion = latest ? suggestNextShot(latest) : null;
  const off = daysOffRoast(c.roastDate);

  return (
    <>
      <div className="page-head spread">
        <div>
          <Link className="back small dim" to={mine ? '/coffees' : '/explore'}>
            ← back
          </Link>
          <h1>{c.name}</h1>
          <p>
            {c.roaster}
            {c.origin ? ` · ${c.origin}` : ''}
            {c.region ? `, ${c.region}` : ''}
            {c.producer ? ` · ${c.producer}` : ''}
          </p>
        </div>
        <div className="row">
          {capabilities.profiling !== 'none' ? (
            <button
              className="btn"
              onClick={() => id && suggest(id)}
              disabled={!ai.enabled || suggesting}
              aria-busy={suggesting}
              title={ai.enabled ? 'Design a starting profile for this coffee' : ai.reason}
            >
              {suggesting ? (
                <Working label="Designing" seconds={designingFor} />
              ) : (
                'Suggest a profile'
              )}
            </button>
          ) : null}
          {mine ? (
            <button className="btn btn-primary" onClick={() => setLogging(true)}>
              Log a shot
            </button>
          ) : null}
        </div>
      </div>

      {suggestError ? <Banner kind="bad">{suggestError}</Banner> : null}
      {capabilities.profiling !== 'none' && !ai.enabled ? (
        <p className="page-note small faint">{ai.reason}</p>
      ) : null}

      <div className="row-wrap mb-5">
        {c.roastLevel ? <span className="tag">{c.roastLevel}</span> : null}
        {c.process ? <span className="tag cool">{c.process}</span> : null}
        {c.varietal ? <span className="tag">{c.varietal}</span> : null}
        {c.altitudeMasl ? <span className="tag mono">{c.altitudeMasl} masl</span> : null}
        {off != null ? <span className="tag accent">{off} days off roast</span> : null}
        {c.tastingNotes.map((n) => (
          <span key={n} className="tag">
            {n}
          </span>
        ))}
      </div>

      {c.notes ? (
        <div className="mb-5">
          <Banner>{c.notes}</Banner>
        </div>
      ) : null}

      <div className="grid grid-4 mb-5">
        <Stat label="Shots" value={list.length} />
        <Stat
          label="Average rating"
          value={c.avgRating ?? '—'}
          unit={c.avgRating ? '★' : undefined}
        />
        <Stat
          label="Best pull"
          value={best ? `${fmt(best.shotTimeS)}s` : '—'}
          note={
            best
              ? `grind ${best.grindSetting ?? '—'} · 1:${(best.yieldG / best.doseG).toFixed(1)}`
              : undefined
          }
        />
        <Stat label="Cloned by" value={c.cloneCount ?? 0} note="other brewers" />
      </div>

      {list.length >= 2 ? (
        <div className="card mb-4">
          <div className="card-head">
            <h2>Dial-in</h2>
            <span className="small faint">shot time over successive pulls</span>
          </div>
          <DialInChart shots={list} />
        </div>
      ) : null}

      {suggestion && mine ? (
        <div className="card mb-4">
          <div className="card-head">
            <h2>Next pull</h2>
          </div>
          <h3 className="next-pull">{baristaLine(suggestion)}</h3>
          <p className="dim small m-0 mt-2">{suggestion.reason}</p>
        </div>
      ) : null}

      <div className="card">
        <div className="card-head">
          <h2>Shot history</h2>
        </div>
        {list.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Grinder</th>
                <th className="num">Grind</th>
                <th className="num">Dose → Yield</th>
                <th className="num">Time</th>
                <th>Rating</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td data-label="When" className="dim">
                    {relativeDate(s.brewedAt)}
                  </td>
                  <td data-label="Grinder" className="dim">
                    {s.grinderName ?? '—'}
                  </td>
                  <td data-label="Grind" className="num">
                    {s.grindSetting ?? '—'}
                    {s.grindMicrons ? <span className="faint"> · {s.grindMicrons}µm</span> : null}
                  </td>
                  <td data-label="Dose → Yield" className="num">
                    {fmt(s.doseG)} → {fmt(s.yieldG)}
                  </td>
                  <td data-label="Time" className="num">
                    {fmt(s.shotTimeS)}s
                  </td>
                  <td data-label="Rating">
                    <Stars value={s.rating} />
                  </td>
                  <td data-label="Notes" className="dim small">
                    {s.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty title="No shots on this bag yet" />
        )}
      </div>

      {logging ? (
        <Modal title={`Log a shot — ${c.name}`} onClose={() => setLogging(false)} wide>
          <ShotForm
            coffees={coffees.data ?? []}
            grinders={grinders.data ?? []}
            profiles={profiles.data ?? []}
            defaultCoffeeId={c.id}
            basedOn={latest}
            onSaved={() => {
              setLogging(false);
              void shots.reload();
              void coffee.reload();
            }}
          />
        </Modal>
      ) : null}
    </>
  );
}
