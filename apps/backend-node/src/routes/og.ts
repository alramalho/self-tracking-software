import { Router, type Request, type Response } from "express";
import {
  findCircleInvite,
  inviteCacheKey,
  inviteMeta,
  inviteOgCard,
} from "../services/og/circleInvite";
import { cachedOgCard } from "../services/og/render";
import { logger } from "../utils/logger";

// Link previews (OpenGraph) for shared links. Public: crawlers don't sign in.
const router: Router = Router();

const DEFAULT_IMAGE = "https://app.tracking.so/images/og.png";

// The API's public address, as the proxy in front of it received the request.
const origin = (req: Request) =>
  `${req.protocol}://${req.get("x-forwarded-host") ?? req.get("host")}`;

// The 1200x630 image. Crawlers never get an error: anything that goes wrong shows the default image.
router.get("/circle-invite/:code.png", async (req: Request, res: Response) => {
  try {
    const invite = await findCircleInvite(req.params.code);
    if (!invite) {
      res.redirect(302, DEFAULT_IMAGE);
      return;
    }
    const png = await cachedOgCard(
      inviteCacheKey(req.params.code, invite.card),
      inviteOgCard(invite),
    );
    res
      .set({
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=600",
        // Helmet's default only lets this site embed the image; previews load it from anywhere.
        "Cross-Origin-Resource-Policy": "cross-origin",
      })
      .send(png);
  } catch (error) {
    logger.warn("Could not render a circle invite preview", { error });
    res.redirect(302, DEFAULT_IMAGE);
  }
});

// The title, description and image the web app puts in the page's meta tags for crawlers.
router.get("/circle-invite/:code", async (req: Request, res: Response) => {
  try {
    const invite = await findCircleInvite(req.params.code);
    if (!invite) {
      res.status(404).json({ error: "This invite link doesn't work anymore" });
      return;
    }
    res.json({
      ...inviteMeta(invite),
      image: `${origin(req)}/og/circle-invite/${encodeURIComponent(req.params.code)}.png`,
    });
  } catch (error) {
    logger.error("Could not load a circle invite preview", { error });
    res.status(500).json({ error: "Could not load this invite. Please retry." });
  }
});

export const ogRouter: Router = router;
