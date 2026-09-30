import type { AdminMutations, AdminOperations, AdminQueries } from "@shopify/admin-api-client";
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import {
  MAX_THROTTLE_RETRIES,
  readQueryCost,
  throttleRetryDelay,
  throttledBody,
  waitBeforeNext,
  type QueryCost,
} from "./throttle";

/**
 * `AdminQueries`/`AdminMutations` carry a string index signature, so plain
 * `keyof` would accept any string (and type its result as `any`). This keeps
 * only the operations generated from `#graphql` tags in `operations.ts`.
 */
type LiteralKeys<T> = keyof {
  [K in keyof T as string extends K ? never : number extends K ? never : K]: T[K];
};

export type OperationName = LiteralKeys<AdminQueries> | LiteralKeys<AdminMutations>;
export type OperationVariables<Op extends OperationName> = AdminOperations[Op]["variables"];
export type OperationResult<Op extends OperationName> = AdminOperations[Op]["return"];

type Sleep = (ms: number) => Promise<void>;

const sleep: Sleep = (ms) =>
  ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

export class GraphqlResponseError extends Error {}

/**
 * Wraps `admin.graphql` with typed operations and cost-aware pacing: before
 * each request it waits for the leaky bucket to hold enough points for the
 * previous request's cost, and it retries THROTTLED responses with backoff.
 * Reuse one instance per request so pacing carries across paginated calls.
 */
export class AdminClient {
  private lastCost: QueryCost | null = null;

  constructor(
    private readonly admin: Pick<AdminApiContext, "graphql">,
    private readonly wait: Sleep = sleep,
  ) {}

  async request<Op extends OperationName>(
    operation: Op,
    variables: OperationVariables<Op>,
  ): Promise<OperationResult<Op>> {
    for (let attempt = 0; ; attempt++) {
      await this.wait(waitBeforeNext(this.lastCost));
      try {
        const response = await this.admin.graphql(operation, { variables });
        const body = await response.json();
        this.lastCost = readQueryCost(body.extensions) ?? this.lastCost;
        if (body.data === undefined) {
          throw new GraphqlResponseError("Shopify returned no data for the request.");
        }
        return body.data;
      } catch (error) {
        const throttled = throttledBody(error);
        if (!throttled || attempt >= MAX_THROTTLE_RETRIES) throw error;
        this.lastCost = readQueryCost(throttled.extensions) ?? this.lastCost;
        await this.wait(throttleRetryDelay(throttled, attempt));
      }
    }
  }

  /** Last bucket reading, exposed for logging and tests. */
  get cost(): QueryCost | null {
    return this.lastCost;
  }
}
