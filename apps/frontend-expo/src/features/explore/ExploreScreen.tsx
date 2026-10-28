import { useState } from "react";
import { Keyboard, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Text } from "@/components/typography/Text";
import { IconButton, Status, useColors } from "@/components/ui";
import { ProfileGlow } from "@/components/ProfileGlow";
import { goBack } from "@/core/navigation";
import { useCircleSearch, useCircleSuggestions, useMyCircles } from "@/features/circles/api";
import { JoinSheet } from "@/features/circles/JoinSheet";
import type { CircleCard } from "@/features/circles/types";
import { SearchField, useDebounced } from "@/features/people/SearchField";
import { useConnectionSearch, useRecommendedUsers } from "./api";
import { ExploreGrid } from "./ExploreGrid";
import { exploreRows, matchingPeople, normalizeQuery, recommendedPeople } from "./model";
import type { ExploreCircle, ExplorePerson } from "./types";

// Explore: circles to join and people to follow, until you type a name or goal.
export default function ExploreScreen() {
  const c = useColors();
  const client = useQueryClient();
  const [text, setText] = useState("");
  const value = normalizeQuery(text);
  const [query, setQuery] = useDebounced(value);
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
    Keyboard.dismiss();
    if (joined) router.push(`/circle/${card.id}`);
    else setJoining(card);
  };
  const openPerson = (person: ExplorePerson) => {
    Keyboard.dismiss();
    router.push({ pathname: "/profile/[username]", params: { username: person.username } });
  };
  const leave = () => { Keyboard.dismiss(); goBack(); };

  return (
    <SafeAreaView testID="people-search-screen" style={{ flex: 1, backgroundColor: c.bg }}>
      <ProfileGlow />
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8 }}>
        <IconButton label="Back" icon={ChevronLeft} onPress={leave} />
        <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: "700", color: c.text, marginLeft: 8 }}>Search</Text>
      </View>
      <SearchField
        testID="people-search-input" label="Search people and circles" placeholder="People, circles, goals…"
        value={text} onChange={setText} onSubmit={() => { setQuery(value); Keyboard.dismiss(); }}
      />
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: 32 }}>
        {failed && (
          <Pressable accessibilityRole="button" onPress={() => sources.forEach((source) => void source.refetch())} style={{ marginHorizontal: 24, marginBottom: 12 }}>
            <Text style={{ color: c.dark ? "#f87171" : "#dc2626", fontSize: 14 }}>
              Couldn't load everything. <Text style={{ textDecorationLine: "underline", color: c.dark ? "#f87171" : "#dc2626", fontSize: 14 }}>Try again</Text>
            </Text>
          </Pressable>
        )}
        {!rows.length && (
          <View style={{ paddingHorizontal: 24 }}>
            <Status
              loading={loading}
              empty={failed ? undefined : query ? "Nothing matches. Try another name, username or goal." : "Nothing to explore yet. Add a plan to meet people working on the same thing."}
            />
          </View>
        )}
        <ExploreGrid rows={rows} onOpenCircle={openCircle} onOpenPerson={openPerson} />
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
    </SafeAreaView>
  );
}
