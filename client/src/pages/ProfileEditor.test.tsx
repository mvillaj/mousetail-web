import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  STOCK_PROFILES,
  roundF,
  totalDurationS,
  yieldG,
  type BrewProfileRecord,
} from '@brewlab/shared';
import ProfileEditor from './ProfileEditor';

const record = (id: string, stock: string): BrewProfileRecord => {
  const s = STOCK_PROFILES.find((p) => p.name === stock)!;
  return {
    id,
    userId: 'usr_1',
    name: s.name,
    description: s.description,
    isPublic: false,
    profile: { ...s, id },
    syncState: 'local',
    fellowProfileId: null,
    lastPushedAt: null,
    origin: 'local',
    sourceDeviceId: null,
    createdAt: '2026-10-01T00:00:00.000Z',
  } as BrewProfileRecord;
};

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

/** Each profile answers only when its test says so. */
function stubProfiles() {
  const pending = new Map<string, (r: Response) => void>();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const m = /^\/api\/profiles\/(.+)$/.exec(url);
      if (m) return new Promise<Response>((r) => pending.set(m[1], r));
      return json(200, { optedIn: false });
    }),
  );
  return async (id: string, body: BrewProfileRecord) => {
    await vi.waitFor(() => expect(pending.has(id)).toBe(true));
    await act(async () => pending.get(id)!(json(200, body)));
  };
}

let go: (path: string) => void = () => {};
function Driver() {
  go = useNavigate();
  return null;
}

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Driver />
      <Routes>
        <Route path="/profiles/:id" element={<ProfileEditor />} />
      </Routes>
    </MemoryRouter>,
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Profile editor loading', () => {
  it('shows nothing of the blank template while a saved profile loads', async () => {
    const answer = stubProfiles();
    renderAt('/profiles/prf_lever');

    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();

    await answer('prf_lever', record('prf_lever', 'Lever'));
    expect(screen.getByRole('heading', { level: 1, name: 'Lever' })).toBeInTheDocument();
  });

  it('drops the last profile at once when switching to another', async () => {
    const answer = stubProfiles();
    renderAt('/profiles/prf_lever');
    await answer('prf_lever', record('prf_lever', 'Lever'));

    act(() => go('/profiles/prf_classic'));
    expect(screen.queryByRole('heading', { level: 1, name: 'Lever' })).not.toBeInTheDocument();

    await answer('prf_classic', record('prf_classic', 'Classic 9 Bar'));
    expect(screen.getByRole('heading', { level: 1, name: 'Classic 9 Bar' })).toBeInTheDocument();
  });
});

describe('Profile editor with a suggested draft', () => {
  it('shows the draft under its name and explains it above the curve', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(200, { optedIn: false })),
    );
    const lever = STOCK_PROFILES.find((p) => p.name === 'Lever')!;
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/profiles/new',
            state: {
              draft: { ...lever, id: 'suggested', name: 'Hi-Fi Espresso · Stepped down' },
              rationale: 'Soft and dark, so cooler and shorter.',
              coffeeName: 'Hi-Fi Espresso',
            },
          },
        ]}
      >
        <Routes>
          <Route path="/profiles/new" element={<ProfileEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    const note = await screen.findByRole('region', { name: 'For Hi-Fi Espresso' });
    expect(note).toHaveTextContent('Soft and dark, so cooler and shorter.');
    expect(note).toHaveTextContent('Nothing is saved yet');
    expect(screen.getByLabelText('Name')).toHaveValue('Hi-Fi Espresso · Stepped down');

    // The numbers as suggested sit beside the reasoning.
    const numbers = within(note).getByLabelText('As suggested');
    expect(numbers).toHaveTextContent(`${roundF(lever.brewTempC)}°F`);
    expect(numbers).toHaveTextContent(`1:${lever.ratio.toFixed(1)}${yieldG(lever)} g out`);
    expect(numbers).toHaveTextContent(`${totalDurationS(lever)}s`);
  });
});

describe('Sending to Fellow', () => {
  it("shows Fellow's reason and raw answer when it refuses the profile", async () => {
    const rejected = {
      ok: false,
      message: 'Fellow rejected the profile (400): temperature must not be greater than 94',
      error: 'Fellow rejected the profile (400): temperature must not be greater than 94',
      raw: { statusCode: 400, message: ['temperature must not be greater than 94'] },
      warnings: [],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/fellow/status') return json(200, { optedIn: true });
        if (url === '/api/fellow/push/prf_lever') return json(424, rejected);
        return json(200, record('prf_lever', 'Lever'));
      }),
    );
    renderAt('/profiles/prf_lever');

    const send = await screen.findByRole('button', { name: 'Send to Fellow' });
    await act(async () => send.click());

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Fellow said no')).toBeInTheDocument();
    expect(within(dialog).getByText(rejected.message)).toBeInTheDocument();
    expect(within(dialog).getByText(/"statusCode": 400/)).toBeInTheDocument();
  });
});
