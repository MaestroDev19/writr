import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const internalHost = process.env.TAURI_DEV_HOST || 'localhost';

const nextConfig: NextConfig = {
  // Tauri needs a static export (no Node server in the desktop shell)
  // https://nextjs.org/docs/app/building-your-application/deploying/static-exports
  output: "export",
  images: {
    unoptimized: true,
  },
  // Dev: load assets from the Next dev server so Tauri can resolve them
  assetPrefix: isProd ? undefined : `http://${internalHost}:3000`,

  experimental: {
    agentFeedback: true,
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
