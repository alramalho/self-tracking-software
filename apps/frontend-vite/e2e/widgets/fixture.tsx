import React from "react";
import { createRoot } from "react-dom/client";
import {
  useRouterState,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { PlanCard } from "../../src/components/home-cards/PlanCard";
import { MetricsCard } from "../../src/components/home-cards/MetricsCard";
import { CoachCard } from "../../src/components/home-cards/CoachCard";
import { UpcomingSessionsCard } from "../../src/components/home-cards/UpcomingSessionsCard";
import { plan, scheduled } from "./data";
import "../../src/index.css";
const dark = new URLSearchParams(location.search).get("theme") === "dark";
document.documentElement.classList.toggle("dark", dark);
function Gallery() {
  const href = useRouterState({ select: (state) => state.location.href });
  const [logger, setLogger] = React.useState(false);
  return (
    <main
      style={{
        maxWidth: 390,
        margin: "auto",
        padding: "24px 20px",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <h1 className="mb-2 text-2xl font-semibold">Original homepage cards.</h1>
      <p className="mb-6 text-xs text-muted-foreground">
        Actual PWA components · illustrative test data
      </p>
      <div className="grid grid-cols-2 gap-3">
        <MetricsCard onLogClick={() => setLogger(true)} />
        <PlanCard plan={plan} activityEntries={[]} />
        <CoachCard />
        <PlanCard plan={{ ...scheduled, sessions: [] }} />
        <UpcomingSessionsCard plans={[scheduled]} />
      </div>
      <output className="sr-only" data-testid="fixture-navigation">
        {href}
      </output>
      {logger && <p role="status">Check-in action received</p>}
    </main>
  );
}
const root = createRootRoute({ component: Gallery });
const plans = createRoute({ getParentRoute: () => root, path: "/plans" });
const messages = createRoute({
  getParentRoute: () => root,
  path: "/message-ai",
});
const router = createRouter({
  routeTree: root.addChildren([plans, messages]),
  history: createMemoryHistory(),
});
createRoot(document.getElementById("root")!).render(
  <RouterProvider router={router} />,
);
