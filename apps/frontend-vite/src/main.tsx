import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

// Import the generated route tree
import posthog from "posthog-js";
import { routeTree } from "./routeTree.gen";
import { PostHogProvider } from "posthog-js/react";

// Create a new router instance
const router = createRouter({ routeTree });

posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
  defaults: "2025-05-24",
  api_host: "/relay-ph",
  // person_profiles: "identified_only",
  // capture_pageview: false,
  // capture_pageleave: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PostHogProvider client={posthog}>
      <RouterProvider router={router} />
    </PostHogProvider>
  </StrictMode>
);
