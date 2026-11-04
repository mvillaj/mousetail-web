import { useState } from 'react';
import { Coffee, TriangleAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  peakPressureBar,
  type Es1Profile,
  type FellowConnectionStatus,
  type FellowDevice,
  type ProfileOrigin,
} from '@brewlab/shared';
import { api, useApi } from '../lib/api';
import { Banner, Empty, Field } from '../components/ui';
import { EspressoMachineIcon } from '../components/EspressoMachineIcon';
import { fmt, tempF } from '../lib/format';

interface RemoteProfile {
  remoteId: string;
  name: string;
  origin: ProfileOrigin;
  editable: boolean;
  profile: Es1Profile;
}

const ORIGIN_TAG: Record<ProfileOrigin, { cls: string; label: string }> = {
  factory: { cls: '', label: "Fellow's own" },
  drop: { cls: 'cool', label: 'Drop' },
  custom: { cls: 'accent', label: 'Yours' },
  local: { cls: '', label: 'local' },
};

/**
 * The warning a user accepts before anything here talks to Fellow. The server
 * enforces the opt-in; this is where the user reads what they are agreeing to.
 */
export function OptInGate({ onEnabled }: { onEnabled: () => void }) {
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      await api('/fellow/opt-in', { method: 'POST', body: { accept: true } });
      onEnabled();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>Experimental: read before turning on</h2>
        <span className="tag">off</span>
      </div>
      <ul className="fellow-risks">
        <li>
          Mousetail talks to Fellow through its private API. It is not public or documented, and it
          can change or stop working at any time, without notice.
        </li>
        <li>
          Profiles you send are written to your real Espresso Series 1. A wrong or malformed profile
          can pull bad shots, make the machine behave unexpectedly, or need a reset to clear.
        </li>
        <li>
          This feature is provided as is, with no warranty. You use it at your own risk, and
          Mousetail and its developer are not responsible for any damage to your machine, your
          Fellow account or its profiles, or anything else that results from using it.
        </li>
      </ul>
      <label className="checkbox fellow-accept">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
        <span>I understand this is experimental and unofficial, and I use it at my own risk.</span>
      </label>
      {error ? (
        <div className="mt-4">
          <Banner kind="bad">{error}</Banner>
        </div>
      ) : null}
      <div className="fellow-actions">
        <button className="btn btn-primary" disabled={!accepted || busy} onClick={enable}>
          {busy ? 'Turning on…' : 'Turn on the Fellow integration'}
        </button>
      </div>
    </section>
  );
}

/**
 * The line under a device name: the model when it says something the name does
 * not (a renamed machine), and the firmware. Fellow's ids mean nothing to a user.
 */
function DeviceMeta({ device }: { device: FellowDevice }) {
  const parts = [
    device.model && device.model !== device.displayName ? device.model : null,
    device.firmware ? `Firmware ${device.firmware}` : null,
  ].filter(Boolean);
  if (!parts.length) return null;
  return <div className="small dim mt-1">{parts.join(' · ')}</div>;
}

export default function Fellow() {
  const status = useApi<FellowConnectionStatus>('/fellow/status');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [remote, setRemote] = useState<{ deviceId: string; list: RemoteProfile[] } | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const navigate = useNavigate();

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/fellow/connect', { method: 'POST', body: { email, password } });
      setPassword('');
      void status.reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    await api('/fellow/disconnect', { method: 'POST' });
    void status.reload();
  }

  async function turnOff() {
    await api('/fellow/opt-out', { method: 'POST' });
    setRemote(null);
    void status.reload();
  }

  async function loadProfiles(deviceId: string) {
    setFlash(null);
    try {
      const list = await api<RemoteProfile[]>(`/fellow/devices/${deviceId}/profiles/parsed`);
      setRemote({ deviceId, list });
    } catch (err) {
      setFlash((err as Error).message);
    }
  }

  async function importProfile(deviceId: string, p: RemoteProfile) {
    setImporting(p.remoteId);
    try {
      const saved = await api<{ id: string }>(`/fellow/import/${deviceId}/${p.remoteId}`, {
        method: 'POST',
      });
      navigate(`/profiles/${saved.id}`);
    } catch (err) {
      setFlash((err as Error).message);
    } finally {
      setImporting(null);
    }
  }

  const s = status.data;

  return (
    <div className="fellow">
      <div className="page-head">
        <h1>Fellow account</h1>
        <p>
          Connect the account your ES1 is paired with, then push profiles to it from the editor.
          Your password is used for the sign-in call and is never stored; the access token it
          returns is.
        </p>
        <p className="small faint">
          Mousetail is an independent project, not affiliated with, endorsed by or supported by
          Fellow. It talks to Fellow's private API, which can change or stop working without notice.
        </p>
      </div>

      {s && !s.optedIn ? <OptInGate onEnabled={() => void status.reload()} /> : null}

      {s?.optedIn && s.warning ? (
        <Banner kind="warn" icon={TriangleAlert}>
          <strong>Experimental</strong> — {s.warning}
        </Banner>
      ) : null}

      {!s?.optedIn ? null : s.connected ? (
        <>
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Devices</h2>
                <div className="small dim mt-1">
                  Connected as <span className="mono">{s.email}</span>
                </div>
              </div>
              <button className="btn btn-danger btn-sm" onClick={disconnect}>
                Disconnect
              </button>
            </div>
            {s.devices.length ? (
              <div className="fellow-rows">
                {s.devices.map((d) => (
                  <div key={d.id} className="fellow-row">
                    <div className="fellow-device min-w-0">
                      <span className="fellow-device-icon" aria-hidden="true">
                        {d.supportsEspressoProfiles ? (
                          <EspressoMachineIcon size={22} />
                        ) : (
                          <Coffee size={22} />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="row-wrap tight">
                          <span className="item-title">{d.displayName}</span>
                          <span className={`tag ${d.supportsEspressoProfiles ? 'good' : ''}`}>
                            {d.supportsEspressoProfiles
                              ? 'espresso profiles'
                              : 'not an espresso machine'}
                          </span>
                        </div>
                        <DeviceMeta device={d} />
                      </div>
                    </div>
                    <div className="fellow-row-actions">
                      {d.supportsEspressoProfiles ? (
                        <button className="btn btn-sm" onClick={() => loadProfiles(d.id)}>
                          Profiles on this machine
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty title="No devices on that account" />
            )}
          </section>

          {flash ? <Banner kind="bad">{flash}</Banner> : null}

          {remote ? (
            <section className="card">
              <div className="card-head">
                <h2>Profiles on this machine</h2>
                <button className="btn btn-ghost btn-sm" onClick={() => setRemote(null)}>
                  Close
                </button>
              </div>
              <p className="small dim fellow-note">
                Importing copies a profile onto your shelf. Fellow's own profiles are read-only —
                editing one and sending it back saves a new profile in your custom folder rather
                than overwriting the original.
              </p>
              {remote.list.length ? (
                <div className="fellow-rows">
                  {remote.list.map((p) => (
                    <div className="fellow-row" key={p.remoteId}>
                      <div className="min-w-0">
                        <div className="row-wrap tight">
                          <strong>{p.name}</strong>
                          <span className={`tag ${ORIGIN_TAG[p.origin].cls}`}>
                            {ORIGIN_TAG[p.origin].label}
                          </span>
                          {!p.editable ? <span className="tag">read-only</span> : null}
                        </div>
                        <div className="small dim mt-1">
                          <span className="mono">{p.profile.stages.length}</span> stages
                          {peakPressureBar(p.profile) != null ? (
                            <>
                              {' · '}
                              <span className="mono">{fmt(peakPressureBar(p.profile))}</span> bar
                              peak
                            </>
                          ) : null}
                          {' · '}
                          {tempF(p.profile.brewTempC)}
                        </div>
                      </div>
                      <div className="fellow-row-actions">
                        <button
                          className="btn btn-sm"
                          disabled={importing === p.remoteId}
                          onClick={() => importProfile(remote.deviceId, p)}
                        >
                          {importing === p.remoteId ? 'Importing…' : 'Import'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty title="No profiles on this machine yet" />
              )}
            </section>
          ) : null}
        </>
      ) : (
        <section className="card">
          <div className="card-head">
            <h2>Connect</h2>
          </div>
          <form onSubmit={connect} className="stack fellow-form">
            <Field label="Fellow email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Field label="Fellow password">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
            {error ? <Banner kind="bad">{error}</Banner> : null}
            <div>
              <button className="btn btn-primary" disabled={busy}>
                {busy ? 'Connecting…' : 'Connect'}
              </button>
            </div>
          </form>
        </section>
      )}

      {s?.optedIn ? (
        <section className="card fellow-off">
          <div>
            <h3>Turn off the Fellow integration</h3>
            <p className="small dim">
              Disconnects your Fellow account and deletes the stored access token. Profiles already
              on your machine stay there, and you can turn this back on at any time.
            </p>
          </div>
          <button className="btn btn-danger btn-sm" onClick={turnOff}>
            Turn off
          </button>
        </section>
      ) : null}
    </div>
  );
}
