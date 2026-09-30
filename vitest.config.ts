import { defineConfig } from "vitest/config";

// Kept separate from vite.config.ts so unit tests don't boot the React Router
// plugin or need Shopify environment variables.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
