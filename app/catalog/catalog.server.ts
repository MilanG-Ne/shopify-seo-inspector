import { runAudit } from "../seo/audit";
import type {
  AuditReport,
  Catalog,
  CollectionResource,
  ProductResource,
} from "../seo/types";
import type { AdminClient, OperationResult } from "../shopify/admin.server";
import {
  CATALOG_COLLECTIONS_QUERY,
  CATALOG_PRODUCTS_QUERY,
  PRODUCT_VARIANT_MEDIA_QUERY,
} from "../shopify/operations";
import { mapCollection, mapProduct, withVariantOptions } from "./map";

const PRODUCT_PAGE_SIZE = 25;
const COLLECTION_PAGE_SIZE = 50;
/** Live scans stop here; bigger stores need Bulk Operations (see README). */
export const MAX_SCANNED_PRODUCTS = 2_500;
const CACHE_TTL_MS = 2 * 60 * 1000;

export interface CatalogSnapshot {
  catalog: Catalog;
  fetchedAt: string;
  truncated: boolean;
}

async function fetchProducts(
  client: AdminClient,
): Promise<{ products: ProductResource[]; truncated: boolean }> {
  const products: ProductResource[] = [];
  let after: string | null = null;
  do {
    // Annotated because `after` feeds back into the request (circular inference).
    const data: OperationResult<typeof CATALOG_PRODUCTS_QUERY> = await client.request(CATALOG_PRODUCTS_QUERY, {
      first: PRODUCT_PAGE_SIZE,
      after,
    });
    products.push(...data.products.nodes.map(mapProduct));
    const { hasNextPage, endCursor } = data.products.pageInfo;
    after = hasNextPage ? (endCursor ?? null) : null;
  } while (after !== null && products.length < MAX_SCANNED_PRODUCTS);
  return { products, truncated: after !== null };
}

async function fetchCollections(client: AdminClient): Promise<CollectionResource[]> {
  const collections: CollectionResource[] = [];
  let after: string | null = null;
  do {
    const data: OperationResult<typeof CATALOG_COLLECTIONS_QUERY> = await client.request(CATALOG_COLLECTIONS_QUERY, {
      first: COLLECTION_PAGE_SIZE,
      after,
    });
    collections.push(...data.collections.nodes.map(mapCollection));
    const { hasNextPage, endCursor } = data.collections.pageInfo;
    after = hasNextPage ? (endCursor ?? null) : null;
  } while (after !== null);
  return collections;
}

export async function fetchCatalog(client: AdminClient): Promise<CatalogSnapshot> {
  // Sequential on purpose: both share one cost bucket and the client paces them.
  const { products, truncated } = await fetchProducts(client);
  const collections = await fetchCollections(client);
  return {
    catalog: { products, collections },
    fetchedAt: new Date().toISOString(),
    truncated,
  };
}

/**
 * Per-shop in-memory cache so moving between pages doesn't rescan the store.
 * Writes made through the app patch the cached copy, and "Rescan" bypasses it.
 * A multi-instance deployment would move this to a shared store.
 */
interface CacheEntry {
  expiresAt: number;
  snapshot: Promise<CatalogSnapshot>;
}

const cache = new Map<string, CacheEntry>();

export function getCatalog(
  shop: string,
  client: AdminClient,
  options: { refresh?: boolean } = {},
): Promise<CatalogSnapshot> {
  const cached = cache.get(shop);
  if (!options.refresh && cached && cached.expiresAt > Date.now()) {
    return cached.snapshot;
  }
  const snapshot = fetchCatalog(client);
  cache.set(shop, { expiresAt: Date.now() + CACHE_TTL_MS, snapshot });
  // Don't cache failures: the next request should try again.
  snapshot.catch(() => {
    if (cache.get(shop)?.snapshot === snapshot) cache.delete(shop);
  });
  return snapshot;
}

export interface AuditSnapshot {
  report: AuditReport;
  catalog: Catalog;
  fetchedAt: string;
  truncated: boolean;
}

export async function getAudit(
  shop: string,
  client: AdminClient,
  options: { refresh?: boolean } = {},
): Promise<AuditSnapshot> {
  const snapshot = await getCatalog(shop, client, options);
  return { ...snapshot, report: runAudit(snapshot.catalog) };
}

export type ProductPatch = Partial<
  Pick<ProductResource, "title" | "seoTitle" | "seoDescription">
> & {
  imageAlts?: Record<string, string>;
};

export type CollectionPatch = Partial<
  Pick<CollectionResource, "seoTitle" | "seoDescription">
>;

async function updateCachedCatalog(
  shop: string,
  update: (catalog: Catalog) => Catalog,
): Promise<void> {
  const cached = cache.get(shop);
  if (!cached) return;
  let snapshot: CatalogSnapshot;
  try {
    snapshot = await cached.snapshot;
  } catch {
    return;
  }
  cache.set(shop, {
    expiresAt: cached.expiresAt,
    snapshot: Promise.resolve({ ...snapshot, catalog: update(snapshot.catalog) }),
  });
}

/** Applies a confirmed write to the cached catalog so the next audit reflects it. */
export function patchCachedProduct(
  shop: string,
  productId: string,
  { imageAlts, ...fields }: ProductPatch,
): Promise<void> {
  return updateCachedCatalog(shop, (catalog) => ({
    ...catalog,
    products: catalog.products.map((product) =>
      product.id !== productId
        ? product
        : {
            ...product,
            ...fields,
            images: product.images.map((image) => {
              const alt = imageAlts?.[image.id];
              return alt === undefined ? image : { ...image, alt };
            }),
          },
    ),
  }));
}

export function patchCachedCollection(
  shop: string,
  collectionId: string,
  fields: CollectionPatch,
): Promise<void> {
  return updateCachedCatalog(shop, (catalog) => ({
    ...catalog,
    collections: catalog.collections.map((collection) =>
      collection.id === collectionId ? { ...collection, ...fields } : collection,
    ),
  }));
}

/** A product with variant option values attached to its images, for alt text drafts. */
export async function withVariantContext(
  client: AdminClient,
  product: ProductResource,
): Promise<ProductResource> {
  const data = await client.request(PRODUCT_VARIANT_MEDIA_QUERY, { id: product.id });
  return data.product ? withVariantOptions(product, data.product.variants.nodes) : product;
}
