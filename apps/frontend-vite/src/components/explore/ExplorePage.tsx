import { useCircleSearch, useCircleSuggestions, useMyCircles } from "@/components/circles/api";
import { JoinDialog } from "@/components/circles/JoinDialog";
import type { CircleCard } from "@/components/circles/types";
import { Input } from "@/components/ui/input";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { ChevronLeft, Loader2, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useConnectionSearch, useRecommendedUsers } from "./api";
import { ExploreGrid } from "./ExploreGrid";
import { exploreRows, matchingPeople, normalizeQuery, recommendedPeople } from "./model";
import type { ExploreCircle, ExplorePerson } from "./types";

// Waits for typing to pause before searching.
function useDebounced(value: string, delay = 250) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

// Explore: circles to join and people to follow, until you type a name or goal.
export function ExplorePage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [text, setText] = useState("");
  const value = normalizeQuery(text);
  const query = useDebounced(value);
  const [joining, setJoining] = useState<CircleCard | null>(null);

  const recommended = useRecommendedUsers();
  const suggestions = useCircleSuggestions();
  const mine = useMyCircles();
  const circleResults = useCircleSearch(query);
  const connections = useConnectionSearch(query);

  const suggested = recommendedPeople(recommended.data);
  const sources = query ? [circleResults, connections] : [suggestions, recommended];
  const rows = exploreRows({
    circles: query ? circleResults.data ?? [] : (suggestions.data ?? []).flatMap((group) => group.circles),
    joinedCircleIds: (mine.data ?? []).map((circle) => circle.id),
    people: query ? matchingPeople(query, connections.data ?? [], suggested) : suggested,
  });
  const loading = value !== query || sources.some((source) => source.isPending);
  const failed = sources.some((source) => source.error);

  const openCircle = ({ card, joined }: ExploreCircle) => {
    if (joined) navigate({ to: "/circle/$id", params: { id: card.id } });
    else setJoining(card);
  };
  const openPerson = (person: ExplorePerson) =>
    navigate({ to: "/profile/$username", params: { username: person.username } });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-2 pb-8">
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Back" onClick={() => router.history.back()} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-2xl font-bold">Search</h1>
      </div>
      <div className="relative mx-2">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          data-testid="people-search-input"
          aria-label="Search people and circles"
          placeholder="People, circles, goals…"
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="h-[50px] rounded-2xl border-0 bg-muted pl-11 text-base"
        />
        {text && (
          <button type="button" aria-label="Clear search" onClick={() => setText("")} className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      {failed && (
        <p className="mx-2 text-sm text-red-500">
          Couldn't load everything.{" "}
          <button type="button" className="underline" onClick={() => sources.forEach((source) => void source.refetch())}>
            Try again
          </button>
        </p>
      )}
      {!rows.length && loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !rows.length && !failed ? (
        <p className="mx-2 rounded-2xl bg-card p-4 text-muted-foreground">
          {query ? "Nothing matches. Try another name, username or goal." : "Nothing to explore yet. Add a plan to meet people working on the same thing."}
        </p>
      ) : (
        <ExploreGrid rows={rows} onOpenCircle={openCircle} onOpenPerson={openPerson} />
      )}
      <JoinDialog
        card={joining}
        onClose={() => setJoining(null)}
        onJoined={(id) => {
          setJoining(null);
          navigate({ to: "/circle/$id", params: { id }, search: { proof: true } });
        }}
      />
    </div>
  );
}
