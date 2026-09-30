import type { ResourceKind, ResourceRef } from "../seo/types";

const GID_PREFIX: Record<ResourceKind, string> = {
  product: "gid://shopify/Product/",
  collection: "gid://shopify/Collection/",
};

const ADMIN_PATH: Record<ResourceKind, string> = {
  product: "products",
  collection: "collections",
};

export function isResourceKind(value: string | undefined): value is ResourceKind {
  return value === "product" || value === "collection";
}

/** "gid://shopify/Product/123" → "123" */
export function numericId(gid: string): string {
  return gid.slice(gid.lastIndexOf("/") + 1);
}

/** Rebuilds a GID from a route param; null unless the param is all digits. */
export function toGid(kind: ResourceKind, id: string | undefined): string | null {
  return id && /^\d+$/.test(id) ? `${GID_PREFIX[kind]}${id}` : null;
}

/** The app's own detail page for a resource. */
export function resourcePath(ref: Pick<ResourceRef, "kind" | "id">): string {
  return `/app/resources/${ref.kind}/${numericId(ref.id)}`;
}

/** Opens the resource in the Shopify admin (App Bridge handles `shopify:`). */
export function adminUrl(ref: Pick<ResourceRef, "kind" | "id">): string {
  return `shopify://admin/${ADMIN_PATH[ref.kind]}/${numericId(ref.id)}`;
}

/** Bulk alt text page for the given products (all flagged products if empty). */
export function altTextPath(productIds: readonly string[] = []): string {
  if (productIds.length === 0) return "/app/alt-text";
  const params = new URLSearchParams({ products: productIds.map(numericId).join(",") });
  return `/app/alt-text?${params.toString()}`;
}
