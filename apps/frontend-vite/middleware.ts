// Vercel Routing Middleware: runs before the SPA is served. Link-preview crawlers (iMessage,
// WhatsApp, Slack...) don't run JavaScript, so for a circle invite they get the same page
// with that circle's title, description and image in the meta tags. Everyone else, and any
// failure, continues to the app untouched.

export const config = { matcher: "/circle-invite/:code" };

const API_URL = process.env.VITE_BACKEND_URL || "https://api.tracking.so";

// iMessage's preview fetcher calls itself both facebookexternalhit and Twitterbot.
const CRAWLERS =
  /facebookexternalhit|Facebot|Twitterbot|WhatsApp|TelegramBot|Slackbot|Discordbot|LinkedInBot|Applebot|Pinterest|redditbot|SkypeUriPreview|Googlebot/i;

export interface Preview {
  title: string;
  description: string;
  image: string;
  url: string;
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Swaps the static preview tags of index.html for this page's own.
export function withPreview(html: string, preview: Preview): string {
  const tags: Record<string, string> = {
    description: preview.description,
    "og:title": preview.title,
    "og:description": preview.description,
    "og:image": preview.image,
    "og:url": preview.url,
    "twitter:title": preview.title,
    "twitter:description": preview.description,
    "twitter:image": preview.image,
    "twitter:url": preview.url,
  };
  let page = html.replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(preview.title)}</title>`);
  for (const [name, value] of Object.entries(tags)) {
    const tag = new RegExp(`(<meta (?:property|name)="${name}" content=")[^"]*"`);
    page = page.replace(tag, (_match, start: string) => `${start}${escapeHtml(value)}"`);
  }
  return page;
}

// What `next()` from @vercel/functions returns: carry on to the normal response.
const carryOn = () => new Response(null, { headers: { "x-middleware-next": "1" } });

export default async function middleware(request: Request): Promise<Response> {
  if (!CRAWLERS.test(request.headers.get("user-agent") ?? "")) return carryOn();
  try {
    const url = new URL(request.url);
    const code = url.pathname.split("/")[2];
    const timeout = () => AbortSignal.timeout(4000);
    const [meta, page] = await Promise.all([
      fetch(`${API_URL}/og/circle-invite/${code}`, { signal: timeout() }),
      fetch(new URL("/index.html", url), { signal: timeout() }),
    ]);
    if (!meta.ok || !page.ok) return carryOn();
    const { title, description, image } = (await meta.json()) as Preview;
    const html = withPreview(await page.text(), {
      title,
      description,
      image,
      url: `${url.origin}${url.pathname}`,
    });
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  } catch {
    return carryOn();
  }
}
