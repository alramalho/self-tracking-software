import { useEffect, useState } from "react";
import { Image, Linking, Platform, Switch, View } from "react-native";
import { Pencil, Smile, Trash2 } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { Status, useColors } from "@/components/ui";
import {
  EditorButton,
  EditorInput,
} from "@/features/activities/editor/controls";
import { useAction, useCurrentUser } from "@/data/queries";
import { useSession } from "@/auth/provider";
import { api } from "@/data/api";
import { pickPhotos, appendPhotos } from "@/native/photos";
import { SettingsCard } from "./SettingsCard";
import type { ProfileField, ProfileSettingsProps } from "./types";
import { ReactionEmojiEditor } from "@/features/timeline/reactions/ReactionEmojiEditor";
import { normalizeReactionEmojis } from "@/features/timeline/reactions/types";

export function ProfileSettings({ onBusyChange }: ProfileSettingsProps) {
  const user = useCurrentUser(),
    auth = useSession(),
    c = useColors();
  const [field, setField] = useState<ProfileField>();
  const [value, setValue] = useState("");
  const [looking, setLooking] = useState(false);
  const save = useAction(async () => {
    const updates =
      field === "lookingForAp"
        ? { lookingForAp: looking }
        : field === "age"
          ? { age: Number(value) }
          : field === "description"
            ? { profile: value.trim() }
            : { name: value.trim() };
    await api.patch("/users/user", updates);
    setField(undefined);
  });
  const photo = useAction(async () => {
    const selected = await pickPhotos();
    if (!selected.length) return;
    const form = new FormData();
    await appendPhotos(form, [selected[0]], "image");
    await api.post("/users/update-profile-image", form);
  });
  const remove = useAction(async () => {
    await api.delete("/users/user");
    await auth.signOut();
  });
  const busy = save.isPending || photo.isPending || remove.isPending;
  useEffect(() => {
    onBusyChange(busy);
    return () => onBusyChange(false);
  }, [busy, onBusyChange]);
  const edit = (next: ProfileField, initial = "") => {
    save.reset();
    remove.reset();
    setValue(initial);
    setLooking(!!user.data?.lookingForAp);
    setField(next);
  };
  const pencil = <Pencil size={16} color={c.muted} />;
  return (
    <View style={{ gap: 16 }}>
      {field ? (
        <>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: "600" }}>
            {
              {
                name: "Edit your full name",
                age: "Select your age",
                lookingForAp: "Looking for Accountability Partner",
                description: "Update Your Profile Description",
                reactionEmojis: "Customize reactions",
                delete: "Delete Account",
              }[field]
            }
          </Text>
          {field === "reactionEmojis" ? (
            <ReactionEmojiEditor onClose={() => setField(undefined)} />
          ) : field === "delete" ? (
            <Text style={{ color: c.muted, lineHeight: 22 }}>
              Permanently delete your account and all its data? This cannot be
              undone.
            </Text>
          ) : field === "lookingForAp" ? (
            <>
              <Text style={{ color: c.muted, lineHeight: 20 }}>
                Make your profile discoverable to people also looking for an
                accountability partner.
              </Text>
              <View
                style={{ flexDirection: "row", gap: 12, alignItems: "center" }}
              >
                <Switch
                  accessibilityLabel="Looking for Accountability Partner"
                  value={looking}
                  onValueChange={setLooking}
                  disabled={busy}
                  trackColor={{ true: c.accent }}
                />
                <Text style={{ color: c.text }}>
                  {looking
                    ? "Yes, I'm looking for an AP"
                    : "No, not looking for an AP"}
                </Text>
              </View>
            </>
          ) : (
            <>
              {field === "description" && (
                <Text style={{ color: c.muted, lineHeight: 20 }}>
                  Tell people who you are. This appears in discovery and helps
                  find accountability partners.
                </Text>
              )}
              <EditorInput
                label={
                  field === "age"
                    ? "Age"
                    : field === "name"
                      ? "Full Name"
                      : "Profile description"
                }
                value={value}
                onChangeText={setValue}
                editable={!busy}
                multiline={field === "description"}
                keyboardType={field === "age" ? "number-pad" : "default"}
                style={
                  field === "description"
                    ? { minHeight: 120, textAlignVertical: "top" }
                    : undefined
                }
              />
            </>
          )}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <EditorButton
                label="Cancel"
                secondary
                disabled={busy}
                onPress={() => setField(undefined)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <EditorButton
                label={
                  field === "delete" ? "Permanently delete account" : "Save"
                }
                destructive={field === "delete"}
                busy={busy}
                disabled={
                  field === "age"
                    ? !Number.isInteger(Number(value)) ||
                      Number(value) < 12 ||
                      Number(value) > 100
                    : field === "name" && !value.trim()
                }
                onPress={() =>
                  field === "delete" ? remove.mutate() : save.mutate()
                }
              />
            </View>
          </View>
        </>
      ) : (
        <>
          <SettingsCard
            title="Looking for Accountability Partner"
            description={user.data?.lookingForAp ? "Yes" : "No"}
            trailing={pencil}
            onPress={() => edit("lookingForAp")}
          />
          <SettingsCard
            title="Age"
            description={
              user.data?.age ? `${user.data.age} years old` : "No age set"
            }
            trailing={pencil}
            onPress={() => edit("age", String(user.data?.age || 18))}
          />
          <SettingsCard
            title="Full Name"
            description={user.data?.name || "No name set"}
            trailing={pencil}
            onPress={() => edit("name", user.data?.name || "")}
          />
          <SettingsCard
            title="Username"
            description={user.data?.username || "No username set"}
            trailing={
              <Text style={{ color: c.muted, fontSize: 12 }}>Read only</Text>
            }
          />
          <SettingsCard
            title="Email"
            description={user.data?.email || "No email"}
            trailing={
              <Text style={{ color: c.muted, fontSize: 12 }}>Read only</Text>
            }
          />
          <SettingsCard
            title="Profile Picture"
            description={
              photo.isPending ? "Updating…" : "Tap to update your photo"
            }
            trailing={pencil}
            disabled={busy}
            onPress={() => photo.mutate()}
          >
            {!!user.data?.picture && (
              <Image
                source={{ uri: user.data.picture }}
                style={{ width: 40, height: 40, borderRadius: 20 }}
              />
            )}
          </SettingsCard>
          <SettingsCard
            title="Profile Description"
            description={user.data?.profile || "Tell people about yourself"}
            trailing={pencil}
            onPress={() => edit("description", user.data?.profile || "")}
          />
          <SettingsCard
            title="Reaction emojis"
            description={
              normalizeReactionEmojis(user.data?.reactionEmojis).join(" ")
            }
            icon={Smile}
            onPress={() => edit("reactionEmojis")}
          />
          {Platform.OS === "ios" && (
            <SettingsCard
              title="Notification settings"
              description="Manage this app’s notification permissions"
              onPress={() => void Linking.openSettings()}
            />
          )}
          <SettingsCard
            title="Delete Account"
            description="Permanently delete your account and all data"
            trailing={<Trash2 size={20} color="#ef4444" />}
            onPress={() => edit("delete")}
          />
        </>
      )}
      <Status error={save.error ?? photo.error ?? remove.error} />
    </View>
  );
}
