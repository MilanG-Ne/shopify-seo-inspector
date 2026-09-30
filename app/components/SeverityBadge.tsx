import type { Severity } from "../seo/types";

export function SeverityBadge({ severity }: { severity: Severity }) {
  return severity === "fail" ? (
    <s-badge tone="critical" icon="alert-diamond">
      Fail
    </s-badge>
  ) : (
    <s-badge tone="warning" icon="alert-triangle">
      Warning
    </s-badge>
  );
}
