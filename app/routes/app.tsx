import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { PREVIEW_MODE } from "../demo/preview.server";
import { authenticate } from "../shopify.server";

const NAV = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/issues", label: "Issues" },
  { href: "/app/alt-text", label: "Alt text" },
] as const;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (PREVIEW_MODE) return { apiKey: "", preview: true };

  await authenticate.admin(request);
  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "", preview: false };
};

export default function App() {
  const { apiKey, preview } = useLoaderData<typeof loader>();

  if (preview) {
    return (
      <AppProvider embedded={false}>
        <s-box padding="small-100 base" background="subdued" borderWidth="none none base none" borderColor="base">
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-text type="strong">SEO Inspector</s-text>
            {NAV.map((item) => (
              <s-link key={item.href} href={item.href}>
                {item.label}
              </s-link>
            ))}
            <s-badge tone="info">Preview mode · demo data, no Shopify connection</s-badge>
          </s-stack>
        </s-box>
        <Outlet />
      </AppProvider>
    );
  }

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        {NAV.map((item) => (
          <s-link key={item.href} href={item.href}>
            {item.label}
          </s-link>
        ))}
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
