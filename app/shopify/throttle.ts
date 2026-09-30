/**
 * Shopify's GraphQL Admin API rate-limits by calculated query cost using a
 * leaky bucket. Every response reports the bucket in `extensions.cost`; these
 * helpers read it and decide how long to wait. All pure, so they're unit
 * tested without a network.
 */

export interface ThrottleStatus {
  maximumAvailable: number;
  currentlyAvailable: number;
  restoreRate: number;
}

export interface QueryCost {
  requestedQueryCost: number;
  throttleStatus: ThrottleStatus;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Reads `extensions.cost`, or returns null if it's absent or malformed. */
export function readQueryCost(extensions: unknown): QueryCost | null {
  if (!isRecord(extensions) || !isRecord(extensions.cost)) return null;
  const { requestedQueryCost, throttleStatus } = extensions.cost;
  if (!isFiniteNumber(requestedQueryCost) || !isRecord(throttleStatus)) return null;
  const { maximumAvailable, currentlyAvailable, restoreRate } = throttleStatus;
  if (
    !isFiniteNumber(maximumAvailable) ||
    !isFiniteNumber(currentlyAvailable) ||
    !isFiniteNumber(restoreRate) ||
    restoreRate <= 0
  ) {
    return null;
  }
  return {
    requestedQueryCost,
    throttleStatus: { maximumAvailable, currentlyAvailable, restoreRate },
  };
}

/**
 * Milliseconds to wait before sending a request expected to cost `nextCost`
 * (defaults to what the last request asked for), given the last known bucket.
 */
export function waitBeforeNext(last: QueryCost | null, nextCost?: number): number {
  if (!last) return 0;
  const { currentlyAvailable, restoreRate, maximumAvailable } = last.throttleStatus;
  const needed = Math.min(nextCost ?? last.requestedQueryCost, maximumAvailable);
  if (currentlyAvailable >= needed) return 0;
  return Math.ceil(((needed - currentlyAvailable) / restoreRate) * 1000);
}

export const MAX_THROTTLE_RETRIES = 4;
const MAX_BACKOFF_MS = 10_000;

/**
 * A THROTTLED response arrives as HTTP 200 with a GraphQL error. The Shopify
 * client throws it as `GraphqlQueryError` with the parsed body attached.
 */
export function throttledBody(error: unknown): Record<string, unknown> | null {
  if (!isRecord(error) || !isRecord(error.body)) return null;
  const { errors } = error.body;
  // The client nests them as `errors.graphQLErrors`; a raw body has an array.
  const graphQLErrors = Array.isArray(errors)
    ? errors
    : isRecord(errors)
      ? errors.graphQLErrors
      : undefined;
  if (!Array.isArray(graphQLErrors)) return null;
  const throttled = graphQLErrors.some(
    (entry) =>
      isRecord(entry) &&
      isRecord(entry.extensions) &&
      entry.extensions.code === "THROTTLED",
  );
  return throttled ? error.body : null;
}

/** How long to back off after a THROTTLED error on retry number `attempt`. */
export function throttleRetryDelay(body: Record<string, unknown>, attempt: number): number {
  const cost = readQueryCost(body.extensions);
  const fromBucket = waitBeforeNext(cost);
  const backoff = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS);
  return Math.max(fromBucket, backoff);
}
