import { useCallback, useEffect, useState } from 'react';

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

/** Minimal data hook: fetch on mount, expose a manual refresh. */
export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));

  const reload = useCallback(async () => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setData(await api<T>(path));
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
