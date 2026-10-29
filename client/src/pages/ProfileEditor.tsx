import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ES1_LIMITS,
  RANGE_NOTES,
  buildStages,
  makeStage,
  splitStages,
  totalDurationS,
  yieldG,
  type BrewProfileRecord,
  type Es1Profile,
  type Es1Shot,
  type FellowConnectionStatus,
  type InfusionStep,
  type PreInfusionStep,
  type RampDownStep,
} from '@brewlab/shared';
import { api, useApi } from '../lib/api';
import { useDelayPassed } from '../lib/delay';
import { Banner, Field, Modal } from '../components/ui';
import { ProfileCurve, STAGE_COLOUR } from '../components/charts';
import { fmt, fToC, roundF } from '../lib/format';

const BLANK: Es1Profile = {
  id: 'new',
  name: 'New profile',
  description: '',
  doseG: 18,
  ratio: 2,
  brewTempC: 93,
  stages: [makeStage('preinfusion'), makeStage('infusion'), makeStage('rampdown')],
};

export default function ProfileEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // A suggested profile arrives in router state rather than the database, so it
  // is a real draft: close the tab and nothing was ever created.
  const draft = (useLocation().state ?? null) as {
    draft: Es1Profile;
    rationale: string;
    coffeeName: string;
  } | null;
  const isNew = !id;

  const record = useApi<BrewProfileRecord>(id ? `/profiles/${id}` : null, [id]);
  const fellow = useApi<FellowConnectionStatus>('/fellow/status');

  const [profile, setProfile] = useState<Es1Profile>(draft?.draft ?? BLANK);
  const [isPublic, setIsPublic] = useState(false);
  const [description, setDescription] = useState(draft?.draft.description ?? '');
  const [status, setStatus] = useState<{ kind: 'good' | 'bad' | 'info'; text: string } | null>(
    null,
  );
  const [pushResult, setPushResult] = useState<{
    message: string;
    raw?: unknown;
    ok: boolean;
    warnings?: string[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  // Which record the form holds. Until it is this page's, the form still has the
  // blank template in it, and drawing that would flash a curve that isn't yours.
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const loadingPassed = useDelayPassed();

  // Anything that did not originate in our own custom folder gets written as a
  // new profile rather than over the original, so say so on the button.
  const origin = record.data?.origin ?? 'local';
  const clonesOnPush = origin === 'factory' || origin === 'drop';
  // Sending is opt-in per user. Until then the editor says nothing about Fellow.
  const fellowOn = fellow.data?.optedIn === true;

  useEffect(() => {
    if (record.data) {
      setProfile(record.data.profile);
      setIsPublic(record.data.isPublic);
      setDescription(record.data.description ?? '');
      setLoadedId(record.data.id);
    }
  }, [record.data]);

  const total = totalDurationS(profile);
  const overLimit = total > ES1_LIMITS.totalDurationS.max;

  function patch(p: Partial<Es1Profile>) {
    setProfile((prev) => ({ ...prev, ...p }));
  }

  /*
   * The editor works in the machine's own terms — an optional pre-infusion, one
   * or more flat infusion steps, an optional ramp-down — and writes back the flat
   * ordered stage list that storage and the wire format use. Every edit goes
   * through buildStages, so the array is always in run order and a ramp-down
   * always starts where the last infusion ended.
   */
  const shot = splitStages(profile.stages);

  function setShot(next: Es1Shot) {
    setProfile((prev) => ({ ...prev, stages: buildStages(next) }));
  }

  function newId(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function togglePreInfusion(on: boolean) {
    setShot({
      ...shot,
      preInfusion: on
        ? { id: newId('pre'), durationS: 5, pressureBar: 3, flowLimitMlS: 4.5 }
        : null,
    });
  }

  function patchPre(changes: Partial<PreInfusionStep>) {
    if (!shot.preInfusion) return;
    setShot({ ...shot, preInfusion: { ...shot.preInfusion, ...changes } });
  }

  function toggleRampDown(on: boolean) {
    setShot({
      ...shot,
      rampDown: on
        ? {
            id: newId('rmp'),
            durationS: 5,
            // Somewhere below where the shot currently ends, so the default ramps.
            endPressureBar: Math.max(
              ES1_LIMITS.pressureBar.min,
              Math.round(((shot.infusions.at(-1)?.pressureBar ?? 9) - 3) * 10) / 10,
            ),
          }
        : null,
    });
  }

  function patchRamp(changes: Partial<RampDownStep>) {
    if (!shot.rampDown) return;
    setShot({ ...shot, rampDown: { ...shot.rampDown, ...changes } });
  }

  function addInfusion() {
    const last = shot.infusions.at(-1);
    setShot({
      ...shot,
      infusions: [
        ...shot.infusions,
        // Steps usually descend, so offer the next one a bar lower.
        {
          id: newId('inf'),
          durationS: last?.durationS ?? 22,
          pressureBar: Math.max(ES1_LIMITS.pressureBar.min, (last?.pressureBar ?? 9) - 1),
        },
      ],
    });
  }

  function patchInfusion(index: number, changes: Partial<InfusionStep>) {
    setShot({
      ...shot,
      infusions: shot.infusions.map((inf, i) => (i === index ? { ...inf, ...changes } : inf)),
    });
  }

  function removeInfusion(index: number) {
    if (shot.infusions.length <= 1) return;
    setShot({ ...shot, infusions: shot.infusions.filter((_, i) => i !== index) });
  }

  function moveInfusion(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= shot.infusions.length) return;
    const next = [...shot.infusions];
    [next[index], next[target]] = [next[target], next[index]];
    setShot({ ...shot, infusions: next });
  }

  const fmtTotal = (seconds: number) => `${Math.round(seconds)}s`;

  async function save() {
    setBusy(true);
    setStatus(null);
    try {
      const body = { name: profile.name, description: description || null, isPublic, profile };
      if (isNew) {
        const created = await api<BrewProfileRecord>('/profiles', { method: 'POST', body });
        // The form already holds what was saved, so there is nothing to wait for.
        setLoadedId(created.id);
        navigate(`/profiles/${created.id}`, { replace: true });
      } else {
        await api(`/profiles/${id}`, { method: 'PATCH', body });
        await record.reload();
      }
      setStatus({ kind: 'good', text: 'Saved.' });
    } catch (err) {
      setStatus({ kind: 'bad', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function pushToFellow() {
    if (isNew) {
      setStatus({ kind: 'bad', text: 'Save the profile first.' });
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ ok: boolean; message: string; raw?: unknown; warnings?: string[] }>(
        `/fellow/push/${id}`,
        { method: 'POST', body: {} },
      );
      setPushResult(res);
      await record.reload();
    } catch (err) {
      setPushResult({ ok: false, message: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (!isNew && loadedId !== id) {
    if (record.error) return <Banner kind="bad">{record.error}</Banner>;
    return loadingPassed ? <p className="faint">Loading…</p> : null;
  }

  return (
    <>
      <div className="page-head spread">
        <div>
          <Link className="back small dim" to="/profiles">
            ← profiles
          </Link>
          <h1>{isNew ? 'New profile' : profile.name}</h1>
          <p>
            Optional pre-infusion, one or more flat infusion steps, an optional ramp down. A falling
            curve is made of successive steps, not a slope — that is how the machine expresses it.
          </p>
        </div>
        <div className="row">
          {fellowOn ? (
            <button className="btn" onClick={pushToFellow} disabled={busy || isNew}>
              {clonesOnPush ? 'Save to Fellow as a copy' : 'Send to Fellow'}
            </button>
          ) : null}
          <button className="btn btn-primary" onClick={save} disabled={busy || overLimit}>
            {busy ? 'Working…' : 'Save'}
          </button>
        </div>
      </div>

      {status ? (
        <div className="mb-4">
          <Banner kind={status.kind}>{status.text}</Banner>
        </div>
      ) : null}

      {draft ? (
        <section className="suggestion-note mb-4" aria-labelledby="suggestion-title">
          <div className="suggestion-head">
            <span className="suggestion-mark" aria-hidden="true">
              <Sparkles size={16} strokeWidth={2.25} />
            </span>
            <div>
              <p className="suggestion-eyebrow">Suggested starting point</p>
              <h2 id="suggestion-title">For {draft.coffeeName}</h2>
            </div>
          </div>
          <p className="suggestion-reason">{draft.rationale}</p>
          <p className="suggestion-foot">
            Nothing is saved yet. Change anything you disagree with, then Save.
          </p>
        </section>
      ) : null}

      {fellowOn && clonesOnPush ? (
        <Banner kind="info">
          This came off your machine as one of Fellow's own profiles, so it is read-only up there.
          Editing it here is fine — sending it back saves a separate copy in your custom folder and
          leaves the original alone.
        </Banner>
      ) : null}

      {fellowOn && !fellow.data?.connected ? (
        <div className="mb-4 mt-1">
          <Banner kind="info">
            No Fellow account connected — <Link to="/fellow">connect one</Link> to send profiles to
            the machine.
          </Banner>
        </div>
      ) : null}

      <div className="card mb-4">
        <ProfileCurve profile={profile} height={230} />
        <div className="row-wrap small mt-3">
          {profile.stages.map((s, i) => (
            <span key={s.id} className="tag" style={{ borderColor: STAGE_COLOUR[s.kind] }}>
              <span style={{ color: STAGE_COLOUR[s.kind] }}>●</span> {i + 1}. {s.label ?? s.kind} ·{' '}
              {s.durationS}s ·{' '}
              {s.pressureBar === s.endPressureBar
                ? `${s.pressureBar} bar`
                : `${s.pressureBar}→${s.endPressureBar} bar`}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-2 mb-4">
        <div className="card">
          <div className="card-head">
            <h2>Recipe</h2>
          </div>
          <div className="stack">
            <Field label="Name">
              <input
                value={profile.name}
                onChange={(e) => patch({ name: e.target.value })}
                maxLength={50}
              />
            </Field>
            <Field label="Description">
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="When you reach for this one."
              />
            </Field>
            <div className="grid grid-3">
              <Field label="Dose (g)">
                <input
                  type="number"
                  step="0.1"
                  min={ES1_LIMITS.doseG.min}
                  max={ES1_LIMITS.doseG.max}
                  value={profile.doseG}
                  onChange={(e) => patch({ doseG: Number(e.target.value) })}
                />
              </Field>
              <Field label="Ratio (1:x)" hint={`Yield ${yieldG(profile)} g`}>
                <input
                  type="number"
                  step="0.1"
                  min={ES1_LIMITS.ratio.min}
                  max={ES1_LIMITS.ratio.max}
                  value={profile.ratio}
                  onChange={(e) => patch({ ratio: Number(e.target.value) })}
                />
              </Field>
              <Field label="Temp (°F)" hint={RANGE_NOTES.tempC}>
                <input
                  type="number"
                  step="1"
                  min={roundF(ES1_LIMITS.tempC.min)}
                  max={roundF(ES1_LIMITS.tempC.max)}
                  value={roundF(profile.brewTempC)}
                  onChange={(e) => patch({ brewTempC: fToC(Number(e.target.value)) })}
                />
              </Field>
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              Publish to Explore so other people can clone it
            </label>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Shot summary</h2>
          </div>
          <div className="grid grid-2">
            <div>
              <div className="stat-label">Total time</div>
              <div className="stat-value">
                {total}
                <span className="unit">s</span>
              </div>
            </div>
            <div>
              <div className="stat-label">In → out</div>
              <div className="stat-value">
                {profile.doseG}→{yieldG(profile)}
                <span className="unit">g</span>
              </div>
            </div>
            <div>
              <div className="stat-label">Peak pressure</div>
              <div className="stat-value">
                {Math.max(...profile.stages.flatMap((s) => [s.pressureBar, s.endPressureBar]))}
                <span className="unit">bar</span>
              </div>
            </div>
            <div>
              <div className="stat-label">Phases</div>
              <div className="stat-value">{profile.stages.length}</div>
            </div>
          </div>
          {overLimit ? (
            <div className="mt-3">
              <Banner kind="bad">
                {total}s is longer than the {ES1_LIMITS.totalDurationS.max}s the machine will
                accept.
              </Banner>
            </div>
          ) : null}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Phases</h2>
          <span className="small faint">{fmtTotal(total)} total</span>
        </div>

        <div className="stack">
          {/* Pre-infusion — optional, and the only phase with a flow setting. */}
          <div className="phase">
            <div className="phase-head">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={Boolean(shot.preInfusion)}
                  onChange={(e) => togglePreInfusion(e.target.checked)}
                />
                <strong>Pre-infusion</strong>
              </label>
              <span className="small faint">Wets the puck at low pressure before the shot.</span>
            </div>
            {shot.preInfusion ? (
              <div className="grid grid-3">
                <Field label="Seconds">
                  <input
                    type="number"
                    min={ES1_LIMITS.preInfusion.durationS.min}
                    max={ES1_LIMITS.preInfusion.durationS.max}
                    value={shot.preInfusion.durationS}
                    onChange={(e) => patchPre({ durationS: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Bar">
                  <input
                    type="number"
                    step="0.1"
                    min={ES1_LIMITS.preInfusion.holdPressureBar.min}
                    max={ES1_LIMITS.preInfusion.holdPressureBar.max}
                    value={shot.preInfusion.pressureBar}
                    onChange={(e) => patchPre({ pressureBar: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Fill flow ml/s">
                  <input
                    type="number"
                    step="0.1"
                    min={ES1_LIMITS.preInfusion.fillFlowMlS.min}
                    max={ES1_LIMITS.preInfusion.fillFlowMlS.max}
                    value={shot.preInfusion.flowLimitMlS}
                    onChange={(e) => patchPre({ flowLimitMlS: Number(e.target.value) })}
                  />
                </Field>
              </div>
            ) : null}
          </div>

          {/* Infusion — one or more flat steps. A falling curve is several of these. */}
          <div className="phase">
            <div className="phase-head">
              <strong>Infusion</strong>
              <button
                type="button"
                className="btn btn-sm"
                onClick={addInfusion}
                disabled={shot.infusions.length >= ES1_LIMITS.stages.max - 2}
              >
                + Add step
              </button>
            </div>
            <div className="stack-sm">
              {shot.infusions.map((inf, i) => (
                <div className="infusion-row" key={inf.id}>
                  <div className="handle" style={{ background: STAGE_COLOUR.infusion }}>
                    {i + 1}
                  </div>
                  <Field label="Seconds">
                    <input
                      type="number"
                      min={ES1_LIMITS.stageDurationS.min}
                      max={ES1_LIMITS.stageDurationS.max}
                      value={inf.durationS}
                      onChange={(e) => patchInfusion(i, { durationS: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Bar">
                    <input
                      type="number"
                      step="0.1"
                      min={ES1_LIMITS.pressureBar.min}
                      max={ES1_LIMITS.pressureBar.max}
                      value={inf.pressureBar}
                      onChange={(e) => patchInfusion(i, { pressureBar: Number(e.target.value) })}
                    />
                  </Field>
                  <div className="infusion-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => moveInfusion(i, -1)}
                      disabled={i === 0}
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => moveInfusion(i, 1)}
                      disabled={i === shot.infusions.length - 1}
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => removeInfusion(i)}
                      disabled={shot.infusions.length <= 1}
                      title={
                        shot.infusions.length <= 1 ? 'A shot needs at least one infusion' : 'Remove'
                      }
                      aria-label="Remove infusion step"
                    >
                      <X aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ramp down — starts wherever the last infusion ended, so only the end is set. */}
          <div className="phase">
            <div className="phase-head">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={Boolean(shot.rampDown)}
                  onChange={(e) => toggleRampDown(e.target.checked)}
                />
                <strong>Ramp down</strong>
              </label>
              <span className="small faint">
                Falls from {fmt(shot.infusions.at(-1)?.pressureBar ?? 9)} bar to the end pressure.
              </span>
            </div>
            {shot.rampDown ? (
              <div className="grid grid-3">
                <Field label="Seconds">
                  <input
                    type="number"
                    min={ES1_LIMITS.stageDurationS.min}
                    max={ES1_LIMITS.stageDurationS.max}
                    value={shot.rampDown.durationS}
                    onChange={(e) => patchRamp({ durationS: Number(e.target.value) })}
                  />
                </Field>
                <Field label="End bar">
                  <input
                    type="number"
                    step="0.1"
                    min={ES1_LIMITS.pressureBar.min}
                    max={ES1_LIMITS.pressureBar.max}
                    value={shot.rampDown.endPressureBar}
                    onChange={(e) => patchRamp({ endPressureBar: Number(e.target.value) })}
                  />
                </Field>
              </div>
            ) : null}
          </div>
        </div>

        <p className="small faint mt-3 mb-0">
          {RANGE_NOTES.pressureBar} {RANGE_NOTES.preInfusion}
        </p>
      </div>

      {pushResult ? (
        <Modal
          title={pushResult.ok ? 'Sent' : 'Fellow said no'}
          onClose={() => setPushResult(null)}
        >
          <div className="stack">
            <Banner kind={pushResult.ok ? 'good' : 'bad'}>{pushResult.message}</Banner>
            {pushResult.warnings?.length ? (
              <Banner kind="info">
                <strong>What the machine will not have received:</strong>
                <ul className="banner-list">
                  {pushResult.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </Banner>
            ) : null}
            {pushResult.raw ? (
              <>
                <div className="small dim">
                  Raw response — this is how you learn the real schema.
                </div>
                <pre className="code-block mono small">
                  {JSON.stringify(pushResult.raw, null, 2)}
                </pre>
              </>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
