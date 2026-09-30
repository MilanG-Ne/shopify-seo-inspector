import { describe, expect, it } from "vitest";
import {
  collectionDescriptionMissing,
  duplicateMetaDescription,
  duplicateTitle,
  imageAltMissing,
  metaDescriptionLength,
  metaDescriptionMissing,
  seoTitleLength,
  seoTitleMissing,
  thinDescription,
} from "../app/seo/checks";
import { catalog, collection, image, product, repeat } from "./helpers";

const words = (count: number) =>
  `<p>${Array.from({ length: count }, (_, index) => `w${index}`).join(" ")}</p>`;

describe("baseline", () => {
  it("a well-formed product raises no issues in any check", () => {
    const clean = catalog([product(), product()], [collection()]);
    for (const check of [
      seoTitleMissing,
      seoTitleLength,
      metaDescriptionMissing,
      metaDescriptionLength,
      duplicateMetaDescription,
      duplicateTitle,
      imageAltMissing,
      thinDescription,
      collectionDescriptionMissing,
    ]) {
      expect(check(clean)).toEqual([]);
    }
  });
});

describe("seo-title-missing", () => {
  it("warns when no SEO title is set", () => {
    const hat = product({ title: "Camel Felt Hat", seoTitle: null });
    const [issue] = seoTitleMissing(catalog([hat]));
    expect(issue).toMatchObject({
      check: "seo-title-missing",
      severity: "warn",
      currentValue: null,
    });
    expect(issue.message).toContain("Camel Felt Hat");
  });

  it("ignores products with an SEO title", () => {
    expect(seoTitleMissing(catalog([product()]))).toEqual([]);
  });
});

describe("seo-title-length", () => {
  it("accepts 20 and 60 characters exactly", () => {
    const products = [product({ seoTitle: repeat("a", 20) }), product({ seoTitle: repeat("a", 60) })];
    expect(seoTitleLength(catalog(products))).toEqual([]);
  });

  it("warns at 61 characters and suggests a shortened title", () => {
    const [issue] = seoTitleLength(
      catalog([product({ seoTitle: `${repeat("word ", 12)}x` })]),
    );
    expect(issue.severity).toBe("warn");
    expect(issue.message).toContain("61 characters");
    expect(issue.suggestedValue?.length).toBeLessThanOrEqual(60);
  });

  it("warns at 19 characters", () => {
    const [issue] = seoTitleLength(catalog([product({ seoTitle: repeat("a", 19) })]));
    expect(issue.message).toContain("19 characters");
  });

  it("offers the product title for a short SEO title when it fits", () => {
    const [issue] = seoTitleLength(
      catalog([product({ title: "Merino Wool Beanie in Charcoal", seoTitle: "Beanie" })]),
    );
    expect(issue.suggestedValue).toBe("Merino Wool Beanie in Charcoal");
  });

  it("doesn't measure the fallback title when no SEO title is set", () => {
    expect(seoTitleLength(catalog([product({ title: "Hat", seoTitle: null })]))).toEqual([]);
  });
});

describe("meta-description-missing", () => {
  it("fails when no meta description is set", () => {
    const [issue] = metaDescriptionMissing(catalog([product({ seoDescription: null })]));
    expect(issue).toMatchObject({ severity: "fail", currentValue: null });
  });

  it("drafts a suggestion from the product description", () => {
    const bag = product({
      seoDescription: null,
      descriptionHtml:
        "<p>A compact crossbody bag in warm saddle-brown leather with an adjustable strap and antique brass buckle. It holds the everyday essentials, phone, cardholder, keys and sunglasses, without the bulk of a full handbag.</p>",
    });
    const [issue] = metaDescriptionMissing(catalog([bag]));
    expect(issue.suggestedValue).toBe(
      "A compact crossbody bag in warm saddle-brown leather with an adjustable strap and antique brass buckle.",
    );
  });

  it("offers no draft when the description is too short to make one", () => {
    const hat = product({ seoDescription: null, descriptionHtml: "<p>Wool felt hat in camel.</p>" });
    const [issue] = metaDescriptionMissing(catalog([hat]));
    expect(issue.suggestedValue).toBeUndefined();
  });

  it("doesn't draft a description another page already uses", () => {
    const text = "A compact crossbody bag in warm saddle-brown leather with an adjustable strap and antique brass buckle.";
    const bag = product({ seoDescription: null, descriptionHtml: `<p>${text}</p>` });
    const other = product({ seoDescription: text });
    const [issue] = metaDescriptionMissing(catalog([bag, other]));
    expect(issue.suggestedValue).toBeUndefined();
  });
});

describe("meta-description-length", () => {
  it("accepts 70 and 160 characters exactly", () => {
    const products = [
      product({ seoDescription: repeat("a", 70) }),
      product({ seoDescription: repeat("b", 160) }),
    ];
    expect(metaDescriptionLength(catalog(products))).toEqual([]);
  });

  it("warns above 160 characters", () => {
    const [issue] = metaDescriptionLength(catalog([product({ seoDescription: repeat("a", 161) })]));
    expect(issue).toMatchObject({ severity: "warn" });
    expect(issue.message).toContain("161 characters");
  });

  it("warns below 70 characters", () => {
    const [issue] = metaDescriptionLength(catalog([product({ seoDescription: "Two-tone pine bench." })]));
    expect(issue.message).toContain("20 characters");
  });

  it("leaves missing descriptions to the missing check", () => {
    expect(metaDescriptionLength(catalog([product({ seoDescription: null })]))).toEqual([]);
  });
});

describe("duplicate-meta-description", () => {
  it("fails every page in a duplicate group and names the others", () => {
    const text = "Vintage-inspired varsity jacket with wool body, contrast sleeves and chenille details.";
    const purple = product({ title: "Purple Varsity Jacket", seoDescription: text });
    const navy = product({ title: "Two-Tone Varsity Jacket", seoDescription: `  ${text.toUpperCase()} ` });
    const issues = duplicateMetaDescription(catalog([purple, navy, product()]));

    expect(issues).toHaveLength(2);
    expect(issues.every((issue) => issue.severity === "fail")).toBe(true);
    expect(issues[0].related?.map((ref) => ref.id)).toEqual([navy.id]);
    expect(issues[0].message).toContain("Two-Tone Varsity Jacket");
  });

  it("compares collections too", () => {
    const text = "Leather satchels, crossbody bags and steel watches for everyday city life.";
    const issues = duplicateMetaDescription(
      catalog([product({ seoDescription: text })], [collection({ seoDescription: text })]),
    );
    expect(issues.map((issue) => issue.resource.kind).sort()).toEqual(["collection", "product"]);
  });

  it("doesn't treat missing descriptions as duplicates of each other", () => {
    const issues = duplicateMetaDescription(
      catalog([product({ seoDescription: null }), product({ seoDescription: null })]),
    );
    expect(issues).toEqual([]);
  });
});

describe("duplicate-title", () => {
  it("fails each product that shares a title", () => {
    const ochre = product({ title: "Wave Bowl", handle: "wave-bowl" });
    const green = product({ title: "wave  bowl", handle: "wave-bowl-1" });
    const issues = duplicateTitle(catalog([ochre, green, product()]));

    expect(issues.map((issue) => issue.resource.handle)).toEqual(["wave-bowl", "wave-bowl-1"]);
    expect(issues[0]).toMatchObject({ severity: "fail" });
    expect(issues[0].related?.[0].handle).toBe("wave-bowl-1");
  });

  it("ignores collections sharing a product's title", () => {
    const issues = duplicateTitle(
      catalog([product({ title: "Apparel" })], [collection({ title: "Apparel" })]),
    );
    expect(issues).toEqual([]);
  });
});

describe("image-alt-missing", () => {
  it("fails once per product and counts the images", () => {
    const missingA = image({ alt: "" });
    const missingB = image({ alt: "   " });
    const hoodie = product({ images: [image(), missingA, missingB] });
    const [issue] = imageAltMissing(catalog([hoodie]));

    expect(issue.severity).toBe("fail");
    expect(issue.message).toBe("2 of 3 images have no alt text.");
    expect(issue.imageIds).toEqual([missingA.id, missingB.id]);
  });

  it("ignores products without images", () => {
    expect(imageAltMissing(catalog([product({ images: [] })]))).toEqual([]);
  });
});

describe("thin-description", () => {
  it("accepts exactly 50 words", () => {
    expect(thinDescription(catalog([product({ descriptionHtml: words(50) })]))).toEqual([]);
  });

  it("warns at 49 words and reports the count", () => {
    const [issue] = thinDescription(catalog([product({ descriptionHtml: words(49) })]));
    expect(issue).toMatchObject({ severity: "warn" });
    expect(issue.message).toContain("49 words");
  });

  it("counts words in text, not markup", () => {
    const [issue] = thinDescription(
      catalog([product({ descriptionHtml: '<p class="lead">Wool <strong>felt</strong> hat in camel.</p>' })]),
    );
    expect(issue.message).toContain("5 words");
    expect(issue.currentValue).toBe("Wool felt hat in camel.");
  });

  it("reports an empty description as missing", () => {
    const [issue] = thinDescription(catalog([product({ descriptionHtml: "" })]));
    expect(issue.message).toBe("The product has no description.");
    expect(issue.currentValue).toBeNull();
  });
});

describe("collection-description-missing", () => {
  it("warns when a collection has no description", () => {
    const [issue] = collectionDescriptionMissing(
      catalog([], [collection({ title: "Home & Living", descriptionHtml: "" })]),
    );
    expect(issue).toMatchObject({ severity: "warn", check: "collection-description-missing" });
  });

  it("treats markup with no text as empty", () => {
    const issues = collectionDescriptionMissing(
      catalog([], [collection({ descriptionHtml: "<p>&nbsp;</p><br>" })]),
    );
    expect(issues).toHaveLength(1);
  });
});
