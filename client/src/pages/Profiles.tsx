import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import {
  STOCK_PROFILES,
  totalDurationS,
  yieldG,
  type BrewProfileRecord,
  type Coffee,
} from '@brewlab/shared';
import { api, useApi } from '../lib/api';
import { useAi } from '../lib/ai';
import { useSuggestProfile } from '../lib/suggestProfile';
import { Banner, Empty, Modal, Working, useElapsed } from '../components/ui';
import { ProfileCurve } from '../components/charts';
import { tempF } from '../lib/format';

const ORIGIN_TAG: Partial<Record<BrewProfileRecord['origin'], { cls: string; label: string }>> = {
  factory: { cls: '', label: "from Fellow's own" },
  drop: { cls: 'cool', label: 'from a Drop' },
  custom: { cls: 'accent', label: 'on your machine' },
};

const SYNC_TAG: Record<BrewProfileRecord['syncState'], { cls: string; label: string }> = {
  local: { cls: '', label: 'not sent' },
  pushed: { cls: 'good', label: 'on the machine' },
  stale: { cls: 'bad', label: 'edited since sending' },
};

export default function Profiles() {
  const profiles = useApi<BrewProfileRecord[]>('/profiles');
  const navigate = useNavigate();
  const [picking, setPicking] = useState(false);
  // Only fetched once the picker opens: most visits here never start a profile.
  const coffees = useApi<Coffee[]>(picking ? '/coffees' : null, [picking]);
  const ai = useAi();
  const { suggest, suggesting, error: suggestError } = useSuggestProfile();
  const designingFor = useElapsed(suggesting != null);

  async function createFromStock(name: string) {
    const stock = STOCK_PROFILES.find((p) => p.name === name)!;
    const created = await api<BrewProfileRecord>('/profiles', {
      method: 'POST',
      body: {
        name: stock.name,
        description: stock.description,
        isPublic: false,
        profile: { ...stock, id: 'pending' },
      },
    });
    navigate(`/profiles/${created.id}`);
  }

  async function remove(p: BrewProfileRecord) {
    await api(`/profiles/${p.id}`, { method: 'DELETE' });
    void profiles.reload();
  }

  return (
    <>
      <div className="page-head spread">
        <div>
          <h1>Brew profiles</h1>
          <p>
            Shots the ES1 runs as timed phases: each one targets a pressure and the machine
            modulates flow to hold it. Build one here, then send it to your Fellow account.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setPicking(true)}>
          New profile
        </button>
      </div>

      {profiles.data?.length ? (
        <div className="grid grid-2">
          {profiles.data.map((p) => (
            <div key={p.id} className="card">
              <div className="spread align-start mb-2">
                <div>
                  <Link className="item-title" to={`/profiles/${p.id}`}>
                    {p.name}
                  </Link>
                  {p.description ? <div className="small dim">{p.description}</div> : null}
                </div>
                <button
                  className="btn btn-ghost btn-icon"
                  onClick={() => remove(p)}
                  aria-label={`Delete ${p.name}`}
                  title="Delete"
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </div>

              <ProfileCurve profile={p.profile} height={150} />

              <div className="row-wrap small mt-2">
                <span className="tag mono">{tempF(p.profile.brewTempC)}</span>
                <span className="tag mono">
                  {p.profile.doseG} → {yieldG(p.profile)} g
                </span>
                <span className="tag mono">{totalDurationS(p.profile)}s</span>
                <span className="tag">{p.profile.stages.length} stages</span>
                <span className={`tag ${SYNC_TAG[p.syncState].cls}`}>
                  {SYNC_TAG[p.syncState].label}
                </span>
                {ORIGIN_TAG[p.origin] ? (
                  <span className={`tag ${ORIGIN_TAG[p.origin]!.cls}`}>
                    {ORIGIN_TAG[p.origin]!.label}
                  </span>
                ) : null}
                {p.isPublic ? <span className="tag crema">shared</span> : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty title="No profiles yet">
          Start from one of Fellow's factory profiles, or have one designed for a coffee you've
          added.
        </Empty>
      )}

      {picking ? (
        <Modal title="Start from" onClose={() => setPicking(false)} wide>
          <h3 className="mb-2">Designed for a coffee</h3>
          {!ai.enabled ? (
            <p className="small faint mt-1 mb-4">{ai.reason}</p>
          ) : coffees.data && !coffees.data.length ? (
            <p className="small dim mt-1 mb-4">
              <Link className="link" to="/coffees">
                Add a coffee
              </Link>{' '}
              and a profile can be designed around its origin, process and roast.
            </p>
          ) : coffees.data ? (
            <>
              {suggestError ? (
                <div className="mb-2">
                  <Banner kind="bad">{suggestError}</Banner>
                </div>
              ) : null}
              <div className="grid grid-2 mb-5">
                {coffees.data.map((c) => (
                  <button
                    key={c.id}
                    className="list-item"
                    onClick={() => suggest(c.id)}
                    disabled={suggesting != null}
                    aria-busy={suggesting === c.id}
                  >
                    <div className="spread">
                      <span className="item-title">{c.name}</span>
                      {suggesting === c.id ? (
                        <Working label="Designing" seconds={designingFor} />
                      ) : null}
                    </div>
                    <div className="small dim mt-1">{c.roaster}</div>
                    <div className="row-wrap small mt-2">
                      {c.roastLevel ? <span className="tag">{c.roastLevel}</span> : null}
                      {c.process ? <span className="tag cool">{c.process}</span> : null}
                      {c.origin ? <span className="tag">{c.origin}</span> : null}
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="small faint mt-1 mb-4">Loading your coffees…</p>
          )}

          <h3 className="mb-2">Blank or factory</h3>
          <div className="grid grid-2">
            <button className="list-item" onClick={() => navigate('/profiles/new')}>
              <div className="item-title">Blank profile</div>
              <div className="small dim">
                Pre-infusion, infusion, ramp down — then change everything.
              </div>
            </button>
            {STOCK_PROFILES.map((s) => (
              <button key={s.name} className="list-item" onClick={() => createFromStock(s.name)}>
                <div className="spread">
                  <span className="item-title">{s.name}</span>
                  <span className="tag mono">{tempF(s.brewTempC)}</span>
                </div>
                <div className="small dim mt-1">{s.description}</div>
                <div className="row-wrap small mt-2">
                  <span className="tag mono">1:{s.ratio}</span>
                  <span className="tag mono">{totalDurationS(s)}s</span>
                  <span className="tag">{s.stages.length} stages</span>
                </div>
              </button>
            ))}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
