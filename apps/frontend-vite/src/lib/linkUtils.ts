// URL detection regex - matches http(s):// URLs and www. URLs
const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<>"{}|\\^`[\]]+/gi;

/**
 * Extract the first URL from a text string
 */
export function extractFirstUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const matches = text.match(URL_REGEX);
  if (!matches || matches.length === 0) return null;

  // Ensure URL has protocol
  let url = matches[0];
  if (url.startsWith("www.")) {
    url = "https://" + url;
  }
  return url;
}

/**
 * Extract all URLs from a text string
 */
export function extractAllUrls(text: string | null | undefined): string[] {
  if (!text) return [];
  const matches = text.match(URL_REGEX);
  if (!matches) return [];

  return matches.map((url) => {
    if (url.startsWith("www.")) {
      return "https://" + url;
    }
    return url;
  });
}

/**
 * Extract domain from a URL for display
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Split text into parts: regular text and URLs
 */
export function splitTextWithUrls(
  text: string
): Array<{ type: "text" | "url"; content: string }> {
  const parts: Array<{ type: "text" | "url"; content: string }> = [];
  let lastIndex = 0;

  const regex = new RegExp(URL_REGEX.source, "gi");
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: text.slice(lastIndex, match.index),
      });
    }

    // Add the URL
    let url = match[0];
    if (url.startsWith("www.")) {
      url = "https://" + url;
    }
    parts.push({
      type: "url",
      content: url,
    });

    lastIndex = regex.lastIndex;
  }

  // Add remaining text after last URL
  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      content: text.slice(lastIndex),
    });
  }

  return parts;
}
