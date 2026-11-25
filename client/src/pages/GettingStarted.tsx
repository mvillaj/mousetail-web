import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import {
  BUILT_IN_GRINDERS,
  GRINDERS_BY_ID,
  MACHINES_BY_ID,
  RECOMMENDATIONS_AS_OF,
  RECOMMENDATIONS_BY_ID,
  RECOMMENDED_GRINDERS,
  RECOMMENDED_MACHINES,
  priceTier,
  sortByPrice,
  specToUserGrinder,
  specToUserMachine,
  type BrewProfileRecord,
  type Coffee,
  type Grinder,
  type Recommendation,
} from '@brewlab/shared';
import { api, useApi } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useMachines } from '../lib/machines';
import { BASICS, FIRST_SHOT, NO_GRINDER_NOTE, STARTER } from '../lib/onboarding-content';
import { Banner, Field, Segmented } from '../components/ui';
import ShotForm from '../components/ShotForm';
import ShotGlass from '../components/ShotGlass';

type Step = 'welcome' | 'basics' | 'gear' | 'shop' | 'shot';
const STEPS: Step[] = ['welcome', 'basics', 'gear', 'shop', 'shot'];

const usd = (n: number) => `~$${n.toLocaleString('en-US')}`;
const recName = (r: Recommendation) => `${r.brand} ${r.model}`;
const asOf = new Date(`${RECOMMENDATIONS_AS_OF}-01T12:00:00Z`).toLocaleDateString('en-US', {
  month: 'long',
  year: 'numeric',
});

/** Puts a catalogue grinder on the bench as the default. */
async function addGrinder(builtInId: string) {
  const spec = GRINDERS_BY_ID[builtInId];
  await api('/grinders', {
    method: 'POST',
    body: {
      ...specToUserGrinder(spec),
      burrType: spec.burrType,
      notes: spec.notes ?? null,
      isDefault: true,
    },
  });
}

/**
 * First run. Asks two questions -- have you made espresso, do you own a machine
 * -- and only shows what the answers call for: the basics for a beginner, a
 * price-sorted shopping guide for someone with no machine, then a walk through
 * the first shot that ends in the real shot form.
 *
 * The step lives in the URL so Back and refresh behave. Every step can be
 * skipped; finishing or skipping is what stops the first-run redirect.
 */
export default function GettingStarted() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { markOnboarded } = useAuth();
  const { machines } = useMachines();
  const step = (
    STEPS.includes(params.get('step') as Step) ? params.get('step') : 'welcome'
  ) as Step;
  const isNew = params.get('new') === '1';

  function go(next: Step, opts: { isNew?: boolean } = {}) {
    const p = new URLSearchParams({ step: next });
    if (opts.isNew ?? isNew) p.set('new', '1');
    setParams(p);
    window.scrollTo?.({ top: 0 });
  }

  async function finish(state?: unknown) {
    await markOnboarded();
    navigate('/', { state });
  }

  // The path differs by answer, so count only the steps this user will see.
  const path: Step[] = ['welcome', ...(isNew ? (['basics'] as Step[]) : []), 'gear', 'shot'];
  const position = Math.max(1, path.indexOf(step === 'shop' ? 'gear' : step) + 1);

  return (
    <div className="wizard">
      <div className="wizard-top">
        <span className="faint small" aria-live="polite">
          Step {position} of {path.length}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={() => void finish()}>
          Skip for now
        </button>
      </div>

      {step === 'welcome' ? (
        <Welcome onAnswer={(fresh) => go(fresh ? 'basics' : 'gear', { isNew: fresh })} />
      ) : null}
      {step === 'basics' ? <Basics onBack={() => go('welcome')} onNext={() => go('gear')} /> : null}
      {step === 'gear' ? (
        <Gear
          hasMachine={machines.length > 0}
          onBack={() => go(isNew ? 'basics' : 'welcome')}
          onShop={() => go('shop')}
          onReady={() => go('shot')}
        />
      ) : null}
      {step === 'shop' ? (
        <Shop onBack={() => go('gear')} onNext={() => go('shot')} onFinish={() => void finish()} />
      ) : null}
      {step === 'shot' ? (
        <FirstShot
          hasMachine={machines.length > 0}
          onBack={() => go('gear')}
          onFinish={(saved) => void finish(saved ? { saved } : undefined)}
        />
      ) : null}
    </div>
  );
}

function Welcome({ onAnswer }: { onAnswer: (isNew: boolean) => void }) {
  return (
    <section className="stack">
      <div className="page-head">
        <h1>Let's get you pulling shots</h1>
        <p>
          Two quick questions, then we'll set up your bench and walk you through your first
          espresso.
        </p>
      </div>
      <h2>Have you made espresso before?</h2>
      <div className="choices">
        <button className="choice" onClick={() => onAnswer(true)}>
          <strong>I'm new to it</strong>
          <span>Show me the basics first.</span>
        </button>
        <button className="choice" onClick={() => onAnswer(false)}>
          <strong>I've pulled shots</strong>
          <span>Skip to setting up my gear.</span>
        </button>
      </div>
    </section>
  );
}

function Basics({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <section className="stack">
      <div className="page-head">
        <h1>Espresso in four ideas</h1>
        <p>Everything else is detail. The app's coach works from exactly these.</p>
      </div>
      <div className="basics-hero card">
        {/* Decorative: the recipe beside it gives the grams the cup can't show. */}
        <ShotGlass yieldG={STARTER.yieldG} taste={0} width={72} />
        <div>
          <div className="basics-recipe mono">
            {STARTER.doseG} g → {STARTER.yieldG} g · {STARTER.timeS} s
          </div>
          <p className="dim small mb-0">A good first recipe for almost any coffee.</p>
        </div>
      </div>
      <ol className="lessons">
        {BASICS.map((l) => (
          <li className="card" key={l.id}>
            <h3>{l.title}</h3>
            <p className="dim">{l.body}</p>
            {l.facts ? (
              <div className="row-wrap tight">
                {l.facts.map((f) => (
                  <span className="tag" key={f}>
                    {f}
                  </span>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      <WizardNav
        onBack={onBack}
        next={
          <button className="btn btn-primary" onClick={onNext}>
            Got it <ArrowRight aria-hidden="true" />
          </button>
        }
      />
    </section>
  );
}

function Gear({
  hasMachine,
  onBack,
  onShop,
  onReady,
}: {
  hasMachine: boolean;
  onBack: () => void;
  onShop: () => void;
  onReady: () => void;
}) {
  const { machines } = useMachines();
  const [answer, setAnswer] = useState<'yes' | null>(null);

  if (hasMachine) {
    return (
      <section className="stack">
        <div className="page-head">
          <h1>You're set up</h1>
          <p>
            Your bench has {machines.map((m) => m.name).join(', ')}. You can change it any time
            under Machines and Grinders.
          </p>
        </div>
        <WizardNav
          onBack={onBack}
          next={
            <div className="row-wrap">
              <button className="btn" onClick={onShop}>
                Browse the buying guide
              </button>
              <button className="btn btn-primary" onClick={onReady}>
                Continue <ArrowRight aria-hidden="true" />
              </button>
            </div>
          }
        />
      </section>
    );
  }

  return (
    <section className="stack">
      <div className="page-head">
        <h1>Do you have an espresso machine?</h1>
        <p>
          If you do, we'll put it on your bench so the shot log knows its temperature range and
          features.
        </p>
      </div>
      {answer === 'yes' ? (
        <BenchForm onSaved={onReady} onCancel={() => setAnswer(null)} />
      ) : (
        <>
          <div className="choices">
            <button className="choice" onClick={() => setAnswer('yes')}>
              <strong>Yes, I have one</strong>
              <span>Add it and my grinder.</span>
            </button>
            <button className="choice" onClick={onShop}>
              <strong>Not yet</strong>
              <span>Help me choose a machine and grinder.</span>
            </button>
          </div>
          <WizardNav onBack={onBack} />
        </>
      )}
    </section>
  );
}

const OTHER_MACHINE = 'other';
const NO_GRINDER = 'none';

function BenchForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const { reload } = useMachines();
  const grinders = useApi<Grinder[]>('/grinders');
  const machineOptions = sortByPrice(RECOMMENDED_MACHINES, 'asc');
  const [machineId, setMachineId] = useState(machineOptions[0].id);
  const [otherName, setOtherName] = useState('');
  const [grinderId, setGrinderId] = useState(BUILT_IN_GRINDERS[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasGrinder = (grinders.data?.length ?? 0) > 0;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const rec = RECOMMENDATIONS_BY_ID[machineId];
      const spec = MACHINES_BY_ID[rec?.builtInId ?? 'generic-espresso'];
      const base = specToUserMachine(spec);
      // Only the ES1 has a spec of its own; anything else is the generic
      // machine under the name the user knows it by.
      const name = rec ? recName(rec) : otherName.trim() || 'My espresso machine';
      await api('/machines', {
        method: 'POST',
        body: {
          ...base,
          name: spec.id === 'generic-espresso' ? name : base.name,
          notes: spec.notes ?? null,
          isDefault: true,
        },
      });
      if (!hasGrinder && grinderId !== NO_GRINDER) await addGrinder(grinderId);
      await reload();
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={save}>
      <Field label="Machine">
        <select value={machineId} onChange={(e) => setMachineId(e.target.value)}>
          {machineOptions.map((r) => (
            <option key={r.id} value={r.id}>
              {recName(r)}
            </option>
          ))}
          <option value={OTHER_MACHINE}>Something else</option>
        </select>
      </Field>
      {machineId === OTHER_MACHINE ? (
        <Field label="What is it called?" hint="Everything in the logbook works with any machine.">
          <input
            value={otherName}
            onChange={(e) => setOtherName(e.target.value)}
            placeholder="My espresso machine"
            maxLength={80}
          />
        </Field>
      ) : null}
      {hasGrinder ? null : (
        <>
          <Field label="Grinder">
            <select value={grinderId} onChange={(e) => setGrinderId(e.target.value)}>
              {BUILT_IN_GRINDERS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.brand} {g.model}
                </option>
              ))}
              <option value={NO_GRINDER}>No grinder yet / pre-ground</option>
            </select>
          </Field>
          {grinderId === NO_GRINDER ? <Banner>{NO_GRINDER_NOTE}</Banner> : null}
        </>
      )}
      {error ? <Banner kind="bad">{error}</Banner> : null}
      <div className="spread">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          <ArrowLeft aria-hidden="true" /> Back
        </button>
        <button className="btn btn-primary" disabled={busy || grinders.data == null}>
          Add to my bench
        </button>
      </div>
    </form>
  );
}

function Shop({
  onBack,
  onNext,
  onFinish,
}: {
  onBack: () => void;
  onNext: () => void;
  onFinish: () => void;
}) {
  const { machines } = useMachines();
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function own(r: Recommendation) {
    setError(null);
    try {
      await addGrinder(r.builtInId!);
      setAdded((s) => new Set(s).add(r.id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="stack">
      <div className="page-head">
        <h1>Choosing your first setup</h1>
        <p>
          Budget for the grinder as seriously as the machine: espresso needs a fine, even grind, and
          a great machine can't fix a grinder that can't get there.
        </p>
      </div>

      <div className="spread">
        <span className="faint small">Sort by price</span>
        <Segmented
          options={[
            { value: 'asc', label: 'Low to high' },
            { value: 'desc', label: 'High to low' },
          ]}
          value={dir}
          onChange={setDir}
        />
      </div>

      <RecList title="Machines" items={sortByPrice(RECOMMENDED_MACHINES, dir)} />
      <RecList
        title="Grinders"
        items={sortByPrice(RECOMMENDED_GRINDERS, dir)}
        action={(r) =>
          added.has(r.id) ? (
            <span className="tag good">
              <Check aria-hidden="true" /> On your bench
            </span>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={() => void own(r)}>
              I have this
            </button>
          )
        }
      />
      {error ? <Banner kind="bad">{error}</Banner> : null}

      <p className="faint small">
        Prices are approximate US street prices as of {asOf} and change often. This is a starting
        list, not a ranking, and nobody paid to be on it.
      </p>

      {machines.length ? null : (
        <div className="card stack-sm">
          <h3>Come back when it arrives</h3>
          <p className="dim small mb-0">
            Add your machine under Machines once it's here. Meanwhile, you can read how a first shot
            goes.
          </p>
        </div>
      )}
      <WizardNav
        onBack={onBack}
        next={
          <div className="row-wrap">
            <button className="btn" onClick={onFinish}>
              Finish for now
            </button>
            <button className="btn btn-primary" onClick={onNext}>
              How a first shot goes <ArrowRight aria-hidden="true" />
            </button>
          </div>
        }
      />
    </section>
  );
}

function RecList({
  title,
  items,
  action,
}: {
  title: string;
  items: Recommendation[];
  action?: (r: Recommendation) => React.ReactNode;
}) {
  return (
    <section className="card" aria-label={title}>
      <div className="card-head">
        <h2>{title}</h2>
      </div>
      <ul className="rec-list">
        {items.map((r) => (
          <li key={r.id} className="rec">
            <div className="rec-main">
              <div className="row-wrap tight">
                <h3>{recName(r)}</h3>
                <span className="tag mono" title="Price band">
                  {priceTier(r)}
                </span>
              </div>
              <p className="dim small">{r.why}</p>
              {r.pairsWith?.length ? (
                <p className="faint small">
                  Pairs with{' '}
                  {r.pairsWith.map((id) => recName(RECOMMENDATIONS_BY_ID[id])).join(' or ')}
                </p>
              ) : null}
            </div>
            <div className="rec-side">
              <span className="rec-price mono">{usd(r.priceUsd)}</span>
              {action?.(r)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FirstShot({
  hasMachine,
  onBack,
  onFinish,
}: {
  hasMachine: boolean;
  onBack: () => void;
  onFinish: (saved?: unknown) => void;
}) {
  const [logging, setLogging] = useState(false);
  const coffees = useApi<Coffee[]>(hasMachine ? '/coffees' : null);
  const grinders = useApi<Grinder[]>(hasMachine ? '/grinders' : null);
  const profiles = useApi<BrewProfileRecord[]>(hasMachine ? '/profiles' : null);

  return (
    <section className="stack">
      <div className="page-head">
        <h1>Your first shot</h1>
        <p>
          {hasMachine
            ? "Follow along at the machine, then log what happened. Don't worry if it isn't good: the first shot is a measurement."
            : 'Here is how it goes once your machine arrives.'}
        </p>
      </div>
      <ol className="walkthrough">
        {FIRST_SHOT.map((s, i) => (
          <li key={s.title}>
            <span className="walkthrough-n mono" aria-hidden="true">
              {i + 1}
            </span>
            <div>
              <h3>{s.title}</h3>
              <p className="dim small mb-0">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      {hasMachine && logging ? (
        <section className="card" aria-label="Log your first shot">
          <div className="card-head">
            <h2>Log it</h2>
          </div>
          <ShotForm
            coffees={coffees.data ?? []}
            grinders={grinders.data ?? []}
            profiles={profiles.data ?? []}
            onSaved={(shot, suggestion) => onFinish({ shot, suggestion })}
          />
        </section>
      ) : null}

      <WizardNav
        onBack={onBack}
        next={
          hasMachine ? (
            logging ? (
              <button className="btn" onClick={() => onFinish()}>
                I'll log it later
              </button>
            ) : (
              <div className="row-wrap">
                <button className="btn" onClick={() => onFinish()}>
                  I'll log it later
                </button>
                <button className="btn btn-primary" onClick={() => setLogging(true)}>
                  I pulled it, log it
                </button>
              </div>
            )
          ) : (
            <button className="btn btn-primary" onClick={() => onFinish()}>
              Finish
            </button>
          )
        }
      />
    </section>
  );
}

function WizardNav({ onBack, next }: { onBack: () => void; next?: React.ReactNode }) {
  return (
    <div className="wizard-nav">
      <button className="btn btn-ghost" onClick={onBack}>
        <ArrowLeft aria-hidden="true" /> Back
      </button>
      {next}
    </div>
  );
}
