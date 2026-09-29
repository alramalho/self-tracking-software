import { useState } from "react";
import { Keyboard, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Text } from "@/components/typography/Text";
import { Status, useColors } from "@/components/ui";
import { SearchField, useDebounced } from "@/features/people/SearchField";
import { CircleCardView } from "./components";
import { JoinSheet } from "./JoinSheet";
import { useCircleSearch, useCircleSuggestions } from "./api";
import type { CircleCard, CirclePickerProps, CircleSearchResultsProps } from "./types";

// Circles you could join: suggestions per plan until you type, then search results.
export function CircleSearch() {
  const c = useColors();
  const client = useQueryClient();
  const [text, setText] = useState("");
  const value = text.trim();
  const [query, setQuery] = useDebounced(value);
  const [joining, setJoining] = useState<CircleCard | null>(null);
  const pick = (card: CircleCard) => {
    Keyboard.dismiss();
    setJoining(card);
  };
  return (
    <>
      <SearchField
        testID="circle-search-input" label="Search circles" placeholder="Guitar, running, studying…"
        value={text} onChange={setText} onSubmit={() => { setQuery(value); Keyboard.dismiss(); }}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32, gap: 20 }}
      >
        {value ? <SearchResults query={query} onPick={pick} /> : <PlanSuggestionList onPick={pick} />}
        <Text style={{ color: c.muted, fontSize: 12 }}>Full and invite-only circles aren't listed.</Text>
      </ScrollView>
      <JoinSheet
        card={joining}
        onClose={() => setJoining(null)}
        onJoined={(id) => {
          setJoining(null);
          void client.invalidateQueries({ queryKey: ["circles"] });
          router.push(`/circle/${id}?proof=1`);
        }}
      />
    </>
  );
}

function PlanSuggestionList({ onPick }: CirclePickerProps) {
  const c = useColors();
  const suggestions = useCircleSuggestions();
  const groups = (suggestions.data ?? []).filter((group) => group.circles.length > 0);
  if (!groups.length)
    return (
      <Status
        loading={suggestions.isPending}
        error={suggestions.error}
        retry={() => void suggestions.refetch()}
        empty="No circles yet for your plans. Start one from a plan."
      />
    );
  return groups.map(({ plan, circles }) => (
    <View key={plan.id} style={{ gap: 10 }}>
      <Text accessibilityRole="header" style={{ fontSize: 14, fontWeight: "600", color: c.muted }}>
        {`For ${plan.emoji ? `${plan.emoji} ` : ""}${plan.goal}`}
      </Text>
      {circles.map((card) => <CircleCardView key={card.id} card={card} onPress={() => onPick(card)} />)}
    </View>
  ));
}

function SearchResults({ query, onPick }: CircleSearchResultsProps) {
  const results = useCircleSearch(query);
  const cards = results.data ?? [];
  if (!cards.length)
    return (
      <Status
        loading={!query || results.isPending}
        error={results.error}
        retry={() => void results.refetch()}
        empty="No circles match"
      />
    );
  return (
    <View style={{ gap: 10 }}>
      {cards.map((card) => <CircleCardView key={card.id} card={card} onPress={() => onPick(card)} />)}
    </View>
  );
}
