import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components (Next 16 experimental) is strict about runtime-only data
  // in prerendered pages. Our app is auth-gated and reads from the DB on
  // every request; opt out for a simpler SSR model that just works.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
