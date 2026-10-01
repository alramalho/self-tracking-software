import { View } from "react-native";
import { Image } from "expo-image";
import LottieView from "lottie-react-native";
import { useReducedMotion } from "react-native-reanimated";
import type { OnboardingArtName, OnboardingArtProps, OnboardingArtSource } from "./types";

// Welcome and Goal reuse the original target Lottie. Other screens retain
// standalone 3D artwork. Reduce Motion uses the existing static target.
const art: Record<Exclude<OnboardingArtName, "welcome" | "goal">, OnboardingArtSource> = {
  baseline: { still: require("../../../../assets/onboarding/start.png") },
  motivation: { still: require("../../../../assets/onboarding/why.png") },
  rhythm: { still: require("../../../../assets/onboarding/week.png") },
  support: { still: require("../../../../assets/onboarding/support.png") },
  circle: { still: require("../../../../assets/onboarding/circle.png") },
  match: { still: require("../../../../assets/onboarding/match.png") },
  review: { still: require("../../../../assets/onboarding/plan.png") },
  // A clay "?" for the questions the coach writes itself.
  question: { still: require("../../../../assets/onboarding/question.png") },
};

export function OnboardingArt({ name, size = 176 }: OnboardingArtProps) {
  const reduced = useReducedMotion();
  if (name === "welcome" || name === "goal") {
    const artSize = size * 0.78;
    return <View testID={`onboarding-art-${name}`} style={{ width: size, height: size, alignSelf: "center", alignItems: "center", justifyContent: "center" }}>
      {reduced
        ? <Image testID={`onboarding-target-still-${name}`} source={require("../../../../assets/animations/target-still.png")} style={{ width: artSize, height: artSize }} contentFit="contain" accessible={false} />
        : <View testID={`onboarding-target-lottie-${name}`} style={{ width: artSize, height: artSize }}>
            <LottieView source={require("../../../../assets/animations/target.json")} autoPlay loop speed={0.45} resizeMode="contain" style={{ width: artSize, height: artSize }} webStyle={{ width: artSize, height: artSize }} />
          </View>}
    </View>;
  }
  const { still } = art[name];
  return (
    <View testID={`onboarding-art-${name}`} style={{ width: size, height: size, alignItems: "center", justifyContent: "center", alignSelf: "center" }}>
      <Image
        testID={`onboarding-art-${name}-image`}
        source={still}
        style={{ width: size * 0.78, height: size * 0.78 }}
        contentFit="contain"
        accessible={false}
      />
    </View>
  );
}
