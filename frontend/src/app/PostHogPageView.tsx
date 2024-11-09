// app/PostHogPageView.tsx
'use client'

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { usePostHog } from 'posthog-js/react';
import { useNotifications } from "@/hooks/useNotifications";

export default function PostHogPageView() : null {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();
  const { isAppInstalled } = useNotifications();
  
  useEffect(() => {
    // Track pageviews
    if (pathname && posthog) {
      let url = window.origin + pathname
      if (searchParams.toString()) {
        url = url + `?${searchParams.toString()}`
      }
      posthog.capture(
        '$pageview',
        {
          '$current_url': url,
          'isAppInstalled': isAppInstalled
        }
      )
    }
  }, [pathname, searchParams, posthog])
  
  return null
}