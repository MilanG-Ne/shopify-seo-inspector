import { LIMITS } from "./rules";
import { charLength, collapseWhitespace, cutAtWord } from "./text";
import type { ProductResource } from "./types";

export interface AltTextDraft {
  imageId: string;
  productId: string;
  alt: string;
}

/**
 * Drafts alt text from data the store already has: the product title, plus
 * the option values of the variant(s) an image belongs to. Images that aren't
 * tied to a variant are numbered so a gallery doesn't repeat one string.
 *
 * These are starting points for the merchant to review, never saved as-is
 * without confirmation.
 */
export function draftAltTexts(
  product: ProductResource,
  imageIds?: readonly string[],
): AltTextDraft[] {
  const title = collapseWhitespace(product.title);
  const wanted = imageIds ? new Set(imageIds) : null;
  const drafts: AltTextDraft[] = [];
  let genericIndex = 0;

  for (const image of product.images) {
    const options = image.variantOptionValues
      .map(collapseWhitespace)
      .filter((value) => value !== "");

    let alt: string;
    if (options.length > 0) {
      alt = `${title} – ${options.join(", ")}`;
    } else {
      genericIndex += 1;
      alt = genericIndex === 1 ? title : `${title} – view ${genericIndex}`;
    }

    if (wanted && !wanted.has(image.id)) continue;
    drafts.push({
      imageId: image.id,
      productId: product.id,
      alt:
        charLength(alt) > LIMITS.altTextMax
          ? cutAtWord(alt, LIMITS.altTextMax)
          : alt,
    });
  }

  return drafts;
}
