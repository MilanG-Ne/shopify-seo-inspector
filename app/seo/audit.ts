import { CHECK_FUNCTIONS, toRef } from "./checks";
import { CHECKS, IGNORED_COLLECTION_HANDLES } from "./rules";
import { resourceScore, storeScore } from "./score";
import type {
  AuditReport,
  Catalog,
  CheckSummary,
  Issue,
  Resource,
  ResourceSummary,
} from "./types";

/** Drops resources the audit deliberately skips (see README). */
export function auditableCatalog(catalog: Catalog): Catalog {
  return {
    products: catalog.products,
    collections: catalog.collections.filter(
      (collection) => !IGNORED_COLLECTION_HANDLES.has(collection.handle),
    ),
  };
}

const CHECK_ORDER = new Map(CHECKS.map((check, index) => [check.id, index]));

function compareIssues(a: Issue, b: Issue): number {
  if (a.severity !== b.severity) return a.severity === "fail" ? -1 : 1;
  const byCheck =
    (CHECK_ORDER.get(a.check) ?? 0) - (CHECK_ORDER.get(b.check) ?? 0);
  if (byCheck !== 0) return byCheck;
  return a.resource.title.localeCompare(b.resource.title, "en");
}

function summarizeResource(resource: Resource, issues: Issue[]): ResourceSummary {
  const fails = issues.filter((issue) => issue.severity === "fail").length;
  const warns = issues.length - fails;
  return {
    resource: toRef(resource),
    imageUrl: resource.kind === "product" ? resource.imageUrl : null,
    score: resourceScore(fails, warns),
    fails,
    warns,
  };
}

export function runAudit(input: Catalog): AuditReport {
  const catalog = auditableCatalog(input);
  const issues = CHECKS.flatMap((check) => CHECK_FUNCTIONS[check.id](catalog)).sort(
    compareIssues,
  );

  const issuesByResource = new Map<string, Issue[]>();
  for (const issue of issues) {
    const list = issuesByResource.get(issue.resource.id);
    if (list) list.push(issue);
    else issuesByResource.set(issue.resource.id, [issue]);
  }

  const resources = [...catalog.products, ...catalog.collections]
    .map((resource) =>
      summarizeResource(resource, issuesByResource.get(resource.id) ?? []),
    )
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.resource.title.localeCompare(b.resource.title, "en"),
    );

  const byCheck: CheckSummary[] = CHECKS.map((check) => ({
    check: check.id,
    severity: check.severity,
    count: issues.filter((issue) => issue.check === check.id).length,
  }));

  const failCount = issues.filter((issue) => issue.severity === "fail").length;

  return {
    score: storeScore(resources.map((summary) => summary.score)),
    resourceCount: resources.length,
    issueCount: issues.length,
    failCount,
    warnCount: issues.length - failCount,
    issues,
    byCheck,
    resources,
  };
}

export function issuesForResource(report: AuditReport, resourceId: string): Issue[] {
  return report.issues.filter((issue) => issue.resource.id === resourceId);
}
