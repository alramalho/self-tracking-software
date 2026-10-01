import { useState } from "react";
import { View } from "react-native";
import { Text } from "@/components/typography/Text";
import { Button, Copy, Field, Sheet, Status, useColors } from "@/components/ui";
import { errorMessage } from "@/data/api";
import { useAction } from "@/data/queries";
import { inviteFriend, useInvitableFriends } from "./api";
import { PersonAvatar } from "./components";
import type { InviteSheetProps } from "./types";

// Invite friends without leaving the app: each gets one notification that opens the
// circle's join screen. The link is still there for people who aren't on the app yet.
export function InviteSheet({ circleId, visible, onClose, onShareLink }: InviteSheetProps) {
  const c = useColors();
  const [search, setSearch] = useState("");
  const friends = useInvitableFriends(circleId, visible);
  const invite = useAction(async (userId: string) => inviteFriend(circleId, userId));
  const query = search.trim().toLowerCase();
  const shown = (friends.data ?? []).filter(
    (friend) => !query || `${friend.name ?? ""} ${friend.username ?? ""}`.toLowerCase().includes(query),
  );
  return (
    <Sheet visible={visible} title="Invite to circle" onClose={onClose}>
      {!!friends.data?.length && (
        <Field
          label="Search friends"
          placeholder="Name or username"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      )}
      <Status loading={friends.isLoading} error={friends.error} retry={() => void friends.refetch()} />
      {friends.data?.length === 0 && <Copy muted>No friends here yet. Share the link instead.</Copy>}
      {!!friends.data?.length && !shown.length && <Copy muted>No friends found.</Copy>}
      {shown.map((friend) => {
        const name = friend.name ?? friend.username ?? "Someone";
        const sending = invite.isPending && invite.variables === friend.userId;
        return (
          <View key={friend.userId} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 }}>
            <PersonAvatar name={name} picture={friend.picture} size={38} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>
                {name}
              </Text>
              {!!friend.username && (
                <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13 }}>
                  @{friend.username}
                </Text>
              )}
            </View>
            {friend.state === "open" ? (
              <View style={{ minWidth: 92 }}>
                <Button testID={`invite-${friend.userId}`} busy={sending} disabled={invite.isPending} onPress={() => invite.mutate(friend.userId)}>
                  Invite
                </Button>
              </View>
            ) : (
              <Text style={{ color: c.muted, fontSize: 15 }}>{friend.state === "member" ? "In the circle" : "Invited"}</Text>
            )}
          </View>
        );
      })}
      {invite.error && <Copy muted>{errorMessage(invite.error)}</Copy>}
      <Button secondary onPress={onShareLink}>
        Share a link
      </Button>
    </Sheet>
  );
}
