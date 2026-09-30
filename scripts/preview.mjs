// Runs the app UI against the bundled demo catalog, with no Shopify login.
// See "Preview mode" in the README. Never used by `shopify app dev`.
import { spawn } from "node:child_process";

const env = {
  ...process.env,
  NODE_ENV: "development",
  SEO_INSPECTOR_PREVIEW: "1",
  // shopifyApp() validates these at startup; preview mode never uses them.
  SHOPIFY_API_KEY: "preview",
  SHOPIFY_API_SECRET: "preview",
  SHOPIFY_APP_URL: "http://localhost:3000",
  SCOPES: "read_products,write_products,write_files",
};

const run = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit", shell: process.platform === "win32" });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`))));
  });

await run("npx", ["prisma", "generate"]);
await run("npx", ["prisma", "migrate", "deploy"]);
await run("npx", ["react-router", "dev"]);
