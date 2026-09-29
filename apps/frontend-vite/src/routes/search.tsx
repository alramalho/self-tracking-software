import { CircleSearch } from "@/components/circles/CircleSearch";
import { SearchTabs } from "@/components/search/SearchTabs";
import type { SearchPageSearch, SearchTab } from "@/components/search/types";
import UserSearch, { type UserSearchResult } from "@/components/UserSearch";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/search")({
  component: SearchPage,
  validateSearch: (search: Record<string, unknown>): SearchPageSearch => ({
    tab: search.tab === "circles" ? "circles" : undefined,
  }),
});

// People: find friends by name or username. Circles: groups you could join.
function SearchPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const tab: SearchTab = search.tab ?? "people";
  const changeTab = (next: SearchTab) =>
    navigate({ to: "/search", search: next === "circles" ? { tab: "circles" } : {}, replace: true });
  const openProfile = (user: UserSearchResult) =>
    navigate({ to: "/profile/$username", params: { username: user.username } });

  return (
    <div className="container mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-4 pb-8">
      <SearchTabs value={tab} onChange={changeTab} />
      {tab === "circles" ? <CircleSearch /> : <UserSearch onUserClick={openProfile} />}
    </div>
  );
}
