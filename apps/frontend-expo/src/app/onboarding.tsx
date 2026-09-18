import { useLocalSearchParams } from "expo-router";
import Onboarding from "@/features/onboarding/Onboarding";
export default function OnboardingRoute() { const { preview } = useLocalSearchParams<{ preview?: string }>(); return <Onboarding preview={preview === "1"} />; }
