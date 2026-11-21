import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Coffee } from '@brewlab/shared';
import Coffees from './Coffees';

const coffee = (id: string, name: string, createdAt: string, pinnedAt: string | null = null) =>
  ({
    id,
    ownerId: 'usr_1',
    ownerName: 'Ada',
    name,
    roaster: 'Roastery',
    origin: null,
    region: null,
    producer: null,
    varietal: null,
    process: null,
    roastLevel: null,
    altitudeMasl: null,
    roastDate: null,
    tastingNotes: [],
    url: null,
    notes: null,
    isPublic: false,
    clonedFromId: null,
    createdAt,
    pinnedAt,
  }) satisfies Coffee;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * A server holding the shelf. Pin requests answer with the updated coffee, or
 * `fail`, and are held until the test lets them go: all at once (`answer`) or
 * one at a time in any order (`answerAt`).
 */
function serve(shelf: Coffee[], { fail = false } = {}) {
  const pending: Array<() => void> = [];
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const pin = /^\/api\/coffees\/([^/]+)\/pin$/.exec(url);
    if (pin) {
      await new Promise<void>((go) => pending.push(go));
      if (fail) return json(500, { error: 'The server fell over' });
      const c = shelf.find((x) => x.id === pin[1])!;
      return json(200, {
        ...c,
        pinnedAt: init?.method === 'PUT' ? '2026-11-20T10:00:00.000Z' : null,
      });
    }
    if (init?.method === 'DELETE') return new Response(null, { status: 204 });
    return json(200, shelf);
  });
  vi.stubGlobal('fetch', fetch);
  return {
    fetch,
    answer: () => pending.splice(0).forEach((go) => go()),
    answerAt: (i: number) => pending[i](),
  };
}

afterEach(() => vi.unstubAllGlobals());

function renderShelf() {
  return render(
    <MemoryRouter>
      <Coffees />
    </MemoryRouter>,
  );
}

const group = (name: string) => screen.getByRole('region', { name });
const namesIn = (region: HTMLElement) =>
  within(region)
    .getAllByRole('link')
    .map((l) => l.textContent);

describe('My coffees: pinning', () => {
  it('shows pinned coffees in their own group on top', async () => {
    serve([
      coffee('cof_a', 'Kenya', '2026-01-01', '2026-04-01'),
      coffee('cof_b', 'Peru', '2026-02-01'),
      coffee('cof_c', 'Ethiopia', '2026-03-01'),
    ]);
    renderShelf();
    expect(namesIn(await screen.findByRole('region', { name: 'Pinned' }))).toEqual(['Kenya']);
    expect(namesIn(group('On the shelf'))).toEqual(['Ethiopia', 'Peru']);
    expect(screen.getByRole('button', { name: 'Pin Kenya' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('with nothing pinned, is one shelf with no group headings', async () => {
    serve([coffee('cof_b', 'Peru', '2026-02-01')]);
    renderShelf();
    await screen.findByRole('link', { name: 'Peru' });
    expect(screen.queryByRole('heading', { name: 'Pinned' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'On the shelf' })).toBeNull();
  });

  it('moves a coffee to the top as soon as it is pinned, then saves it', async () => {
    const server = serve([coffee('cof_b', 'Peru', '2026-02-01')]);
    renderShelf();
    await userEvent.click(await screen.findByRole('button', { name: 'Pin Peru' }));

    // Moved before the server has answered.
    expect(namesIn(group('Pinned'))).toEqual(['Peru']);
    expect(server.fetch).toHaveBeenCalledWith(
      '/api/coffees/cof_b/pin',
      expect.objectContaining({ method: 'PUT' }),
    );
    server.answer();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Pin Peru' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
  });

  it('unpins back onto the shelf', async () => {
    const server = serve([
      coffee('cof_a', 'Kenya', '2026-01-01', '2026-04-01'),
      coffee('cof_b', 'Peru', '2026-02-01'),
    ]);
    renderShelf();
    await userEvent.click(await screen.findByRole('button', { name: 'Pin Kenya' }));
    expect(server.fetch).toHaveBeenCalledWith(
      '/api/coffees/cof_a/pin',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(screen.queryByRole('region', { name: 'Pinned' })).toBeNull();
    server.answer();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Pin Kenya' })).toHaveAttribute(
        'aria-pressed',
        'false',
      ),
    );
  });

  it('puts the coffee back and says so when the save fails', async () => {
    const server = serve([coffee('cof_b', 'Peru', '2026-02-01')], { fail: true });
    renderShelf();
    await userEvent.click(await screen.findByRole('button', { name: 'Pin Peru' }));
    expect(screen.getByRole('region', { name: 'Pinned' })).toBeInTheDocument();
    server.answer();
    await waitFor(() =>
      expect(document.querySelector('.banner')).toHaveTextContent(
        "Couldn't pin Peru: The server fell over",
      ),
    );
    expect(screen.getByRole('status')).toHaveTextContent("Couldn't pin Peru");
    expect(screen.getByRole('button', { name: 'Pin Peru' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('keeps focus on the pin button as its coffee moves', async () => {
    const server = serve([coffee('cof_b', 'Peru', '2026-02-01')]);
    renderShelf();
    await userEvent.click(await screen.findByRole('button', { name: 'Pin Peru' }));
    expect(within(group('Pinned')).getByRole('button', { name: 'Pin Peru' })).toHaveFocus();
    server.answer();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pin Peru' })).toHaveFocus());
  });

  it('ends where the last click left it, whatever order the answers arrive in', async () => {
    const server = serve([coffee('cof_b', 'Peru', '2026-02-01')]);
    renderShelf();
    const pin = await screen.findByRole('button', { name: 'Pin Peru' });
    await userEvent.click(pin);
    await userEvent.click(screen.getByRole('button', { name: 'Pin Peru' }));
    // The unpin is answered first, the pin last.
    server.answerAt(1);
    server.answerAt(0);
    await waitFor(() => expect(server.fetch).toHaveBeenCalledTimes(3));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByRole('button', { name: 'Pin Peru' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.queryByRole('region', { name: 'Pinned' })).toBeNull();
  });

  it('puts a new pin on top even when an existing pin looks later than now', async () => {
    serve([
      coffee('cof_a', 'Kenya', '2026-01-01', '2099-01-01T00:00:00.000Z'),
      coffee('cof_b', 'Peru', '2026-02-01'),
    ]);
    renderShelf();
    await userEvent.click(await screen.findByRole('button', { name: 'Pin Peru' }));
    expect(namesIn(group('Pinned'))).toEqual(['Peru', 'Kenya']);
  });

  it('tells screen readers where the coffee went', async () => {
    serve([coffee('cof_b', 'Peru', '2026-02-01')]);
    renderShelf();
    await userEvent.click(await screen.findByRole('button', { name: 'Pin Peru' }));
    expect(screen.getByRole('status')).toHaveTextContent('Peru pinned to the top');
    await userEvent.click(screen.getByRole('button', { name: 'Pin Peru' }));
    expect(screen.getByRole('status')).toHaveTextContent('Peru back on the shelf');
  });

  it('clears a failed pin’s message once something else works', async () => {
    const server = serve(
      [coffee('cof_b', 'Peru', '2026-02-01'), coffee('cof_c', 'Ethiopia', '2026-03-01')],
      { fail: true },
    );
    renderShelf();
    await userEvent.click(await screen.findByRole('button', { name: 'Pin Peru' }));
    server.answer();
    await waitFor(() => expect(document.querySelector('.banner')).not.toBeNull());
    await userEvent.click(screen.getByRole('button', { name: 'Delete Ethiopia' }));
    await waitFor(() => expect(screen.queryByText(/Couldn't pin Peru/)).toBeNull());
  });
});
