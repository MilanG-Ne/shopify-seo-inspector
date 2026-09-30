import {
  getAudit,
  withVariantContext,
  type AuditSnapshot,
} from "./catalog/catalog.server";
import {
  saveCollectionSeo,
  saveImageAltTexts,
  saveProductSeo,
  type AltTextWrite,
  type SeoFields,
  type WriteResult,
} from "./catalog/fixes.server";
import { PREVIEW_MODE, previewStore } from "./demo/preview.server";
import type { ProductResource } from "./seo/types";
import { AdminClient } from "./shopify/admin.server";
import { authenticate } from "./shopify.server";

/**
 * Everything a route needs from the store. Routes never call the Admin API
 * directly, which keeps them small and lets preview mode swap in fixture data.
 */
export interface Store {
  shop: string;
  mode: "shopify" | "preview";
  loadAudit(options?: { refresh?: boolean }): Promise<AuditSnapshot>;
  /** The product with variant option values on its images, for alt text drafts. */
  loadProductForAltText(product: ProductResource): Promise<ProductResource>;
  saveProductSeo(productId: string, fields: SeoFields): Promise<WriteResult>;
  saveCollectionSeo(
    collectionId: string,
    fields: Omit<SeoFields, "title">,
  ): Promise<WriteResult>;
  saveImageAltTexts(writes: readonly AltTextWrite[]): Promise<WriteResult[]>;
}

export async function getStore(request: Request): Promise<Store> {
  if (PREVIEW_MODE) return previewStore();

  const { admin, session } = await authenticate.admin(request);
  const { shop } = session;
  // One client per request, so pacing carries across its paginated calls.
  const client = new AdminClient(admin);

  return {
    shop,
    mode: "shopify",
    loadAudit: (options) => getAudit(shop, client, options),
    loadProductForAltText: (product) => withVariantContext(client, product),
    saveProductSeo: (productId, fields) =>
      saveProductSeo(shop, client, productId, fields),
    saveCollectionSeo: (collectionId, fields) =>
      saveCollectionSeo(shop, client, collectionId, fields),
    saveImageAltTexts: (writes) => saveImageAltTexts(shop, client, writes),
  };
}
