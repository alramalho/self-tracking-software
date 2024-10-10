import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  register: false, // we'll do this manually
  cacheOnFrontEndNav: true,
});

export default withSerwist({
  // Your Next.js config
  env: {
    // Client env variables go here
  },
});

export default {};
