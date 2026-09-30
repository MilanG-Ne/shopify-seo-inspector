import type { AdminClient } from "../shopify/admin.server";
import {
  COLLECTION_UPDATE_MUTATION,
  IMAGE_ALT_UPDATE_MUTATION,
  PRODUCT_UPDATE_MUTATION,
} from "../shopify/operations";
import { patchCachedCollection, patchCachedProduct } from "./catalog.server";

/**
 * Every write returns one result per item, so the UI can show exactly what
 * saved and what didn't. Nothing here writes in bulk silently: image alt
 * text is saved one file per request, even when many are selected.
 */
export type WriteResult =
  | { id: string; ok: true }
  | { id: string; ok: false; errors: string[] };

interface UserError {
  field?: string[] | null;
  message: string;
}

function failure(id: string, errors: readonly UserError[] | string): WriteResult {
  return {
    id,
    ok: false,
    errors:
      typeof errors === "string"
        ? [errors]
        : errors.map((error) =>
            error.field?.length ? `${error.field.join(".")}: ${error.message}` : error.message,
          ),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error while saving.";
}

/** Normalizes form input; an empty string clears the field in Shopify. */
function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export interface SeoFields {
  seoTitle: string;
  seoDescription: string;
  /** Only sent when the merchant edits the product title (duplicate titles). */
  title?: string;
}

export async function saveProductSeo(
  shop: string,
  client: AdminClient,
  productId: string,
  fields: SeoFields,
): Promise<WriteResult> {
  const seo = {
    title: cleanText(fields.seoTitle),
    description: cleanText(fields.seoDescription),
  };
  const title = fields.title === undefined ? undefined : cleanText(fields.title);
  if (title === "") return failure(productId, "Product title can't be empty.");

  try {
    const data = await client.request(PRODUCT_UPDATE_MUTATION, {
      product: { id: productId, seo, ...(title === undefined ? {} : { title }) },
    });
    const payload = data.productUpdate;
    if (!payload) return failure(productId, "Shopify returned no result.");
    if (payload.userErrors.length > 0) return failure(productId, payload.userErrors);

    const saved = payload.product;
    await patchCachedProduct(shop, productId, {
      seoTitle: saved?.seo.title?.trim() || null,
      seoDescription: saved?.seo.description?.trim() || null,
      ...(saved ? { title: saved.title } : {}),
    });
    return { id: productId, ok: true };
  } catch (error) {
    return failure(productId, errorMessage(error));
  }
}

export async function saveCollectionSeo(
  shop: string,
  client: AdminClient,
  collectionId: string,
  fields: Omit<SeoFields, "title">,
): Promise<WriteResult> {
  const seo = {
    title: cleanText(fields.seoTitle),
    description: cleanText(fields.seoDescription),
  };

  try {
    const data = await client.request(COLLECTION_UPDATE_MUTATION, {
      collection: { id: collectionId, seo },
    });
    const payload = data.collectionUpdate;
    if (!payload) return failure(collectionId, "Shopify returned no result.");
    if (payload.userErrors.length > 0) return failure(collectionId, payload.userErrors);

    const saved = payload.collection;
    await patchCachedCollection(shop, collectionId, {
      seoTitle: saved?.seo.title?.trim() || null,
      seoDescription: saved?.seo.description?.trim() || null,
    });
    return { id: collectionId, ok: true };
  } catch (error) {
    return failure(collectionId, errorMessage(error));
  }
}

export interface AltTextWrite {
  productId: string;
  imageId: string;
  alt: string;
}

export const MAX_ALT_TEXT_LENGTH = 512;

export async function saveImageAltTexts(
  shop: string,
  client: AdminClient,
  writes: readonly AltTextWrite[],
): Promise<WriteResult[]> {
  const results: WriteResult[] = [];

  for (const write of writes) {
    const alt = cleanText(write.alt);
    if (alt === "") {
      results.push(failure(write.imageId, "Alt text can't be empty."));
      continue;
    }
    if (alt.length > MAX_ALT_TEXT_LENGTH) {
      results.push(failure(write.imageId, `Alt text must be ${MAX_ALT_TEXT_LENGTH} characters or fewer.`));
      continue;
    }

    try {
      const data = await client.request(IMAGE_ALT_UPDATE_MUTATION, {
        files: [{ id: write.imageId, alt }],
      });
      const payload = data.fileUpdate;
      if (!payload) {
        results.push(failure(write.imageId, "Shopify returned no result."));
      } else if (payload.userErrors.length > 0) {
        results.push(failure(write.imageId, payload.userErrors));
      } else {
        const savedAlt = payload.files?.find((file) => file.id === write.imageId)?.alt ?? alt;
        await patchCachedProduct(shop, write.productId, {
          imageAlts: { [write.imageId]: savedAlt },
        });
        results.push({ id: write.imageId, ok: true });
      }
    } catch (error) {
      results.push(failure(write.imageId, errorMessage(error)));
    }
  }

  return results;
}
