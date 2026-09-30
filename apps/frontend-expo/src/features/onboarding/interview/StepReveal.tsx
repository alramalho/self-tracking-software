import { Children, Fragment, isValidElement, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Reveal } from "@/components/reveal/Reveal";
import type { StepRevealProps, StepSequenceProps } from "./types";

// Fast overlapping fades on screen entry, including sheets opening offscreen.
export function StepReveal({ children, order, name, style }: StepRevealProps) {
  return (
    <Reveal
      testID={`onboarding-reveal-${name}`}
      waitForViewport={false}
      delay={order * 55}
      duration={240}
      offset={0}
      maxDelay={440}
      style={style}
    >
      {children}
    </Reveal>
  );
}

function sections(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap(child =>
    isValidElement<Pick<StepRevealProps, "children">>(child) && child.type === Fragment
      ? sections(child.props.children)
      : [child],
  );
}

// Keeps the section's existing spacing and alignment while revealing its rows.
export function StepSequence({ children, start = 0, prefix, style, ...props }: StepSequenceProps) {
  const alignItems = StyleSheet.flatten(style)?.alignItems;
  return <View {...props} style={style}>
    {sections(children).map((child, index) => <StepReveal
      key={index}
      name={`${prefix}-${index}`}
      order={start + index}
      style={{ alignSelf: "stretch", alignItems }}
    >{child}</StepReveal>)}
  </View>;
}
