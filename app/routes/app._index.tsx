import { useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { ScoreRing } from "../components/ScoreRing";
import { SeverityBadge } from "../components/SeverityBadge";
import { resetPreviewStore } from "../demo/preview.server";
import { resourcePath } from "../lib/resource-urls";
import { showToast } from "../lib/toast";
import { CHECKS, LIMITS, PENALTY, checkMeta } from "../seo/rules";
import { getStore } from "../store.server";

const WORST_OFFENDERS = 5;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const store = await getStore(request);
  const { report, fetchedAt, truncated } = await store.loadAudit();

  return {
    preview: store.mode === "preview",
    fetchedAt,
    truncated,
    score: report.score,
    resourceCount: report.resourceCount,
    affectedCount: report.resources.filter((summary) => summary.score < 100).length,
    issueCount: report.issueCount,
    failCount: report.failCount,
    warnCount: report.warnCount,
    byCheck: report.byCheck,
    worst: report.resources
      .filter((summary) => summary.score < 100)
      .slice(0, WORST_OFFENDERS),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const store = await getStore(request);
  const intent = (await request.formData()).get("intent");

  if (intent === "reset-preview" && store.mode === "preview") {
    resetPreviewStore();
    return { done: "Demo data reset" };
  }
  await store.loadAudit({ refresh: true });
  return { done: "Store rescanned" };
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function Dashboard() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const busy = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.done) showToast(fetcher.data.done);
  }, [fetcher.state, fetcher.data]);

  const submit = (intent: string) => fetcher.submit({ intent }, { method: "post" });

  return (
    <s-page heading="SEO overview">
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={() => submit("rescan")}
        {...(busy ? { loading: true } : {})}
      >
        Rescan store
      </s-button>
      {data.preview && (
        <s-button slot="secondary-actions" onClick={() => submit("reset-preview")}>
          Reset demo data
        </s-button>
      )}

      {data.truncated && (
        <s-banner tone="warning" heading="Large catalog: partial scan">
          This scan stopped after the first products it could check live. Scores
          and counts cover only those products.
        </s-banner>
      )}

      <s-section heading="Store score">
        <s-grid gridTemplateColumns="auto 1fr" gap="large-200" alignItems="center">
          <ScoreRing score={data.score} />
          <s-stack direction="block" gap="small-200">
            <s-heading>
              {data.issueCount === 0
                ? "No issues found"
                : `${data.issueCount} ${data.issueCount === 1 ? "issue" : "issues"} on ${data.affectedCount} of ${data.resourceCount} pages`}
            </s-heading>
            <s-stack direction="inline" gap="small-200">
              <s-badge tone={data.failCount > 0 ? "critical" : "success"}>
                {`${data.failCount} failing`}
              </s-badge>
              <s-badge tone={data.warnCount > 0 ? "warning" : "success"}>
                {`${data.warnCount} ${data.warnCount === 1 ? "warning" : "warnings"}`}
              </s-badge>
            </s-stack>
            <s-text color="subdued">
              Active products and collections, last scanned {formatTime(data.fetchedAt)}.
            </s-text>
            <s-stack direction="inline" gap="small-200">
              <s-button href="/app/issues">Review issues</s-button>
              {(data.byCheck.find((row) => row.check === "image-alt-missing")?.count ?? 0) > 0 && (
                <s-button href="/app/alt-text" variant="tertiary">
                  Fix missing alt text
                </s-button>
              )}
            </s-stack>
          </s-stack>
        </s-grid>
      </s-section>

      <s-section heading="Issues by check" padding="none">
        <s-table>
          <s-table-header-row>
            <s-table-header listSlot="primary">Check</s-table-header>
            <s-table-header>Severity</s-table-header>
            <s-table-header format="numeric">Pages</s-table-header>
            <s-table-header listSlot="inline">
              <s-text accessibilityVisibility="exclusive">Actions</s-text>
            </s-table-header>
          </s-table-header-row>
          <s-table-body>
            {data.byCheck.map((row) => (
              <s-table-row key={row.check}>
                <s-table-cell>
                  <s-stack direction="block" gap="none">
                    <s-text type="strong">{checkMeta(row.check).label}</s-text>
                    <s-text color="subdued">{checkMeta(row.check).rule}</s-text>
                  </s-stack>
                </s-table-cell>
                <s-table-cell>
                  <SeverityBadge severity={row.severity} />
                </s-table-cell>
                <s-table-cell>
                  {row.count === 0 ? (
                    <s-badge tone="success" icon="check">
                      Passed
                    </s-badge>
                  ) : (
                    row.count
                  )}
                </s-table-cell>
                <s-table-cell>
                  {row.count > 0 && (
                    <s-link href={`/app/issues?check=${row.check}`}>View</s-link>
                  )}
                </s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
      </s-section>

      <s-section heading="Worst offenders" padding="none">
        {data.worst.length === 0 ? (
          <s-box padding="base">
            <s-paragraph>Every product and collection passes all checks.</s-paragraph>
          </s-box>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Page</s-table-header>
              <s-table-header listSlot="kicker">Type</s-table-header>
              <s-table-header>Issues</s-table-header>
              <s-table-header format="numeric" listSlot="secondary">
                Score
              </s-table-header>
            </s-table-header-row>
            <s-table-body>
              {data.worst.map((summary) => (
                <s-table-row key={summary.resource.id} clickDelegate={`worst-${summary.resource.id}`}>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small-200" alignItems="center">
                      <s-thumbnail
                        size="small-200"
                        src={summary.imageUrl ?? undefined}
                        alt=""
                      />
                      <s-link id={`worst-${summary.resource.id}`} href={resourcePath(summary.resource)}>
                        {summary.resource.title}
                      </s-link>
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>
                    {summary.resource.kind === "product" ? "Product" : "Collection"}
                  </s-table-cell>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small-200">
                      {summary.fails > 0 && <s-badge tone="critical">{`${summary.fails} failing`}</s-badge>}
                      {summary.warns > 0 && (
                        <s-badge tone="warning">
                          {`${summary.warns} ${summary.warns === 1 ? "warning" : "warnings"}`}
                        </s-badge>
                      )}
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>{summary.score}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>

      <s-section slot="aside" heading="How the score works">
        <s-paragraph>
          Each product and collection starts at 100 and loses {PENALTY.fail} points
          per failing check and {PENALTY.warn} per warning. The store score is the
          average, so a large catalog isn&apos;t penalised for its size.
        </s-paragraph>
        <s-paragraph>
          <s-text color="subdued">
            90 and up is good, 70 to 89 needs work, below 70 is poor.
          </s-text>
        </s-paragraph>
      </s-section>

      <s-section slot="aside" heading="What's checked">
        <s-unordered-list>
          {CHECKS.map((check) => (
            <s-list-item key={check.id}>{check.label}</s-list-item>
          ))}
        </s-unordered-list>
        <s-paragraph>
          <s-text color="subdued">
            SEO titles: {LIMITS.seoTitle.min}–{LIMITS.seoTitle.max} characters. Meta
            descriptions: {LIMITS.metaDescription.min}–{LIMITS.metaDescription.max}.
            Descriptions: at least {LIMITS.thinDescriptionWords} words.
          </s-text>
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
