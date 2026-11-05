import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  api,
  ApiError,
  clearPrefetched,
  prefetch,
  PREFETCH_TTL_MS,
  setTokenGetter,
  useApi,
} from './api';

const respond = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

function mockFetch(res: Response) {
  const fn = vi.fn().mockResolvedValue(res);
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  setTokenGetter(async () => null);
});

describe('api', () => {
  it('prefixes /api and parses JSON', async () => {
    const fetch = mockFetch(respond(200, { ok: true }));
    await expect(api('/coffees')).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith('/api/coffees', expect.anything());
  });

  it('sends the bearer token once one is registered', async () => {
    const fetch = mockFetch(respond(200, {}));
    setTokenGetter(async () => 'tok_123');
    await api('/me');
    expect(fetch.mock.calls[0][1].headers).toMatchObject({ Authorization: 'Bearer tok_123' });
  });

  it('omits Authorization when signed out', async () => {
    const fetch = mockFetch(respond(200, {}));
    await api('/me');
    expect(fetch.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
  });

  it('JSON-encodes a body and sets the content type', async () => {
    const fetch = mockFetch(respond(201, { id: 1 }));
    await api('/shots', { method: 'POST', body: { doseG: 18 } });
    const init = fetch.mock.calls[0][1];
    expect(init.body).toBe('{"doseG":18}');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('resolves undefined for 204 No Content', async () => {
    mockFetch(respond(204));
    await expect(api('/shots/1', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it("throws ApiError with the server's message and status", async () => {
    mockFetch(respond(422, { error: 'Dose must be positive' }));
    const err = await api('/shots').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 422, message: 'Dose must be positive' });
  });

  it('keeps the whole error body on the ApiError', async () => {
    mockFetch(respond(424, { error: 'Fellow said no', raw: { statusCode: 400 } }));
    const err = await api('/fellow/push/p1', { method: 'POST', body: {} }).catch((e) => e);
    expect(err).toMatchObject({ body: { error: 'Fellow said no', raw: { statusCode: 400 } } });
  });

  it('turns an HTML error page from a proxy into a sentence, not a JSON parse error', async () => {
    mockFetch(new Response('<!DOCTYPE html><title>502 Bad Gateway</title>', { status: 502 }));
    const err = await api('/fellow/push/p1').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 502,
      message: 'The server sent back a page instead of an answer (502). Try again in a moment.',
    });
  });

  it('falls back to a generic message when the error body is empty', async () => {
    mockFetch(respond(500));
    await expect(api('/shots')).rejects.toThrow('Request failed (500)');
  });
});

// Requests started alongside /auth/me, so the dashboard isn't one round trip
// behind the shell.
describe('prefetch', () => {
  /** A fresh Response per call: a body can only be read once. */
  function serve(initial: unknown) {
    const state = { body: initial };
    const fn = vi.fn(async () => respond(200, state.body));
    vi.stubGlobal('fetch', fn);
    return Object.assign(fn, { answer: (b: unknown) => (state.body = b) });
  }

  afterEach(() => {
    clearPrefetched();
    vi.useRealTimers();
  });

  it('hands a page the prefetched answer for its first load, without asking again', async () => {
    const fetch = serve([{ id: 'shot_1' }]);
    prefetch(['/shots']);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    // Let the response settle so the first render can use it.
    await new Promise((r) => setTimeout(r, 0));

    const { result } = renderHook(() => useApi<{ id: string }[]>('/shots'));
    expect(result.current.data).toEqual([{ id: 'shot_1' }]);
    expect(result.current.loading).toBe(false);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('waits on a prefetch still in flight rather than sending a second request', async () => {
    let answer!: (r: Response) => void;
    const fetch = vi.fn(() => new Promise<Response>((r) => (answer = r)));
    vi.stubGlobal('fetch', fetch);
    prefetch(['/shots']);

    const { result } = renderHook(() => useApi<number[]>('/shots'));
    expect(result.current.data).toBeNull();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    answer(respond(200, [1]));
    await waitFor(() => expect(result.current.data).toEqual([1]));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('uses a prefetch once: a reload asks the server again', async () => {
    const fetch = serve([1]);
    prefetch(['/shots']);
    const { result } = renderHook(() => useApi<number[]>('/shots'));
    await waitFor(() => expect(result.current.data).toEqual([1]));
    fetch.answer([1, 2]);
    await act(() => result.current.reload());
    expect(result.current.data).toEqual([1, 2]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('ignores a prefetch that has gone stale', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const fetch = serve(['old']);
    prefetch(['/shots']);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    vi.setSystemTime(Date.now() + PREFETCH_TTL_MS + 1);
    fetch.answer(['new']);
    const { result } = renderHook(() => useApi<string[]>('/shots'));
    await waitFor(() => expect(result.current.data).toEqual(['new']));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('drops everything on clear, so the next account never sees the last one’s answers', async () => {
    const fetch = serve(['theirs']);
    prefetch(['/shots']);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    clearPrefetched();
    fetch.answer(['mine']);
    const { result } = renderHook(() => useApi<string[]>('/shots'));
    await waitFor(() => expect(result.current.data).toEqual(['mine']));
  });
});
