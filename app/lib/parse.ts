import type { AltTextWrite } from "../catalog/fixes.server";

export const MAX_ALT_TEXT_WRITES = 250;

const PRODUCT_GID = /^gid:\/\/shopify\/Product\/\d+$/;
const MEDIA_IMAGE_GID = /^gid:\/\/shopify\/MediaImage\/\d+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Validates the JSON body of a bulk alt text save. Returns null for anything
 * malformed so the action can reject the request as a whole.
 */
export function parseAltTextWrites(body: unknown): AltTextWrite[] | null {
  if (!isRecord(body) || !Array.isArray(body.writes)) return null;
  if (body.writes.length === 0 || body.writes.length > MAX_ALT_TEXT_WRITES) return null;

  const writes: AltTextWrite[] = [];
  for (const item of body.writes) {
    if (!isRecord(item)) return null;
    const { productId, imageId, alt } = item;
    if (
      typeof productId !== "string" ||
      typeof imageId !== "string" ||
      typeof alt !== "string" ||
      !PRODUCT_GID.test(productId) ||
      !MEDIA_IMAGE_GID.test(imageId)
    ) {
      return null;
    }
    writes.push({ productId, imageId, alt });
  }
  return writes;
}
