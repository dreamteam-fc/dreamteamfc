import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
  // Keep sharp on the Node runtime (native/libvips), not Edge/wasm.
  serverExternalPackages: ["sharp"]
};

export default nextConfig;
