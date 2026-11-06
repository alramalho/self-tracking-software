import { Children, Fragment } from "react";
import { View } from "react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import type { SettingsGroupProps } from "./types";

/** An inset group of rows, like a section in iOS Settings. */
export function SettingsGroup({
  title,
  footer,
  separatorInset = 36,
  children,
  testID,
}: SettingsGroupProps) {
  const c = useColors();
  const rows = Children.toArray(children).filter(Boolean);
  if (!rows.length) return null;
  return (
    <View testID={testID} style={{ gap: 6 }}>
      {!!title && (
        <Text
          accessibilityRole="header"
          style={{
            color: c.muted,
            fontSize: 13,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            paddingHorizontal: 14,
          }}
        >
          {title}
        </Text>
      )}
      <View
        style={{
          backgroundColor: c.card,
          borderRadius: 20,
          paddingHorizontal: 16,
        }}
      >
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <View
                style={{
                  height: 1,
                  backgroundColor: c.border,
                  marginLeft: separatorInset,
                }}
              />
            )}
            {row}
          </Fragment>
        ))}
      </View>
      {!!footer && (
        <Text
          style={{
            color: c.muted,
            fontSize: 13,
            lineHeight: 18,
            paddingHorizontal: 14,
          }}
        >
          {footer}
        </Text>
      )}
    </View>
  );
}
