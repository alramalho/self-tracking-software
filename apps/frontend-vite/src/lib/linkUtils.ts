// URL detection regex - matches http(s):// URLs and www. URLs
const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<>"{}|\\^`[\]]+/gi;

const TRAILING_URL_PUNCTUATION = /[.,!?;:]+$/;

function trimTrailingUrlPunctuation(rawUrl: string): {
  url: string;
  trailingText: string;
} {
  let url = rawUrl;
  let trailingText = "";

  const punctuationMatch = url.match(TRAILING_URL_PUNCTUATION);
  if (punctuationMatch) {
    trailingText = punctuationMatch[0] + trailingText;
    url = url.slice(0, -punctuationMatch[0].length);
  }

  while (url.endsWith(")")) {
    const openCount = (url.match(/\(/g) || []).length;
    const closeCount = (url.match(/\)/g) || []).length;
    if (closeCount <= openCount) break;

    trailingText = ")" + trailingText;
    url = url.slice(0, -1);
  }

  return { url, trailingText };
}

function ensureProtocol(url: string): string {
  return url.startsWith("www.") ? `https://${url}` : url;
}

/**
 * Extract the first URL from a text string
 */
export function extractFirstUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const matches = text.match(URL_REGEX);
  if (!matches || matches.length === 0) return null;

  // Ensure URL has protocol
  const { url } = trimTrailingUrlPunctuation(matches[0]);
  return ensureProtocol(url);
}

/**
 * Extract all URLs from a text string
 */
export function extractAllUrls(text: string | null | undefined): string[] {
  if (!text) return [];
  const matches = text.match(URL_REGEX);
  if (!matches) return [];

  return matches.map((url) => ensureProtocol(trimTrailingUrlPunctuation(url).url));
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

    const { url, trailingText } = trimTrailingUrlPunctuation(match[0]);
    parts.push({
      type: "url",
      content: ensureProtocol(url),
    });
    if (trailingText) {
      parts.push({
        type: "text",
        content: trailingText,
      });
    }

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
