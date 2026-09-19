import { useState } from "react";
import { Image, Pressable, Share, View } from "react-native";
import { Text } from "@/components/typography/Text";
import {
  Maximize2,
  Minimize2,
  Pencil,
  MessageCircle,
  Share2,
  Sprout,
  Rocket,
  HeartPulse,
  ChevronRight,
} from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { ActivitySummary } from "./ActivitySummary";
import { FeedCaption } from "./FeedCaption";
import { CommentsSheet } from "./comments/CommentsSheet";
import { ReactionBadges } from "./reactions/ReactionBadges";
import { ReactionPicker } from "./reactions/ReactionPicker";
import { PhotoGrid } from "./PhotoGrid";
import { router } from "expo-router";
import {
  Button,
  Copy,
  Heading,
  IconButton,
  useColors,
  Panel,
  Sheet,
  Status,
  s,
} from "@/components/ui";
import { dateLabel } from "@/core/dates";
import { useAction, useCurrentUser, useProfile } from "@/data/queries";
import { api } from "@/data/api";
import type { ActivityEntry, Comment } from "@/core/types";
import type { FeedCardProps } from "./types";
import { EntryEditor } from "../activities/EntryEditor";
import { AchievementEditor } from "./AchievementEditor";
import { achievementTitle } from "./achievement";
import { feedPhotos } from "./layout";
export function FeedCard({
  item,
  compactInitially = false,
  highlighted = false,
  expanded: controlledExpanded,
  onExpandedChange,
}: FeedCardProps) {
  const c = useColors();
  const [localExpanded, setLocalExpanded] = useState(!compactInitially);
  const expanded = controlledExpanded ?? localExpanded;
  const setExpanded = onExpandedChange ?? setLocalExpanded;
  const me = useCurrentUser();
  const [comments, setComments] = useState(false);
  const [editing, setEditing] = useState<ActivityEntry>();
  const [editingPost, setEditingPost] = useState(false);
  const [chooseEdit, setChooseEdit] = useState(false);
  const entry = item.entry;
  const post = item.achievement;
  const user = item.user ?? post?.user;
  const ownerProfile = useProfile(user?.username ?? undefined);
  const achievementPlans = (ownerProfile.data?.plans ?? []).filter(
    (plan) =>
      !plan.deletedAt &&
      plan.activities?.some((activity) => activity.id === item.activity?.id),
  );
  const lifestyle = achievementPlans.some(
    (plan) => plan.progress?.lifestyleAchievement?.isAchieved,
  );
  const habit = achievementPlans.some(
    (plan) => plan.progress?.habitAchievement?.isAchieved,
  );
  const own = (entry?.userId ?? user?.id) === me.data?.id;
  const reactions = entry?.reactions ?? post?.reactions ?? [];

  const base = entry
    ? `/activities/activity-entries/${entry.id}`
    : `/achievements/${post!.id}`;
  const fullComments = useQuery({
    queryKey: ["comments", base],
    enabled: comments,
    queryFn: async () =>
      (await api.get<{ comments: Comment[] }>(`${base}/comments`)).data
        .comments,
  });
  const commentList =
    fullComments.data ?? entry?.comments ?? post?.comments ?? [];
  const commentCount =
    fullComments.data?.length ?? entry?._count?.comments ?? commentList.length;
  const react = useAction(async (emoji: string) =>
    api.post(`${base}/modify-reactions`, {
      reactions: [
        {
          emoji,
          operation: reactions.some(
            (r) =>
              r.emoji === emoji && (r.user?.id ?? r.userId) === me.data?.id,
          )
            ? "remove"
            : "add",
        },
      ],
    }),
  );
  const photos = feedPhotos(item);
  const ownRows = [item, ...(item.sharedEntries ?? [])].filter(
    (row) => row.entry?.userId === me.data?.id,
  );
  const selectedEmojis = reactions
    .filter((r) => (r.user?.id ?? r.userId) === me.data?.id)
    .map((r) => r.emoji);
  const reactionChips = (
    <ReactionBadges
      reactions={reactions}
      currentUserId={me.data?.id}
      overlay={!!photos.length}
    />
  );
  const social = (
    <View style={{ gap: 8 }}>
      {!photos.length && !!reactions.length && reactionChips}
      {commentList.slice(-2).map((comment) => (
        <Pressable key={comment.id} onPress={() => setComments(true)}>
          <Text numberOfLines={2} style={{ color: c.text, fontSize: 12 }}>
            <Text style={{ color: c.muted }}>@{comment.user.username} </Text>
            {comment.text}
          </Text>
        </Pressable>
      ))}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Comments${commentCount ? ` (${commentCount})` : ""}`}
          onPress={() => setComments(true)}
          style={{
            flex: 1,
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            borderRadius: 999,
            backgroundColor: c.soft,
            paddingHorizontal: 12,
          }}
        >
          <MessageCircle size={16} color={c.muted} />
          <Text style={{ color: c.muted, fontSize: 12 }}>
            {commentCount
              ? `View comments (${commentCount})`
              : "Add a comment..."}
          </Text>
        </Pressable>
        {!photos.length && (
          <ReactionPicker
            disabled={react.isPending}
            onSelect={react.mutateAsync}
            selectedEmojis={selectedEmojis}
          />
        )}
        <IconButton
          label="Share"
          icon={Share2}
          onPress={() =>
            void Share.share({
              message: `${user?.name ?? user?.username} on tracking.so ${entry ? `https://app.tracking.so/?activityEntryId=${entry.id}` : `https://app.tracking.so/profile/${user?.username ?? ""}`}`,
              url: entry
                ? `https://app.tracking.so/?activityEntryId=${entry.id}`
                : `https://app.tracking.so/profile/${user?.username ?? ""}`,
            })
          }
        />
      </View>
    </View>
  );
  if (compactInitially && !expanded && !photos.length && entry && !highlighted)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Expand ${item.activity?.title} ${entry.quantity} ${item.activity?.measure}`}
        onPress={() => setExpanded(true)}
      >
        <Panel
          testID="feed-card"
          style={{
            paddingVertical: 16,
            paddingHorizontal: 20,
            borderRadius: 16,
          }}
        >
          <ActivitySummary item={item} compact />
          <View
            style={{ position: "absolute", top: 6, right: 6, opacity: 0.3 }}
          >
            <Maximize2 size={12} color={c.muted} />
          </View>
        </Panel>
      </Pressable>
    );
  return (
    <Panel
      testID="feed-card"
      style={{
        padding: 16,
        overflow: "hidden",
        gap: 0,
        borderRadius: 16,
        ...(highlighted ? { borderColor: c.accent, borderWidth: 2 } : {}),
      }}
    >
      {!!photos.length && (
        <View>
          <View>
            <PhotoGrid
              photos={photos}
              title={item.activity?.title ?? post?.title ?? "Activity"}
            />
            {(!entry || !own) && (
              <View
                style={{
                  position: "absolute",
                  right: 8,
                  bottom:
                    (entry?.description ?? post?.message ?? post?.description)
                      ? 32
                      : 8,
                }}
              >
                <ReactionPicker
                  overlay
                  disabled={react.isPending}
                  onSelect={react.mutateAsync}
                  selectedEmojis={selectedEmojis}
                />
              </View>
            )}
            {!!reactions.length && (
              <View
                pointerEvents="box-none"
                style={{ position: "absolute", top: 8, left: 8, right: 44 }}
              >
                {reactionChips}
              </View>
            )}
          </View>
          {!!(entry?.description ?? post?.message ?? post?.description) && (
            <FeedCaption
              text={(entry?.description ?? post?.message ?? post?.description)!}
              overlay
            />
          )}
          <View style={{ marginHorizontal: 8, marginTop: 8, marginBottom: 16 }}>
            {social}
          </View>
        </View>
      )}
      {entry ? (
        <>
          <ActivitySummary item={item} />
          {entry.healthWorkout && (
            <Pressable
              accessibilityRole={own ? "button" : undefined}
              accessibilityLabel="Apple Watch details"
              disabled={!own}
              onPress={() => own && router.push(`/health-workout/${entry.healthWorkout!.id}` as never)}
              style={({ pressed }) => ({
                marginTop: 12,
                minHeight: 48,
                borderRadius: 14,
                backgroundColor: c.soft,
                paddingHorizontal: 14,
                paddingVertical: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <HeartPulse size={18} color={c.muted} strokeWidth={1.8} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }}>Apple Watch</Text>
                <Text style={{ color: c.muted, fontSize: 12 }} numberOfLines={1}>
                  {[
                    entry.healthWorkout.averageHeartRateBpm == null ? null : `${Math.round(entry.healthWorkout.averageHeartRateBpm)} bpm avg`,
                    entry.healthWorkout.activeEnergyKcal == null ? null : `${Math.round(entry.healthWorkout.activeEnergyKcal)} kcal`,
                    `${Math.round(entry.healthWorkout.durationSeconds / 60)} min`,
                  ].filter(Boolean).join(" · ")}
                </Text>
              </View>
              {own && <ChevronRight size={17} color={c.muted} />}
            </Pressable>
          )}
        </>
      ) : (
        <View style={{ gap: 8 }}>
          <View style={s.row}>
            {user?.picture && (
              <Image
                source={{ uri: user.picture }}
                style={{ width: 32, height: 32, borderRadius: 16 }}
              />
            )}
            <Pressable
              onPress={() =>
                user?.username && router.push(`/profile/${user.username}`)
              }
            >
              <Copy>@{user?.username}</Copy>
              <Copy muted>{dateLabel(new Date(item.date))}</Copy>
            </Pressable>
          </View>
          <Heading>{achievementTitle(post!)}</Heading>
        </View>
      )}
      {!photos.length &&
        !!(entry?.description ?? post?.message ?? post?.description) && (
          <FeedCaption
            text={(entry?.description ?? post?.message ?? post?.description)!}
          />
        )}
      {item.sharedEntries
        ?.filter((row) => row.entry?.description)
        .map((row) => (
          <View key={row.id} style={{ marginTop: 8 }}>
            <Text style={{ color: c.muted, fontSize: 12 }}>
              @{row.user?.username}
            </Text>
            <FeedCaption text={row.entry!.description!} />
          </View>
        ))}
      {!photos.length && (
        <View
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: c.border,
          }}
        >
          {social}
        </View>
      )}
      <View
        style={{ position: "absolute", top: 4, right: 4, flexDirection: "row" }}
      >
        {compactInitially && !photos.length && (
          <IconButton
            label="Collapse activity"
            icon={Minimize2}
            onPress={() => setExpanded(false)}
          />
        )}
        {!!ownRows.length && (
          <IconButton
            label="Edit"
            icon={Pencil}
            onPress={() =>
              ownRows.length > 1
                ? setChooseEdit(true)
                : setEditing(ownRows[0].entry)
            }
          />
        )}
        {own && post && (
          <IconButton
            label="Edit"
            icon={Pencil}
            onPress={() => setEditingPost(true)}
          />
        )}
      </View>
      <Sheet
        visible={chooseEdit}
        title="Edit activity"
        onClose={() => setChooseEdit(false)}
      >
        {ownRows.map((row) => (
          <Button
            secondary
            key={row.id}
            onPress={() => {
              setChooseEdit(false);
              setEditing(row.entry);
            }}
          >{`${row.activity?.title} - ${row.entry?.quantity} ${row.activity?.measure}`}</Button>
        ))}
      </Sheet>
      {entry && (habit || lifestyle) && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            right: -12,
            bottom: -14,
            height: 80,
            width: 96,
            overflow: "hidden",
          }}
        >
          {lifestyle ? (
            <Rocket size={96} color="#f59e0b" style={{ opacity: 0.2 }} />
          ) : (
            <Sprout size={96} color="#84cc16" style={{ opacity: 0.2 }} />
          )}
        </View>
      )}
      <Status error={react.error} />
      {editing && (
        <EntryEditor entry={editing} onClose={() => setEditing(undefined)} />
      )}
      {editingPost && post && (
        <AchievementEditor post={post} onClose={() => setEditingPost(false)} />
      )}
      <CommentsSheet
        visible={comments}
        base={base}
        comments={commentList}
        loading={fullComments.isPending}
        error={fullComments.error}
        retry={() => void fullComments.refetch()}
        onClose={() => setComments(false)}
      />
    </Panel>
  );
}
