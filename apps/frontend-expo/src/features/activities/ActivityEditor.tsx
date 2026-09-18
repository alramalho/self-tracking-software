import { useState } from "react";
import { Keyboard, View } from "react-native";
import { Trash2 } from "lucide-react-native";
import { Copy, Status, useColors } from "@/components/ui";
import { Text } from "@/components/typography/Text";
import { useAction } from "@/data/queries";
import { api } from "@/data/api";
import { LoggingDrawer } from "./logging/LoggingDrawer";
import { ColorPicker } from "./editor/ColorPicker";
import { EditorButton, EditorInput } from "./editor/controls";
import { formatPreviewMeasure, isOneEmoji } from "./editor/model";
import type {
  ActivityEditorProps,
  ConversionOperator,
  EditorAction,
  EditorStep,
} from "./editor/types";

export function ActivityEditor({ activity, onClose }: ActivityEditorProps) {
  const c = useColors();
  const [title, setTitle] = useState(activity?.title ?? "");
  const [emoji, setEmoji] = useState(activity?.emoji ?? "");
  const [measure, setMeasure] = useState(activity?.measure ?? "");
  const [color, setColor] = useState(activity?.colorHex ?? "");
  const [factor, setFactor] = useState("1");
  const [operation, setOperation] = useState<ConversionOperator>("divide");
  const [step, setStep] = useState<EditorStep>("edit");
  const [validation, setValidation] = useState<Error>();
  const oldMeasure = activity?.measure.trim() ?? "",
    newMeasure = measure.trim();
  const validFactor = Number.isInteger(Number(factor)) && Number(factor) > 0;
  const preview =
    operation === "divide" ? 60 / Number(factor) : 60 * Number(factor);
  const action = useAction(async ({ kind, convert }: EditorAction) => {
    if (kind === "delete") return api.delete(`/activities/${activity!.id}`);
    return api.post("/activities/upsert", {
      ...(activity ? { id: activity.id } : {}),
      title: title.trim(),
      emoji,
      measure: newMeasure,
      colorHex: color || null,
      ...(convert
        ? { measureConversion: { operator: operation, factor: Number(factor) } }
        : {}),
    });
  });
  function save() {
    Keyboard.dismiss();
    setValidation(undefined);
    action.reset();
    if (!title.trim() || !newMeasure || !isOneEmoji(emoji)) {
      setValidation(
        new Error("Title, measure, and a single emoji are required."),
      );
      return;
    }
    if (activity && oldMeasure !== newMeasure) {
      setStep("measure");
      return;
    }
    action.mutate({ kind: "save" }, { onSuccess: onClose });
  }
  function back() {
    if (action.isPending) return;
    Keyboard.dismiss();
    action.reset();
    setValidation(undefined);
    if (step === "edit") onClose();
    else setStep("edit");
  }
  const heading =
    step === "delete"
      ? "Delete Activity"
      : step === "measure"
        ? "Change Activity Measure"
        : activity
          ? "Edit Activity"
          : "Add New Activity";
  return (
    <LoggingDrawer
      keyboardToolbar
      scrollToEndOnKeyboard={false}
      title={heading}
      titleAlign={step === "edit" ? "left" : "center"}
      contentPadding={20}
      testID="activity-editor"
      dismissLabel="Dismiss activity editor"
      onClose={back}
    >
      {step === "edit" ? (
        <View style={{ gap: 16 }}>
          <EditorInput
            label="Emoji"
            placeholder="Enter an emoji"
            value={emoji}
            editable={!action.isPending}
            autoCorrect={false}
            onChangeText={(value) => {
              if (!value || isOneEmoji(value)) setEmoji(value);
            }}
          />
          <EditorInput
            label="Activity Title"
            placeholder="Activity Title"
            value={title}
            editable={!action.isPending}
            onChangeText={setTitle}
          />
          <EditorInput
            label="Measure"
            placeholder="Measure (e.g., minutes, times)"
            value={measure}
            editable={!action.isPending}
            onChangeText={setMeasure}
          />
          <ColorPicker
            value={color}
            onChange={setColor}
            disabled={action.isPending}
          />
          <View
            style={{
              height: 1,
              backgroundColor: c.inputBorder,
              marginVertical: 16,
            }}
          />
          <Status error={validation ?? action.error} />
          <EditorButton
            label="Save Activity"
            busy={action.isPending}
            onPress={save}
          />
          {activity && (
            <EditorButton
              label="Delete Activity"
              secondary
              destructive
              icon={Trash2}
              disabled={action.isPending}
              onPress={() => {
                Keyboard.dismiss();
                action.reset();
                setValidation(undefined);
                setStep("delete");
              }}
            />
          )}
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          {step === "delete" ? (
            <>
              <Copy>Are you sure you want to delete this activity?</Copy>
              <Text
                style={{ color: c.text, fontWeight: "700", lineHeight: 22 }}
              >
                This will permanently delete all entries, reactions, and
                comments associated with it.
              </Text>
              <Copy>This action cannot be undone.</Copy>
            </>
          ) : (
            <>
              <Copy>
                This changes how existing logs and planned sessions for this
                activity are measured. Pick how old quantities should convert.
              </Copy>
              <View
                style={{
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: c.inputBorder,
                  backgroundColor: c.card,
                  padding: 12,
                  gap: 12,
                }}
              >
                <Text style={{ color: c.text, fontWeight: "500" }}>
                  Conversion
                </Text>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Text numberOfLines={1} style={{ flex: 1, color: c.text }}>
                    {oldMeasure}
                  </Text>
                  <EditorButton
                    label={operation === "divide" ? "÷" : "×"}
                    secondary
                    disabled={action.isPending}
                    onPress={() =>
                      setOperation(
                        operation === "divide" ? "multiply" : "divide",
                      )
                    }
                  />
                  <EditorInput
                    label="Conversion factor"
                    selectTextOnFocus
                    value={factor}
                    onChangeText={setFactor}
                    editable={!action.isPending}
                    keyboardType="number-pad"
                    style={{ width: 72, textAlign: "center" }}
                  />
                  <Text numberOfLines={1} style={{ flex: 1, color: c.text }}>
                    {newMeasure}
                  </Text>
                </View>
                <Copy muted>
                  {validFactor && Number.isFinite(preview)
                    ? `60 ${formatPreviewMeasure(oldMeasure, 60)} = ${preview} ${formatPreviewMeasure(newMeasure, preview)}`
                    : "Enter a positive whole number to preview the conversion."}
                </Copy>
              </View>
              {validFactor && !Number.isInteger(preview) && (
                <Text style={{ color: "#ef4444", lineHeight: 20 }}>
                  This conversion can create fractional quantities. Existing
                  activity quantities are whole numbers today, so the server may
                  reject it if any saved log or session would become fractional.
                </Text>
              )}
            </>
          )}
          <Status error={action.error} />
          <EditorButton
            label="Cancel"
            secondary
            disabled={action.isPending}
            onPress={back}
          />
          <EditorButton
            label={step === "delete" ? "Delete" : "Change Measure"}
            destructive={step === "delete"}
            busy={action.isPending}
            disabled={step === "measure" && !validFactor}
            onPress={() => {
              Keyboard.dismiss();
              action.mutate(
                {
                  kind: step === "delete" ? "delete" : "save",
                  convert: step === "measure",
                },
                { onSuccess: onClose },
              );
            }}
          />
        </View>
      )}
    </LoggingDrawer>
  );
}
