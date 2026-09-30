import { LIMITS } from "../seo/rules";
import { charLength } from "../seo/text";

function clip(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length > max ? `${chars.slice(0, max - 1).join("").trimEnd()}…` : text;
}

/**
 * Approximates how the page appears in Google results, using the same
 * fallbacks Shopify themes use when the SEO fields are empty. Google trims by
 * pixel width, so this clips at the audit's character limits as a guide.
 */
export function SerpPreview({
  title,
  description,
  url,
}: {
  title: string;
  description: string;
  url: string;
}) {
  return (
    <s-box padding="base" borderRadius="base" border="base" background="base">
      <div style={{ fontFamily: "Arial, sans-serif", maxWidth: 600 }}>
        <div style={{ fontSize: 12, color: "#4d5156", marginBottom: 4 }}>{url}</div>
        <div
          style={{
            fontSize: 20,
            lineHeight: 1.3,
            color: "#1a0dab",
            marginBottom: 4,
            overflowWrap: "anywhere",
          }}
        >
          {clip(title, LIMITS.seoTitle.max) || "Untitled"}
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.58, color: "#4d5156", overflowWrap: "anywhere" }}>
          {charLength(description) > 0
            ? clip(description, LIMITS.metaDescription.max)
            : "No meta description. Google will choose a snippet from the page."}
        </div>
      </div>
    </s-box>
  );
}
