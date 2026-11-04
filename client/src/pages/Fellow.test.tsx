import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeStage, type FellowConnectionStatus } from '@brewlab/shared';
import Fellow from './Fellow';

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

/** A tiny fake of the three Fellow routes the page touches before connecting. */
function fakeServer(initial: FellowConnectionStatus, profiles: unknown[] = []) {
  let status = initial;
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/fellow/status') return json(200, status);
    if (url === '/api/fellow/opt-in' && init?.method === 'POST') {
      status = { ...status, optedIn: true };
      return json(204);
    }
    if (url.endsWith('/profiles/parsed')) return json(200, profiles);
    if (url === '/api/fellow/opt-out' && init?.method === 'POST') {
      status = { optedIn: false, connected: false, devices: [] };
      return json(204);
    }
    return json(404, { error: `unexpected ${url}` });
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <Fellow />
    </MemoryRouter>,
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Fellow page', () => {
  it('shows only the warning until the user opts in', async () => {
    fakeServer({ optedIn: false, connected: false, devices: [] });
    renderPage();
    expect(await screen.findByText(/read before turning on/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/fellow email/i)).not.toBeInTheDocument();
  });

  it('will not turn on until the box is ticked, then sends an explicit yes', async () => {
    const fetch = fakeServer({ optedIn: false, connected: false, devices: [] });
    renderPage();

    const enable = await screen.findByRole('button', { name: /turn on the fellow integration/i });
    expect(enable).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /at my own risk/i }));
    expect(enable).toBeEnabled();
    fireEvent.click(enable);

    expect(await screen.findByLabelText(/fellow email/i)).toBeInTheDocument();
    const optIn = fetch.mock.calls.find(([url]) => url === '/api/fellow/opt-in');
    expect(JSON.parse(String(optIn?.[1]?.body))).toEqual({ accept: true });
  });

  it('turning it off brings the warning back', async () => {
    fakeServer({ optedIn: true, connected: false, devices: [] });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /^turn off$/i }));

    await waitFor(() => expect(screen.getByText(/read before turning on/i)).toBeInTheDocument());
    expect(screen.queryByLabelText(/fellow email/i)).not.toBeInTheDocument();
  });

  it('shows the experimental warning as a caution with an icon, and offers no raw JSON', async () => {
    fakeServer({
      optedIn: true,
      connected: true,
      email: 'me@example.com',
      devices: [
        {
          id: 'dev_1',
          displayName: 'Kitchen ES1',
          model: 'Espresso Series 1',
          supportsEspressoProfiles: true,
        },
      ],
      warning: 'Writes reach your real machine.',
    } as FellowConnectionStatus);
    renderPage();

    const banner = (await screen.findByText('Experimental')).closest('.banner');
    expect(banner).toHaveClass('warn');
    expect(banner?.querySelector('svg')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /raw json/i })).not.toBeInTheDocument();
  });

  it('describes devices by model and firmware, keeping their ids out of the row', async () => {
    fakeServer({
      optedIn: true,
      connected: true,
      email: 'me@example.com',
      devices: [
        {
          id: 'FS_97b70d6f',
          displayName: 'Kitchen ES1',
          model: 'Espresso Series 1',
          family: 'espresso',
          firmware: '2.5.15',
          supportsEspressoProfiles: true,
        },
        {
          id: 'FB_ef3da0f4',
          displayName: 'Aiden',
          model: 'Aiden',
          family: 'brewer',
          firmware: '1.5.16',
          supportsEspressoProfiles: false,
        },
      ],
    });
    renderPage();

    // A renamed machine still says what it is; a model that repeats the name does not.
    expect(await screen.findByText('Espresso Series 1 · Firmware 2.5.15')).toBeInTheDocument();
    expect(screen.getByText('Firmware 1.5.16')).toBeInTheDocument();
    expect(screen.queryByText(/FS_97b70d6f|FB_ef3da0f4/)).not.toBeInTheDocument();
    expect(document.querySelector('[title*="FS_"], [title*="FB_"]')).toBeNull();
  });

  it("lists a machine's profiles with their peak pressure and no Fellow ids", async () => {
    fakeServer(
      {
        optedIn: true,
        connected: true,
        email: 'me@example.com',
        devices: [
          {
            id: 'FS_97b70d6f',
            displayName: 'Espresso Series 1',
            model: 'Espresso Series 1',
            family: 'espresso',
            supportsEspressoProfiles: true,
          },
        ],
      },
      [
        {
          remoteId: 'remote_abc123',
          name: 'Morning lever',
          origin: 'custom',
          editable: true,
          profile: {
            id: 'p1',
            name: 'Morning lever',
            doseG: 18,
            ratio: 2,
            brewTempC: 93,
            stages: [
              makeStage('preinfusion', { pressureBar: 3, endPressureBar: 3 }),
              makeStage('infusion', { pressureBar: 9, endPressureBar: 9 }),
            ],
          },
        },
      ],
    );
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /profiles on this machine/i }));

    const name = await screen.findByText('Morning lever');
    const row = name.closest('.fellow-row') as HTMLElement;
    expect(row).toHaveTextContent('2 stages · 9 bar peak');
    expect(row).not.toHaveTextContent('remote_abc123');
  });
});
