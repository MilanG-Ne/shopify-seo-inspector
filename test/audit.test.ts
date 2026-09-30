import { describe, expect, it } from "vitest";
import { runAudit } from "../app/seo/audit";
import { resourceScore, scoreBand, storeScore } from "../app/seo/score";
import { catalog, collection, demoCatalog, product } from "./helpers";

/**
 * The answer key for the seeded demo store: every deliberate issue, and
 * nothing else. Keyed by handle because two products share the title
 * "Wave Bowl".
 */
const ANSWER_KEY = [
  ["saddle-leather-crossbody-bag", "meta-description-missing"],
  ["saddle-leather-crossbody-bag", "image-alt-missing"],
  ["black-dial-steel-watch", "seo-title-length"],
  ["black-graphic-hoodie", "thin-description"],
  ["black-graphic-hoodie", "image-alt-missing"],
  ["purple-varsity-jacket", "duplicate-meta-description"],
  ["two-tone-varsity-jacket", "duplicate-meta-description"],
  ["two-tone-entry-bench", "meta-description-length"],
  ["two-tone-entry-bench", "image-alt-missing"],
  ["wave-bowl", "duplicate-title"],
  ["wave-bowl-1", "duplicate-title"],
  ["gold-tin-candle", "meta-description-length"],
  ["camel-felt-hat", "seo-title-missing"],
  ["camel-felt-hat", "meta-description-missing"],
  ["camel-felt-hat", "thin-description"],
  ["home-living", "collection-description-missing"],
] as const;

describe("demo store answer key", () => {
  const report = runAudit(demoCatalog());

  it("finds exactly the seeded issues", () => {
    const found = report.issues
      .map((issue) => `${issue.resource.handle} ${issue.check}`)
      .sort();
    const expected = ANSWER_KEY.map(([handle, check]) => `${handle} ${check}`).sort();
    expect(found).toEqual(expected);
  });

  it("reports the measured values from the seed notes", () => {
    const message = (handle: string, check: string) =>
      report.issues.find(
        (issue) => issue.resource.handle === handle && issue.check === check,
      )?.message;

    expect(message("black-dial-steel-watch", "seo-title-length")).toContain("93 characters");
    expect(message("two-tone-entry-bench", "meta-description-length")).toContain("20 characters");
    expect(message("gold-tin-candle", "meta-description-length")).toContain("241 characters");
    expect(message("black-graphic-hoodie", "thin-description")).toContain("8 words");
    expect(message("camel-felt-hat", "thin-description")).toContain("5 words");
  });

  it("leaves the clean controls and complete collections alone", () => {
    const flagged = new Set(report.issues.map((issue) => issue.resource.handle));
    for (const handle of ["colorblock-leather-satchel", "walnut-wall-shelf", "apparel", "bags-accessories"]) {
      expect(flagged.has(handle)).toBe(false);
    }
  });

  it("skips Shopify's built-in Home page collection", () => {
    expect(report.resources.some((summary) => summary.resource.handle === "frontpage")).toBe(false);
    expect(report.resourceCount).toBe(15);
  });

  it("totals and scores the store", () => {
    expect(report).toMatchObject({ issueCount: 16, failCount: 9, warnCount: 7, score: 84 });
    expect(report.resources[0].resource.handle).toBe("saddle-leather-crossbody-bag");
    expect(report.resources[0].score).toBe(60);
  });

  it("drafts fixes that pass their own rules", () => {
    const suggested = Object.fromEntries(
      report.issues
        .filter((issue) => issue.suggestedValue !== undefined)
        .map((issue) => [`${issue.resource.handle} ${issue.check}`, issue.suggestedValue]),
    );
    expect(suggested).toEqual({
      "saddle-leather-crossbody-bag meta-description-missing":
        "A compact crossbody bag in warm saddle-brown leather with an adjustable strap and antique brass buckle.",
      "black-dial-steel-watch seo-title-length":
        "Black Dial Stainless Steel Men's Watch with Sapphire Crystal",
      "purple-varsity-jacket duplicate-meta-description":
        "A vintage-inspired varsity jacket in deep purple wool with cream contrast sleeves, a striped rib collar and snap-button front.",
      "two-tone-varsity-jacket duplicate-meta-description":
        "A two-tone varsity jacket in navy and off-white with a clean, minimal front and ribbed cuffs.",
      "two-tone-entry-bench meta-description-length":
        "A slim entryway bench in natural and smoked pine with tapered legs and a lower slatted shelf for shoes.",
      "gold-tin-candle meta-description-length":
        "Our best-selling small travel candle poured into a brushed gold tin and scented with warm amber, cedar wood and a hint of fresh orange peel.",
    });
  });
});

describe("report shape", () => {
  it("orders fails before warnings", () => {
    const report = runAudit(demoCatalog());
    const firstWarn = report.issues.findIndex((issue) => issue.severity === "warn");
    expect(report.issues.slice(firstWarn).every((issue) => issue.severity === "warn")).toBe(true);
  });

  it("counts issues per check, including checks with none", () => {
    const report = runAudit(catalog([product({ seoDescription: null })]));
    expect(report.byCheck).toHaveLength(9);
    expect(report.byCheck.find((row) => row.check === "meta-description-missing")?.count).toBe(1);
    expect(report.byCheck.find((row) => row.check === "duplicate-title")?.count).toBe(0);
  });

  it("scores a clean catalog 100", () => {
    const report = runAudit(catalog([product(), product()], [collection()]));
    expect(report).toMatchObject({ score: 100, issueCount: 0 });
  });

  it("scores an empty store 100 rather than dividing by zero", () => {
    expect(runAudit(catalog([])).score).toBe(100);
  });
});

describe("scoring", () => {
  it("deducts 20 per fail and 8 per warning, floored at 0", () => {
    expect(resourceScore(0, 0)).toBe(100);
    expect(resourceScore(1, 2)).toBe(64);
    expect(resourceScore(6, 0)).toBe(0);
  });

  it("averages resources and rounds", () => {
    expect(storeScore([100, 60, 92])).toBe(84);
  });

  it("bands scores", () => {
    expect([scoreBand(90), scoreBand(89), scoreBand(70), scoreBand(69)]).toEqual([
      "good",
      "fair",
      "fair",
      "poor",
    ]);
  });
});
