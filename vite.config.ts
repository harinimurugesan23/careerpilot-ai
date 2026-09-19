import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

// The Cloudflare Vite plugin runs the Worker (src/server.ts) locally with
// real bindings during `npm run dev`, and bundles everything correctly
// for `wrangler deploy`. React handles the frontend as usual.
export default defineConfig({
  plugins: [react(), cloudflare()],
});
