import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Clerk holds the session, and its `getToken()` is async — so instead of reading
 * a string out of localStorage, this module takes a getter that AuthProvider
 * registers once Clerk has loaded. Every call site already awaits `api()`, so
 * the extra await costs them nothing.
 */
type TokenGetter = () => Promise<string | null>;

let tokenGetter: TokenGetter = async () => null;

export function setTokenGetter(fn: TokenGetter) {
  tokenGetter = fn;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** The parsed error body, for callers that want more than `error`. */
    public body: unknown = null,
  ) {
    super(message);
  }
}

/**
 * Something between us and the server (Cloudflare, Fly's proxy) can answer with
 * an HTML error page. Parsing that raw gave the user `Unexpected token '<'`, so
 * a body that is not JSON is kept as text and never thrown over.
 */
function parseBody(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * `RequestInit & { body?: any }` does not widen `body` \u2014 an intersection narrows,
 * so `body` stayed `BodyInit` and every caller passing a plain object failed to
 * typecheck. Omit it from RequestInit first, then re-add it as the JSON value
 * this helper actually wants (it does the JSON.stringify below).
 */
export async function api<T = unknown>(
  path: string,
  init: Omit<RequestInit, 'body'> & { body?: unknown } = {},
): Promise<T> {
  const token = await tokenGetter();
  const hasBody = init.body !== undefined;
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    body: hasBody ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = parseBody(await res.text());
  if (typeof data === 'string') {
    throw new ApiError(
      res.status,
      `The server sent back a page instead of an answer (${res.status}). Try again in a moment.`,
    );
  }
  const error = (data as { error?: unknown } | null)?.error;
  if (!res.ok) {
    throw new ApiError(
      res.status,
      typeof error === 'string' ? error : `Request failed (${res.status})`,
      data,
    );
  }
  return data as T;
}

/**
 * Requests started ahead of the page that will want them, so they run
 * alongside `/auth/me` instead of after it. In memory only, never persisted:
 * nothing here outlives the tab, and sign-out drops it.
 */
interface Prefetched {
  at: number;
  promise: Promise<unknown>;
  /** Filled in once the request settles, so a page can draw it on first render. */
  settled?: { data: unknown } | { error: string };
}

const prefetched = new Map<string, Prefetched>();

/** Older than this and a prefetch is not used: the page fetches fresh instead. */
export const PREFETCH_TTL_MS = 10_000;

export function prefetch(paths: readonly string[]) {
  const now = Date.now();
  for (const path of paths) {
    const existing = prefetched.get(path);
    if (existing && now - existing.at < PREFETCH_TTL_MS) continue;
    const entry: Prefetched = { at: now, promise: api(path) };
    entry.promise.then(
      (data) => (entry.settled = { data }),
      (e: Error) => (entry.settled = { error: e.message }),
    );
    prefetched.set(path, entry);
  }
}

export function clearPrefetched() {
  prefetched.clear();
}

function peekPrefetched(path: string | null): Prefetched | undefined {
  if (!path) return undefined;
  const entry = prefetched.get(path);
  if (entry && Date.now() - entry.at < PREFETCH_TTL_MS) return entry;
  if (entry) prefetched.delete(path);
  return undefined;
}

/** One use per prefetch: after the first load, a reload asks the server again. */
function takePrefetched(path: string): Prefetched | undefined {
  const entry = peekPrefetched(path);
  prefetched.delete(path);
  return entry;
}

const settledData = (entry: Prefetched | undefined) =>
  entry?.settled && 'data' in entry.settled ? entry.settled.data : null;

/**
 * Minimal data hook: fetch on mount, expose a manual refresh. A prefetch of the
 * same path is used for the first load, and one that has already landed is on
 * screen from the first render.
 */
export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(() => settledData(peekPrefetched(path)) as T | null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => Boolean(path) && data == null);
  const first = useRef(true);

  const reload = useCallback(async () => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
    const ahead = first.current ? takePrefetched(path) : undefined;
    first.current = false;
    if (ahead?.settled) {
      // Already landed: on screen from the first render, so no loading flicker.
      if ('data' in ahead.settled) {
        setData(ahead.settled.data as T);
        setError(null);
      } else {
        setError(ahead.settled.error);
      }
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setData((await (ahead?.promise ?? api<T>(path))) as T);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}
