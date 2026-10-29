import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, setTokenGetter } from './api';

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
