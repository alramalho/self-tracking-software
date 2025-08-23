// import withSerwistInit from "@serwist/next";

// const withSerwist = withSerwistInit({
//   swSrc: "src/app/sw.ts",
//   swDest: "public/sw.js",
//   register: false, // we'll do this manually
//   cacheOnFrontEndNav: true,
// });

const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
      {
        source: "/ingest/decide",
        destination: "https://eu.i.posthog.com/decide",
      },
    ];
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
  env: {
    // Client env variables go here
  },
  optimizePackageImports: ["@prisma/client"],
};

export default nextConfig;
// export default withSerwist(nextConfig);
