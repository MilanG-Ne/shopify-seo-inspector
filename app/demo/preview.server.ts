/**
 * Preview mode: runs the UI against the demo-store fixture in memory, with no
 * Shopify login. For trying the app locally (`npm run preview:ui`) and for UI
 * work without a tunnel. Writes change the in-memory copy only.
 *
 * It skips authentication, so it refuses to run in a production build.
 */
import { mapCollection, mapProduct } from "../catalog/map";
import type { AltTextWrite, SeoFields, WriteResult } from "../catalog/fixes.server";
import { runAudit } from "../seo/audit";
import { collapseWhitespace } from "../seo/text";
import type { Catalog } from "../seo/types";
import type { Store } from "../store.server";
import demoStore from "./demo-store.json";

export const PREVIEW_MODE = process.env.SEO_INSPECTOR_PREVIEW === "1";

if (PREVIEW_MODE && process.env.NODE_ENV === "production") {
  throw new Error(
    "SEO_INSPECTOR_PREVIEW skips authentication and must not be set in production.",
  );
}

function fixtureCatalog(): Catalog {
  return {
    products: demoStore.products.map(mapProduct),
    collections: demoStore.collections.map(mapCollection),
  };
}

let catalog = fixtureCatalog();
let fetchedAt = new Date().toISOString();

export function resetPreviewStore(): void {
  catalog = fixtureCatalog();
  fetchedAt = new Date().toISOString();
}

function optional(value: string): string | null {
  const cleaned = collapseWhitespace(value);
  return cleaned === "" ? null : cleaned;
}

function missing(id: string): WriteResult {
  return { id, ok: false, errors: ["Not found in the demo catalog."] };
}

export function previewStore(): Store {
  return {
    shop: "preview.myshopify.com",
    mode: "preview",

    async loadAudit(options) {
      if (options?.refresh) fetchedAt = new Date().toISOString();
      return { catalog, fetchedAt, truncated: false, report: runAudit(catalog) };
    },

    async loadProductForAltText(product) {
      return product;
    },

    async saveProductSeo(productId, fields: SeoFields) {
      const product = catalog.products.find((item) => item.id === productId);
      if (!product) return missing(productId);
      const title = fields.title === undefined ? product.title : collapseWhitespace(fields.title);
      if (title === "") return { id: productId, ok: false, errors: ["Product title can't be empty."] };
      catalog = {
        ...catalog,
        products: catalog.products.map((item) =>
          item.id === productId
            ? {
                ...item,
                title,
                seoTitle: optional(fields.seoTitle),
                seoDescription: optional(fields.seoDescription),
              }
            : item,
        ),
      };
      return { id: productId, ok: true };
    },

    async saveCollectionSeo(collectionId, fields) {
      if (!catalog.collections.some((item) => item.id === collectionId)) {
        return missing(collectionId);
      }
      catalog = {
        ...catalog,
        collections: catalog.collections.map((item) =>
          item.id === collectionId
            ? {
                ...item,
                seoTitle: optional(fields.seoTitle),
                seoDescription: optional(fields.seoDescription),
              }
            : item,
        ),
      };
      return { id: collectionId, ok: true };
    },

    async saveImageAltTexts(writes: readonly AltTextWrite[]) {
      return writes.map((write) => {
        const alt = collapseWhitespace(write.alt);
        if (alt === "") return { id: write.imageId, ok: false, errors: ["Alt text can't be empty."] };
        const product = catalog.products.find((item) => item.id === write.productId);
        if (!product?.images.some((image) => image.id === write.imageId)) {
          return missing(write.imageId);
        }
        catalog = {
          ...catalog,
          products: catalog.products.map((item) =>
            item.id === write.productId
              ? {
                  ...item,
                  images: item.images.map((image) =>
                    image.id === write.imageId ? { ...image, alt } : image,
                  ),
                }
              : item,
          ),
        };
        return { id: write.imageId, ok: true } satisfies WriteResult;
      });
    },
  };
}
