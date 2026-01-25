import { Response, Router } from "express";
import axios from "axios";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { logger } from "../utils/logger";

const router = Router();

// Simple in-memory cache for OpenGraph data (5 minute TTL)
const ogCache = new Map<string, { data: OGData; timestamp: number }>();
const OG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface OGData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
}

/**
 * Extract OpenGraph meta tags from HTML
 */
function extractOGTags(html: string, url: string): OGData {
  const result: OGData = { url };

  // Helper to extract meta content
  const getMetaContent = (property: string): string | undefined => {
    // Try og: prefix
    const ogMatch = html.match(
      new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']+)["']`, "i")
    );
    if (ogMatch) return ogMatch[1];

    // Try reverse order (content before property)
    const ogMatchReverse = html.match(
      new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${property}["']`, "i")
    );
    if (ogMatchReverse) return ogMatchReverse[1];

    // Try name attribute for non-og tags
    const nameMatch = html.match(
      new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["']`, "i")
    );
    if (nameMatch) return nameMatch[1];

    // Try reverse for name attribute
    const nameMatchReverse = html.match(
      new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${property}["']`, "i")
    );
    if (nameMatchReverse) return nameMatchReverse[1];

    return undefined;
  };

  // Extract OG tags
  result.title = getMetaContent("title");
  result.description = getMetaContent("description");
  result.image = getMetaContent("image");
  result.siteName = getMetaContent("site_name");

  // Fallback to <title> tag if no og:title
  if (!result.title) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) result.title = titleMatch[1].trim();
  }

  // Fallback to meta description if no og:description
  if (!result.description) {
    result.description = getMetaContent("description");
  }

  // Extract favicon
  const faviconMatch = html.match(
    /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i
  );
  if (faviconMatch) {
    let faviconUrl = faviconMatch[1];
    // Make relative URLs absolute
    if (faviconUrl.startsWith("//")) {
      faviconUrl = "https:" + faviconUrl;
    } else if (faviconUrl.startsWith("/")) {
      const urlObj = new URL(url);
      faviconUrl = urlObj.origin + faviconUrl;
    } else if (!faviconUrl.startsWith("http")) {
      const urlObj = new URL(url);
      faviconUrl = urlObj.origin + "/" + faviconUrl;
    }
    result.favicon = faviconUrl;
  }

  // Fallback favicon using domain
  if (!result.favicon) {
    try {
      const urlObj = new URL(url);
      result.favicon = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`;
    } catch {
      // Ignore URL parsing errors
    }
  }

  // Make relative image URLs absolute
  if (result.image && !result.image.startsWith("http")) {
    try {
      const urlObj = new URL(url);
      if (result.image.startsWith("//")) {
        result.image = "https:" + result.image;
      } else if (result.image.startsWith("/")) {
        result.image = urlObj.origin + result.image;
      } else {
        result.image = urlObj.origin + "/" + result.image;
      }
    } catch {
      // Ignore URL parsing errors
    }
  }

  return result;
}

/**
 * Fetch OpenGraph data for a URL
 */
router.get(
  "/og",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { url } = req.query;

      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "url query parameter is required" });
      }

      // Validate URL
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: "Invalid URL" });
      }

      // Check cache
      const cached = ogCache.get(url);
      if (cached && Date.now() - cached.timestamp < OG_CACHE_TTL) {
        return res.json(cached.data);
      }

      // Fetch the page
      const response = await axios.get(url, {
        timeout: 5000,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; TrackingSoBot/1.0)",
          "Accept": "text/html,application/xhtml+xml",
        },
        maxRedirects: 3,
        validateStatus: (status) => status < 400,
      });

      const html = response.data;
      const ogData = extractOGTags(html, url);

      // Cache the result
      ogCache.set(url, { data: ogData, timestamp: Date.now() });

      // Clean up old cache entries periodically
      if (ogCache.size > 1000) {
        const now = Date.now();
        for (const [key, value] of ogCache.entries()) {
          if (now - value.timestamp > OG_CACHE_TTL) {
            ogCache.delete(key);
          }
        }
      }

      logger.info(`Fetched OG data for ${url}`);

      res.json(ogData);
    } catch (error) {
      logger.error("Error fetching OpenGraph data:", error);

      // Return minimal data with just the favicon fallback
      const url = req.query.url as string;
      try {
        const urlObj = new URL(url);
        return res.json({
          url,
          favicon: `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`,
        });
      } catch {
        return res.status(500).json({ error: "Failed to fetch OpenGraph data" });
      }
    }
  }
);

/**
 * Batch fetch OpenGraph data for multiple URLs
 */
router.post(
  "/og/batch",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { urls } = req.body;

      if (!Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: "urls array is required" });
      }

      if (urls.length > 10) {
        return res.status(400).json({ error: "Maximum 10 URLs per request" });
      }

      const results: Record<string, OGData> = {};

      // Process URLs in parallel
      await Promise.all(
        urls.map(async (url: string) => {
          try {
            // Validate URL
            new URL(url);

            // Check cache first
            const cached = ogCache.get(url);
            if (cached && Date.now() - cached.timestamp < OG_CACHE_TTL) {
              results[url] = cached.data;
              return;
            }

            // Fetch the page
            const response = await axios.get(url, {
              timeout: 5000,
              headers: {
                "User-Agent": "Mozilla/5.0 (compatible; TrackingSoBot/1.0)",
                "Accept": "text/html,application/xhtml+xml",
              },
              maxRedirects: 3,
              validateStatus: (status) => status < 400,
            });

            const html = response.data;
            const ogData = extractOGTags(html, url);

            // Cache the result
            ogCache.set(url, { data: ogData, timestamp: Date.now() });
            results[url] = ogData;
          } catch (error) {
            // Return minimal data on error
            try {
              const urlObj = new URL(url);
              results[url] = {
                url,
                favicon: `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`,
              };
            } catch {
              results[url] = { url };
            }
          }
        })
      );

      logger.info(`Batch fetched OG data for ${urls.length} URLs`);

      res.json({ results });
    } catch (error) {
      logger.error("Error in batch OpenGraph fetch:", error);
      res.status(500).json({ error: "Failed to fetch OpenGraph data" });
    }
  }
);

export const utilsRouter: Router = router;
export default utilsRouter;
