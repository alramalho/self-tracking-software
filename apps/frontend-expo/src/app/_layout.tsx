import { NotificationNavigation } from "@/native/NotificationNavigation";
import { NotificationRegistration } from "@/native/notifications/NotificationRegistration";
import { WatchSync } from "@/native/watch/WatchSync";
import { HealthProvider } from "@/features/health/HealthProvider";
import { OnboardingGate } from "@/features/onboarding/OnboardingGate";
import { AiConsentGate } from "@/features/ai-consent/AiConsent";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Platform } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useSession } from "@/auth/provider";
import { DataProvider } from "@/data/provider";
import { ThemeProvider } from "@/components/theme";
import { Status } from "@/components/ui";
import { useFonts } from "expo-font";
import { useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";
import { fonts } from "@/components/typography/fonts";

void SplashScreen.preventAutoHideAsync();
function Routes() {
  const session = useSession();
  if (!session.isLoaded) return <Status loading />;
  return (
    <DataProvider key={session.isSignedIn ? session.userId : "signed-out"}>
      <ThemeProvider>
        <HealthProvider>
        <StatusBar style="auto" />
        <NotificationNavigation />
        <NotificationRegistration />
        <WatchSync />
        <OnboardingGate />
        <AiConsentGate />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={session.isSignedIn}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="plan/[id]" />
            <Stack.Screen name="create-plan" />
            <Stack.Screen name="onboarding" options={{ presentation: "fullScreenModal" }} />
            <Stack.Screen name="create-plan-advanced" />
            <Stack.Screen name="session/[id]" />
            <Stack.Screen name="plan-support/[id]" />
            <Stack.Screen name="circles" />
            <Stack.Screen name="circle/[id]" />
            <Stack.Screen name="edit-plan/[id]" />
            <Stack.Screen name="settings" options={{ presentation: "transparentModal", animation: "none", contentStyle: { backgroundColor: "transparent" } }} />
            <Stack.Screen
              name="photo"
              options={{
                presentation: "card",
                headerShown: Platform.OS === "ios",
                headerTitle: "",
                headerBackVisible: false,
                headerStyle: { backgroundColor: "black" },
                headerTintColor: "white",
                headerShadowVisible: false,
                animation: "fade",
                contentStyle: { backgroundColor: "black" },
              }}
            />
            <Stack.Screen name="search" />
            <Stack.Screen name="health" />
            <Stack.Screen name="health-workout/[id]" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="messages" />
            <Stack.Screen name="rankings" />
            <Stack.Screen
              name="badges"
              options={{
                presentation:
                  Platform.OS === "web" ? "transparentModal" : "formSheet",
                sheetAllowedDetents: [0.72, 0.94],
                sheetGrabberVisible: true,
                sheetCornerRadius: 28,
                headerBackVisible: false,
                contentStyle: { backgroundColor: "transparent" },
              }}
            />
            <Stack.Screen
              name="wrapped"
              options={{
                presentation: "fullScreenModal",
                animation: "fade",
                headerBackVisible: false,
              }}
            />
            <Stack.Screen name="chat/[id]" />
          </Stack.Protected>
          <Stack.Protected guard={!session.isSignedIn}>
            <Stack.Screen name="signin" />
          </Stack.Protected>
        </Stack>
        </HealthProvider>
      </ThemeProvider>
    </DataProvider>
  );
}
export default function Root() {
  const [fontsLoaded, fontError] = useFonts(fonts);
  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);
  if (!fontsLoaded && !fontError) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <Routes />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
