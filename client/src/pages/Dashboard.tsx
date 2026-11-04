import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Plus } from 'lucide-react';
import {
  suggestNextShot,
  type BrewProfileRecord,
  type Coffee,
  type Grinder,
  type Shot,
  type Suggestion,
} from '@brewlab/shared';
import { useApi } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useDelayPassed } from '../lib/delay';
import { baristaLine, CONFIDENCE_LABEL } from '../lib/coach';
import { Banner, Empty, Modal, Stars } from '../components/ui';
import ShotForm from '../components/ShotForm';
import ShotGlass, { tasteLabel } from '../components/ShotGlass';
import { fmt, relativeDate } from '../lib/format';

interface Stats {
  total: number;
  avgRating: number | null;
  avgTimeS: number | null;
  avgRatio: number | null;
  goodShots: number;
  activeDaysLast30: number;
}

const TARGET_S = 28;
const STRIP_MAX = 8;

/** What changed since the pull before, as one signed figure. */
/** What changed since the pull before: a signed figure in mono, its unit in prose. */
function Delta({ shot, prev }: { shot: Shot; prev: Shot | undefined }) {
  if (!prev) return <>first</>;
  const n = (d: number) => (
    <span className="mono">{`${d > 0 ? '+' : '−'}${fmt(Math.abs(d))}`}</span>
  );
  if (
    shot.grindSetting != null &&
    prev.grindSetting != null &&
    shot.grindSetting !== prev.grindSetting
  ) {
    const d = shot.grindSetting - prev.grindSetting;
    return (
      <>
        {n(d)} step{Math.abs(d) === 1 ? '' : 's'}
      </>
    );
  }
  if (shot.yieldG !== prev.yieldG) return <>{n(shot.yieldG - prev.yieldG)} g</>;
  if (shot.doseG !== prev.doseG) return <>{n(shot.doseG - prev.doseG)} g dose</>;
  return <>same</>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const shots = useApi<Shot[]>('/shots?limit=200');
  const stats = useApi<Stats>('/shots/meta/stats');
  const coffees = useApi<Coffee[]>('/coffees');
  const grinders = useApi<Grinder[]>('/grinders');
  const profiles = useApi<BrewProfileRecord[]>('/profiles');

  const [logging, setLogging] = useState(false);
  const [justSaved, setJustSaved] = useState<{ shot: Shot; suggestion: Suggestion } | null>(null);

  // The phone tab bar's Log shot button lands here with { log: true }, and
  // getting started with { saved } after logging a first shot. Clear the state
  // once read, so a reload or Back doesn't reopen anything.
  useEffect(() => {
    const state = location.state as {
      log?: boolean;
      saved?: { shot: Shot; suggestion: Suggestion };
    } | null;
    if (state?.log) setLogging(true);
    if (state?.saved) setJustSaved(state.saved);
    if (state?.log || state?.saved) navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  const latest = shots.data?.[0] ?? null;
  const suggestion = useMemo(() => (latest ? suggestNextShot(latest) : null), [latest]);

  const activeCoffeeShots = useMemo(() => {
    if (!shots.data || !latest?.coffeeId) return [];
    return shots.data
      .filter((s) => s.coffeeId === latest.coffeeId)
      .slice(0, STRIP_MAX)
      .reverse();
  }, [shots.data, latest]);

  function refreshAll() {
    void shots.reload();
    void stats.reload();
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
  const firstName = user?.displayName?.split(' ')[0];

  // First load only: a reload after logging keeps the old data on screen.
  const loadingShots = shots.data == null && !shots.error;
  // A quick first load shows only the greeting until the shots and stats land,
  // so the cards appear once at full size rather than as short placeholders
  // that grow, or a stats strip that slots in between them, and push the page
  // down. A slow one gets the placeholders.
  const loadingStats = stats.data == null && !stats.error;
  const slow = useDelayPassed();
  const holding = (loadingShots || loadingStats) && !slow;
  const loadError = shots.error ?? stats.error;
  // Hold the stats strip's place while it loads, unless the shots have already
  // said there is nothing to total.
  const statsPending = loadingStats && (loadingShots || Boolean(shots.data?.length));
  const unavailable = <p className="faint small">Unavailable until your shots load.</p>;

  return (
    <>
      <div className="page-head spread">
        <div>
          <h1>
            {greeting}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p>
            {loadingShots || shots.error
              ? ' '
              : latest
                ? `Last pull ${relativeDate(latest.brewedAt)}: ${latest.coffeeName ?? 'unnamed coffee'}.`
                : 'Nothing logged yet. Pull a shot and write it down.'}
          </p>
        </div>
        {/* With a coach card on screen its button is the one press; a second
            primary up here would split the action. */}
        {holding || (latest && suggestion) ? null : (
          <button className="btn btn-primary btn-lg head-log" onClick={() => setLogging(true)}>
            <Plus aria-hidden="true" />
            Log a shot
          </button>
        )}
      </div>

      {holding ? null : (
        <>
          {loadError ? (
            <div className="dash-error">
              <Banner kind="bad">Couldn't load your shots: {loadError}</Banner>
            </div>
          ) : null}

          <div className="dash-top">
            {loadingShots ? (
              <section className="coach is-empty" aria-busy="true">
                <ShotGlass yieldG={0} width={92} className="coach-glass" />
                <p className="coach-reason">Loading your last shot…</p>
              </section>
            ) : latest && suggestion ? (
              <section className="coach" aria-label="What to change next" key={latest.id}>
                <ShotGlass
                  yieldG={latest.yieldG}
                  taste={latest.tasteBalance}
                  width={92}
                  className="coach-glass"
                  label={`Last shot: ${fmt(latest.yieldG)} g out, ${tasteLabel(latest.tasteBalance).toLowerCase()}`}
                />
                <div>
                  <h2 className="coach-headline">{baristaLine(suggestion)}</h2>
                  <p className="coach-reason">{suggestion.reason}</p>
                  <div className="coach-meta">
                    <span>
                      <span className="mono">{fmt(latest.shotTimeS)}</span> s
                    </span>
                    <span>
                      <span className="mono">
                        {fmt(latest.doseG)} → {fmt(latest.yieldG)}
                      </span>{' '}
                      g
                    </span>
                    {latest.grindSetting != null ? (
                      <span>
                        grind <span className="mono">{latest.grindSetting}</span>
                      </span>
                    ) : null}
                    <span>{tasteLabel(latest.tasteBalance)}</span>
                  </div>
                </div>
                <div className="coach-actions">
                  <button className="btn btn-primary" onClick={() => setLogging(true)}>
                    <Plus aria-hidden="true" />
                    Log the next shot
                  </button>
                  {latest.coffeeId ? (
                    <Link className="btn btn-ghost" to={`/coffees/${latest.coffeeId}`}>
                      {latest.coffeeName}
                    </Link>
                  ) : null}
                  <span className="confidence">{CONFIDENCE_LABEL[suggestion.confidence]}</span>
                </div>
              </section>
            ) : shots.error ? (
              <section className="coach is-empty">
                <ShotGlass yieldG={0} width={84} className="coach-glass" />
                <p className="coach-reason">The coach needs your shots, and they didn't load.</p>
              </section>
            ) : (
              <section className="coach is-empty" aria-label="What to change next">
                <ShotGlass yieldG={0} width={92} className="coach-glass" />
                <div>
                  <h2 className="coach-headline">Pull your first shot</h2>
                  <p className="coach-reason">
                    Log it here and the coach tells you the one thing to change next: grind, ratio,
                    or nothing at all.
                  </p>
                  <p className="coach-reason">
                    New to espresso? <Link to="/getting-started">Start here</Link>.
                  </p>
                </div>
                <div className="coach-actions">
                  <button className="btn btn-primary" onClick={() => setLogging(true)}>
                    <Plus aria-hidden="true" />
                    Log a shot
                  </button>
                </div>
              </section>
            )}

            <section className="card" aria-label="Dial-in progress" aria-busy={loadingShots}>
              <div className="card-head">
                <h2>{latest?.coffeeName ? `Dialing in ${latest.coffeeName}` : 'Dial-in'}</h2>
                {latest?.coffeeId ? <Link to={`/coffees/${latest.coffeeId}`}>Details</Link> : null}
              </div>
              {loadingShots ? (
                <p className="faint small">Loading…</p>
              ) : activeCoffeeShots.length >= 2 ? (
                <>
                  <div className="dialin-strip">
                    {activeCoffeeShots.map((s, i) => {
                      const onTarget = Math.abs(s.shotTimeS - TARGET_S) <= 4;
                      return (
                        <div
                          key={s.id}
                          className={`dialin-shot${i === activeCoffeeShots.length - 1 ? ' latest' : ''}`}
                          title={`${relativeDate(s.brewedAt)} · ${fmt(s.doseG)} → ${fmt(s.yieldG)} g · ${tasteLabel(s.tasteBalance)}`}
                        >
                          <ShotGlass
                            yieldG={s.yieldG}
                            taste={s.tasteBalance}
                            width={44}
                            label={`${fmt(s.yieldG)} g, ${fmt(s.shotTimeS)} s, ${tasteLabel(s.tasteBalance).toLowerCase()}`}
                          />
                          <span className={`dialin-time${onTarget ? ' on-target' : ''}`}>
                            {fmt(s.shotTimeS)}s
                          </span>
                          <span className="dialin-delta">
                            <Delta shot={s} prev={activeCoffeeShots[i - 1]} />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="dialin-legend" aria-hidden="true">
                    <span>
                      <i className="sour" />
                      Sour
                    </span>
                    <span>
                      <i className="balanced" />
                      Balanced
                    </span>
                    <span>
                      <i className="bitter" />
                      Bitter
                    </span>
                    <span>Height is yield · green time is on target ({TARGET_S} ± 4 s)</span>
                  </div>
                </>
              ) : shots.error ? (
                unavailable
              ) : (
                <Empty title="Two shots and a story appears">
                  Each pull of this coffee lines up here as a glass, so you can watch it come in.
                </Empty>
              )}
            </section>
          </div>

          {statsPending ? (
            // Stands in for the strip so it doesn't slot in above Recent shots
            // and push it down. Same labels, so it wraps to the same height.
            <p className="dash-summary is-pending" aria-hidden="true">
              <span>
                <b>–</b>shots logged
              </span>
              <span>
                <b>–</b>rated 4 stars or better
              </span>
              <span>
                <b>–</b>average time
              </span>
              <span>
                <b>–</b>average ratio
              </span>
              <span>
                <b>–</b>days brewing this month
              </span>
            </p>
          ) : stats.data && stats.data.total > 0 ? (
            <p className="dash-summary">
              <span>
                <b>{stats.data.total}</b>shots logged
              </span>
              <span>
                <b>{stats.data.goodShots}</b>rated 4 stars or better
              </span>
              {stats.data.avgTimeS != null ? (
                <span>
                  <b>
                    {fmt(stats.data.avgTimeS)}
                    <small>s</small>
                  </b>
                  average time
                </span>
              ) : null}
              {stats.data.avgRatio ? (
                <span>
                  <b>1:{fmt(stats.data.avgRatio)}</b>average ratio
                </span>
              ) : null}
              <span>
                <b>{stats.data.activeDaysLast30}</b>days brewing this month
              </span>
            </p>
          ) : null}

          <section className="card">
            <div className="card-head">
              <h2>Recent shots</h2>
              <Link to="/shots">
                All shots <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
            {loadingShots ? (
              <p className="faint small">Loading…</p>
            ) : shots.data?.length ? (
              <table className="table">
                <thead>
                  <tr>
                    <th aria-label="Glass" />
                    <th>When</th>
                    <th>Coffee</th>
                    <th>Grind</th>
                    <th className="num">Dose → Yield</th>
                    <th className="num">Time</th>
                    <th>Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {shots.data.slice(0, 6).map((s) => (
                    <tr key={s.id}>
                      <td className="glass-cell">
                        <ShotGlass yieldG={s.yieldG} taste={s.tasteBalance} width={26} />
                      </td>
                      <td data-label="When" className="dim">
                        {relativeDate(s.brewedAt)}
                      </td>
                      <td data-label="Coffee">
                        {s.coffeeName ?? <span className="faint">—</span>}
                      </td>
                      <td data-label="Grind" className="num dim">
                        <span>
                          {s.grindSetting ?? '—'}
                          {s.grindMicrons ? (
                            <span className="faint"> · {s.grindMicrons}µm</span>
                          ) : null}
                        </span>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : shots.error ? (
              unavailable
            ) : (
              <Empty title="No shots yet">Your pulls show up here, newest first.</Empty>
            )}
          </section>
        </>
      )}

      {logging ? (
        <Modal title="Log a shot" onClose={() => setLogging(false)} wide>
          <ShotForm
            coffees={coffees.data ?? []}
            grinders={grinders.data ?? []}
            profiles={profiles.data ?? []}
            basedOn={latest}
            onSaved={(shot, s) => {
              setLogging(false);
              setJustSaved({ shot, suggestion: s });
              refreshAll();
            }}
          />
        </Modal>
      ) : null}

      {justSaved ? (
        <Modal title="Shot logged" onClose={() => setJustSaved(null)}>
          <div className="stack">
            <div className="row align-end gap-4">
              <ShotGlass
                yieldG={justSaved.shot.yieldG}
                taste={justSaved.shot.tasteBalance}
                width={64}
                className="coach-glass"
              />
              <div>
                <h2 className="coach-line">{baristaLine(justSaved.suggestion)}</h2>
                <p className="coach-reason">{justSaved.suggestion.reason}</p>
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => setJustSaved(null)}>
              Got it
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
