import { describe, expect, it } from "vitest";
import {
  charLength,
  cutAtWord,
  fitSentences,
  fitTitle,
  htmlToText,
  normalizeForCompare,
  wordCount,
} from "../app/seo/text";

describe("charLength", () => {
  it("counts code points, not UTF-16 units", () => {
    expect(charLength("café")).toBe(4);
    expect(charLength("🧢 hat")).toBe(5);
  });
});

describe("htmlToText", () => {
  it("strips tags without merging words across block boundaries", () => {
    expect(htmlToText("<p>One</p><p>two<br>three</p>")).toBe("One two three");
  });

  it("drops script and style content", () => {
    expect(htmlToText("<style>p{}</style><p>Visible</p><script>x()</script>")).toBe(
      "Visible",
    );
  });

  it("decodes named and numeric entities", () => {
    expect(htmlToText("Salt &amp; pepper&nbsp;mill &#8211; &#x2764;")).toBe(
      "Salt & pepper mill – ❤",
    );
  });
});

describe("wordCount", () => {
  it("ignores punctuation-only tokens", () => {
    expect(wordCount("Wool felt hat – in camel .")).toBe(5);
  });

  it("returns 0 for empty text", () => {
    expect(wordCount("")).toBe(0);
  });
});

describe("normalizeForCompare", () => {
  it("ignores case and whitespace differences", () => {
    expect(normalizeForCompare("  Wave  Bowl ")).toBe(normalizeForCompare("wave bowl"));
  });
});

describe("cutAtWord", () => {
  it("never cuts inside a word and drops trailing connectors", () => {
    expect(cutAtWord("Leather bag with brass buckle", 20)).toBe("Leather bag");
  });
});

describe("fitTitle", () => {
  const range = { min: 20, max: 60 };

  it("drops trailing segments before cutting words", () => {
    expect(fitTitle("Walnut Wall Shelf for Books | Solid Wood - Free Shipping Today Only", range)).toBe(
      "Walnut Wall Shelf for Books | Solid Wood",
    );
  });

  it("falls back to a word boundary when no segment fits", () => {
    const watch =
      "Black Dial Stainless Steel Men's Watch with Sapphire Crystal and Leather Strap - Perfect Gift";
    expect(fitTitle(watch, range)).toBe(
      "Black Dial Stainless Steel Men's Watch with Sapphire Crystal",
    );
  });

  it("returns null when the source is too short", () => {
    expect(fitTitle("Camel Felt Hat", range)).toBeNull();
  });
});

describe("fitSentences", () => {
  const range = { min: 70, max: 160 };

  it("keeps whole sentences when they fit", () => {
    const prose =
      "A compact crossbody bag in warm saddle-brown leather with an adjustable strap and antique brass buckle. It holds the everyday essentials without the bulk of a full handbag.";
    expect(fitSentences(prose, range)).toBe(
      "A compact crossbody bag in warm saddle-brown leather with an adjustable strap and antique brass buckle.",
    );
  });

  it("cuts a long single sentence at the last clause boundary", () => {
    const candle =
      "Our best-selling small travel candle poured into a brushed gold tin and scented with warm amber, cedar wood and a hint of fresh orange peel, with a clean-burning soy wax blend that lasts around 25 hours and a reusable tin for rings and pins.";
    expect(fitSentences(candle, range)).toBe(
      "Our best-selling small travel candle poured into a brushed gold tin and scented with warm amber, cedar wood and a hint of fresh orange peel.",
    );
  });

  it("returns null when the source is shorter than the minimum", () => {
    expect(fitSentences("Wool felt hat in camel.", range)).toBeNull();
  });
});
