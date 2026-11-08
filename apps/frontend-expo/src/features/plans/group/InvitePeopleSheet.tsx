import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Check, Search, X } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { Button, Copy, Sheet, Status, useColors } from "@/components/ui";
import { api } from "@/data/api";
import { useAction } from "@/data/queries";
import type { SearchPerson } from "../../people/types";
import type { InvitePeopleSheetProps } from "../types";

export function InvitePeopleSheet({ plan, visible, onClose }: InvitePeopleSheetProps) {
  const c = useColors();
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [invitees, setInvitees] = useState<SearchPerson[]>([]);
  const value = text.trim().replace(/^@/, "");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(value), 250);
    return () => clearTimeout(timer);
  }, [value]);
  const people = useQuery({
    queryKey: ["people-search-v2", search],
    enabled: visible && !!search,
    queryFn: async ({ signal }) =>
      (
        await api.get<SearchPerson[]>(
          `/users/search-users/${encodeURIComponent(search)}`,
          { signal },
        )
      ).data,
  });
  const invite = useAction(async () =>
    Promise.all(
      invitees.map((person) =>
        api.post("/plans/invite-to-plan", {
          planId: plan.id,
          recipientId: person.userId,
        }),
      ),
    ),
  );
  const close = () => {
    setText("");
    setInvitees([]);
    invite.reset();
    onClose();
  };
  const toggle = (person: SearchPerson) =>
    setInvitees((current) =>
      current.some((p) => p.userId === person.userId)
        ? current.filter((p) => p.userId !== person.userId)
        : [...current, person],
    );
  return (
    <Sheet visible={visible} title="Invite to Plan" onClose={close}>
      <View style={{ alignItems: "center", gap: 4, paddingVertical: 8 }}>
        <Text style={{ fontSize: 56 }}>{plan.emoji}</Text>
        <Text style={{ fontSize: 18, fontWeight: "600", color: c.text }}>
          {plan.goal}
        </Text>
        <Copy muted>Invite people to join this plan</Copy>
      </View>
      <View
        style={{
          minHeight: 50,
          paddingLeft: 14,
          borderRadius: 16,
          backgroundColor: c.soft,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Search size={20} color={c.muted} />
        <TextInput
          accessibilityLabel="Search people to invite"
          placeholder="Search names or usernames"
          placeholderTextColor={c.muted}
          value={text}
          onChangeText={setText}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            flex: 1,
            color: c.text,
            fontSize: 16,
            fontFamily: "Inter-Regular",
            paddingVertical: 14,
          }}
        />
      </View>
      {invitees.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {invitees.map((person) => (
            <Pressable
              key={person.userId}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${person.name || person.username}`}
              onPress={() => toggle(person)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingLeft: 12,
                paddingRight: 8,
                minHeight: 36,
                borderRadius: 18,
                backgroundColor: c.soft,
              }}
            >
              <Text style={{ color: c.text, fontSize: 14 }}>
                {person.name || person.username}
              </Text>
              <X size={14} color={c.muted} />
            </Pressable>
          ))}
        </View>
      )}
      <Status error={people.error ?? invite.error} />
      {value !== search || people.isFetching ? (
        <ActivityIndicator color={c.accent} />
      ) : (
        (people.data ?? []).map((person) => {
          const selected = invitees.some((p) => p.userId === person.userId);
          return (
            <Pressable
              key={person.userId}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Invite ${person.name || person.username}`}
              onPress={() => toggle(person)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 12,
                borderRadius: 16,
                backgroundColor: c.card,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              {person.picture ? (
                <Image
                  source={{ uri: person.picture }}
                  style={{ width: 40, height: 40, borderRadius: 20 }}
                />
              ) : (
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: c.soft,
                  }}
                >
                  <Text style={{ color: c.text }}>
                    {(person.name || person.username)[0].toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: c.text, fontWeight: "600" }}>
                  {person.name || person.username}
                </Text>
                <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13 }}>
                  @{person.username}
                </Text>
              </View>
              {selected && <Check size={20} color={c.accent} />}
            </Pressable>
          );
        })
      )}
      <Button
        disabled={invitees.length === 0}
        busy={invite.isPending}
        onPress={() => invite.mutate(undefined, { onSuccess: close })}
      >
        {`Invite (${invitees.length})`}
      </Button>
    </Sheet>
  );
}
