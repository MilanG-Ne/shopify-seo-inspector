import demoStore from "../app/demo/demo-store.json";
import { mapCollection, mapProduct } from "../app/catalog/map";
import type {
  Catalog,
  CollectionResource,
  ProductImage,
  ProductResource,
} from "../app/seo/types";

/** 50+ words of plain copy, so products built with it pass the thin check. */
export const LONG_DESCRIPTION = `<p>${Array.from(
  { length: 60 },
  (_, index) => `word${index}`,
).join(" ")}</p>`;

let sequence = 0;

export function image(overrides: Partial<ProductImage> = {}): ProductImage {
  sequence += 1;
  return {
    id: `gid://shopify/MediaImage/${sequence}`,
    alt: "A clear photo of the product",
    url: null,
    variantOptionValues: [],
    ...overrides,
  };
}

/** A product that passes every check unless overridden. */
export function product(overrides: Partial<ProductResource> = {}): ProductResource {
  sequence += 1;
  return {
    kind: "product",
    id: `gid://shopify/Product/${sequence}`,
    title: `Product ${sequence}`,
    handle: `product-${sequence}`,
    descriptionHtml: LONG_DESCRIPTION,
    seoTitle: `Handmade Product ${sequence} | Test Store Range`,
    seoDescription: `Unique meta description number ${sequence} that is long enough to pass the seventy character minimum.`,
    images: [image()],
    imageUrl: null,
    ...overrides,
  };
}

export function collection(
  overrides: Partial<CollectionResource> = {},
): CollectionResource {
  sequence += 1;
  return {
    kind: "collection",
    id: `gid://shopify/Collection/${sequence}`,
    title: `Collection ${sequence}`,
    handle: `collection-${sequence}`,
    descriptionHtml: "<p>A short intro to the collection.</p>",
    seoTitle: null,
    seoDescription: null,
    productsCount: 3,
    ...overrides,
  };
}

export function catalog(
  products: ProductResource[],
  collections: CollectionResource[] = [],
): Catalog {
  return { products, collections };
}

/** The seeded demo store, mapped exactly as the app maps live API data. */
export function demoCatalog(): Catalog {
  return {
    products: demoStore.products.map(mapProduct),
    collections: demoStore.collections.map(mapCollection),
  };
}

export function repeat(char: string, length: number): string {
  return char.repeat(length);
}
