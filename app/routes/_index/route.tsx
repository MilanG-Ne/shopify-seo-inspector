import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { PREVIEW_MODE } from "../../demo/preview.server";
import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (PREVIEW_MODE) throw redirect("/app");

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>SEO Inspector</h1>
        <p className={styles.text}>
          Find and fix the on-page SEO problems in your Shopify catalog.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Audit</strong>. Nine checks across products and collections:
            SEO titles, meta descriptions, duplicates, image alt text and thin copy.
          </li>
          <li>
            <strong>Score</strong>. A 0–100 store score and a worst-offenders list,
            so you know where to start.
          </li>
          <li>
            <strong>Fix in place</strong>. Edit SEO fields with live counters and
            write alt text in bulk, reviewing every change before it&apos;s saved.
          </li>
        </ul>
      </div>
    </div>
  );
}
