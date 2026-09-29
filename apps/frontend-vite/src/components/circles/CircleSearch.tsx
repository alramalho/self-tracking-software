import { Input } from "@/components/ui/input";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useCircleSearch, useCircleSuggestions } from "./api";
import { CircleCardView } from "./components";
import { JoinDialog } from "./JoinDialog";
import type { CircleCard, CirclePickerProps, CircleSearchResultsProps, LoadErrorProps } from "./types";

const SEARCH_DELAY_MS = 300;

function useDebounced(value: string) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [value]);
  return debounced;
}

// Circles you could join: suggestions per plan until you type, then search results.
export function CircleSearch() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const value = text.trim();
  const query = useDebounced(value);
  const [joining, setJoining] = useState<CircleCard | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          data-testid="circle-search-input"
          aria-label="Search circles"
          placeholder="Guitar, running, studying…"
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="pl-9"
        />
      </div>
      {value ? <SearchResults query={query} onPick={setJoining} /> : <PlanSuggestionList onPick={setJoining} />}
      <p className="text-xs text-muted-foreground">Full and invite-only circles aren't listed.</p>
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

function Loading() {
  return (
    <div className="flex justify-center py-6">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function LoadError({ message, retry }: LoadErrorProps) {
  return (
    <p className="text-sm text-red-500">
      {message}{" "}
      <button type="button" className="underline" onClick={retry}>
        Retry
      </button>
    </p>
  );
}

function PlanSuggestionList({ onPick }: CirclePickerProps) {
  const suggestions = useCircleSuggestions();
  const groups = (suggestions.data ?? []).filter((group) => group.circles.length > 0);
  if (suggestions.isPending) return <Loading />;
  if (suggestions.error)
    return <LoadError message="Couldn't load circles." retry={() => void suggestions.refetch()} />;
  if (!groups.length)
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No circles yet for your plans. Start one from a plan.
      </p>
    );
  return groups.map(({ plan, circles }) => (
    <section key={plan.id} className="flex flex-col gap-2.5">
      <h3 className="text-sm font-semibold text-muted-foreground">
        {`For ${plan.emoji ? `${plan.emoji} ` : ""}${plan.goal}`}
      </h3>
      {circles.map((card) => (
        <CircleCardView key={card.id} card={card} onPress={() => onPick(card)} />
      ))}
    </section>
  ));
}

function SearchResults({ query, onPick }: CircleSearchResultsProps) {
  const results = useCircleSearch(query);
  const cards = results.data ?? [];
  if (!query || results.isPending) return <Loading />;
  if (results.error)
    return <LoadError message="Couldn't search circles." retry={() => void results.refetch()} />;
  if (!cards.length)
    return <p className="py-6 text-center text-sm text-muted-foreground">No circles match</p>;
  return (
    <div className="flex flex-col gap-2.5">
      {cards.map((card) => (
        <CircleCardView key={card.id} card={card} onPress={() => onPick(card)} />
      ))}
    </div>
  );
}
