import { Response, Router } from "express";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { CLIENT_ROUGH_EDGES, recordRoughEdge, type RoughEdgeKind } from "../services/roughEdges";

// The app reports a failure the person actually saw (a cut-off chat reply, a voice note that didn't go through).
const router: Router = Router();

router.post("/", ...requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const kind = req.body?.kind as RoughEdgeKind;
  if (!CLIENT_ROUGH_EDGES.includes(kind)) return void res.status(400).json({ error: "Unknown kind" });
  const detail = typeof req.body?.detail === "string" ? req.body.detail : undefined;
  recordRoughEdge({ kind, userId: req.user!.id, detail });
  res.json({ ok: true });
});

export const roughEdgesRouter = router;
