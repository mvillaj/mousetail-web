import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiStatus, Coffee } from '@brewlab/shared';
import Profiles from './Profiles';

let ai: AiStatus;
vi.mock('../lib/ai', () => ({ useAi: () => ai }));

const coffee = (over: Partial<Coffee>): Coffee => ({
  id: 'cof_1',
  ownerId: 'usr_1',
  ownerName: 'Ada Lovelace',
  name: 'Kenya Kiambu',
  roaster: 'Sey',
  origin: 'Kenya',
  region: null,
  producer: null,
  varietal: null,
  process: 'washed',
  roastLevel: 'light',
  altitudeMasl: null,
  roastDate: null,
  tastingNotes: [],
  url: null,
  notes: null,
  isPublic: false,
  clonedFromId: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  ...over,
});

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => handler(url, init));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

/** Stands in for the editor: shows which draft it was handed. */
function EditorStub() {
  const state = useLocation().state as { coffeeName: string; rationale: string } | null;
  return (
    <p>
      editor for {state?.coffeeName}: {state?.rationale}
    </p>
  );
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/profiles']}>
      <Routes>
        <Route path="/profiles" element={<Profiles />} />
        <Route path="/profiles/new" element={<EditorStub />} />
      </Routes>
    </MemoryRouter>,
  );

const openPicker = () => fireEvent.click(screen.getByRole('button', { name: 'New profile' }));

beforeEach(() => {
  ai = { enabled: true };
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Profiles picker, starting from a coffee', () => {
  it('designs a profile for the chosen coffee and opens it unsaved in the editor', async () => {
    const fetch = stubFetch((url) => {
      if (url === '/api/profiles') return json(200, []);
      if (url === '/api/coffees') return json(200, [coffee({})]);
      if (url === '/api/ai/suggest-profile/cof_1')
        return json(200, {
          profile: { id: 'draft', name: 'Kiambu', stages: [] },
          rationale: 'Dense and bright, so hotter and longer.',
          coffeeName: 'Kenya Kiambu',
        });
      return json(404);
    });
    renderPage();
    openPicker();

    fireEvent.click(await screen.findByRole('button', { name: /Kenya Kiambu/ }));

    expect(
      await screen.findByText('editor for Kenya Kiambu: Dense and bright, so hotter and longer.'),
    ).toBeInTheDocument();
    const call = fetch.mock.calls.find(([url]) => url === '/api/ai/suggest-profile/cof_1');
    expect(call?.[1]?.method).toBe('POST');
    // A draft, not a record: nothing was created on the way.
    expect(fetch.mock.calls.some(([url, init]) => url === '/api/profiles' && init?.method)).toBe(
      false,
    );
  });

  it('holds the other coffees while one is designing', async () => {
    let answer: (r: Response) => void = () => {};
    stubFetch((url) => {
      if (url === '/api/profiles') return json(200, []);
      if (url === '/api/coffees')
        return json(200, [coffee({}), coffee({ id: 'cof_2', name: 'Ethiopia Guji' })]);
      // Left hanging so the in-flight state can be looked at.
      if (url.startsWith('/api/ai/')) return new Promise<Response>((r) => (answer = r));
      return json(404);
    });
    renderPage();
    openPicker();

    const kiambu = await screen.findByRole('button', { name: /Kenya Kiambu/ });
    fireEvent.click(kiambu);

    await waitFor(() => expect(kiambu).toHaveAttribute('aria-busy', 'true'));
    expect(screen.getByText('Designing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ethiopia Guji/ })).toBeDisabled();
    answer(json(503, { error: 'nope' }));
  });

  it('shows why a suggestion failed and lets you pick again', async () => {
    stubFetch((url) => {
      if (url === '/api/profiles') return json(200, []);
      if (url === '/api/coffees') return json(200, [coffee({})]);
      if (url === '/api/ai/suggest-profile/cof_1')
        return json(429, { error: 'You have used this month’s AI budget.' });
      return json(404);
    });
    renderPage();
    openPicker();

    const tile = await screen.findByRole('button', { name: /Kenya Kiambu/ });
    fireEvent.click(tile);

    expect(await screen.findByText('You have used this month’s AI budget.')).toBeInTheDocument();
    expect(tile).toBeEnabled();
  });

  it('explains instead of listing coffees when AI is off', async () => {
    ai = { enabled: false, reason: 'Set ANTHROPIC_API_KEY on the server.' };
    stubFetch((url) => {
      if (url === '/api/profiles') return json(200, []);
      if (url === '/api/coffees') return json(200, [coffee({})]);
      return json(404);
    });
    renderPage();
    openPicker();

    expect(screen.getByText('Set ANTHROPIC_API_KEY on the server.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Kenya Kiambu/ })).not.toBeInTheDocument();
    // The factory starts are still there.
    expect(screen.getByRole('button', { name: /Blank profile/ })).toBeInTheDocument();
  });

  it('points to the coffees page when there are none yet', async () => {
    stubFetch((url) => {
      if (url === '/api/profiles') return json(200, []);
      if (url === '/api/coffees') return json(200, []);
      return json(404);
    });
    renderPage();
    openPicker();

    expect(await screen.findByRole('link', { name: 'Add a coffee' })).toHaveAttribute(
      'href',
      '/coffees',
    );
  });
});
