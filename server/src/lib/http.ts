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
