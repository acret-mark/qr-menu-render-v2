import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  experimental: {
    serverActions: {
      // Default is 1MB — real phone camera photos routinely exceed that.
      // Capped at 4mb, not the app's full validateLogoFile allowance.
      // Originally required because Vercel's Serverless Functions hard-cap
      // request bodies at 4.5MB at the infra level; Render's Web Services
      // aren't serverless functions, so that ceiling doesn't apply here —
      // left in place as a harmless, no-longer-load-bearing cap (see
      // reference/render-and-authjs-replacement.md).
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
