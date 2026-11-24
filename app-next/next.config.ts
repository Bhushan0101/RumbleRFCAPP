import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components (Next 16 experimental) is strict about runtime-only data
  // in prerendered pages. Our app is auth-gated and reads from the DB on
  // every request; opt out for a simpler SSR model that just works.
  cacheComponents: false,
  // On Render / Cloudflare / Vercel behind a load balancer, the Origin header
  // of a server-action POST is the public URL but the proxy forwards it with
  // a different Host. Next.js 16 refuses the action unless we tell it the
  // forwarded host is allowed.
  experimental: {
    serverActions: {
      allowedOrigins: [
        "*.onrender.com",
        "*.workers.dev",
        "wucoireland.ie",
        "www.wucoireland.ie",
      ],
      // Fighter profile photos can be up to 5 MB.
      bodySizeLimit: "5mb",
    },
  },
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
