import { describe, expect, it } from "vitest";
import {
  readQueryCost,
  throttleRetryDelay,
  throttledBody,
  waitBeforeNext,
} from "../app/shopify/throttle";

const cost = (currentlyAvailable: number, requestedQueryCost = 300) => ({
  cost: {
    requestedQueryCost,
    actualQueryCost: 120,
    throttleStatus: { maximumAvailable: 2000, currentlyAvailable, restoreRate: 100 },
  },
});

describe("readQueryCost", () => {
  it("reads the leaky bucket from extensions.cost", () => {
    expect(readQueryCost(cost(1500))).toEqual({
      requestedQueryCost: 300,
      throttleStatus: { maximumAvailable: 2000, currentlyAvailable: 1500, restoreRate: 100 },
    });
  });

  it("returns null for missing or malformed data", () => {
    expect(readQueryCost(undefined)).toBeNull();
    expect(readQueryCost({ cost: { requestedQueryCost: "300" } })).toBeNull();
    expect(
      readQueryCost({
        cost: {
          requestedQueryCost: 10,
          throttleStatus: { maximumAvailable: 1000, currentlyAvailable: 5, restoreRate: 0 },
        },
      }),
    ).toBeNull();
  });
});

describe("waitBeforeNext", () => {
  it("doesn't wait when the bucket can afford the next request", () => {
    expect(waitBeforeNext(readQueryCost(cost(300)))).toBe(0);
    expect(waitBeforeNext(null)).toBe(0);
  });

  it("waits for the shortfall to restore", () => {
    // Needs 300, has 50, restores 100/s: 2.5 seconds.
    expect(waitBeforeNext(readQueryCost(cost(50)))).toBe(2500);
  });

  it("uses an explicit next cost when given", () => {
    expect(waitBeforeNext(readQueryCost(cost(50)), 150)).toBe(1000);
  });

  it("never waits for more than the bucket can hold", () => {
    expect(waitBeforeNext(readQueryCost(cost(0, 5000)))).toBe(20_000);
  });
});

describe("throttledBody", () => {
  const throttledError = {
    body: {
      errors: { graphQLErrors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }] },
      extensions: cost(10),
    },
  };

  it("recognizes a THROTTLED GraphqlQueryError", () => {
    expect(throttledBody(throttledError)).toBe(throttledError.body);
  });

  it("recognizes a plain errors array too", () => {
    const error = { body: { errors: [{ extensions: { code: "THROTTLED" } }] } };
    expect(throttledBody(error)).not.toBeNull();
  });

  it("ignores other errors", () => {
    expect(throttledBody(new Error("network"))).toBeNull();
    expect(
      throttledBody({ body: { errors: { graphQLErrors: [{ extensions: { code: "ACCESS_DENIED" } }] } } }),
    ).toBeNull();
  });

  it("backs off by the bucket shortfall or exponentially, whichever is longer", () => {
    const body = throttledBody(throttledError);
    expect(body).not.toBeNull();
    if (!body) return;
    expect(throttleRetryDelay(body, 0)).toBe(2900); // (300 - 10) / 100 s
    expect(throttleRetryDelay({}, 0)).toBe(1000);
    expect(throttleRetryDelay({}, 3)).toBe(8000);
    expect(throttleRetryDelay({}, 10)).toBe(10_000);
  });
});
