import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  register: false, // we'll do this manually
});

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/relay-ph/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/relay-ph/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
      {
        source: "/relay-ph/decide",
        destination: "https://eu.i.posthog.com/decide",
      },
    ];
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
  env: {
    // Client env variables go here
  },
  webpack: (config, { isServer }) => {
    if (isServer && process.env.NODE_ENV === "production") {
      config.plugins = [...config.plugins, new PrismaPlugin()];
    }

    return config;
  },
};

export default process.env.NODE_ENV === "production"
  ? withSerwist(nextConfig)
  : nextConfig;
// export default withSerwist(nextConfig);
