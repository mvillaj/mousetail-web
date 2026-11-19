import { useMemo, useState } from 'react';
import {
  grindBucket,
  grindSettingError,
  settingToMicrons,
  yieldG,
  type BrewProfileRecord,
  type Coffee,
  type Grinder,
  type Shot,
  type Suggestion,
} from '@brewlab/shared';
import { api } from '../lib/api';
import { useMachines } from '../lib/machines';
import { Banner, Field, ModalHeaderSlot, RatingInput, Segmented } from './ui';
import ShotFormSimple from './ShotFormSimple';
import { TASTE_LABELS, fToC, roundF } from '../lib/format';

interface Props {
  coffees: Coffee[];
  grinders: Grinder[];
  profiles: BrewProfileRecord[];
  /** Pre-select this coffee and hide nothing else. */
  defaultCoffeeId?: string;
  /** Copy the numbers from a previous shot — the usual way you log the next one. */
  basedOn?: Shot | null;
  onSaved: (shot: Shot, suggestion: Suggestion) => void;
}

function ShotFormDetailed({
  coffees,
  grinders,
  profiles,
  defaultCoffeeId,
  basedOn,
  onSaved,
}: Props) {
  const { machines, active, capabilities } = useMachines();
  const [machineId, setMachineId] = useState(basedOn?.machineId ?? active?.id ?? '');
  const [coffeeId, setCoffeeId] = useState(
    defaultCoffeeId ?? basedOn?.coffeeId ?? coffees[0]?.id ?? '',
  );
  const [grinderId, setGrinderId] = useState(
    basedOn?.grinderId ?? grinders.find((g) => g.isDefault)?.id ?? grinders[0]?.id ?? '',
  );
  const [profileId, setProfileId] = useState(basedOn?.profileId ?? '');
  const [grindSetting, setGrindSetting] = useState<string>(String(basedOn?.grindSetting ?? ''));
  const [doseG, setDoseG] = useState(String(basedOn?.doseG ?? 18));
  const [yieldGrams, setYieldGrams] = useState(String(basedOn?.yieldG ?? 36));
  const [shotTimeS, setShotTimeS] = useState(String(basedOn?.shotTimeS ?? 28));
  const [preInfusionS, setPreInfusionS] = useState(String(basedOn?.preInfusionS ?? 5));
  const [brewTempF, setBrewTempF] = useState(String(roundF(basedOn?.brewTempC ?? 93)));
  const [rating, setRating] = useState<number | null>(null);
  const [tasteBalance, setTasteBalance] = useState(0);
  const [flavourNotes, setFlavourNotes] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const grinder = grinders.find((g) => g.id === grinderId) ?? null;
  const machine = machines.find((m) => m.id === machineId) ?? active;
  const tempRange = machine?.limits.tempC ?? { min: 0, max: 130 };
  const setting = Number(grindSetting);
  const microns = useMemo(
    () =>
      grinder && grindSetting !== '' && Number.isFinite(setting)
        ? Math.round(settingToMicrons(grinder, setting))
        : null,
    [grinder, grindSetting, setting],
  );
  const grindProblem = grinder && grindSetting !== '' ? grindSettingError(grinder, setting) : null;

  const dose = Number(doseG) || 0;
  const out = Number(yieldGrams) || 0;
  const ratioText = dose > 0 ? `1:${(out / dose).toFixed(2)}` : '—';

  function applyProfile(pid: string) {
    setProfileId(pid);
    const record = profiles.find((p) => p.id === pid);
    if (!record?.profile) return;
    setDoseG(String(record.profile.doseG));
    setYieldGrams(String(yieldG(record.profile)));
    setBrewTempF(String(roundF(record.profile.brewTempC)));
    const pre = record.profile.stages.find((s) => s.kind === 'preinfusion');
    setPreInfusionS(String(pre?.durationS ?? 0));
    setShotTimeS(String(record.profile.stages.reduce((s, x) => s + x.durationS, 0)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ shot: Shot; suggestion: Suggestion }>('/shots', {
        method: 'POST',
        body: {
          coffeeId: coffeeId || null,
          grinderId: grinderId || null,
          machineId: machineId || null,
          profileId: profileId || null,
          grindSetting: grindSetting === '' ? null : Number(grindSetting),
          doseG: Number(doseG),
          yieldG: Number(yieldGrams),
          shotTimeS: Number(shotTimeS),
          preInfusionS: preInfusionS === '' ? null : Number(preInfusionS),
          brewTempC: brewTempF === '' ? null : fToC(Number(brewTempF)),
          wdt: true,
          rating,
          tasteBalance,
          flavourNotes: flavourNotes
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          notes: notes || null,
        },
      });
      onSaved(res.shot, res.suggestion);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="stack">
      <div className="grid grid-3">
        <Field label="Coffee">
          <select value={coffeeId} onChange={(e) => setCoffeeId(e.target.value)}>
            <option value="">— none —</option>
            {coffees.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.roaster}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Machine">
          <select value={machineId} onChange={(e) => setMachineId(e.target.value)}>
            <option value="">— none —</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Grinder">
          <select value={grinderId} onChange={(e) => setGrinderId(e.target.value)}>
            <option value="">— none —</option>
            {grinders.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={`Grind setting${grinder ? ` (${grinder.scale.unitLabel})` : ''}`}
          hint={
            grindProblem ??
            (microns != null
              ? `≈ ${microns} µm · ${grindBucket(microns)}`
              : 'Pick a grinder to see the micron estimate')
          }
        >
          <input
            type="number"
            step={grinder?.scale.kind === 'stepless' ? 'any' : (grinder?.scale.step ?? 1)}
            min={grinder?.scale.min}
            max={grinder?.scale.max}
            value={grindSetting}
            onChange={(e) => setGrindSetting(e.target.value)}
            aria-invalid={grindProblem ? true : undefined}
          />
        </Field>
      </div>

      {capabilities.profiling !== 'none' ? (
        <Field
          label="Brew profile"
          hint="Selecting one fills in dose, yield, temperature and time."
        >
          <select value={profileId} onChange={(e) => applyProfile(e.target.value)}>
            <option value="">— none —</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <div className="grid grid-4">
        <Field label="Dose (g)">
          <input
            type="number"
            step="0.1"
            value={doseG}
            onChange={(e) => setDoseG(e.target.value)}
            required
          />
        </Field>
        <Field label="Yield (g)" hint={`Ratio ${ratioText}`}>
          <input
            type="number"
            step="0.1"
            value={yieldGrams}
            onChange={(e) => setYieldGrams(e.target.value)}
            required
          />
        </Field>
        <Field label="Shot time (s)">
          <input
            type="number"
            step="0.5"
            value={shotTimeS}
            onChange={(e) => setShotTimeS(e.target.value)}
            required
          />
        </Field>
        <Field label="Pre-infusion (s)">
          <input
            type="number"
            step="1"
            value={preInfusionS}
            onChange={(e) => setPreInfusionS(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-2">
        <Field
          label={`Temperature (°F)`}
          hint={
            machine
              ? `${machine.name}: ${roundF(tempRange.min)}–${roundF(tempRange.max)} °F`
              : 'Add a machine to see its range'
          }
        >
          <input
            type="number"
            step="1"
            min={roundF(tempRange.min)}
            max={roundF(tempRange.max)}
            value={brewTempF}
            onChange={(e) => setBrewTempF(e.target.value)}
          />
        </Field>
        <Field label="Rating">
          <div className="pt-1">
            <RatingInput value={rating} onChange={setRating} />
          </div>
        </Field>
      </div>

      <Field
        label={`Taste — ${TASTE_LABELS[tasteBalance]}`}
        hint="Sour on the left, bitter on the right. This drives the next suggestion."
      >
        <input
          type="range"
          min={-2}
          max={2}
          step={1}
          value={tasteBalance}
          onChange={(e) => setTasteBalance(Number(e.target.value))}
        />
      </Field>

      <Field label="Flavour notes" hint="Comma separated.">
        <input
          value={flavourNotes}
          onChange={(e) => setFlavourNotes(e.target.value)}
          placeholder="peach, jasmine, black tea"
        />
      </Field>

      <Field label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What did you change, and what happened?"
        />
      </Field>

      {error ? <Banner kind="bad">{error}</Banner> : null}

      <div className="row">
        <button className="btn btn-primary" disabled={busy || grindProblem != null}>
          {busy ? 'Saving…' : 'Log shot'}
        </button>
      </div>
    </form>
  );
}

type Mode = 'simple' | 'detailed';
const MODE_KEY = 'brewlab.shotFormMode';

function storedMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === 'detailed' ? 'detailed' : 'simple';
  } catch {
    return 'simple';
  }
}

/**
 * The shot log has two faces. A machine that runs a profile (the ES1) already
 * knows its dose, yield, temperature and timing, so it gets a short, big-button
 * form by default; everything else, and anyone who prefers the numbers, gets the
 * full form.
 */
export default function ShotForm(props: Props) {
  const { machines, active } = useMachines();
  const [mode, setMode] = useState<Mode>(storedMode);
  const machine = machines.find((m) => m.id === props.basedOn?.machineId) ?? active;

  if (!machine || machine.capabilities.profiling !== 'pressure') {
    return <ShotFormDetailed {...props} />;
  }

  function choose(next: Mode) {
    setMode(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      // Private mode: the choice just lasts until the form closes.
    }
  }

  return (
    <div className="stack">
      <ModalHeaderSlot>
        <div className="shot-mode">
          <Segmented
            options={[
              { value: 'simple', label: 'Simple' },
              { value: 'detailed', label: 'Detailed' },
            ]}
            value={mode}
            onChange={choose}
          />
        </div>
      </ModalHeaderSlot>
      {mode === 'simple' ? (
        <ShotFormSimple
          machine={machine}
          coffees={props.coffees}
          grinders={props.grinders}
          profiles={props.profiles}
          defaultCoffeeId={props.defaultCoffeeId}
          basedOn={props.basedOn}
          onSaved={props.onSaved}
        />
      ) : (
        <ShotFormDetailed {...props} />
      )}
    </div>
  );
}
