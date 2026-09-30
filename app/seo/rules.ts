import type { CheckId, ResourceKind, Severity } from "./types";

export const LIMITS = {
  seoTitle: { min: 20, max: 60 },
  metaDescription: { min: 70, max: 160 },
  /** Descriptions under this many words are flagged as thin. */
  thinDescriptionWords: 50,
  /** Screen readers handle alt text best under ~125 characters. */
  altTextMax: 125,
} as const;

/** Points deducted from a resource's 100-point score per issue. */
export const PENALTY: Record<Severity, number> = {
  fail: 20,
  warn: 8,
};

export interface CheckMeta {
  id: CheckId;
  label: string;
  severity: Severity;
  appliesTo: ResourceKind[];
  rule: string;
}

export const CHECKS: readonly CheckMeta[] = [
  {
    id: "seo-title-missing",
    label: "SEO title missing",
    severity: "warn",
    appliesTo: ["product"],
    rule: "No SEO title is set, so Shopify falls back to the product title.",
  },
  {
    id: "seo-title-length",
    label: "SEO title length",
    severity: "warn",
    appliesTo: ["product"],
    rule: `SEO title is shorter than ${LIMITS.seoTitle.min} or longer than ${LIMITS.seoTitle.max} characters.`,
  },
  {
    id: "meta-description-missing",
    label: "Meta description missing",
    severity: "fail",
    appliesTo: ["product"],
    rule: "No meta description is set, so search engines pick their own snippet.",
  },
  {
    id: "meta-description-length",
    label: "Meta description length",
    severity: "warn",
    appliesTo: ["product"],
    rule: `Meta description is shorter than ${LIMITS.metaDescription.min} or longer than ${LIMITS.metaDescription.max} characters.`,
  },
  {
    id: "duplicate-meta-description",
    label: "Duplicate meta description",
    severity: "fail",
    appliesTo: ["product", "collection"],
    rule: "The same meta description is used on two or more pages.",
  },
  {
    id: "duplicate-title",
    label: "Duplicate product title",
    severity: "fail",
    appliesTo: ["product"],
    rule: "Two or more products share the same title.",
  },
  {
    id: "image-alt-missing",
    label: "Image alt text missing",
    severity: "fail",
    appliesTo: ["product"],
    rule: "One or more product images have no alt text.",
  },
  {
    id: "thin-description",
    label: "Thin description",
    severity: "warn",
    appliesTo: ["product"],
    rule: `Product description is under ${LIMITS.thinDescriptionWords} words.`,
  },
  {
    id: "collection-description-missing",
    label: "Collection description missing",
    severity: "warn",
    appliesTo: ["collection"],
    rule: "Collection has no description.",
  },
];

const CHECKS_BY_ID = new Map(CHECKS.map((check) => [check.id, check]));

export function checkMeta(id: CheckId): CheckMeta {
  const meta = CHECKS_BY_ID.get(id);
  if (!meta) throw new Error(`Unknown check: ${id}`);
  return meta;
}

/**
 * Shopify creates a "Home page" collection (handle `frontpage`) on every
 * store for theme use. It isn't merchandised, so auditing it is noise.
 */
export const IGNORED_COLLECTION_HANDLES: ReadonlySet<string> = new Set([
  "frontpage",
]);
