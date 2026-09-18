import { Linking, View } from "react-native";
import { Button, Copy } from "@/components/ui";
import type { CoachToolsProps } from "./types";
export function CoachTools({ tools }: CoachToolsProps) {
  return (
    <View style={{ gap: 8 }}>
      {tools.map((tool, index) => {
        const sources = Array.isArray(tool.result?.results)
          ? tool.result.results
          : [];
        return (
          <View key={index} style={{ gap: 6 }}>
            <Copy muted>
              {tool.tool === "webSearch"
                ? "Web search sources"
                : tool.tool
                    .replace(/([a-z])([A-Z])/g, "$1 $2")
                    .replaceAll("_", " ")}
            </Copy>
            {sources.map((source, i) => {
              if (!source || typeof source !== "object") return null;
              const item = source as Record<string, unknown>;
              if (
                typeof item.url !== "string" ||
                !/^https?:\/\//i.test(item.url)
              )
                return null;
              const url = item.url;
              return (
                <Button
                  secondary
                  key={i}
                  onPress={() => void Linking.openURL(url)}
                >
                  {typeof item.title === "string"
                    ? item.title
                    : new URL(url).hostname}
                </Button>
              );
            })}
            {typeof tool.result?.error === "string" && (
              <Copy muted>{tool.result.error}</Copy>
            )}
            {typeof tool.result?.message === "string" && (
              <Copy>{tool.result.message}</Copy>
            )}
          </View>
        );
      })}
    </View>
  );
}
