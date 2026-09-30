import { checkMeta } from "../seo/rules";
import type { Issue } from "../seo/types";

const COLUMNS = [
  "Type",
  "Title",
  "Handle",
  "Check",
  "Severity",
  "Details",
  "Current value",
  "Suggestion",
  "Suggested value",
] as const;

/** RFC 4180 quoting, plus a guard against spreadsheet formula injection. */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function issuesToCsv(issues: readonly Issue[]): string {
  const rows = issues.map((issue) => [
    issue.resource.kind,
    issue.resource.title,
    issue.resource.handle,
    checkMeta(issue.check).label,
    issue.severity === "fail" ? "Fail" : "Warning",
    issue.message,
    issue.currentValue ?? "",
    issue.suggestion,
    issue.suggestedValue ?? "",
  ]);
  return [COLUMNS, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
