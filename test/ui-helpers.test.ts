import { describe, expect, it } from "vitest";
import { issuesToCsv } from "../app/lib/csv";
import { parseAltTextWrites } from "../app/lib/parse";
import { adminUrl, altTextPath, numericId, resourcePath, toGid } from "../app/lib/resource-urls";
import { lengthTone } from "../app/seo/length";
import type { Issue } from "../app/seo/types";

describe("lengthTone", () => {
  const range = { min: 20, max: 60 };

  it("is green in range, amber when short, red when too long", () => {
    expect(lengthTone(20, range)).toBe("success");
    expect(lengthTone(60, range)).toBe("success");
    expect(lengthTone(19, range)).toBe("warning");
    expect(lengthTone(61, range)).toBe("critical");
  });

  it("uses the given tone for an empty field", () => {
    expect(lengthTone(0, range)).toBe("critical");
    expect(lengthTone(0, range, "warning")).toBe("warning");
  });
});

describe("resource URLs", () => {
  const product = { kind: "product" as const, id: "gid://shopify/Product/15354623361256" };

  it("round-trips GIDs through route params", () => {
    expect(numericId(product.id)).toBe("15354623361256");
    expect(toGid("product", "15354623361256")).toBe(product.id);
    expect(toGid("collection", "abc")).toBeNull();
    expect(toGid("product", undefined)).toBeNull();
  });

  it("builds app and admin links", () => {
    expect(resourcePath(product)).toBe("/app/resources/product/15354623361256");
    expect(adminUrl(product)).toBe("shopify://admin/products/15354623361256");
    expect(altTextPath([product.id, "gid://shopify/Product/2"])).toBe(
      "/app/alt-text?products=15354623361256%2C2",
    );
    expect(altTextPath()).toBe("/app/alt-text");
  });
});

describe("parseAltTextWrites", () => {
  const valid = {
    productId: "gid://shopify/Product/1",
    imageId: "gid://shopify/MediaImage/2",
    alt: "Ochre wave bowl",
  };

  it("accepts well-formed writes", () => {
    expect(parseAltTextWrites({ writes: [valid] })).toEqual([valid]);
  });

  it("rejects malformed bodies and foreign IDs", () => {
    expect(parseAltTextWrites(null)).toBeNull();
    expect(parseAltTextWrites({ writes: [] })).toBeNull();
    expect(parseAltTextWrites({ writes: [{ ...valid, alt: 3 }] })).toBeNull();
    expect(parseAltTextWrites({ writes: [{ ...valid, imageId: "gid://shopify/Video/2" }] })).toBeNull();
    expect(parseAltTextWrites({ writes: [{ ...valid, productId: "1" }] })).toBeNull();
    expect(parseAltTextWrites({ writes: Array.from({ length: 251 }, () => valid) })).toBeNull();
  });
});

describe("issuesToCsv", () => {
  const issue: Issue = {
    key: "duplicate-meta-description:1",
    check: "duplicate-meta-description",
    severity: "fail",
    resource: { kind: "product", id: "gid://shopify/Product/1", title: 'Bowl, "Wave"', handle: "wave-bowl" },
    message: "Same meta description as “Other”.",
    currentValue: "=HYPERLINK(\"x\")",
    suggestion: "Write a unique description.",
  };

  it("quotes fields and neutralizes spreadsheet formulas", () => {
    const [header, row] = issuesToCsv([issue]).trimEnd().split("\r\n");
    expect(header).toBe("Type,Title,Handle,Check,Severity,Details,Current value,Suggestion,Suggested value");
    expect(row).toBe(
      'product,"Bowl, ""Wave""",wave-bowl,Duplicate meta description,Fail,Same meta description as “Other”.,"\'=HYPERLINK(""x"")",Write a unique description.,',
    );
  });
});
