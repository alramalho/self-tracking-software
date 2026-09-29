import { useState } from "react";
import { ActivityIndicator, FlatList, Image, Keyboard, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { Text } from "@/components/typography/Text";
import { IconButton, Status, useColors } from "@/components/ui";
import { ProfileGlow } from "@/components/ProfileGlow";
import { goBack } from "@/core/navigation";
import { api } from "@/data/api";
import { CircleSearch } from "@/features/circles/CircleSearch";
import { SearchField, useDebounced } from "./SearchField";
import type { SearchPerson, SearchTab, SearchTabsProps } from "./types";

const tabLabels: Record<SearchTab, string> = { people: "People", circles: "Circles" };

export default function SearchScreen() {
  const c = useColors();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<SearchTab>(params.tab === "circles" ? "circles" : "people");
  const leave = () => { Keyboard.dismiss(); goBack(); };
  return (
    <SafeAreaView testID="people-search-screen" style={{ flex: 1, backgroundColor: c.bg }}>
      <ProfileGlow />
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8 }}>
        <IconButton label="Back" icon={ChevronLeft} onPress={leave} />
        <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: "700", color: c.text, marginLeft: 8 }}>Search</Text>
      </View>
      <SearchTabs value={tab} onChange={setTab} />
      {tab === "people" ? <PeopleSearch /> : <CircleSearch />}
    </SafeAreaView>
  );
}

// Same pill control as the Plans screen.
function SearchTabs({ value, onChange }: SearchTabsProps) {
  const c = useColors();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", marginHorizontal: 24, marginTop: 8, marginBottom: 12, backgroundColor: c.soft, borderRadius: 24, padding: 4, gap: 4 }}>
      {(Object.keys(tabLabels) as SearchTab[]).map((tab) => (
        <Pressable
          key={tab}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === tab }}
          onPress={() => onChange(tab)}
          style={{ flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: value === tab ? c.card : "transparent" }}
        >
          <Text style={{ color: value === tab ? c.text : c.muted, fontWeight: "600" }}>{tabLabels[tab]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function PeopleSearch() {
  const c = useColors();
  const [text, setText] = useState("");
  const value = text.trim().replace(/^@/, "");
  const [search, setSearch] = useDebounced(value);
  const people = useQuery({
    queryKey: ["people-search-v2", search],
    queryFn: async ({ signal }) => (await api.get<SearchPerson[]>(`/users/search-users/${encodeURIComponent(search)}`, { signal })).data,
  });
  const loading = value !== search || people.isPending;
  const matches = loading ? [] : people.data ?? [];
  return (
    <>
      <SearchField
        testID="people-search-input" label="Search people" placeholder="Search names or usernames"
        value={text} onChange={setText} onSubmit={() => { setSearch(value); Keyboard.dismiss(); }}
      />
      <FlatList
        data={matches} keyExtractor={person => person.userId} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32, gap: 8 }}
        ListHeaderComponent={<View style={{ gap: 12, marginBottom: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: c.muted }}>{value ? "Results" : "Your people"}</Text>
          <Status error={people.error} retry={() => void people.refetch()} />
        </View>}
        ListEmptyComponent={loading ? <ActivityIndicator accessibilityLabel="Searching people" color={c.accent} style={{ marginTop: 32 }} /> : !people.error ? <View style={{ gap: 8, paddingVertical: 28 }}>
          <Text style={{ color: c.text, fontSize: 17, fontWeight: "600" }}>{value ? "No matching people" : "Find your people"}</Text>
          <Text style={{ color: c.muted, lineHeight: 21 }}>{value ? "Try another name or username." : "Search for a friend by name or username."}</Text>
        </View> : null}
        renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`View @${item.username}'s profile`}
          onPress={() => { Keyboard.dismiss(); router.push({ pathname: "/profile/[username]", params: { username: item.username } }); }}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 76, padding: 12, borderRadius: 20, backgroundColor: c.card, opacity: pressed ? 0.7 : 1 })}>
          {item.picture ? <Image source={{ uri: item.picture }} style={{ width: 48, height: 48, borderRadius: 24 }} /> : <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.soft, justifyContent: "center", alignItems: "center" }}><Text style={{ color: c.text, fontSize: 20 }}>{(item.name || item.username)[0].toUpperCase()}</Text></View>}
          <View style={{ flex: 1, gap: 3 }}><Text numberOfLines={1} style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>{item.name || item.username}</Text><Text numberOfLines={1} style={{ color: c.muted, fontSize: 14 }}>@{item.username}</Text></View>
          <ChevronRight size={18} color={c.muted} />
        </Pressable>}
      />
    </>
  );
}
