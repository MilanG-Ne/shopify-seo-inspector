import { describe, expect, it } from "vitest";
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { AdminClient } from "../app/shopify/admin.server";
import { CATALOG_COLLECTIONS_QUERY } from "../app/shopify/operations";

type Step = { body: unknown } | { error: unknown };

/** A fake `admin` that replays scripted responses and records each call. */
function fakeAdmin(steps: Step[]) {
  const calls: unknown[] = [];
  const graphql = async (_operation: string, options?: { variables?: unknown }) => {
    calls.push(options?.variables);
    const step = steps.shift();
    if (!step) throw new Error("No scripted response left");
    if ("error" in step) throw step.error;
    return new Response(JSON.stringify(step.body));
  };
  // The fake only implements what AdminClient calls.
  return { admin: { graphql } as unknown as Pick<AdminApiContext, "graphql">, calls };
}

const page = (currentlyAvailable: number) => ({
  data: { collections: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } },
  extensions: {
    cost: {
      requestedQueryCost: 102,
      throttleStatus: { maximumAvailable: 2000, currentlyAvailable, restoreRate: 100 },
    },
  },
});

const throttled = {
  body: {
    errors: { graphQLErrors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }] },
  },
};

describe("AdminClient", () => {
  it("returns typed data and paces the next request from the bucket", async () => {
    const waits: number[] = [];
    const { admin, calls } = fakeAdmin([{ body: page(52) }, { body: page(1900) }]);
    const client = new AdminClient(admin, async (ms) => {
      waits.push(ms);
    });

    const first = await client.request(CATALOG_COLLECTIONS_QUERY, { first: 50, after: null });
    expect(first.collections.nodes).toEqual([]);
    await client.request(CATALOG_COLLECTIONS_QUERY, { first: 50, after: null });

    // No reading before the first call; then (102 - 52) / 100 s before the second.
    expect(waits).toEqual([0, 500]);
    expect(calls).toHaveLength(2);
  });

  it("retries THROTTLED responses with backoff", async () => {
    const waits: number[] = [];
    const { admin, calls } = fakeAdmin([{ error: throttled }, { body: page(1500) }]);
    const client = new AdminClient(admin, async (ms) => {
      waits.push(ms);
    });

    await client.request(CATALOG_COLLECTIONS_QUERY, { first: 50, after: null });
    expect(calls).toHaveLength(2);
    expect(waits).toContain(1000);
  });

  it("gives up after the retry limit", async () => {
    const { admin, calls } = fakeAdmin(Array.from({ length: 6 }, () => ({ error: throttled })));
    const client = new AdminClient(admin, async () => {});
    await expect(
      client.request(CATALOG_COLLECTIONS_QUERY, { first: 50, after: null }),
    ).rejects.toBe(throttled);
    expect(calls).toHaveLength(5);
  });

  it("doesn't retry other errors", async () => {
    const failure = new Error("Access denied");
    const { admin, calls } = fakeAdmin([{ error: failure }]);
    const client = new AdminClient(admin, async () => {});
    await expect(
      client.request(CATALOG_COLLECTIONS_QUERY, { first: 50, after: null }),
    ).rejects.toBe(failure);
    expect(calls).toHaveLength(1);
  });
});
