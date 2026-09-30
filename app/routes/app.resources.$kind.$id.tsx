import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { SeoField } from "../components/SeoField";
import { SerpPreview } from "../components/SerpPreview";
import { SeverityBadge } from "../components/SeverityBadge";
import { adminUrl, altTextPath, isResourceKind, resourcePath, toGid } from "../lib/resource-urls";
import { flag } from "../lib/polaris";
import { showToast } from "../lib/toast";
import { issuesForResource } from "../seo/audit";
import { LIMITS, checkMeta } from "../seo/rules";
import { fitSentences, htmlToText, wordCount } from "../seo/text";
import type { Issue } from "../seo/types";
import { getStore } from "../store.server";

function notFound(): Response {
  return new Response("Not found", { status: 404 });
}

function parseParams(params: LoaderFunctionArgs["params"]) {
  const kind = params.kind;
  if (!isResourceKind(kind)) throw notFound();
  const id = toGid(kind, params.id);
  if (!id) throw notFound();
  return { kind, id };
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { kind, id } = parseParams(params);
  const store = await getStore(request);
  const { catalog, report } = await store.loadAudit();

  const resource =
    kind === "product"
      ? catalog.products.find((product) => product.id === id)
      : catalog.collections.find((collection) => collection.id === id);
  if (!resource) throw notFound();

  const text = htmlToText(resource.descriptionHtml);
  return {
    resource,
    issues: issuesForResource(report, id),
    score: report.resources.find((summary) => summary.resource.id === id)?.score ?? null,
    words: wordCount(text),
    // What Shopify themes show when the meta description is empty.
    fallbackDescription: fitSentences(text, { min: 0, max: LIMITS.metaDescription.max }) ?? "",
    shop: store.shop,
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { kind, id } = parseParams(params);
  const store = await getStore(request);
  const form = await request.formData();
  const text = (key: string): string | undefined => {
    const value = form.get(key);
    return typeof value === "string" ? value : undefined;
  };

  const fields = {
    seoTitle: text("seoTitle") ?? "",
    seoDescription: text("seoDescription") ?? "",
  };
  const title = text("title");

  const result =
    kind === "product"
      ? await store.saveProductSeo(id, { ...fields, ...(title === undefined ? {} : { title }) })
      : await store.saveCollectionSeo(id, fields);
  return { result };
};

function suggestionFor(issues: Issue[], checks: Issue["check"][]): string | undefined {
  return issues.find((issue) => checks.includes(issue.check) && issue.suggestedValue)?.suggestedValue;
}

function IssueList({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) {
    return (
      <s-banner tone="success" heading="No issues">
        This page passes every check.
      </s-banner>
    );
  }
  return (
    <s-stack direction="block" gap="base">
      {issues.map((issue, index) => (
        <s-stack key={issue.key} direction="block" gap="small-200">
          {index > 0 && <s-divider />}
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <SeverityBadge severity={issue.severity} />
            <s-text type="strong">{checkMeta(issue.check).label}</s-text>
          </s-stack>
          <s-text>{issue.message}</s-text>
          <s-text color="subdued">{issue.suggestion}</s-text>
          {issue.related && issue.related.length > 0 && (
            <s-stack direction="inline" gap="small-200">
              <s-text color="subdued">Also on:</s-text>
              {issue.related.map((ref) => (
                <s-link key={ref.id} href={resourcePath(ref)}>
                  {`${ref.title} (/${ref.handle})`}
                </s-link>
              ))}
            </s-stack>
          )}
        </s-stack>
      ))}
    </s-stack>
  );
}

export default function ResourceDetailRoute() {
  const data = useLoaderData<typeof loader>();
  // Remount per resource so form state never leaks between pages.
  return <ResourceDetail key={data.resource.id} {...data} />;
}

function ResourceDetail({
  resource,
  issues,
  score,
  words,
  fallbackDescription,
  shop,
}: ReturnType<typeof useLoaderData<typeof loader>>) {
  const fetcher = useFetcher<typeof action>();
  const saving = fetcher.state !== "idle";

  const saved = {
    title: resource.title,
    seoTitle: resource.seoTitle ?? "",
    seoDescription: resource.seoDescription ?? "",
  };
  const [title, setTitle] = useState(saved.title);
  const [seoTitle, setSeoTitle] = useState(saved.seoTitle);
  const [seoDescription, setSeoDescription] = useState(saved.seoDescription);

  const editsTitle =
    resource.kind === "product" && issues.some((issue) => issue.check === "duplicate-title");
  const dirty =
    seoTitle !== saved.seoTitle ||
    seoDescription !== saved.seoDescription ||
    (editsTitle && title !== saved.title);

  const titleSuggestion = suggestionFor(issues, ["seo-title-length"]);
  const descriptionSuggestion = suggestionFor(issues, [
    "meta-description-missing",
    "meta-description-length",
    "duplicate-meta-description",
  ]);

  const result = fetcher.data?.result;
  useEffect(() => {
    if (fetcher.state !== "idle" || !result) return;
    if (result.ok) showToast("SEO fields saved");
    else showToast("Couldn't save changes", { isError: true });
  }, [fetcher.state, result]);

  const save = () => {
    fetcher.submit(
      { seoTitle, seoDescription, ...(editsTitle ? { title } : {}) },
      { method: "post" },
    );
  };

  const path = resource.kind === "product" ? "products" : "collections";
  const images = resource.kind === "product" ? resource.images : [];
  const missingAlt = images.filter((image) => image.alt.trim() === "").length;

  return (
    <s-page heading={resource.title}>
      <s-link slot="breadcrumb-actions" href="/app/issues">
        Issues
      </s-link>
      <s-button slot="secondary-actions" href={adminUrl(resource)} target="_blank">
        Open in Shopify admin
      </s-button>

      <s-section heading={`Issues${score === null ? "" : ` · score ${score}`}`}>
        <IssueList issues={issues} />
      </s-section>

      <s-section heading="Search listing">
        <s-stack direction="block" gap="base">
          {result && !result.ok && fetcher.state === "idle" && (
            <s-banner tone="critical" heading="Shopify didn't save these changes">
              <s-unordered-list>
                {result.errors.map((error) => (
                  <s-list-item key={error}>{error}</s-list-item>
                ))}
              </s-unordered-list>
            </s-banner>
          )}
          {result?.ok && !dirty && fetcher.state === "idle" && (
            <s-banner tone="success" heading="Saved">
              The audit has been updated with the new values.
            </s-banner>
          )}

          {editsTitle && (
            <SeoField
              label="Product title"
              name="title"
              value={title}
              onChange={setTitle}
              placeholder="Product title"
            />
          )}

          <SeoField
            label="SEO title"
            name="seoTitle"
            value={seoTitle}
            onChange={setSeoTitle}
            range={LIMITS.seoTitle}
            placeholder={resource.title}
            emptyTone="warning"
            emptyHint={`Empty: search results use the ${resource.kind} title`}
          />
          {titleSuggestion && titleSuggestion !== seoTitle && (
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <s-button variant="tertiary" icon="wand" onClick={() => setSeoTitle(titleSuggestion)}>
                Use suggestion
              </s-button>
              <s-text color="subdued">{titleSuggestion}</s-text>
            </s-stack>
          )}

          <SeoField
            label="Meta description"
            name="seoDescription"
            value={seoDescription}
            onChange={setSeoDescription}
            range={LIMITS.metaDescription}
            multiline
            emptyHint="Empty: search engines will pick their own snippet"
          />
          {descriptionSuggestion && descriptionSuggestion !== seoDescription && (
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <s-button
                variant="tertiary"
                icon="wand"
                onClick={() => setSeoDescription(descriptionSuggestion)}
              >
                Use suggestion
              </s-button>
              <s-text color="subdued">{descriptionSuggestion}</s-text>
            </s-stack>
          )}

          <s-stack direction="block" gap="small-200">
            <s-text type="strong">Search result preview</s-text>
            <SerpPreview
              title={seoTitle.trim() || (editsTitle ? title : resource.title)}
              description={seoDescription.trim() || fallbackDescription}
              url={`${shop} › ${path} › ${resource.handle}`}
            />
          </s-stack>

          <s-stack direction="inline" gap="small-200" justifyContent="end">
            <s-button
              disabled={flag(!dirty || saving)}
              onClick={() => {
                setTitle(saved.title);
                setSeoTitle(saved.seoTitle);
                setSeoDescription(saved.seoDescription);
              }}
            >
              Discard
            </s-button>
            <s-button
              variant="primary"
              disabled={flag(!dirty)}
              onClick={save}
              {...(saving ? { loading: true } : {})}
            >
              Save
            </s-button>
          </s-stack>
        </s-stack>
      </s-section>

      {resource.kind === "product" && (
        <s-section heading="Images">
          <s-stack direction="block" gap="base">
            {images.length === 0 ? (
              <s-text color="subdued">This product has no images.</s-text>
            ) : (
              <s-grid gridTemplateColumns="repeat(auto-fill, minmax(160px, 1fr))" gap="base">
                {images.map((image) => (
                  <s-stack key={image.id} direction="block" gap="small-200">
                    <s-box borderRadius="base" overflow="hidden" background="subdued">
                      <s-image
                        src={image.url ?? undefined}
                        alt={image.alt}
                        aspectRatio="1/1"
                        objectFit="cover"
                      />
                    </s-box>
                    {image.alt.trim() === "" ? (
                      <s-badge tone="critical">Missing alt text</s-badge>
                    ) : (
                      <s-text color="subdued">{image.alt}</s-text>
                    )}
                  </s-stack>
                ))}
              </s-grid>
            )}
            {missingAlt > 0 && (
              <s-stack direction="inline">
                <s-button href={altTextPath([resource.id])}>
                  {`Write alt text for ${missingAlt} ${missingAlt === 1 ? "image" : "images"}`}
                </s-button>
              </s-stack>
            )}
          </s-stack>
        </s-section>
      )}

      <s-section heading="Description">
        <s-stack direction="block" gap="small-200">
          <s-text>
            {words === 0
              ? `This ${resource.kind} has no description.`
              : `${words} ${words === 1 ? "word" : "words"}.`}{" "}
            {resource.kind === "product"
              ? `Aim for at least ${LIMITS.thinDescriptionWords} so the page has enough unique copy to rank.`
              : "A short intro gives the collection page copy to rank with."}
          </s-text>
          <s-stack direction="inline">
            <s-button href={adminUrl(resource)} target="_blank">
              Edit description in Shopify admin
            </s-button>
          </s-stack>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
