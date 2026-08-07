import path from "node:path";

import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

/**
 * Must stay >= TEAM_LOGO_MAX_INPUT_BYTES (5 MiB) plus multipart FormData overhead.
 * Next.js default Server Action body limit is 1 MB — larger logo uploads then fail
 * before the action try/catch with an opaque "server error" page (HTTP 413).
 */
const SERVER_ACTION_BODY_SIZE_LIMIT = "6mb";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
  // Keep sharp on the Node runtime (native/libvips), not Edge/wasm.
  serverExternalPackages: ["sharp"],
  // Ensure native sharp (+ platform libvips) lands in the Railway standalone image.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/sharp/**/*", "./node_modules/@img/**/*"]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: SERVER_ACTION_BODY_SIZE_LIMIT
    }
  }
};

export default withSerwist(nextConfig);
