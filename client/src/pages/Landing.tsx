import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, RotateCcw } from 'lucide-react';
import {
  STOCK_PROFILES,
  suggestNextShot,
  totalDurationS,
  type Es1Profile,
  type Es1Stage,
  type StageKind,
} from '@brewlab/shared';
import BrandLockup from '../components/BrandLockup';
import ShotGlass, { tasteLabel } from '../components/ShotGlass';
import { ProfileCurve, STAGE_COLOUR } from '../components/charts';
import { baristaLine, CONFIDENCE_LABEL } from '../lib/coach';
import { pressureEaser, smoothPressurePaths } from '../lib/curve';
import pour640 from '../assets/hero/pour-640.jpg';
import pour1080 from '../assets/hero/pour-1080.jpg';
import pour1600 from '../assets/hero/pour-1600.jpg';
import pour2000 from '../assets/hero/pour-2000.jpg';
import pour640Webp from '../assets/hero/pour-640.webp';
import pour1080Webp from '../assets/hero/pour-1080.webp';
import pour1600Webp from '../assets/hero/pour-1600.webp';
import pour2000Webp from '../assets/hero/pour-2000.webp';
import '../styles/landing.css';

/**
 * The public front door. It opens on a photograph of a pour and nothing else
 * but the headline and one press; the page then slides up over it as one shot:
 * a real factory profile pulls across the full width and pours into a glass,
 * and its stages carry the story below. Every demo runs the app's own shared code on sample inputs,
 * so what a visitor plays with here is what the app will tell them at the bench.
 */

const HERO = STOCK_PROFILES.find((p) => p.name === 'Modern Arc') ?? STOCK_PROFILES[0];
const HERO_TOTAL = totalDurationS(HERO);
const HERO_YIELD = HERO.doseG * HERO.ratio;
const HERO_BAR = pressureEaser(HERO);
/** Machine seconds to wall-clock milliseconds: a 35 s shot plays in about 5 s. */
const MS_PER_SECOND = 140;

const STAGE_NAME: Record<StageKind, string> = {
  preinfusion: 'Pre-infusion',
  infusion: 'Infusion',
  rampdown: 'Ramp down',
};
const STAGE_ANCHOR: Record<StageKind, string> = {
  preinfusion: 'log',
  infusion: 'coach',
  rampdown: 'profiles',
};

interface Band {
  stage: Es1Stage;
  from: number;
  to: number;
}

function bandsOf(profile: Pick<Es1Profile, 'stages'>): Band[] {
  let cursor = 0;
  return profile.stages.map((stage) => {
    const band = { stage, from: cursor, to: cursor + stage.durationS };
    cursor += stage.durationS;
    return band;
  });
}

const HERO_BANDS = bandsOf(HERO);
const END_BAR = HERO.stages[HERO.stages.length - 1].endPressureBar;

function bandAt(t: number) {
  return HERO_BANDS.find((b) => t <= b.to) ?? HERO_BANDS[HERO_BANDS.length - 1];
}

/**
 * How full the glass is at t, for the hero's pour. The profile sets pressure,
 * not flow, so this is an illustration: the cup fills in step with the pressure
 * pushed through the puck, which keeps pre-infusion to a drip.
 */
const POUR = (() => {
  const n = 400;
  const cum = [0];
  for (let i = 1; i <= n; i++) cum.push(cum[i - 1] + HERO_BAR((i / n) * HERO_TOTAL));
  return (t: number) => cum[Math.round(Math.min(1, Math.max(0, t / HERO_TOTAL)) * n)] / cum[n];
})();

/** Line and area paths for a profile inside a w×h box, 9 bar at `topY`. */
function curvePaths(profile: Pick<Es1Profile, 'stages'>, w: number, h: number, topY: number) {
  const total = Math.max(1, totalDurationS(profile));
  const x = (t: number) => (t / total) * w;
  const y = (bar: number) => h - ((h - topY) * bar) / 9;
  return { ...smoothPressurePaths(profile, x, y), x, y };
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/* ── Hero: the pull ────────────────────────────────────────────────────────── */

const VB_W = 1000;
const VB_H = 400;
const VB_TOP = 132;

function HeroPull() {
  const clip = useRef<SVGRectElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const readout = useRef<HTMLDivElement>(null);
  const glass = useRef<HTMLDivElement>(null);
  const barText = useRef<HTMLSpanElement>(null);
  const timeText = useRef<HTMLSpanElement>(null);
  const flowText = useRef<HTMLSpanElement>(null);
  const stageText = useRef<HTMLSpanElement>(null);
  const stageDot = useRef<HTMLElement>(null);
  const figure = useRef<HTMLElement>(null);
  const [run, setRun] = useState(0);
  const [done, setDone] = useState(false);
  const [inView, setInView] = useState(false);

  const { line, area, y } = useMemo(() => curvePaths(HERO, VB_W, VB_H, VB_TOP), []);

  // The pull sits below the photo, so it waits to be seen before the pump starts.
  useEffect(() => {
    const el = figure.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    // Written straight to the DOM: one React render per frame would be a lot of
    // reconciling for a line, a dot, a glass and three numbers.
    const liquid = glass.current?.querySelector<SVGGElement>('.liquid-group');
    const paint = (p: number) => {
      const t = p * HERO_TOTAL;
      const bar = HERO_BAR(t);
      const { stage } = bandAt(t);
      const pct = `${(p * 100).toFixed(3)}%`;
      clip.current?.setAttribute('width', String(p * VB_W));
      if (head.current) head.current.style.left = pct;
      if (dot.current) {
        dot.current.style.left = pct;
        dot.current.style.top = `${((y(bar) / VB_H) * 100).toFixed(3)}%`;
        dot.current.style.background = STAGE_COLOUR[stage.kind];
      }
      if (readout.current) {
        // Half the card's own width, so it never hangs off either end of the track.
        const half = Math.ceil(readout.current.offsetWidth / 2) + 8;
        readout.current.style.left = `clamp(${half}px, ${pct}, calc(100% - ${half}px))`;
      }
      if (liquid) liquid.style.transform = `scaleY(${POUR(t).toFixed(4)})`;
      if (barText.current) barText.current.textContent = bar.toFixed(1);
      if (timeText.current) timeText.current.textContent = t.toFixed(1);
      if (flowText.current) flowText.current.textContent = stage.flowLimitMlS.toFixed(1);
      if (stageText.current) stageText.current.textContent = STAGE_NAME[stage.kind];
      if (stageDot.current) stageDot.current.style.background = STAGE_COLOUR[stage.kind];
    };

    if (prefersReducedMotion()) {
      paint(1);
      setDone(true);
      return;
    }

    setDone(false);
    if (!inView) {
      paint(0);
      return;
    }
    let frame = 0;
    let start = 0;
    const duration = HERO_TOTAL * MS_PER_SECOND;
    const tick = (now: number) => {
      if (!start) start = now;
      const p = Math.min(1, (now - start) / duration);
      paint(p);
      if (p < 1) frame = requestAnimationFrame(tick);
      else setDone(true);
    };
    paint(0);
    // A beat before the pump starts, so the empty profile reads first.
    const delay = window.setTimeout(() => (frame = requestAnimationFrame(tick)), run ? 150 : 450);
    return () => {
      window.clearTimeout(delay);
      cancelAnimationFrame(frame);
    };
  }, [run, y, inView]);

  return (
    <figure
      ref={figure}
      className="pull"
      aria-label={`${HERO.name}: ${HERO.stages.map((s) => STAGE_NAME[s.kind]).join(', then ')}, over ${HERO_TOTAL} seconds, ${HERO_YIELD} g out`}
    >
      <div className={done ? 'pull-plot done' : 'pull-plot'}>
        <div className="pull-track">
          <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient
                id="pull-fill"
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1={VB_TOP}
                x2="0"
                y2={VB_H}
              >
                <stop
                  offset="0%"
                  stopColor="var(--chart-pressure)"
                  stopOpacity="var(--chart-area-opacity)"
                />
                <stop offset="100%" stopColor="var(--chart-pressure)" stopOpacity="0" />
              </linearGradient>
              {/* The shot's tail past the last reading fades out across the gutter, so
                  the fill leaves the page instead of stopping in a hard edge. */}
              <linearGradient
                id="pull-tail-fade"
                gradientUnits="userSpaceOnUse"
                x1={VB_W}
                y1="0"
                x2={VB_W * 1.035}
                y2="0"
              >
                <stop offset="0%" stopColor="#fff" />
                <stop offset="100%" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
              <mask
                id="pull-tail-mask"
                maskUnits="userSpaceOnUse"
                x={VB_W}
                y="0"
                width={VB_W}
                height={VB_H}
              >
                <rect x={VB_W} y="0" width={VB_W} height={VB_H} fill="url(#pull-tail-fade)" />
              </mask>
              <clipPath id="pull-clip">
                <rect ref={clip} x="0" y="0" width="0" height={VB_H} />
              </clipPath>
            </defs>
            {HERO_BANDS.map((b, i) => (
              <rect
                className="chart-band"
                key={b.stage.id}
                x={(b.from / HERO_TOTAL) * VB_W}
                y="0"
                // The last band runs on past the track to the viewport edge, so the
                // shot ends inside its stage rather than against a bare column.
                width={
                  ((b.to - b.from) / HERO_TOTAL) * VB_W + (i === HERO_BANDS.length - 1 ? VB_W : 0)
                }
                height={VB_H}
                fill={STAGE_COLOUR[b.stage.kind]}
              />
            ))}
            {[3, 6, 9].map((bar) => (
              <line
                key={bar}
                className="pull-grid"
                x1="0"
                x2={VB_W * 2}
                y1={y(bar)}
                y2={y(bar)}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <path d={line} className="pull-ghost" vectorEffect="non-scaling-stroke" />
            <g className="pull-tail" mask="url(#pull-tail-mask)">
              <path
                d={`M${VB_W},${y(END_BAR)} L${VB_W * 2},${y(END_BAR)} L${VB_W * 2},${VB_H} L${VB_W},${VB_H} Z`}
                fill="url(#pull-fill)"
              />
              <path
                d={`M${VB_W},${y(END_BAR)} L${VB_W * 2},${y(END_BAR)}`}
                className="pull-ghost"
                vectorEffect="non-scaling-stroke"
              />
            </g>
            <g clipPath="url(#pull-clip)">
              <path d={area} fill="url(#pull-fill)" />
              <path d={line} className="pull-line" vectorEffect="non-scaling-stroke" />
            </g>
          </svg>

          {[3, 6, 9].map((bar) => (
            <span key={bar} className="pull-axis" style={{ top: `${(y(bar) / VB_H) * 100}%` }}>
              <span className="mono">{bar}</span>
              {bar === 9 ? ' bar' : null}
            </span>
          ))}

          <div ref={head} className="pull-head" aria-hidden="true" />
          <div ref={dot} className="pull-dot" aria-hidden="true" />
          <div ref={readout} className="pull-readout" aria-hidden="true">
            <div ref={glass} className="pull-glass">
              <ShotGlass yieldG={HERO_YIELD} taste={0} width={40} />
            </div>
            <div className="pull-figures">
              <div className="pull-readings">
                <span className="pull-reading">
                  <span ref={barText} className="mono">
                    0.0
                  </span>{' '}
                  bar
                </span>
                <span className="pull-reading">
                  <span ref={timeText} className="mono">
                    0.0
                  </span>{' '}
                  s
                </span>
                {/* The profile carries a flow ceiling, not a measured flow, so it is labelled as one. */}
                <span className="pull-reading" title="Flow limit for this stage">
                  <span ref={flowText} className="mono">
                    {HERO.stages[0].flowLimitMlS.toFixed(1)}
                  </span>{' '}
                  ml/s max
                </span>
              </div>
              <span className="pull-stage">
                {done ? (
                  <>
                    <span className="mono">{HERO_YIELD}</span> g out, balanced
                  </>
                ) : (
                  <>
                    <i ref={stageDot} style={{ background: STAGE_COLOUR[HERO.stages[0].kind] }} />
                    <span ref={stageText}>{STAGE_NAME[HERO.stages[0].kind]}</span>
                  </>
                )}
              </span>
            </div>
          </div>

          <nav className="pull-stages" aria-label="What Mousetail does">
            {HERO_BANDS.map((b, i) => (
              <a
                key={b.stage.id}
                href={`#${STAGE_ANCHOR[b.stage.kind]}`}
                className={i === HERO_BANDS.length - 1 && i > 0 ? 'last' : undefined}
                style={
                  i === HERO_BANDS.length - 1 && i > 0
                    ? { right: 0 }
                    : { left: `${(b.from / HERO_TOTAL) * 100}%` }
                }
              >
                <span className="pull-stage-name">
                  <i style={{ background: STAGE_COLOUR[b.stage.kind] }} aria-hidden="true" />
                  {STAGE_NAME[b.stage.kind]}
                </span>
                <span className="pull-stage-time">
                  <span className="mono">
                    {b.from}–{b.to}
                  </span>{' '}
                  s
                </span>
              </a>
            ))}
          </nav>
        </div>
      </div>

      <figcaption className="pull-caption">
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => setRun((n) => n + 1)}
          disabled={!done}
        >
          <RotateCcw aria-hidden="true" />
          Pull it again
        </button>
        <span>
          {HERO.name}, one of Fellow’s factory profiles: <span className="mono">{HERO.doseG}</span>{' '}
          g in, <span className="mono">{HERO_YIELD}</span> g out at{' '}
          <span className="mono">{HERO.brewTempC}</span> °C.
        </span>
      </figcaption>
    </figure>
  );
}

/* ── Stage gutter: the shot, with one stage lit ────────────────────────────── */

function StageMark({ kind }: { kind: StageKind }) {
  const W = 220;
  const H = 72;
  const { line, area } = useMemo(() => curvePaths(HERO, W, H, 8), []);
  const band = HERO_BANDS.find((b) => b.stage.kind === kind)!;
  const colour = STAGE_COLOUR[kind];
  const x0 = (band.from / HERO_TOTAL) * W;
  const x1 = (band.to / HERO_TOTAL) * W;
  const id = `mark-${kind}`;
  return (
    <div className="stage-mark">
      <svg className="stage-mark-curve" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <defs>
          <clipPath id={id}>
            <rect x={x0} y="-4" width={x1 - x0} height={H + 8} />
          </clipPath>
        </defs>
        <path d={line} className="stage-mark-rest" />
        <g clipPath={`url(#${id})`}>
          <path className="chart-area" d={area} fill={colour} />
          <path d={line} className="stage-mark-lit" style={{ stroke: colour }} />
        </g>
      </svg>
      <div className="stage-mark-label">
        <span>
          <i style={{ background: colour }} aria-hidden="true" />
          {STAGE_NAME[kind]}
        </span>
        <span className="stage-mark-time">
          <span className="mono">
            {band.from}–{band.to}
          </span>{' '}
          s
        </span>
      </div>
    </div>
  );
}

/** The end of the shot: the glass it poured into. */
function YieldMark() {
  return (
    <div className="stage-mark yield-mark">
      <ShotGlass yieldG={HERO_YIELD} taste={0} width={84} />
      <div className="stage-mark-label">
        <span>End of shot</span>
        <span className="stage-mark-time">
          <span className="mono">{HERO_YIELD}</span> g out
        </span>
      </div>
    </div>
  );
}

/* ── Demo: a dial-in, as the app draws it ──────────────────────────────────── */

const SAMPLE_TARGET_S = 28;
const SAMPLE_PULLS = [
  { yieldG: 36.4, timeS: 21, taste: -2, grind: 16 },
  { yieldG: 36.0, timeS: 24, taste: -1, grind: 15 },
  { yieldG: 36.2, timeS: 26, taste: -1, grind: 14 },
  { yieldG: 36.1, timeS: 28, taste: 0, grind: 13 },
];

function DialInDemo() {
  return (
    <section className="card" aria-label="A sample dial-in">
      <div className="card-head">
        <h3>Dialing in Guji Uraga</h3>
        <span className="tag">Sample</span>
      </div>
      <div className="dialin-strip">
        {SAMPLE_PULLS.map((s, i) => {
          const prev = SAMPLE_PULLS[i - 1];
          const steps = prev ? s.grind - prev.grind : 0;
          return (
            <div key={i} className={`dialin-shot${i === SAMPLE_PULLS.length - 1 ? ' latest' : ''}`}>
              <ShotGlass
                yieldG={s.yieldG}
                taste={s.taste}
                width={52}
                label={`${s.yieldG} g, ${s.timeS} s, ${tasteLabel(s.taste).toLowerCase()}`}
              />
              <span
                className={`dialin-time${Math.abs(s.timeS - SAMPLE_TARGET_S) <= 4 ? ' on-target' : ''}`}
              >
                {s.timeS}s
              </span>
              <span className="dialin-delta">
                {prev ? (
                  <>
                    <span className="mono">{`${steps > 0 ? '+' : '−'}${Math.abs(steps)}`}</span>{' '}
                    step
                  </>
                ) : (
                  'first'
                )}
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
        <span>Height is yield · green time is on target</span>
      </div>
    </section>
  );
}

/* ── Demo: the dial-in coach ───────────────────────────────────────────────── */

const SAMPLE_DOSE = 18;
const SAMPLE_YIELD = 36;

function CoachDemo() {
  const [time, setTime] = useState(21);
  const [taste, setTaste] = useState(-2);
  const s = suggestNextShot({
    doseG: SAMPLE_DOSE,
    yieldG: SAMPLE_YIELD,
    shotTimeS: time,
    tasteBalance: taste,
  });

  return (
    <div className="coach-demo">
      <section className="card" aria-label="Your last shot">
        <div className="card-head">
          <h3>Your last shot</h3>
          <span className="tag">Sample</span>
        </div>
        <div className="demo-controls stacked">
          <div className="field">
            <label htmlFor="coach-time">
              Shot time{' '}
              <span className="demo-value">
                <span className="mono">{time}</span> s
              </span>
            </label>
            <input
              id="coach-time"
              type="range"
              min={14}
              max={44}
              step={1}
              value={time}
              onChange={(e) => setTime(Number(e.target.value))}
            />
            <div className="range-ends">
              <span>
                <span className="mono">14</span> s
              </span>
              <span>
                <span className="mono">44</span> s
              </span>
            </div>
          </div>
          <div className="field">
            <label htmlFor="coach-taste">
              It tasted <span className="demo-value">{tasteLabel(taste)}</span>
            </label>
            <input
              id="coach-taste"
              type="range"
              min={-2}
              max={2}
              step={1}
              value={taste}
              onChange={(e) => setTaste(Number(e.target.value))}
            />
            <div className="range-ends">
              <span>Sour</span>
              <span>Bitter</span>
            </div>
          </div>
        </div>
      </section>

      <section className="coach" aria-label="What to change next">
        <ShotGlass
          yieldG={SAMPLE_YIELD}
          taste={taste}
          width={92}
          className="coach-glass"
          label={`Sample shot: ${SAMPLE_YIELD} g out, ${tasteLabel(taste).toLowerCase()}`}
        />
        <div aria-live="polite">
          <p className="coach-headline">{baristaLine(s)}</p>
          <p className="coach-reason">{s.reason}</p>
          <div className="coach-meta">
            <span>
              <span className="mono">{time}</span> s
            </span>
            <span>
              <span className="mono">
                {SAMPLE_DOSE} → {SAMPLE_YIELD}
              </span>{' '}
              g
            </span>
            <span>{tasteLabel(taste)}</span>
          </div>
        </div>
        <div className="coach-actions">
          <Link to="/sign-up" className="btn btn-primary">
            Coach my own shots
            <ArrowRight aria-hidden="true" />
          </Link>
          <span className="confidence">{CONFIDENCE_LABEL[s.confidence]}</span>
        </div>
      </section>
    </div>
  );
}

/* ── Demo: a profile in the editor ─────────────────────────────────────────── */

const SAMPLE_PROFILE: Es1Profile = {
  id: 'sample',
  name: 'Slow bloom',
  doseG: 18,
  ratio: 2.2,
  brewTempC: 93,
  stages: [
    {
      id: 'a',
      kind: 'preinfusion',
      durationS: 12,
      pressureBar: 2,
      endPressureBar: 2,
      flowLimitMlS: 3,
    },
    {
      id: 'b',
      kind: 'infusion',
      durationS: 10,
      pressureBar: 9,
      endPressureBar: 9,
      flowLimitMlS: 4.5,
    },
    {
      id: 'c',
      kind: 'infusion',
      durationS: 8,
      pressureBar: 7.5,
      endPressureBar: 7.5,
      flowLimitMlS: 4.5,
    },
    {
      id: 'd',
      kind: 'rampdown',
      durationS: 6,
      pressureBar: 7.5,
      endPressureBar: 4,
      flowLimitMlS: 4.5,
    },
  ],
};

function ProfileDemo() {
  return (
    <section className="card" aria-label="A sample profile">
      <div className="card-head">
        <h3>{SAMPLE_PROFILE.name}</h3>
        <span className="tag">Sample profile</span>
      </div>
      <ProfileCurve profile={SAMPLE_PROFILE} width={380} height={190} />
      <ol className="profile-stages">
        {SAMPLE_PROFILE.stages.map((st) => (
          <li key={st.id}>
            <i style={{ background: STAGE_COLOUR[st.kind] }} aria-hidden="true" />
            <span>{STAGE_NAME[st.kind]}</span>
            <span>
              <span className="mono">{st.durationS}</span> s
            </span>
            <span>
              <span className="mono">
                {st.pressureBar === st.endPressureBar
                  ? st.pressureBar
                  : `${st.pressureBar} → ${st.endPressureBar}`}
              </span>{' '}
              bar
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

function Ctas() {
  return (
    <div className="landing-ctas">
      <Link to="/sign-up" className="btn btn-primary btn-lg">
        Create account
      </Link>
      <Link to="/sign-in" className="btn btn-lg">
        Sign in
      </Link>
    </div>
  );
}

/**
 * The first screen: the pour, a headline and one press. Everything else waits
 * below the fold, and the page slides up over the photo as you scroll.
 */
function Splash() {
  return (
    <section className="splash">
      <picture>
        <source
          type="image/webp"
          srcSet={`${pour640Webp} 640w, ${pour1080Webp} 1080w, ${pour1600Webp} 1600w, ${pour2000Webp} 2000w`}
          sizes="100vw"
        />
        <img
          className="splash-photo"
          src={pour1600}
          srcSet={`${pour640} 640w, ${pour1080} 1080w, ${pour1600} 1600w, ${pour2000} 2000w`}
          sizes="100vw"
          alt="Espresso running from a portafilter into a glass in one thin, amber stream"
          // React 18 only passes the lowercase attribute through to the DOM.
          {...{ fetchpriority: 'high' }}
        />
      </picture>
      <div className="splash-scrim" aria-hidden="true" />
      <header className="landing-bar">
        <Link to="/" aria-label="Mousetail home">
          <BrandLockup />
        </Link>
        <Link to="/sign-in" className="btn btn-ghost">
          Sign in
        </Link>
      </header>
      <div className="splash-copy">
        <h1>Bitter? Sour? Chase the mouse tail.</h1>
        <p>A shot log and dial-in coach for any espresso machine.</p>
        <div className="landing-ctas">
          <Link to="/sign-up" className="btn btn-primary btn-lg">
            Create account
          </Link>
        </div>
      </div>
      <a href="#pull" className="splash-cue">
        Watch a shot pull
        <ArrowDown aria-hidden="true" />
      </a>
    </section>
  );
}

export default function Landing() {
  return (
    <main className="landing">
      <Splash />

      <div className="landing-sheet">
        <section className="intro" id="pull">
          <div className="intro-copy">
            <h2>Every pull, as the machine runs it.</h2>
            <p className="lead">
              Mousetail keeps each shot with the setting that made it, hands back the one change to
              make next and, on a Fellow Espresso Series&nbsp;1, builds the pressure profile the
              machine runs. Here is one, from first drip to glass.
            </p>
          </div>
          <HeroPull />
        </section>

        <section className="stage" id="log">
          <StageMark kind="preinfusion" />
          <div className="stage-body">
            <h2>Every shot, logged with the setting that made it.</h2>
            <p className="lead">
              Each shot is a glass on one scale: height is yield, the crema is how it tasted. Grind
              is stored in microns too, so grinders that disagree about what “15” means share one
              axis.
            </p>
            <div className="solo-demo">
              <DialInDemo />
            </div>
          </div>
        </section>

        <section className="stage" id="coach">
          <StageMark kind="infusion" />
          <div className="stage-body">
            <h2>Then exactly one adjustment.</h2>
            <p className="lead">
              The coach reads the time and the taste and answers finer, coarser, longer, shorter, or
              hold. It’s a barista’s checklist written down, not science. Try it on this morning’s
              shot.
            </p>
            <CoachDemo />
          </div>
        </section>

        <section className="stage" id="profiles">
          <StageMark kind="rampdown" />
          <div className="stage-body">
            <h2>Profiles the machine can actually run.</h2>
            <p className="lead">
              The editor builds only what the ES1 runs, inside its limits, and checks every profile
              before it can reach the machine.
            </p>
            <div className="profile-split">
              <ProfileDemo />
              <ul className="facts">
                <li>
                  <strong>Bring your own.</strong> Import the profiles on your Fellow account, edit
                  them here, and push them back.
                </li>
                <li>
                  <strong>Never touches what isn’t yours.</strong> Factory profiles and Drops are
                  left alone, and the editor says what will happen before it happens.
                </li>
                <li>
                  <strong>Candid about the plumbing.</strong> Fellow’s API is private and
                  unofficial. If it changes, pushing breaks and says so; your log keeps working.
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="stage who" id="who">
          <YieldMark />
          <div className="stage-body">
            <h2>Who it’s for</h2>
            <p className="lead">
              Home baristas who want a record of what they pulled and a plain answer about what to
              change next. The log and coach work with any machine; ES1 owners get the profile
              studio too.
            </p>
          </div>
        </section>

        <section className="close">
          <BrandLockup />
          <p>Your next shot is the one to log.</p>
          <Ctas />
        </section>

        <footer className="landing-foot">
          Mousetail is an independent project. It is not affiliated with, endorsed by, or supported
          by Fellow Products. Fellow and Espresso Series 1 belong to their owner.
        </footer>
      </div>
    </main>
  );
}
