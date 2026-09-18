import { View } from "react-native";
import { Check, ChevronRight, X } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { PreviewSheet, PreviewTouch } from "./PreviewSheet";
import type { ProposalReviewProps } from "./types";

export function ProposalReview({
  label,
  title,
  emoji,
  description,
  summary,
  status,
  children,
  quickActions,
  open,
  onOpen,
  onClose,
}: ProposalReviewProps) {
  const c = useColors();
  return (
    <>
      <View
        style={{
          marginTop: 8,
          borderRadius: 8,
          backgroundColor: status ? c.soft : c.fadedBg,
          paddingHorizontal: 12,
          paddingVertical: 10,
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 8,
          opacity: status ? 0.6 : 1,
        }}
      >
        <View style={{ flex: 1 }}>
          <PreviewTouch
            accessibilityRole="button"
            accessibilityLabel={`Review ${label}`}
            onPress={onOpen}
            style={{ width: "100%", gap: 6 }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Text
                style={{
                  flex: 1,
                  fontSize: 14,
                  fontWeight: "500",
                  color: c.text,
                  textDecorationLine:
                    status === "rejected" ? "line-through" : "none",
                }}
              >
                {emoji ? `${emoji} ` : ""}
                {label}
              </Text>
              {status === "accepted" ? (
                <Check size={14} color="#22c55e" />
              ) : status === "rejected" ? (
                <X size={14} color="#ef4444" />
              ) : (
                <ChevronRight size={14} color={c.muted} />
              )}
            </View>
            {!status && description && (
              <Text style={{ fontSize: 12, color: c.muted }}>
                {description}
              </Text>
            )}
            {!status && summary}
          </PreviewTouch>
        </View>
        {!status && quickActions}
      </View>
      <PreviewSheet visible={open} title={title} onClose={onClose}>
        <Text style={{ textAlign: "center", fontSize: 48 }}>
          {emoji ?? "🎯"}
        </Text>
        <Text
          style={{
            textAlign: "center",
            fontSize: 24,
            fontWeight: "700",
            color: c.text,
          }}
        >
          {title}
        </Text>
        {children}
      </PreviewSheet>
    </>
  );
}
