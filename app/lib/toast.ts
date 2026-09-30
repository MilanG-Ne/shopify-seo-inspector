/**
 * Shows an App Bridge toast when running embedded. Preview mode has no App
 * Bridge, and every page also reports results inline, so this is a no-op there.
 */
export function showToast(message: string, options: { isError?: boolean } = {}): void {
  if (typeof shopify === "undefined") return;
  shopify.toast.show(message, { isError: options.isError ?? false });
}
