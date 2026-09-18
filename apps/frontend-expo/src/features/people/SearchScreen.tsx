import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Keyboard, Pressable, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { Text } from "@/components/typography/Text";
import { Button, IconButton, Status, useColors } from "@/components/ui";
import { ProfileGlow } from "@/components/ProfileGlow";
import { goBack } from "@/core/navigation";
import { useAction } from "@/data/queries";
import { api } from "@/data/api";
import type { Person } from "@/core/types";
import type { SearchPerson } from "./types";

export default function SearchScreen() {
  const c = useColors();
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const value = text.trim().replace(/^@/, "");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(value), 250);
    return () => clearTimeout(timer);
  }, [value]);
  const people = useQuery({
    queryKey: ["people-search-v2", search],
    queryFn: async ({ signal }) => (await api.get<SearchPerson[]>(`/users/search-users/${encodeURIComponent(search)}`, { signal })).data,
  });
  const recommendations = useQuery({
    queryKey: ["recommended-users"],
    enabled: !value,
    queryFn: async ({ signal }) => (await api.get<Person[]>("/users/recommended-users", { signal })).data,
  });
  const connect = useAction(async (id: string) => api.post(`/users/send-connection-request/${id}`));
  const loading = value !== search || people.isPending;
  const matches = loading ? [] : people.data ?? [];
  const leave = () => { Keyboard.dismiss(); goBack(); };
  return (
    <SafeAreaView testID="people-search-screen" style={{ flex: 1, backgroundColor: c.bg }}>
      <ProfileGlow />
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8 }}>
        <IconButton label="Back" icon={ChevronLeft} onPress={leave} />
        <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: "700", color: c.text, marginLeft: 8 }}>Search</Text>
      </View>
      <View style={{ marginHorizontal: 24, marginTop: 8, marginBottom: 20, paddingLeft: 14, minHeight: 50, borderRadius: 16, backgroundColor: c.soft, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Search size={20} color={c.muted} />
        <TextInput
          testID="people-search-input" accessibilityLabel="Search people" placeholder="Search names or usernames" placeholderTextColor={c.muted}
          value={text} onChangeText={setText} autoCapitalize="none" autoCorrect={false} maxLength={80} returnKeyType="search"
          onSubmitEditing={() => { setSearch(value); Keyboard.dismiss(); }}
          style={{ flex: 1, color: c.text, fontSize: 16, fontFamily: "Inter-Regular", paddingVertical: 14 }}
        />
        {!!text && <IconButton label="Clear search" icon={X} onPress={() => setText("")} />}
      </View>
      <FlatList
        data={matches} keyExtractor={person => person.userId} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32, gap: 8 }}
        ListHeaderComponent={<View style={{ gap: 12, marginBottom: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: c.muted }}>{value ? "Results" : "Your people"}</Text>
          <Status error={people.error ?? connect.error} retry={() => void people.refetch()} />
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
        ListFooterComponent={!value && !!recommendations.data?.length ? <View style={{ gap: 12, marginTop: 20 }}>
          <Text style={{ color: c.muted, fontWeight: "600", fontSize: 14 }}>Recommended people</Text>
          {recommendations.data.filter(p => !matches.some(friend => friend.userId === p.id)).map(person => <View key={person.id} style={{ backgroundColor: c.card, padding: 16, borderRadius: 20, gap: 8 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`View @${person.username}'s profile`} onPress={() => router.push(`/profile/${person.username}`)}><Text style={{ color: c.text, fontSize: 16 }}>{person.name || person.username}</Text><Text style={{ color: c.muted }}>@{person.username}</Text></Pressable>
            <Button secondary busy={connect.isPending} onPress={() => connect.mutate(person.id)}>Connect</Button>
          </View>)}
        </View> : null}
      />
    </SafeAreaView>
  );
}
