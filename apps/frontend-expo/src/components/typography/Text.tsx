import { createContext, forwardRef, useContext } from "react";
import { StyleSheet, Text as NativeText } from "react-native";
import type { TextProps, TextStyle } from "react-native";

const WeightContext = createContext<TextStyle["fontWeight"]>("400");

// Explicit faces preserve Inter's medium/semibold weights on both native platforms.
// Nested text inherits its parent's weight, just as React Native Text does.
export const Text = forwardRef<NativeText, TextProps>(function Text(
  { style, children, ...props },
  ref,
) {
  const inheritedWeight = useContext(WeightContext);
  const flat = StyleSheet.flatten(style);
  const weight = flat?.fontWeight ?? inheritedWeight;
  const number = weight === "bold" ? 700 : Number(weight) || 400;
  const face =
    number >= 700 ? "Bold" : number >= 600 ? "SemiBold" : number >= 500 ? "Medium" : "Regular";
  return (
    <WeightContext.Provider value={weight}>
      <NativeText
        {...props}
        ref={ref}
        style={[
          style,
          !flat?.fontFamily && { fontFamily: `Inter-${face}`, fontWeight: "normal" },
        ]}
      >
        {children}
      </NativeText>
    </WeightContext.Provider>
  );
});
