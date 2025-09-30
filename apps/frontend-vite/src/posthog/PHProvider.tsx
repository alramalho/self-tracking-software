"use client";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { useEffect } from "react";

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (
      import.meta.env.VITE_POSTHOG_KEY &&
      import.meta.env.VITE_POSTHOG_HOST
    ) {
      posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
        api_host: "/relay-ph",
        ui_host: import.meta.env.VITE_POSTHOG_HOST,
        person_profiles: "identified_only",
        capture_pageview: false,
        capture_pageleave: true,
      });
    } 
    }, []);

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
