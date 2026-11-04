/**
 * Status for "a service we depend on failed": Fellow or Claude said no, or a page
 * could not be read.
 *
 * Not 502 or 504, though those are the textbook answer. Production sits behind
 * Cloudflare, which swaps an origin's 502 or 504 for its own HTML error page, so
 * the JSON `error` never reached the client: it saw `Unexpected token '<',
 * "<!DOCTYPE "... is not valid JSON` instead of what Fellow said. 424 Failed
 * Dependency passes through untouched and still says what kind of failure it is.
 */
export const UPSTREAM_FAILED = 424;

/** What a user sees when something breaks on our side. The details go to the log. */
export const GENERIC_SERVER_ERROR = 'Something went wrong on our side. Try again in a moment.';

/** The bits of an Express/body-parser error the handler reads. */
interface HttpishError extends Error {
  status?: number;
  statusCode?: number;
  expose?: boolean;
}

/**
 * The response for an error that reached Express's error handler. Server-side
 * messages can name env vars, file paths or setup steps, so a 5xx never echoes
 * one. A 4xx the thrower marked safe to show (body-parser's "request entity too
 * large", malformed JSON) keeps its status and message.
 */
export function errorResponse(err: HttpishError): { status: number; body: { error: string } } {
  const status = err.status ?? err.statusCode ?? 500;
  if (status >= 400 && status < 500 && err.expose) {
    return { status, body: { error: err.message } };
  }
  return { status: 500, body: { error: GENERIC_SERVER_ERROR } };
}
