// Renders the real web components for the Coach tab change with illustrative data, for screenshots.
// Open /e2e/coach/?view=coach|plan|home|profile and add &theme=dark for dark mode.
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import BottomNav from "../../src/components/BottomNav";
import { PlanRendererv2 } from "../../src/components/PlanRendererv2";
import { PlanCard } from "../../src/components/home-cards/PlanCard";
import { CheckinsCard } from "../../src/components/profile/CheckinsCard";
import { Route as CoachRoute } from "../../src/routes/coach";
import { plans, activityEntries } from "./data";
import "../../src/index.css";

const params = new URLSearchParams(location.search);
const view = params.get("view") ?? "coach";
document.documentElement.classList.toggle("dark", params.get("theme") === "dark");

const CoachPage = CoachRoute.options.component!;
const Page = () => (
  <main className="mx-auto min-h-screen max-w-[430px] bg-background pb-28 text-foreground">
    <Outlet />
    <BottomNav />
  </main>
);
const Plan = () => (
  <div className="flex flex-col gap-4 p-4">
    <h1 className="text-3xl font-bold">Plans</h1>
    <PlanRendererv2 selectedPlan={plans.find((p) => p.id === (params.get("plan") ?? "half")) as never} />
  </div>
);
const Home = () => (
  <div className="flex flex-col gap-4 p-4">
    <h1 className="text-2xl font-bold">Alex</h1>
    <div className="grid grid-cols-2 gap-3">
      {plans.map((p) => (
        <PlanCard key={p.id} plan={p as never} activityEntries={activityEntries as never} />
      ))}
    </div>
  </div>
);
const Profile = () => (
  <div className="flex flex-col gap-2 p-4">
    <h1 className="text-2xl font-bold">Alex</h1>
    <p className="text-sm text-muted-foreground">@alex</p>
    <CheckinsCard />
  </div>
);

const root = createRootRoute({ component: Page });
const route = (path: string, component: () => JSX.Element | null = () => null) =>
  createRoute({ getParentRoute: () => root, path, component });
const router = createRouter({
  routeTree: root.addChildren([
    route("/coach", CoachPage as () => JSX.Element),
    route("/plans", Plan),
    route("/", Home),
    route("/profile/$username", Profile),
    route("/message-ai"),
    route("/add"),
    route("/insights/dashboard"),
    route("/edit-plan/$planId"),
  ]),
  history: createMemoryHistory({
    initialEntries: [view === "plan" ? "/plans" : view === "home" ? "/" : view === "profile" ? "/profile/alex" : "/coach"],
  }),
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
