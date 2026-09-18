import { useEffect, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/data/api";
import { Button, Copy, Field, Status, s, useColors } from "@/components/ui";
import type { FriendPickerProps, FriendResult } from "./types";

export function FriendPicker({ value, onChange }: FriendPickerProps) {
  const c = useColors();
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const friends = useQuery({
    queryKey: ["friend-search", query],
    enabled: expanded,
    queryFn: async () =>
      (
        await api.get<FriendResult[]>(
          `/users/search-users/${encodeURIComponent(query)}`,
        )
      ).data,
  });
  return (
    <View style={{ gap: 8 }}>
      <Button secondary onPress={() => setExpanded(!expanded)}>
        {value
          ? `With ${value.name ?? value.username}`
          : "With a friend (optional)"}
      </Button>
      {expanded && (
        <>
          <Field
            inputAccessoryViewID="logging-input-done"
            label="Search friends"
            placeholder="Name or username"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          <Status
            loading={friends.isPending}
            error={friends.error}
            retry={() => void friends.refetch()}
          />
          {friends.data?.map((friend) => (
            <Pressable
              key={friend.userId}
              accessibilityRole="button"
              accessibilityLabel={`With ${friend.name ?? friend.username}`}
              onPress={() => {
                onChange(friend);
                setExpanded(false);
              }}
              style={[
                s.row,
                { padding: 12, backgroundColor: c.soft, borderRadius: 8 },
              ]}
            >
              {friend.picture && (
                <Image
                  source={{ uri: friend.picture }}
                  style={{ width: 32, height: 32, borderRadius: 16 }}
                />
              )}
              <Copy>
                {friend.name ?? friend.username} · @{friend.username}
              </Copy>
            </Pressable>
          ))}
          {friends.data?.length === 0 && <Copy muted>No friends found.</Copy>}
          {!!value && (
            <Button
              secondary
              onPress={() => {
                onChange(undefined);
                setExpanded(false);
              }}
            >
              Remove friend
            </Button>
          )}
        </>
      )}
    </View>
  );
}
