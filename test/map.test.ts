import { describe, expect, it } from "vitest";
import { mapCollection, mapProduct, withVariantOptions } from "../app/catalog/map";

const node = {
  id: "gid://shopify/Product/1",
  title: "Wave Bowl",
  handle: "wave-bowl",
  descriptionHtml: "<p>Bowl.</p>",
  seo: { title: "  ", description: null },
  media: {
    nodes: [
      { id: "gid://shopify/MediaImage/1", alt: null, image: { url: "https://cdn.example/1.webp" } },
      {},
      { id: "gid://shopify/MediaImage/2", alt: "Side view", image: null },
    ],
  },
};

describe("mapProduct", () => {
  const mapped = mapProduct(node);

  it("treats blank SEO fields as unset", () => {
    expect(mapped.seoTitle).toBeNull();
    expect(mapped.seoDescription).toBeNull();
  });

  it("keeps image media, normalizes null alt to empty, and skips other media", () => {
    expect(mapped.images).toEqual([
      { id: "gid://shopify/MediaImage/1", alt: "", url: "https://cdn.example/1.webp", variantOptionValues: [] },
      { id: "gid://shopify/MediaImage/2", alt: "Side view", url: null, variantOptionValues: [] },
    ]);
    expect(mapped.imageUrl).toBe("https://cdn.example/1.webp");
  });
});

describe("mapCollection", () => {
  it("defaults a missing product count to 0", () => {
    const mapped = mapCollection({
      id: "gid://shopify/Collection/1",
      title: "Apparel",
      handle: "apparel",
      descriptionHtml: "",
      seo: { title: "Apparel | Store", description: null },
    });
    expect(mapped).toMatchObject({ kind: "collection", seoTitle: "Apparel | Store", productsCount: 0 });
  });
});

describe("withVariantOptions", () => {
  it("tags images with the option values their variants share", () => {
    const product = mapProduct(node);
    const tagged = withVariantOptions(product, [
      {
        selectedOptions: [{ name: "Color", value: "Ochre" }, { name: "Size", value: "S" }],
        media: { nodes: [{ id: "gid://shopify/MediaImage/1" }] },
      },
      {
        selectedOptions: [{ name: "Color", value: "Ochre" }, { name: "Size", value: "L" }],
        media: { nodes: [{ id: "gid://shopify/MediaImage/1" }] },
      },
    ]);
    expect(tagged.images.map((image) => image.variantOptionValues)).toEqual([["Ochre"], []]);
  });

  it("drops Shopify's placeholder option on single-variant products", () => {
    const tagged = withVariantOptions(mapProduct(node), [
      {
        selectedOptions: [{ name: "Title", value: "Default Title" }],
        media: { nodes: [{ id: "gid://shopify/MediaImage/2" }] },
      },
    ]);
    expect(tagged.images[1].variantOptionValues).toEqual([]);
  });
});
