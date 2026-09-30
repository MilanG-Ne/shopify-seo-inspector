import { useMemo, useState } from "react";
import type {
  HeadersFunction,
  LoaderFunctionArgs,
  ShouldRevalidateFunction,
} from "react-router";
import { useLoaderData, useNavigate, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { SeverityBadge } from "../components/SeverityBadge";
import { issuesToCsv } from "../lib/csv";
import { flag } from "../lib/polaris";
import { altTextPath, resourcePath } from "../lib/resource-urls";
import { CHECKS, checkMeta } from "../seo/rules";
import type { CheckId, Issue, Severity } from "../seo/types";
import { getStore } from "../store.server";

const PAGE_SIZE = 25;
const ALL = "all";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const store = await getStore(request);
  const { report } = await store.loadAudit();
  const thumbnails: Record<string, string> = {};
  for (const summary of report.resources) {
    if (summary.imageUrl) thumbnails[summary.resource.id] = summary.imageUrl;
  }
  return { issues: report.issues, thumbnails };
};

// Filters live in the URL but are applied client-side, so changing them
// shouldn't refetch the catalog.
export const shouldRevalidate: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}) => {
  if (!formMethod && currentUrl.pathname === nextUrl.pathname) return false;
  return defaultShouldRevalidate;
};

function isCheckId(value: string | null): value is CheckId {
  return CHECKS.some((check) => check.id === value);
}

function isSeverity(value: string | null): value is Severity {
  return value === "fail" || value === "warn";
}

function matchesSearch(issue: Issue, query: string): boolean {
  if (query === "") return true;
  const haystack = [
    issue.resource.title,
    issue.resource.handle,
    issue.message,
    issue.currentValue ?? "",
    checkMeta(issue.check).label,
  ]
    .join(" ")
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((term) => haystack.includes(term));
}

function clip(text: string, max = 90): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function downloadCsv(issues: Issue[]): void {
  const blob = new Blob([issuesToCsv(issues)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `seo-issues-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Issues() {
  const { issues, thumbnails } = useLoaderData<typeof loader>();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [page, setPage] = useState(0);

  const checkParam = params.get("check");
  const severityParam = params.get("severity");
  const check = isCheckId(checkParam) ? checkParam : null;
  const severity = isSeverity(severityParam) ? severityParam : null;
  const query = params.get("q") ?? "";

  const filtered = useMemo(
    () =>
      issues.filter(
        (issue) =>
          (check === null || issue.check === check) &&
          (severity === null || issue.severity === severity) &&
          matchesSearch(issue, query.trim()),
      ),
    [issues, check, severity, query],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    // "all" is the "no filter" option: an empty option value makes the select
    // fall back to the option's label, so it can't be used as a sentinel.
    if (value === "" || value === ALL) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true, preventScrollReset: true });
    setPage(0);
  };

  const toggle = (key: string, on: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const allVisibleSelected = visible.length > 0 && visible.every((issue) => selected.has(issue.key));
  const someVisibleSelected = visible.some((issue) => selected.has(issue.key));
  const toggleVisible = (on: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      for (const issue of visible) {
        if (on) next.add(issue.key);
        else next.delete(issue.key);
      }
      return next;
    });
  };

  const selectedIssues = issues.filter((issue) => selected.has(issue.key));
  const altProductIds = [
    ...new Set(
      selectedIssues
        .filter((issue) => issue.check === "image-alt-missing")
        .map((issue) => issue.resource.id),
    ),
  ];

  return (
    <s-page heading="Issues" inlineSize="large">
      <s-button slot="secondary-actions" onClick={() => downloadCsv(filtered)}>
        Export CSV
      </s-button>

      <s-section padding="none">
        <s-box padding="base">
          {/* Responsive grid values need a query container ancestor. */}
          <s-query-container>
            <s-grid gridTemplateColumns="@container (inline-size > 640px) 2fr 1fr 1fr, 1fr" gap="base">
              <s-search-field
                label="Search issues"
                labelAccessibilityVisibility="exclusive"
                placeholder="Search by product, collection or value"
                value={query}
                onInput={(event) => updateParam("q", event.currentTarget.value)}
              />
              <s-select
                label="Check"
                labelAccessibilityVisibility="exclusive"
                value={check ?? ALL}
                onInput={(event) => updateParam("check", event.currentTarget.value)}
              >
                <s-option value={ALL}>All checks</s-option>
                {CHECKS.map((meta) => (
                  <s-option key={meta.id} value={meta.id}>
                    {meta.label}
                  </s-option>
                ))}
              </s-select>
              <s-select
                label="Severity"
                labelAccessibilityVisibility="exclusive"
                value={severity ?? ALL}
                onInput={(event) => updateParam("severity", event.currentTarget.value)}
              >
                <s-option value={ALL}>All severities</s-option>
                <s-option value="fail">Fail</s-option>
                <s-option value="warn">Warning</s-option>
              </s-select>
            </s-grid>
          </s-query-container>
        </s-box>

        {selected.size > 0 && (
          <s-box padding="small-200 base" background="subdued" borderWidth="base none" borderColor="base">
            <s-stack direction="inline" gap="base" alignItems="center">
              <s-text type="strong">{`${selected.size} selected`}</s-text>
              <s-button
                variant="primary"
                disabled={flag(altProductIds.length === 0)}
                onClick={() => navigate(altTextPath(altProductIds))}
              >
                {altProductIds.length > 0
                  ? `Write alt text for ${altProductIds.length} ${altProductIds.length === 1 ? "product" : "products"}`
                  : "Write alt text"}
              </s-button>
              <s-button onClick={() => downloadCsv(selectedIssues)}>Export selected</s-button>
              <s-button variant="tertiary" onClick={() => setSelected(new Set())}>
                Clear selection
              </s-button>
            </s-stack>
          </s-box>
        )}

        {filtered.length === 0 ? (
          <s-box padding="large-200">
            <s-stack direction="block" gap="small-200" alignItems="center">
              <s-heading>{issues.length === 0 ? "No issues found" : "No issues match these filters"}</s-heading>
              <s-text color="subdued">
                {issues.length === 0
                  ? "Every product and collection passes all checks."
                  : "Try a different check, severity or search term."}
              </s-text>
            </s-stack>
          </s-box>
        ) : (
          <s-table
            paginate={flag(pageCount > 1)}
            hasPreviousPage={flag(currentPage > 0)}
            hasNextPage={flag(currentPage < pageCount - 1)}
            onPreviousPage={() => setPage(currentPage - 1)}
            onNextPage={() => setPage(currentPage + 1)}
          >
            <s-table-header-row>
              <s-table-header>
                <s-checkbox
                  accessibilityLabel="Select all issues on this page"
                  checked={flag(allVisibleSelected)}
                  indeterminate={flag(someVisibleSelected && !allVisibleSelected)}
                  onInput={(event) => toggleVisible(event.currentTarget.checked)}
                />
              </s-table-header>
              <s-table-header listSlot="primary">Page</s-table-header>
              <s-table-header listSlot="labeled">Issue</s-table-header>
              <s-table-header listSlot="kicker">Severity</s-table-header>
              <s-table-header listSlot="labeled">Current value</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {visible.map((issue) => (
                <s-table-row key={issue.key}>
                  <s-table-cell>
                    <s-checkbox
                      accessibilityLabel={`Select ${checkMeta(issue.check).label} on ${issue.resource.title}`}
                      checked={flag(selected.has(issue.key))}
                      onInput={(event) => toggle(issue.key, event.currentTarget.checked)}
                    />
                  </s-table-cell>
                  <s-table-cell>
                    <s-grid gridTemplateColumns="auto 1fr" gap="small-200" alignItems="center">
                      <s-thumbnail size="small-200" src={thumbnails[issue.resource.id]} alt="" />
                      <s-stack direction="block" gap="none">
                        <s-link href={resourcePath(issue.resource)}>{issue.resource.title}</s-link>
                        <s-text color="subdued">
                          {issue.resource.kind === "product" ? "Product" : "Collection"} · /{issue.resource.handle}
                        </s-text>
                      </s-stack>
                    </s-grid>
                  </s-table-cell>
                  <s-table-cell>
                    <s-stack direction="block" gap="none">
                      <s-text type="strong">{checkMeta(issue.check).label}</s-text>
                      <s-text color="subdued">{issue.message}</s-text>
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>
                    <SeverityBadge severity={issue.severity} />
                  </s-table-cell>
                  <s-table-cell>
                    {issue.currentValue === null ? (
                      <s-text color="subdued">Not set</s-text>
                    ) : (
                      <s-text>{clip(issue.currentValue)}</s-text>
                    )}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}

        <s-box padding="small-200 base">
          <s-text color="subdued">
            {`Showing ${visible.length} of ${filtered.length} ${filtered.length === 1 ? "issue" : "issues"}`}
            {filtered.length !== issues.length ? ` (${issues.length} in total)` : ""}
          </s-text>
        </s-box>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
