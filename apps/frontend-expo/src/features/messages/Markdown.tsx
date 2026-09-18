import { Text } from "@/components/typography/Text";
import { useState, isValidElement, type ReactNode } from "react";
import {
  Linking,
  Pressable,
  View,
  useWindowDimensions,
  type TextProps,
} from "react-native";
import { Check, X } from "lucide-react-native";
import { EntityPreview } from "./entities/EntityPreview";
import { messageReferences } from "./entities/references";
import type { EntityReference } from "./entities/types";
import { useColors } from "@/components/ui";
import { useActivities, usePlans } from "@/data/queries";
import type { MarkdownProps } from "./types";

// Render the coach's markdown and entity links with selectable native text.
export function Markdown({ children, message }: MarkdownProps) {
  const c = useColors();
  const activities = useActivities();
  const plans = usePlans();
  const [preview, setPreview] = useState<EntityReference>();
  const { fontScale } = useWindowDimensions();
  const references = messageReferences(children, message);
  const resolved = references.map(({ reference }) => {
    const entity =
      reference.kind === "plan"
        ? plans.data?.find((p) => p.id === reference.id)
        : reference.kind === "activity"
          ? activities.data?.find((a) => a.id === reference.id)
          : message?.metricReplacement?.metric;
    return entity
      ? { ...reference, emoji: entity.emoji ?? reference.emoji }
      : undefined;
  });
  let content = "";
  let cursor = 0;
  references.forEach((r, index) => {
    content += children.slice(cursor, r.start) + `\uE000${index}\uE001`;
    cursor = r.end;
  });
  content += children.slice(cursor);
  const chipLabel = (r: EntityReference) => {
    const label =
      r.emoji && r.label.startsWith(r.emoji)
        ? r.label.slice(r.emoji.length).trim()
        : r.label;
    return `${r.emoji || (r.kind === "plan" ? "◎" : "")}${r.emoji ? " " : ""}${label}${r.kind === "metric" ? ` (${message?.metricReplacement?.rating}/5)` : ""}`;
  };
  const inline = (text: string): ReactNode[] =>
    text
      .split(
        /(\uE000\d+\uE001|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g,
      )
      .map((part, index) => {
        const match = part.match(/^\uE000(\d+)\uE001$/);
        if (match) {
          const i = Number(match[1]);
          const reference = resolved[i];
          if (!reference) return references[i].reference.label;
          const metric =
            reference.kind === "metric"
              ? message?.metricReplacement
              : undefined;
          if (metric?.status === "rejected") return null;
          const accepted = metric?.status === "accepted";
          const label = chipLabel(reference);

          return (
            <Pressable
              key={index}
              accessible
              accessibilityRole="link"
              accessibilityLabel={reference.label}
              disabled={accepted}
              onPress={(event) => {
                event.stopPropagation();
                setPreview(reference);
              }}
              style={{
                maxWidth: "100%",
                height: 26 * fontScale,
                backgroundColor: c.fadedBg,
                borderRadius: 6,
                opacity: accepted ? 0.6 : 1,
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 8,
              }}
            >
              <Text
                accessible={false}
                numberOfLines={1}
                style={{
                  color: c.text,
                  fontWeight: "500",
                  fontSize: 16,
                  flexShrink: 1,
                  textDecorationLine: accepted ? "line-through" : "none",
                }}
              >
                {label}
              </Text>
              {metric && (
                <>
                  <Check size={14} color="#22c55e" />
                  {!accepted && <X size={14} color="#ef4444" />}
                </>
              )}
            </Pressable>
          );
        }
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link)
          return (
            <Text
              key={index}
              accessibilityRole="link"
              onPress={(event) => {
                event.stopPropagation();
                if (/^https?:\/\//i.test(link[2]))
                  void Linking.openURL(link[2]);
              }}
              style={{ color: c.accent, textDecorationLine: "underline" }}
            >
              {link[1]}
            </Text>
          );
        if (part.startsWith("**") || part.startsWith("__"))
          return (
            <Text key={index} style={{ fontWeight: "600" }}>
              {inline(part.slice(2, -2))}
            </Text>
          );
        if (part.startsWith("~~"))
          return (
            <Text key={index} style={{ textDecorationLine: "line-through" }}>
              {inline(part.slice(2, -2))}
            </Text>
          );
        if (part.startsWith("*"))
          return (
            <Text key={index} style={{ fontStyle: "italic" }}>
              {inline(part.slice(1, -1))}
            </Text>
          );
        if (part.startsWith("`"))
          return (
            <Text
              key={index}
              style={{ fontFamily: "monospace", backgroundColor: c.soft }}
            >
              {inline(part.slice(1, -1))}
            </Text>
          );
        return part;
      });
  // Native text attachments are omitted by iOS's accessibility provider. Lay out
  // mixed paragraphs as native text runs and controls so every chip has a real
  // hit target, while VoiceOver reads the sentence before its individual links.
  const mixedParagraph = (line: string) => {
    let first = true;
    const sentence = line.replace(
      /\uE000(\d+)\uE001/g,
      (_, i) => references[Number(i)].reference.label,
    );
    const runs = (
      nodes: ReactNode[],
      inherited: TextProps["style"] = [],
    ): ReactNode[] =>
      nodes.flatMap((node, i) => {
        if (typeof node === "string")
          return (node.match(/\S+\s*|\s+/g) ?? []).map((word, j) => {
            const accessible = first;
            first = false;
            return (
              <Text
                key={`word-${i}-${j}`}
                accessible={accessible}
                accessibilityLabel={accessible ? sentence : undefined}
                style={[
                  { color: c.text, fontSize: 16, lineHeight: 28 },
                  inherited,
                ]}
              >
                {word}
              </Text>
            );
          });
        if (
          isValidElement<TextProps>(node) &&
          node.type === Text &&
          !node.props.onPress
        ) {
          const children = Array.isArray(node.props.children)
            ? node.props.children
            : [node.props.children];
          return (
            <View key={`run-${i}`} style={{ display: "contents" }}>
              {runs(children, [inherited, node.props.style])}
            </View>
          );
        }
        return node;
      });
    return (
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          minWidth: 0,
        }}
      >
        {runs(inline(line))}
      </View>
    );
  };
  let code = false;
  return (
    <View style={{ gap: 4 }}>
      {content.split("\n").map((line, index) => {
        if (/^```/.test(line)) {
          code = !code;
          return null;
        }
        if (!code && /^[-*_]{3,}$/.test(line.trim()))
          return (
            <View
              key={index}
              style={{
                borderBottomWidth: 1,
                borderColor: c.border,
                marginVertical: 8,
              }}
            />
          );
        const quote = !code && /^>\s?/.test(line);
        if (!code && line.includes("\uE000"))
          return (
            <View key={index}>
              {mixedParagraph(
                line
                  .replace(/^#{1,6}\s+/, "")
                  .replace(/^\s*[-*]\s+/, "• ")
                  .replace(/^>\s?/, ""),
              )}
            </View>
          );
        return (
          <Text
            selectable={!line.includes("\uE000")}
            accessible={!line.includes("\uE000")}
            key={index}
            style={{
              color: c.text,
              fontSize: !code && line.startsWith("#") ? 18 : 16,
              fontWeight: !code && line.startsWith("#") ? "600" : "400",
              lineHeight: 28,
              ...(code
                ? {
                    fontFamily: "monospace",
                    backgroundColor: c.soft,
                    paddingHorizontal: 8,
                  }
                : {}),
              ...(quote
                ? {
                    borderLeftWidth: 2,
                    borderColor: c.muted,
                    paddingLeft: 10,
                    color: c.muted,
                  }
                : {}),
            }}
          >
            {code
              ? line
              : inline(
                  line
                    .replace(/^#{1,6}\s+/, "")
                    .replace(/^\s*[-*]\s+/, "• ")
                    .replace(/^>\s?/, ""),
                )}
          </Text>
        );
      })}
      <EntityPreview
        reference={preview}
        message={message}
        onClose={() => setPreview(undefined)}
      />
    </View>
  );
}
