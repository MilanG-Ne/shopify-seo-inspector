import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useLocation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import type { WriteResult } from "../catalog/fixes.server";
import { parseAltTextWrites } from "../lib/parse";
import { resourcePath, toGid } from "../lib/resource-urls";
import { flag } from "../lib/polaris";
import { showToast } from "../lib/toast";
import { draftAltTexts } from "../seo/alt-text";
import { LIMITS } from "../seo/rules";
import { charLength } from "../seo/text";
import { getStore } from "../store.server";

/** Drafting needs one variant lookup per product, so cap each batch. */
const MAX_PRODUCTS_PER_BATCH = 25;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const store = await getStore(request);
  const requested = (new URL(request.url).searchParams.get("products") ?? "")
    .split(",")
    .map((id) => toGid("product", id.trim()))
    .filter((id): id is string => id !== null);

  const { catalog } = await store.loadAudit();
  const candidates = catalog.products.filter(
    (product) =>
      (requested.length === 0 || requested.includes(product.id)) &&
      product.images.some((image) => image.alt.trim() === ""),
  );

  const rows = [];
  for (const product of candidates.slice(0, MAX_PRODUCTS_PER_BATCH)) {
    const withVariants = await store.loadProductForAltText(product);
    const missing = withVariants.images
      .filter((image) => image.alt.trim() === "")
      .map((image) => image.id);
    for (const draft of draftAltTexts(withVariants, missing)) {
      rows.push({
        ...draft,
        productTitle: product.title,
        imageUrl: withVariants.images.find((image) => image.id === draft.imageId)?.url ?? null,
      });
    }
  }

  return {
    rows,
    productCount: Math.min(candidates.length, MAX_PRODUCTS_PER_BATCH),
    remainingProducts: Math.max(0, candidates.length - MAX_PRODUCTS_PER_BATCH),
    filtered: requested.length > 0,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const store = await getStore(request);
  const writes = parseAltTextWrites(await request.json().catch(() => null));
  if (!writes) {
    return { results: [] as WriteResult[], error: "The request didn't contain valid alt text." };
  }
  return { results: await store.saveImageAltTexts(writes), error: null };
};

type Row = ReturnType<typeof useLoaderData<typeof loader>>["rows"][number];

export default function AltTextRoute() {
  const data = useLoaderData<typeof loader>();
  const location = useLocation();
  // Keyed by the query so a new selection starts a fresh review.
  return <AltTextReview key={location.search} {...data} />;
}

function AltTextReview({
  rows: initialRows,
  productCount,
  remainingProducts,
  filtered,
}: ReturnType<typeof useLoaderData<typeof loader>>) {
  const fetcher = useFetcher<typeof action>();
  const saving = fetcher.state !== "idle";

  // Keep the reviewed rows on screen after saving, even though the audit no
  // longer lists those images as missing alt text.
  const [rows] = useState<Row[]>(initialRows);
  const [alts, setAlts] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialRows.map((row) => [row.imageId, row.alt])),
  );
  const [included, setIncluded] = useState<ReadonlySet<string>>(
    () => new Set(initialRows.map((row) => row.imageId)),
  );
  const [results, setResults] = useState<Record<string, WriteResult>>({});

  // Merge each finished save into `results` once, during render (React's
  // "adjusting state when data changes" pattern) rather than in an effect.
  const [mergedResponse, setMergedResponse] = useState<typeof fetcher.data>();
  if (fetcher.state === "idle" && fetcher.data && fetcher.data !== mergedResponse) {
    setMergedResponse(fetcher.data);
    const batch = fetcher.data.results;
    setResults((current) => ({
      ...current,
      ...Object.fromEntries(batch.map((result) => [result.id, result])),
    }));
  }

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    const { results: batch, error } = fetcher.data;
    if (error) {
      showToast(error, { isError: true });
      return;
    }
    const failedCount = batch.filter((result) => !result.ok).length;
    showToast(
      failedCount === 0
        ? `Saved alt text for ${batch.length} ${batch.length === 1 ? "image" : "images"}`
        : `${failedCount} of ${batch.length} couldn't be saved`,
      { isError: failedCount > 0 },
    );
  }, [fetcher.state, fetcher.data]);

  const pending = rows.filter((row) => included.has(row.imageId) && !results[row.imageId]?.ok);
  const invalid = pending.filter((row) => (alts[row.imageId] ?? "").trim() === "");
  const savedCount = rows.filter((row) => results[row.imageId]?.ok).length;
  const failed = rows.filter((row) => results[row.imageId] && !results[row.imageId].ok);

  const save = () => {
    fetcher.submit(
      {
        writes: pending.map((row) => ({
          productId: row.productId,
          imageId: row.imageId,
          alt: alts[row.imageId] ?? "",
        })),
      },
      { method: "post", encType: "application/json" },
    );
  };

  const toggle = (imageId: string, on: boolean) =>
    setIncluded((current) => {
      const next = new Set(current);
      if (on) next.add(imageId);
      else next.delete(imageId);
      return next;
    });

  return (
    <s-page heading="Write alt text" inlineSize="large">
      <s-link slot="breadcrumb-actions" href="/app/issues?check=image-alt-missing">
        Issues
      </s-link>
      <s-button
        slot="primary-action"
        variant="primary"
        disabled={flag(pending.length === 0 || invalid.length > 0)}
        onClick={save}
        {...(saving ? { loading: true } : {})}
      >
        {pending.length === 0
          ? "Nothing to save"
          : `Save ${pending.length} alt ${pending.length === 1 ? "text" : "texts"}`}
      </s-button>

      {rows.length === 0 ? (
        <s-section>
          <s-stack direction="block" gap="small-200" alignItems="center">
            <s-heading>No images are missing alt text</s-heading>
            <s-text color="subdued">
              {filtered
                ? "The selected products already have alt text on every image."
                : "Every product image in the store has alt text."}
            </s-text>
            <s-button href="/app">Back to dashboard</s-button>
          </s-stack>
        </s-section>
      ) : (
        <>
          <s-banner tone="info" heading="Review before saving">
            Drafts use the product title and, for variant images, the variant&apos;s
            option values. Edit anything that doesn&apos;t describe the photo, untick
            images to skip them, then save. Each image is saved separately and
            reports its own result.
          </s-banner>

          {savedCount > 0 && failed.length === 0 && pending.length === 0 && (
            <s-banner tone="success" heading={`Saved alt text for ${savedCount} ${savedCount === 1 ? "image" : "images"}`}>
              The audit now counts these images as described.
            </s-banner>
          )}
          {failed.length > 0 && (
            <s-banner tone="critical" heading={`${failed.length} ${failed.length === 1 ? "image wasn't" : "images weren't"} saved`}>
              Check the errors in the table, adjust the text if needed, and save again.
            </s-banner>
          )}
          {remainingProducts > 0 && (
            <s-banner tone="warning">
              {`Showing the first ${productCount} products. ${remainingProducts} more have images without alt text; they'll appear here after you save this batch.`}
            </s-banner>
          )}

          <s-section padding="none">
            <s-table>
              <s-table-header-row>
                <s-table-header>
                  <s-text accessibilityVisibility="exclusive">Include</s-text>
                </s-table-header>
                <s-table-header>Image</s-table-header>
                <s-table-header listSlot="primary">Product and alt text</s-table-header>
                <s-table-header listSlot="secondary">Status</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {rows.map((row) => {
                  const result = results[row.imageId];
                  const value = alts[row.imageId] ?? "";
                  const length = charLength(value.trim());
                  return (
                    <s-table-row key={row.imageId}>
                      <s-table-cell>
                        <s-checkbox
                          accessibilityLabel={`Include image of ${row.productTitle}`}
                          checked={flag(included.has(row.imageId))}
                          disabled={flag(result?.ok)}
                          onInput={(event) => toggle(row.imageId, event.currentTarget.checked)}
                        />
                      </s-table-cell>
                      <s-table-cell>
                        <s-thumbnail size="base" src={row.imageUrl ?? undefined} alt="" />
                      </s-table-cell>
                      <s-table-cell>
                        <s-stack direction="block" gap="small-200">
                          <s-link href={resourcePath({ kind: "product", id: row.productId })}>
                            {row.productTitle}
                          </s-link>
                          {result?.ok ? (
                            <s-text>{value.trim()}</s-text>
                          ) : (
                            <s-text-field
                              label={`Alt text for ${row.productTitle}`}
                              labelAccessibilityVisibility="exclusive"
                              // Initial value only; edits are read back through onInput.
                              value={row.alt}
                              disabled={flag(!included.has(row.imageId))}
                              error={
                                included.has(row.imageId) && length === 0
                                  ? "Alt text can't be empty"
                                  : undefined
                              }
                              details={
                                length > LIMITS.altTextMax
                                  ? `${length} characters; screen readers work best under ${LIMITS.altTextMax}`
                                  : undefined
                              }
                              onInput={(event) => {
                                // Read now: currentTarget is null by the time the updater runs.
                                const next = event.currentTarget.value;
                                setAlts((current) => ({ ...current, [row.imageId]: next }));
                              }}
                            />
                          )}
                        </s-stack>
                      </s-table-cell>
                      <s-table-cell>
                        {!result ? (
                          <s-badge tone={included.has(row.imageId) ? "info" : "neutral"}>
                            {included.has(row.imageId) ? "Ready" : "Skipped"}
                          </s-badge>
                        ) : result.ok ? (
                          <s-badge tone="success" icon="check">
                            Saved
                          </s-badge>
                        ) : (
                          <s-stack direction="block" gap="small-100">
                            <s-badge tone="critical">Not saved</s-badge>
                            {result.errors.map((error) => (
                              <s-text key={error} tone="critical">
                                {error}
                              </s-text>
                            ))}
                          </s-stack>
                        )}
                      </s-table-cell>
                    </s-table-row>
                  );
                })}
              </s-table-body>
            </s-table>
          </s-section>
        </>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
