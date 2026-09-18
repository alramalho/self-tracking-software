import { Linking, View } from "react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import type { PlanNotesTextProps } from "./types";

// Match the notes block's compact headings, lists, emphasis, code and links.
export function PlanNotesText({ notes }: PlanNotesTextProps) {
  const c = useColors();
  const inline = (value: string): React.ReactNode[] =>
    value
      .split(
        /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s]+|www\.[^\s]+|\*[^*]+\*)/g,
      )
      .map((part, i) => {
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        const url =
          link?.[2] ?? (/^(https?:\/\/|www\.)/i.test(part) ? part : undefined);
        if (url)
          return (
            <Text
              key={i}
              accessibilityRole="link"
              style={{ color: c.accent, textDecorationLine: "underline" }}
              onPress={() => {
                const target = url.startsWith("www.") ? `https://${url}` : url;
                if (/^https?:\/\//i.test(target)) void Linking.openURL(target);
              }}
            >
              {link?.[1] ?? part}
            </Text>
          );
        if (part.startsWith("**") || part.startsWith("__"))
          return (
            <Text key={i} style={{ fontWeight: "600", color: c.text }}>
              {inline(part.slice(2, -2))}
            </Text>
          );
        if (part.startsWith("`"))
          return (
            <Text
              key={i}
              style={{ fontFamily: "monospace", backgroundColor: c.soft }}
            >
              {part.slice(1, -1)}
            </Text>
          );
        if (part.startsWith("*"))
          return (
            <Text key={i} style={{ fontStyle: "italic" }}>
              {part.slice(1, -1)}
            </Text>
          );
        return part;
      });
  return (
    <View testID="plan-notes-content" style={{ gap: 4 }}>
      {notes.split("\n").map((line, i) => {
        const heading = line.match(/^(#{1,6})\s+(.+)/);
        const list = line.match(/^\s*(?:[-*+] |\d+\. )/);
        return (
          <Text
            key={i}
            selectable
            style={{
              color: heading ? c.text : c.muted,
              fontSize: heading?.[1].length === 1 ? 16 : 14,
              fontWeight: heading ? "600" : "400",
              lineHeight: 22,
              marginTop: heading && i ? 8 : 0,
              paddingLeft: list ? 12 : 0,
            }}
          >
            {inline(heading ? heading[2] : line.replace(/^\s*[-*+]\s+/, "• "))}
          </Text>
        );
      })}
    </View>
  );
}
