import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Keyboard,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { differenceInDays } from "date-fns";
import {
  Check,
  Minus,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { Button, Copy, Status, useColors } from "@/components/ui";
import { api } from "@/data/api";
import { useAction, useActivities } from "@/data/queries";
import { localDateTime, parseLocalDate } from "@/core/dates";
import type { ActivityEntry, SharedCandidate } from "@/core/types";
import { appendPhotos, pickPhotos } from "@/native/photos";
import { VoiceTextArea } from "@/features/dictation/VoiceTextArea";
import { EditorButton } from "./editor/controls";
import { LoggingCalendar } from "./logging/LoggingCalendar";
import { LoggingDrawer } from "./logging/LoggingDrawer";

interface Props {
  entry: ActivityEntry;
  onClose: () => void;
}

interface EntryTextAreaProps {
  label: string;
  accessibilityLabel?: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  disabled?: boolean;
}

type EntryAction = "save" | "delete";

function entryImageUrls(entry: Pick<ActivityEntry, "imageUrl" | "imageUrls">) {
  return Array.from(
    new Set(
      [...(entry.imageUrls ?? []), entry.imageUrl].filter(
        (url): url is string => typeof url === "string" && url.length > 0,
      ),
    ),
  );
}

function EntryTextArea({
  label,
  accessibilityLabel,
  placeholder,
  value,
  onChangeText,
  disabled,
}: EntryTextAreaProps) {
  const c = useColors();
  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          color: c.text,
          fontSize: 18,
          fontWeight: "600",
          textAlign: "center",
        }}
      >
        {label}
      </Text>
      <VoiceTextArea
        testID={`field-${accessibilityLabel ?? label}`}
        accessibilityLabel={accessibilityLabel ?? label}
        inputAccessoryViewID={Platform.OS === "ios" ? "logging-input-done" : undefined}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        value={value}
        editable={!disabled}
        textAlignVertical="top"
        onChangeText={onChangeText}
        dictationLabel={label.toLowerCase()}
        style={{
          minHeight: 96,
          borderWidth: 1,
          borderRadius: 14,
          borderColor: c.inputBorder,
          backgroundColor: c.card,
          color: c.text,
          fontSize: 16,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontFamily: "Inter-Regular",
        }}
      />
    </View>
  );
}

export function EntryEditor({ entry, onClose }: Props) {
  const c = useColors();
  const activities = useActivities();
  const [quantity, setQuantity] = useState(String(entry.quantity));
  const [date, setDate] = useState(localDateTime(entry.datetime));
  const [description, setDescription] = useState(entry.description ?? "");
  const [notes, setNotes] = useState(entry.privateNotes ?? "");
  const [editTime, setEditTime] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [validation, setValidation] = useState<Error>();
  const [images, setImages] = useState(() => entryImageUrls(entry));
  const [candidates, setCandidates] = useState<SharedCandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>();
  const [linkingCandidateId, setLinkingCandidateId] = useState<string>();
  const parsed = parseLocalDate(date);
  const activity =
    entry.activity ?? activities.data?.find((item) => item.id === entry.activityId);
  const entryCreatedAt = new Date(entry.createdAt);
  const canEditPhoto = differenceInDays(new Date(), entryCreatedAt) <= 7;

  useEffect(() => {
    let active = true;
    void api
      .get<{ candidates?: SharedCandidate[] }>(
        `/activities/activity-entries/${entry.id}/shared-candidates`,
      )
      .then((response) => {
        if (active) setCandidates(response.data.candidates ?? []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [entry.id]);

  const photoAction = useAction(async (remove: boolean) => {
    if (remove) {
      await api.delete(`/activities/activity-entries/${entry.id}/photo`);
      setImages([]);
      return;
    }
    const photos = await pickPhotos();
    if (!photos.length) return;
    const form = new FormData();
    await appendPhotos(form, photos);
    const response = await api.put<ActivityEntry>(
      `/activities/activity-entries/${entry.id}/photo`,
      form,
    );
    setImages(entryImageUrls(response.data));
  });

  const action = useAction(async (kind: EntryAction) => {
    if (kind === "delete") {
      await api.delete(`/activities/activity-entries/${entry.id}`);
      return;
    }
    const datetime = parseLocalDate(date);
    if (datetime > new Date())
      throw new Error("Activity date cannot be in the future.");
    if (!Number.isInteger(Number(quantity)) || Number(quantity) <= 0)
      throw new Error("Quantity must be a whole number greater than zero.");
    await api.put(`/activities/activity-entries/${entry.id}`, {
      quantity: Number(quantity),
      datetime: datetime.toISOString(),
      description,
      privateNotes: notes,
    });
  });

  function save() {
    Keyboard.dismiss();
    setValidation(undefined);
    action.reset();
    try {
      const datetime = parseLocalDate(date);
      if (datetime > new Date())
        throw new Error("Activity date cannot be in the future.");
      if (!Number.isInteger(Number(quantity)) || Number(quantity) <= 0)
        throw new Error("Quantity must be a whole number greater than zero.");
    } catch (error) {
      setValidation(
        error instanceof Error
          ? error
          : new Error("Check the entry details."),
      );
      return;
    }
    action.mutate("save", { onSuccess: onClose });
  }

  function confirmDelete() {
    if (action.isPending) return;
    action.reset();
    setValidation(undefined);
    setDeleteConfirm(true);
  }

  function updateDate(value: Date) {
    setDate(localDateTime(value));
  }

  function updateTime(value: Date) {
    const next = new Date(parsed);
    next.setHours(value.getHours(), value.getMinutes(), 0, 0);
    setDate(localDateTime(next));
  }

  function changeQuantity(amount: number) {
    setQuantity(String(Math.max(0, Number(quantity || 0) + amount)));
  }

  async function linkCandidate(candidateId: string) {
    if (linkingCandidateId) return;
    setValidation(undefined);
    setLinkingCandidateId(candidateId);
    try {
      await api.post(
        `/activities/activity-entries/${entry.id}/shared-link`,
        { candidateActivityEntryId: candidateId },
      );
      setSelectedCandidateId(candidateId);
    } catch (error) {
      setValidation(
        error instanceof Error
          ? error
          : new Error("Could not link activities."),
      );
    } finally {
      setLinkingCandidateId(undefined);
    }
  }

  const time = `${parsed.getHours()}:${String(parsed.getMinutes()).padStart(2, "0")}`;

  return (
    <LoggingDrawer
      title="Edit Entry"
      titleAlign="center"
      contentPadding={24}
      keyboardToolbar
      scrollToEndOnKeyboard={false}
      testID="activity-entry-editor"
      dismissLabel="Dismiss activity entry editor"
      onClose={action.isPending ? () => {} : onClose}
    >
      <View style={{ alignItems: "center", gap: 12 }}>
        <Text style={{ fontSize: 52, lineHeight: 62 }}>
          {activity?.emoji ?? "🏃"}
        </Text>
        <Text style={{ color: c.muted, fontSize: 16, fontStyle: "italic" }}>
          📍 {entry.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
        </Text>
      </View>

      <LoggingCalendar value={parsed} variant="large" onChange={updateDate} />

      <View style={{ alignItems: "center", gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit time"
          accessibilityState={{ expanded: editTime }}
          onPress={() => setEditTime(!editTime)}
          style={{
            minHeight: 40,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Text style={{ color: c.muted, fontSize: 20 }}>at {time}</Text>
          <Pencil size={17} color={c.muted} />
        </Pressable>
        {editTime && (
          <View style={{ alignItems: "center", gap: 8 }}>
            <Text style={{ color: c.text, fontSize: 15, fontWeight: "500" }}>
              Select Time
            </Text>
            <DateTimePicker
              mode="time"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              value={parsed}
              themeVariant={c.dark ? "dark" : "light"}
              textColor={c.text}
              accentColor={c.accent}
              is24Hour
              onChange={(event, value) => {
                if (Platform.OS !== "ios") setEditTime(false);
                if (event.type === "set" && value) updateTime(value);
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done editing time"
              onPress={() => setEditTime(false)}
              style={{ padding: 10 }}
            >
              <Text style={{ color: c.accent, fontWeight: "600" }}>Done</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={{ alignItems: "center", gap: 12 }}>
        <Text style={{ color: c.text, fontSize: 19, fontWeight: "600" }}>
          how many {" "}
          <Text style={{ fontStyle: "italic" }}>
            {activity?.measure ?? "units"}
          </Text>
          ?
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <View
            style={{
              borderWidth: 1,
              borderColor: c.inputBorder,
              borderRadius: 14,
              backgroundColor: c.card,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Decrease quantity"
              disabled={Number(quantity) <= 0}
              onPress={() => changeQuantity(-1)}
              style={{
                width: 54,
                height: 52,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Minus size={22} color={c.text} strokeWidth={2} />
            </Pressable>
          </View>
          <TextInput
            testID="field-Quantity"
            accessibilityLabel="Quantity"
            inputAccessoryViewID={Platform.OS === "ios" ? "logging-input-done" : undefined}
            selectTextOnFocus
            keyboardType="number-pad"
            value={quantity}
            onChangeText={(value) => {
              if (/^\d*$/.test(value)) setQuantity(value);
            }}
            style={{
              color: c.text,
              width: 72,
              height: 52,
              fontFamily: "Inter-Bold",
              fontSize: 28,
              textAlign: "center",
            }}
          />
          <View
            style={{
              borderWidth: 1,
              borderColor: c.inputBorder,
              borderRadius: 14,
              backgroundColor: c.card,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Increase quantity"
              onPress={() => changeQuantity(1)}
              style={{
                width: 54,
                height: 52,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Plus size={22} color={c.text} strokeWidth={2} />
            </Pressable>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[10, 30, 45, 60, 90].map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={`Set quantity to ${value}`}
              onPress={() => setQuantity(String(value))}
              style={({ pressed }) => ({
                minWidth: 48,
                height: 38,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: c.card,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={{ color: c.text, fontSize: 15, fontWeight: "500" }}>
                {value}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <EntryTextArea
        label="Caption"
        accessibilityLabel="Description"
        placeholder="Add a caption..."
        value={description}
        disabled={action.isPending}
        onChangeText={setDescription}
      />
      <EntryTextArea
        label="Reflection"
        placeholder="Private to you and your coach..."
        value={notes}
        disabled={action.isPending}
        onChangeText={setNotes}
      />

      {(canEditPhoto || images.length > 0) && (
        <View style={{ gap: 12 }}>
          <Text
            style={{
              color: c.text,
              fontSize: 18,
              fontWeight: "600",
              textAlign: "center",
            }}
          >
            Photos
          </Text>
          {images.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {images.map((uri) => (
                <Image
                  key={uri}
                  source={{ uri }}
                  accessibilityLabel="Activity photo"
                  resizeMode="cover"
                  style={{
                    width: images.length === 1 ? "100%" : "48%",
                    height: images.length === 1 ? 220 : 150,
                    borderRadius: 12,
                  }}
                />
              ))}
            </View>
          )}
          {canEditPhoto ? (
            <>
              <Button
                secondary
                busy={photoAction.isPending}
                onPress={() => photoAction.mutate(false)}
              >
                {images.length ? "Add more photos" : "Add photos"}
              </Button>
              {!!images.length && (
                <Button
                  secondary
                  busy={photoAction.isPending}
                  onPress={() =>
                    Alert.alert(
                      "Delete Photos",
                      "Are you sure you want to delete all photos for this entry?",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Delete",
                          style: "destructive",
                          onPress: () => photoAction.mutate(true),
                        },
                      ],
                    )
                  }
                >
                  Remove photos
                </Button>
              )}
            </>
          ) : (
            <Copy muted>
              Photos can only be edited within 7 days of the entry.
            </Copy>
          )}
        </View>
      )}

      {candidates.length > 0 && (
        <View style={{ gap: 12 }}>
          <Text
            style={{
              color: c.text,
              fontSize: 18,
              fontWeight: "600",
              textAlign: "center",
            }}
          >
            Did this with?
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {candidates.map((candidate) => {
              const selected = selectedCandidateId === candidate.activityEntryId;
              const candidateName =
                candidate.user.name ?? candidate.user.username ?? "friend";
              return (
                <Pressable
                  key={candidate.activityEntryId}
                  accessibilityRole="button"
                  accessibilityLabel={`Link with ${candidateName}`}
                  accessibilityState={{ selected, disabled: !!linkingCandidateId }}
                  disabled={!!linkingCandidateId}
                  onPress={() => void linkCandidate(candidate.activityEntryId)}
                  style={{
                    position: "relative",
                    flex: 1,
                    minWidth: 0,
                    alignItems: "center",
                    gap: 6,
                    padding: 12,
                    borderWidth: 2,
                    borderColor: selected ? c.accent : c.border,
                    borderRadius: 16,
                    backgroundColor: selected ? c.selectedBg : c.card,
                  }}
                >
                  {selected && (
                    <Check
                      size={15}
                      color={c.accent}
                      style={{ position: "absolute", top: 7, right: 7 }}
                    />
                  )}
                  {candidate.user.picture ? (
                    <Image
                      source={{ uri: candidate.user.picture }}
                      style={{ width: 52, height: 52, borderRadius: 26 }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 26,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: c.soft,
                      }}
                    >
                      <Text style={{ color: c.text, fontSize: 20 }}>
                        {candidateName[0]?.toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text
                    numberOfLines={1}
                    style={{ color: c.text, fontSize: 12, fontWeight: "500" }}
                  >
                    {candidateName}
                  </Text>
                  <Text style={{ color: c.muted, fontSize: 11 }}>
                    {candidate.quantity} {candidate.activity.measure}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <Status error={validation ?? photoAction.error ?? action.error} />
      {deleteConfirm ? (
        <View style={{ gap: 12 }}>
          <Copy>Are you sure you want to delete this activity entry? This cannot be undone.</Copy>
          <EditorButton
            label="Confirm Delete"
            destructive
            busy={action.isPending}
            onPress={() => action.mutate("delete", { onSuccess: onClose })}
          />
          <EditorButton
            label="Cancel"
            secondary
            disabled={action.isPending}
            onPress={() => setDeleteConfirm(false)}
          />
        </View>
      ) : (
        <>
          <EditorButton
            label="Save Changes"
            busy={action.isPending}
            disabled={!!linkingCandidateId || photoAction.isPending}
            onPress={save}
          />
          <EditorButton
            label="Delete Entry"
            accessibilityLabel="Delete Activity"
            secondary
            destructive
            icon={Trash2}
            disabled={action.isPending || photoAction.isPending}
            onPress={confirmDelete}
          />
        </>
      )}
    </LoggingDrawer>
  );
}
