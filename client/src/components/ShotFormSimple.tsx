import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Citrus, Coffee, Smile, Wheat, type LucideIcon } from 'lucide-react';
import {
  grindBucket,
  grindSettingError,
  settingToMicrons,
  totalDurationS,
  yieldG,
  type BrewProfileRecord,
  type Coffee as CoffeeRecord,
  type Grinder,
  type Machine,
  type Shot,
  type Suggestion,
} from '@brewlab/shared';
import { api } from '../lib/api';
import { roundF } from '../lib/format';
import { Banner, RatingInput } from './ui';
import GrindDial from './GrindDial';

interface Props {
  machine: Machine;
  coffees: CoffeeRecord[];
  grinders: Grinder[];
  profiles: BrewProfileRecord[];
  defaultCoffeeId?: string;
  basedOn?: Shot | null;
  onSaved: (shot: Shot, suggestion: Suggestion) => void;
}

/** Three honest answers instead of a five-point slider. Values sit on the same -2…+2 scale. */
export const TASTE_CHOICES: { value: number; label: string; hint: string; icon: LucideIcon }[] = [
  { value: -2, label: 'Sour', hint: 'Sharp, thin, makes you squint', icon: Citrus },
  { value: 0, label: 'Just right', hint: 'Sweet and balanced', icon: Smile },
  { value: 2, label: 'Bitter', hint: 'Harsh, dry, burnt', icon: Wheat },
];

/**
 * The ES1 runs a profile, and a profile already fixes dose, yield, temperature
 * and timing. So the only things worth asking are which profile, how it was
 * ground, and how it came out. Everything else is read off the profile.
 */
export default function ShotFormSimple({
  machine,
  coffees,
  grinders,
  profiles,
  defaultCoffeeId,
  basedOn,
  onSaved,
}: Props) {
  const usable = profiles.filter((p) => p.profile);
  const [coffeeId, setCoffeeId] = useState(
    defaultCoffeeId ?? basedOn?.coffeeId ?? coffees[0]?.id ?? '',
  );
  const [profileId, setProfileId] = useState(
    usable.find((p) => p.id === basedOn?.profileId)?.id ?? usable[0]?.id ?? '',
  );
  const [grinderId, setGrinderId] = useState(
    basedOn?.grinderId ?? grinders.find((g) => g.isDefault)?.id ?? grinders[0]?.id ?? '',
  );
  const [grindSetting, setGrindSetting] = useState(String(basedOn?.grindSetting ?? ''));
  const [taste, setTaste] = useState<number | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const record = usable.find((p) => p.id === profileId) ?? null;
  const grinder = grinders.find((g) => g.id === grinderId) ?? null;
  const setting = Number(grindSetting);
  const microns = useMemo(
    () =>
      grinder && grindSetting !== '' && Number.isFinite(setting)
        ? Math.round(settingToMicrons(grinder, setting))
        : null,
    [grinder, grindSetting, setting],
  );
  const grindProblem = grinder && grindSetting !== '' ? grindSettingError(grinder, setting) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!record) return;
    const p = record.profile;
    setBusy(true);
    setError(null);
    try {
      const pre = p.stages.find((s) => s.kind === 'preinfusion');
      const res = await api<{ shot: Shot; suggestion: Suggestion }>('/shots', {
        method: 'POST',
        body: {
          coffeeId: coffeeId || null,
          grinderId: grinderId || null,
          machineId: machine.id,
          profileId: record.id,
          grindSetting: grindSetting === '' ? null : Number(grindSetting),
          doseG: p.doseG,
          yieldG: yieldG(p),
          shotTimeS: totalDurationS(p),
          preInfusionS: pre?.durationS ?? 0,
          brewTempC: p.brewTempC,
          wdt: true,
          rating,
          tasteBalance: taste,
          flavourNotes: [],
          notes: null,
        },
      });
      onSaved(res.shot, res.suggestion);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!usable.length) {
    return (
      <Banner kind="info" icon={Coffee}>
        The {machine.name} brews from a profile, so there has to be one before you can log a shot.{' '}
        <Link to="/profiles">Make or import a profile</Link>, or switch to the detailed form.
      </Banner>
    );
  }

  return (
    <form onSubmit={submit} className="simple-shot">
      {coffees.length ? (
        <section className="simple-step">
          <h3 id="simple-coffee">
            <span className="simple-num">1 ·</span> What coffee?
          </h3>
          <select
            className="simple-select"
            aria-labelledby="simple-coffee"
            value={coffeeId}
            onChange={(e) => setCoffeeId(e.target.value)}
          >
            <option value="">— none —</option>
            {coffees.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.roaster}
              </option>
            ))}
          </select>
        </section>
      ) : null}

      <section className="simple-step">
        <h3 id="simple-profile">
          <span className="simple-num">2 ·</span> Which profile did you run?
        </h3>
        <div className="simple-choices" role="radiogroup" aria-labelledby="simple-profile">
          {usable.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={p.id === profileId}
              className={`simple-choice${p.id === profileId ? ' on' : ''}`}
              onClick={() => setProfileId(p.id)}
            >
              <Coffee aria-hidden="true" />
              <span className="simple-choice-name">{p.name}</span>
              <span className="simple-choice-hint">
                {p.profile.doseG} g in · {yieldG(p.profile)} g out · {totalDurationS(p.profile)} s ·{' '}
                {roundF(p.profile.brewTempC)}°F
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="simple-step">
        <h3 id="simple-grind">
          <span className="simple-num">3 ·</span> Where was the grinder set?
        </h3>
        {grinders.length > 1 ? (
          <select
            className="simple-select"
            aria-label="Grinder"
            value={grinderId}
            onChange={(e) => setGrinderId(e.target.value)}
          >
            {grinders.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        ) : null}
        <GrindDial
          grinder={grinder}
          value={grindSetting}
          onChange={setGrindSetting}
          microns={microns}
          problem={grindProblem}
          labelledBy="simple-grind"
          describedBy="simple-grind-hint"
        />
        <span className="simple-note" id="simple-grind-hint">
          {grindProblem ??
            (microns != null
              ? `About ${microns} µm · ${grindBucket(microns)}`
              : grinder
                ? `${grinder.name}. Skip this if you don't know.`
                : 'Add a grinder to track this.')}
        </span>
      </section>

      <section className="simple-step">
        <h3 id="simple-taste">
          <span className="simple-num">4 ·</span> How did it taste?
        </h3>
        <div className="simple-choices three" role="radiogroup" aria-labelledby="simple-taste">
          {TASTE_CHOICES.map(({ value, label, hint, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={taste === value}
              className={`simple-choice center${taste === value ? ' on' : ''}`}
              onClick={() => setTaste(taste === value ? null : value)}
            >
              <Icon aria-hidden="true" />
              <span className="simple-choice-name">{label}</span>
              <span className="simple-choice-hint">{hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="simple-step">
        <h3>
          <span className="simple-num">5 ·</span> How much did you like it?
        </h3>
        <div className="simple-rating">
          <RatingInput value={rating} onChange={setRating} />
        </div>
      </section>

      {error ? <Banner kind="bad">{error}</Banner> : null}

      <button
        className="btn btn-primary btn-lg simple-submit"
        disabled={busy || grindProblem != null || !record}
      >
        {busy ? 'Saving…' : 'Log this shot'}
      </button>
    </form>
  );
}
