import { LIMITS, checkMeta } from "./rules";
import {
  charLength,
  fitSentences,
  fitTitle,
  htmlToText,
  normalizeForCompare,
  wordCount,
} from "./text";
import type {
  Catalog,
  CheckId,
  Issue,
  Resource,
  ResourceRef,
} from "./types";

/** A check is a pure function from the whole catalog to its issues. */
export type Check = (catalog: Catalog) => Issue[];

export function toRef(resource: Resource): ResourceRef {
  return {
    kind: resource.kind,
    id: resource.id,
    title: resource.title,
    handle: resource.handle,
  };
}

function makeIssue(
  check: CheckId,
  resource: Resource,
  fields: Pick<Issue, "message" | "currentValue" | "suggestion"> &
    Partial<Pick<Issue, "suggestedValue" | "related" | "imageIds">>,
): Issue {
  const issue: Issue = {
    key: `${check}:${resource.id}`,
    check,
    severity: checkMeta(check).severity,
    resource: toRef(resource),
    message: fields.message,
    currentValue: fields.currentValue,
    suggestion: fields.suggestion,
  };
  // Leave optional fields off entirely rather than set to undefined, so
  // issues serialize cleanly to the client.
  if (fields.suggestedValue !== undefined) issue.suggestedValue = fields.suggestedValue;
  if (fields.related !== undefined) issue.related = fields.related;
  if (fields.imageIds !== undefined) issue.imageIds = fields.imageIds;
  return issue;
}

function allResources(catalog: Catalog): Resource[] {
  return [...catalog.products, ...catalog.collections];
}

function groupBy<T>(items: T[], keyOf: (item: T) => string | null): T[][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    if (key === null || key === "") continue;
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return [...groups.values()];
}

function quoteList(resources: Resource[]): string {
  return resources.map((resource) => `“${resource.title}”`).join(", ");
}

/**
 * A meta description drafted from the resource's own copy, only when it fits
 * the length rule and isn't already used elsewhere in the catalog.
 */
function draftMetaDescription(
  resource: Resource,
  catalog: Catalog,
): string | undefined {
  const draft = fitSentences(
    htmlToText(resource.descriptionHtml),
    LIMITS.metaDescription,
  );
  if (draft === null) return undefined;
  const key = normalizeForCompare(draft);
  const taken = allResources(catalog).some(
    (other) =>
      other.seoDescription !== null &&
      normalizeForCompare(other.seoDescription) === key,
  );
  return taken ? undefined : draft;
}

const { seoTitle: titleRange, metaDescription: metaRange } = LIMITS;

export const seoTitleMissing: Check = (catalog) =>
  catalog.products
    .filter((product) => product.seoTitle === null)
    .map((product) =>
      makeIssue("seo-title-missing", product, {
        message: `No SEO title. Search results fall back to the product title “${product.title}” (${charLength(product.title)} characters).`,
        currentValue: null,
        suggestion: `Write an SEO title of ${titleRange.min}–${titleRange.max} characters that leads with what the product is.`,
      }),
    );

export const seoTitleLength: Check = (catalog) =>
  catalog.products.flatMap((product) => {
    if (product.seoTitle === null) return [];
    const length = charLength(product.seoTitle);

    if (length > titleRange.max) {
      const fitted = fitTitle(product.seoTitle, titleRange);
      return [
        makeIssue("seo-title-length", product, {
          message: `SEO title is ${length} characters. Google usually cuts titles off after about ${titleRange.max}.`,
          currentValue: product.seoTitle,
          suggestion: `Shorten it to ${titleRange.max} characters or fewer and keep the key terms first.`,
          ...(fitted === null ? {} : { suggestedValue: fitted }),
        }),
      ];
    }

    if (length < titleRange.min) {
      const productTitle = fitTitle(product.title, titleRange);
      return [
        makeIssue("seo-title-length", product, {
          message: `SEO title is ${length} characters. Aim for at least ${titleRange.min} so it describes the product.`,
          currentValue: product.seoTitle,
          suggestion:
            "Add the product type or a key attribute such as material, colour or use.",
          ...(productTitle === null || productTitle === product.seoTitle
            ? {}
            : { suggestedValue: productTitle }),
        }),
      ];
    }

    return [];
  });

export const metaDescriptionMissing: Check = (catalog) =>
  catalog.products
    .filter((product) => product.seoDescription === null)
    .map((product) => {
      const draft = draftMetaDescription(product, catalog);
      return makeIssue("meta-description-missing", product, {
        message:
          "No meta description. Search engines will pick their own snippet from the page.",
        currentValue: null,
        suggestion: `Write ${metaRange.min}–${metaRange.max} characters that say what the product is and why someone would want it.`,
        ...(draft === undefined ? {} : { suggestedValue: draft }),
      });
    });

export const metaDescriptionLength: Check = (catalog) =>
  catalog.products.flatMap((product) => {
    if (product.seoDescription === null) return [];
    const length = charLength(product.seoDescription);

    if (length > metaRange.max) {
      const fitted = fitSentences(product.seoDescription, metaRange);
      return [
        makeIssue("meta-description-length", product, {
          message: `Meta description is ${length} characters. Search results show about ${metaRange.max}.`,
          currentValue: product.seoDescription,
          suggestion: `Trim it to ${metaRange.max} characters or fewer so the snippet isn't cut off mid-sentence.`,
          ...(fitted === null ? {} : { suggestedValue: fitted }),
        }),
      ];
    }

    if (length < metaRange.min) {
      const draft = draftMetaDescription(product, catalog);
      return [
        makeIssue("meta-description-length", product, {
          message: `Meta description is ${length} characters. Aim for ${metaRange.min}–${metaRange.max} so it earns the click.`,
          currentValue: product.seoDescription,
          suggestion:
            "Expand it with the main benefit and one or two concrete details.",
          ...(draft === undefined ? {} : { suggestedValue: draft }),
        }),
      ];
    }

    return [];
  });

export const duplicateMetaDescription: Check = (catalog) =>
  groupBy(allResources(catalog), (resource) =>
    resource.seoDescription === null
      ? null
      : normalizeForCompare(resource.seoDescription),
  )
    .filter((group) => group.length > 1)
    .flatMap((group) =>
      group.map((resource) => {
        const others = group.filter((other) => other.id !== resource.id);
        const draft = draftMetaDescription(resource, catalog);
        return makeIssue("duplicate-meta-description", resource, {
          message: `Same meta description as ${quoteList(others)}.`,
          currentValue: resource.seoDescription,
          suggestion:
            "Write a unique description for each page so they don't compete with each other in search.",
          related: others.map(toRef),
          ...(draft === undefined ? {} : { suggestedValue: draft }),
        });
      }),
    );

export const duplicateTitle: Check = (catalog) =>
  groupBy(catalog.products, (product) => normalizeForCompare(product.title))
    .filter((group) => group.length > 1)
    .flatMap((group) =>
      group.map((product) => {
        const others = group.filter((other) => other.id !== product.id);
        return makeIssue("duplicate-title", product, {
          message: `${group.length} products are titled “${product.title}”.`,
          currentValue: product.title,
          suggestion:
            "Rename each one so the title says what's different, such as colour, material or size.",
          related: others.map(toRef),
        });
      }),
    );

export const imageAltMissing: Check = (catalog) =>
  catalog.products.flatMap((product) => {
    const missing = product.images.filter((image) => image.alt.trim() === "");
    if (missing.length === 0) return [];
    const total = product.images.length;
    return [
      makeIssue("image-alt-missing", product, {
        message:
          total === 1
            ? "The product image has no alt text."
            : `${missing.length} of ${total} images have no alt text.`,
        currentValue: null,
        suggestion:
          "Describe what each image shows. The bulk alt text tool can draft it from the product and variant names.",
        imageIds: missing.map((image) => image.id),
      }),
    ];
  });

export const thinDescription: Check = (catalog) =>
  catalog.products.flatMap((product) => {
    const text = htmlToText(product.descriptionHtml);
    const words = wordCount(text);
    if (words >= LIMITS.thinDescriptionWords) return [];
    return [
      makeIssue("thin-description", product, {
        message:
          words === 0
            ? "The product has no description."
            : `Description is ${words} ${words === 1 ? "word" : "words"}. Aim for at least ${LIMITS.thinDescriptionWords}.`,
        currentValue: text === "" ? null : text,
        suggestion:
          "Cover materials, size or dimensions, what it's for and how to care for it.",
      }),
    ];
  });

export const collectionDescriptionMissing: Check = (catalog) =>
  catalog.collections
    .filter((collection) => htmlToText(collection.descriptionHtml) === "")
    .map((collection) =>
      makeIssue("collection-description-missing", collection, {
        message: "The collection has no description.",
        currentValue: null,
        suggestion:
          "Add a 2–3 sentence intro that describes the range in the words shoppers search with.",
      }),
    );

export const CHECK_FUNCTIONS: Record<CheckId, Check> = {
  "seo-title-missing": seoTitleMissing,
  "seo-title-length": seoTitleLength,
  "meta-description-missing": metaDescriptionMissing,
  "meta-description-length": metaDescriptionLength,
  "duplicate-meta-description": duplicateMetaDescription,
  "duplicate-title": duplicateTitle,
  "image-alt-missing": imageAltMissing,
  "thin-description": thinDescription,
  "collection-description-missing": collectionDescriptionMissing,
};

