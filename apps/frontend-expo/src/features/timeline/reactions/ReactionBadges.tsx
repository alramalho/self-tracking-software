import { useState } from "react";
import { View } from "react-native";
import { ReactionBadge } from "./ReactionBadge";
import { ReactionPeople } from "./ReactionPeople";
import { reactionPeople } from "./people";
import type { ReactionBadgesProps, ReactionSelection } from "./types";

export function ReactionBadges({
  reactions,
  currentUserId,
  overlay = false,
}: ReactionBadgesProps) {
  const [selection, setSelection] = useState<ReactionSelection>();
  return (
    <>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {[...new Set(reactions.map((reaction) => reaction.emoji))].map(
          (emoji) => (
            <ReactionBadge
              key={emoji}
              emoji={emoji}
              count={reactionPeople(reactions, emoji).length}
              selected={reactions.some(
                (reaction) =>
                  reaction.emoji === emoji &&
                  (reaction.user?.id ?? reaction.userId) === currentUserId,
              )}
              overlay={overlay}
              onOpen={(anchor) => setSelection({ emoji, anchor })}
            />
          ),
        )}
      </View>
      <ReactionPeople
        selection={selection}
        reactions={reactions}
        onClose={() => setSelection(undefined)}
      />
    </>
  );
}
