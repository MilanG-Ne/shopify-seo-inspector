/**
 * Domain model for the audit engine. Everything in `app/seo` is pure and
 * framework-free: it takes a normalized catalog and returns issues, so every
 * rule can be unit-tested against fixture data without Shopify.
 */

export type Severity = "fail" | "warn";

export type ResourceKind = "product" | "collection";

export type CheckId =
  | "seo-title-missing"
  | "seo-title-length"
  | "meta-description-missing"
  | "meta-description-length"
  | "duplicate-meta-description"
  | "duplicate-title"
  | "image-alt-missing"
  | "thin-description"
  | "collection-description-missing";

export interface ProductImage {
  /** MediaImage GID, the ID `fileUpdate` expects. */
  id: string;
  /** Alt text as stored; empty string when missing. */
  alt: string;
  url: string | null;
  /**
   * Option values shared by every variant that uses this image, e.g.
   * `["Charcoal"]`. Empty when the image isn't tied to a variant.
   */
  variantOptionValues: string[];
}

export interface ProductResource {
  kind: "product";
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  /** Trimmed SEO title, or null when unset (Shopify then uses `title`). */
  seoTitle: string | null;
  /** Trimmed meta description, or null when unset. */
  seoDescription: string | null;
  images: ProductImage[];
  imageUrl: string | null;
}

export interface CollectionResource {
  kind: "collection";
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  seoTitle: string | null;
  seoDescription: string | null;
  productsCount: number;
}

export type Resource = ProductResource | CollectionResource;

export interface Catalog {
  products: ProductResource[];
  collections: CollectionResource[];
}

export interface ResourceRef {
  kind: ResourceKind;
  id: string;
  title: string;
  handle: string;
}

export interface Issue {
  /** Stable key (`check:resourceId`) used for row selection in the UI. */
  key: string;
  check: CheckId;
  severity: Severity;
  resource: ResourceRef;
  /** One-line description of what's wrong, with the measured value. */
  message: string;
  /** The offending value as stored, or null when it's missing entirely. */
  currentValue: string | null;
  /** Human guidance for fixing it. */
  suggestion: string;
  /**
   * A ready-to-apply replacement that already passes the rule, when one can be
   * derived from the resource's own data. Always reviewed before saving.
   */
  suggestedValue?: string;
  /** Other resources involved (duplicate checks). */
  related?: ResourceRef[];
  /** Images without alt text (image check). */
  imageIds?: string[];
}

export interface ResourceSummary {
  resource: ResourceRef;
  imageUrl: string | null;
  score: number;
  fails: number;
  warns: number;
}

export interface CheckSummary {
  check: CheckId;
  severity: Severity;
  count: number;
}

export interface AuditReport {
  score: number;
  resourceCount: number;
  issueCount: number;
  failCount: number;
  warnCount: number;
  issues: Issue[];
  byCheck: CheckSummary[];
  resources: ResourceSummary[];
}
