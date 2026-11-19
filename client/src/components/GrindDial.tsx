import { Minus, Plus } from 'lucide-react';
import { snapToScale, type Grinder } from '@brewlab/shared';

interface Props {
  grinder: Grinder | null;
  value: string;
  onChange: (next: string) => void;
  microns: number | null;
  problem: string | null;
  labelledBy: string;
  describedBy: string;
}

/** Fixed spots for the "grounds", so the picture holds still while the size changes. */
const SPOTS: [number, number][] = [
  [14, 18],
  [38, 10],
  [62, 20],
  [86, 12],
  [24, 42],
  [50, 36],
  [76, 44],
  [100, 38],
  [12, 64],
  [40, 62],
  [66, 66],
  [92, 60],
];

/** A repeatable stand-in for random, so each ground keeps its own shape between renders. */
function noise(i: number, k: number): number {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Each ground is a small, lumpy shard: five to seven corners at uneven angles
 * and distances, turned a different way, rather than a neat dot. Drawn at unit
 * size and scaled, so growing the grind is a transform the browser can animate.
 */
const GROUNDS = SPOTS.map(([x, y], i) => {
  const corners = 5 + (i % 3);
  const points = Array.from({ length: corners }, (_, c) => {
    const angle = ((c + (noise(i, c) - 0.5) * 0.7) / corners) * Math.PI * 2;
    const reach = 0.5 + noise(i, c + 20) * 0.7;
    return `${(Math.cos(angle) * reach).toFixed(2)},${(Math.sin(angle) * reach).toFixed(2)}`;
  }).join(' ');
  return { x, y, points, turn: Math.round(noise(i, 40) * 360) };
});

/** 150 µm of powder to 1 mm of rubble, mapped onto a shard's size. */
function sizeFor(microns: number | null): number {
  if (microns == null) return 4;
  const t = Math.min(1, Math.max(0, (microns - 150) / 850));
  return 2.5 + t * 5.5;
}

/**
 * The grind setting as a thing you can play with: a big number you can type
 * into, nudge, or slide, and a pile of grounds that gets coarser as you go.
 * Still just a number underneath, so the form needs nothing new from it.
 */
export default function GrindDial({
  grinder,
  value,
  onChange,
  microns,
  problem,
  labelledBy,
  describedBy,
}: Props) {
  const scale = grinder?.scale;
  const number = Number(value);
  const hasValue = value !== '' && Number.isFinite(number);

  function nudge(dir: 1 | -1) {
    if (!grinder || !scale) return;
    const from = hasValue ? number : (scale.min + scale.max) / 2;
    const next = hasValue ? from + dir * scale.step : from;
    onChange(String(snapToScale(grinder, next)));
  }

  // Which way is finer depends on the grinder: most count up to coarser, some don't.
  const finerAtMin = (grinder?.calibration.umPerUnit ?? 1) >= 0;
  const ends = finerAtMin ? (['Finer', 'Coarser'] as const) : (['Coarser', 'Finer'] as const);

  return (
    <div className={`grind-dial${problem ? ' bad' : ''}`}>
      <div className="grind-dial-top">
        {scale ? (
          <button
            type="button"
            className="grind-dial-step"
            aria-label="Lower the setting"
            onClick={() => nudge(-1)}
          >
            <Minus aria-hidden="true" />
          </button>
        ) : null}
        <input
          className="simple-number grind-dial-number"
          type="number"
          inputMode="decimal"
          placeholder="—"
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          aria-invalid={problem ? true : undefined}
          step={scale?.kind === 'stepless' ? 'any' : (scale?.step ?? 1)}
          min={scale?.min}
          max={scale?.max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {scale ? (
          <button
            type="button"
            className="grind-dial-step"
            aria-label="Raise the setting"
            onClick={() => nudge(1)}
          >
            <Plus aria-hidden="true" />
          </button>
        ) : null}
        <svg className="grind-dial-grounds" viewBox="0 0 112 76" aria-hidden="true">
          {GROUNDS.map((g, i) => (
            <polygon
              key={i}
              points={g.points}
              style={{
                transform: `translate(${g.x}px, ${g.y}px) rotate(${g.turn}deg) scale(${sizeFor(microns)})`,
              }}
            />
          ))}
        </svg>
      </div>

      {scale ? (
        <div className="grind-dial-slider">
          <input
            type="range"
            aria-label={`Slide between ${ends[0].toLowerCase()} and ${ends[1].toLowerCase()}`}
            min={scale.min}
            max={scale.max}
            step={scale.step}
            value={hasValue ? Math.min(scale.max, Math.max(scale.min, number)) : scale.min}
            className={hasValue ? undefined : 'idle'}
            onChange={(e) => onChange(e.target.value)}
          />
          <div className="grind-dial-ends" aria-hidden="true">
            <span>{ends[0]}</span>
            <span>{ends[1]}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
