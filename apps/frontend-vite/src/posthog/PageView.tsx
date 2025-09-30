import { useLocation, useSearch } from "@tanstack/react-router";
import { usePostHog } from 'posthog-js/react';
import { useEffect } from "react";

export default function PostHogPageView() : null {
  const location = useLocation();
  const search = useSearch({ strict: false });
  const posthog = usePostHog();
  
  useEffect(() => {
    // Track pageviews
    if (location.pathname && posthog) {
      let url = window.origin + location.pathname
      const searchString = new URLSearchParams(search as Record<string, string>).toString();
      if (searchString) {
        url = url + `?${searchString}`
      }
      posthog.capture(
        '$pageview',
        {
          '$current_url': url,
        }
      )
    }
  }, [location.pathname, search, posthog])
  
  return null
}