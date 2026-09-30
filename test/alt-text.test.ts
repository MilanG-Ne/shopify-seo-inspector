import { describe, expect, it } from "vitest";
import { draftAltTexts } from "../app/seo/alt-text";
import { image, product, repeat } from "./helpers";

describe("draftAltTexts", () => {
  it("uses the product title for a lone image", () => {
    const hoodie = product({ title: "Black Graphic Hoodie", images: [image({ alt: "" })] });
    expect(draftAltTexts(hoodie).map((draft) => draft.alt)).toEqual(["Black Graphic Hoodie"]);
  });

  it("adds variant option values for variant images", () => {
    const jacket = product({
      title: "Two-Tone Varsity Jacket",
      images: [image({ variantOptionValues: ["Navy"] }), image({ variantOptionValues: ["Cream", "M"] })],
    });
    expect(draftAltTexts(jacket).map((draft) => draft.alt)).toEqual([
      "Two-Tone Varsity Jacket – Navy",
      "Two-Tone Varsity Jacket – Cream, M",
    ]);
  });

  it("numbers extra gallery images so they aren't identical", () => {
    const bowl = product({
      title: "Wave Bowl",
      images: [image(), image({ variantOptionValues: ["Ochre"] }), image(), image()],
    });
    expect(draftAltTexts(bowl).map((draft) => draft.alt)).toEqual([
      "Wave Bowl",
      "Wave Bowl – Ochre",
      "Wave Bowl – view 2",
      "Wave Bowl – view 3",
    ]);
  });

  it("keeps numbering stable when only some images are requested", () => {
    const first = image();
    const second = image();
    const bowl = product({ title: "Wave Bowl", images: [first, second] });
    expect(draftAltTexts(bowl, [second.id])).toEqual([
      { imageId: second.id, productId: bowl.id, alt: "Wave Bowl – view 2" },
    ]);
  });

  it("caps drafts at 125 characters on a word boundary", () => {
    const long = product({ title: repeat("Longword ", 20).trim(), images: [image()] });
    const [draft] = draftAltTexts(long);
    expect(draft.alt.length).toBeLessThanOrEqual(125);
    expect(draft.alt.endsWith("Longword")).toBe(true);
  });
});
