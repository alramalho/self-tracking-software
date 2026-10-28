import { ExplorePage } from "@/components/explore/ExplorePage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/search")({
  component: ExplorePage,
});
