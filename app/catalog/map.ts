/**
 * Maps Admin GraphQL nodes onto the audit engine's catalog model.
 *
 * The input interfaces below describe only the fields the engine reads. The
 * generated operation types in `app/types/admin.generated.d.ts` are checked
 * against them at the call site, and the test fixtures (raw API responses
 * from the demo store) go through exactly the same mapping.
 */
import type {
  CollectionResource,
  ProductImage,
  ProductResource,
} from "../seo/types";

interface SeoNode {
  title?: string | null;
  description?: string | null;
}

/** A product media node; non-image media arrive as empty objects. */
interface MediaNode {
  id?: string;
  alt?: string | null;
  image?: { url: string } | null;
}

export interface ProductNode {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  seo: SeoNode;
  media: { nodes: MediaNode[] };
}

export interface CollectionNode {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  seo: SeoNode;
  productsCount?: { count: number } | null;
}

export interface VariantNode {
  selectedOptions: Array<{ name: string; value: string }>;
  media: { nodes: Array<{ id: string }> };
}

/** Shopify stores "unset" SEO fields as null or, after edits, as "". */
function optionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

export function mapProduct(node: ProductNode): ProductResource {
  const images: ProductImage[] = node.media.nodes.flatMap((media) =>
    media.id === undefined
      ? []
      : [
          {
            id: media.id,
            alt: media.alt ?? "",
            url: media.image?.url ?? null,
            variantOptionValues: [],
          },
        ],
  );

  return {
    kind: "product",
    id: node.id,
    title: node.title,
    handle: node.handle,
    descriptionHtml: node.descriptionHtml,
    seoTitle: optionalText(node.seo.title),
    seoDescription: optionalText(node.seo.description),
    images,
    imageUrl: images[0]?.url ?? null,
  };
}

export function mapCollection(node: CollectionNode): CollectionResource {
  return {
    kind: "collection",
    id: node.id,
    title: node.title,
    handle: node.handle,
    descriptionHtml: node.descriptionHtml,
    seoTitle: optionalText(node.seo.title),
    seoDescription: optionalText(node.seo.description),
    productsCount: node.productsCount?.count ?? 0,
  };
}

/** Single-variant products carry a placeholder "Title: Default Title" option. */
function isPlaceholderOption(option: { name: string; value: string }): boolean {
  return option.name === "Title" && option.value === "Default Title";
}

/**
 * Tags each image with the option values shared by every variant that uses
 * it. An image on "Navy / S" and "Navy / M" becomes `["Navy"]`.
 */
export function withVariantOptions(
  product: ProductResource,
  variants: VariantNode[],
): ProductResource {
  const valuesByImage = new Map<string, string[][]>();
  for (const variant of variants) {
    const values = variant.selectedOptions
      .filter((option) => !isPlaceholderOption(option))
      .map((option) => option.value);
    for (const media of variant.media.nodes) {
      const list = valuesByImage.get(media.id);
      if (list) list.push(values);
      else valuesByImage.set(media.id, [values]);
    }
  }

  return {
    ...product,
    images: product.images.map((image) => {
      const lists = valuesByImage.get(image.id);
      if (!lists) return image;
      const [first, ...rest] = lists;
      const shared = first.filter((value) =>
        rest.every((list) => list.includes(value)),
      );
      return { ...image, variantOptionValues: shared };
    }),
  };
}
