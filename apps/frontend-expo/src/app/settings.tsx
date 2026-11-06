import { useState } from "react";
import { Linking, Platform, Pressable, Switch, View } from "react-native";
import Animated, {
  FadeInRight,
  FadeInLeft,
  useReducedMotion,
} from "react-native-reanimated";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  GraduationCap,
  KeyRound,
  Languages,
  LifeBuoy,
  LogOut,
  Paintbrush,
  Play,
  ShieldCheck,
  Sparkles,
  Users,
  UserX,
} from "lucide-react-native";
import { router, useIsFocused } from "expo-router";
import { goBack } from "@/core/navigation";
import {
  enableIosNotifications,
  disableIosNotifications,
} from "@/native/notifications";
import { Button, Copy, Status, useColors } from "@/components/ui";
import { Text } from "@/components/typography/Text";
import { useSession } from "@/auth/provider";
import { useAction, useCurrentUser } from "@/data/queries";
import { api } from "@/data/api";
import { LoggingDrawer } from "@/features/activities/logging/LoggingDrawer";
import { SettingsRow } from "@/features/settings/SettingsRow";
import {
  ColorPalettes,
  ThemeModes,
  appearanceSummary,
} from "@/features/settings/Appearance";
import { SettingsGroup } from "@/features/settings/SettingsGroup";
import { ProfileCard } from "@/features/settings/ProfileCard";
import { SettingsCard } from "@/features/settings/SettingsCard";
import { ProfileSettings } from "@/features/settings/ProfileSettings";
import { Accounts } from "@/features/settings/Accounts";
import { useHealth } from "@/features/health/HealthProvider";
import {
  AppleLogoIcon,
  GarminContent,
  GarminLogoIcon,
  HealthContent,
} from "@/features/health/HealthScreen";
import { CoachProfile } from "@/features/settings/CoachProfile";
import type { SettingsView } from "@/features/settings/types";
import {
  BlockedPeople,
  SUPPORT_EMAIL,
  showActions,
} from "@/features/safety/Safety";
import { useAiConsent } from "@/features/ai-consent/AiConsent";
import { LanguagesDrawer } from "@/features/dictation/LanguagesDrawer";
import { languagesSummary } from "@/features/dictation/languages";
import { APPLE_SUBSCRIPTIONS_URL, hasAppleSubscription } from "@/features/billing/apple";
const titles: Record<SettingsView, string> = {
  main: "Settings",
  profile: "Account",
  accounts: "Switch account",
  appearance: "Appearance",
  integrations: "Integrations",
  coach: "Coach profile",
  experience: "Preview onboarding",
  appleHealth: "Apple Health",
  garmin: "Garmin Connect",
  privacy: "Privacy & safety",
  blocked: "Blocked people",
};
// Where "Back" goes from each screen; anything not listed returns to Settings.
const parents: Partial<Record<SettingsView, SettingsView>> = {
  accounts: "profile",
  appleHealth: "integrations",
  garmin: "integrations",
  blocked: "privacy",
};
export default function Settings() {
  const focused = useIsFocused();
  const user = useCurrentUser(),
    auth = useSession(),
    c = useColors(),
    reduced = useReducedMotion();
  const health = useHealth();
  const [view, setView] = useState<SettingsView>("main");
  const [languagesOpen, setLanguagesOpen] = useState(false);
  const [error, setError] = useState<unknown>();
  const [profileBusy, setProfileBusy] = useState(false);
  const theme = useAction(
    async (update: { themeMode?: string; themeBaseColor?: string }) =>
      api.patch("/users/user", update),
  );
  const push = useAction(async (enabled: boolean) =>
    enabled
      ? enableIosNotifications(auth.userId ?? undefined)
      : disableIosNotifications(auth.userId ?? undefined),
  );
  const aiConsent = useAiConsent();
  const aiOff = useAction(async () =>
    api.put("/users/ai-consent", { granted: false }),
  );
  const open = (url: string) => void Linking.openURL(url).catch(setError);
  const parent = parents[view] ?? "main";
  const connectedIntegrations = [
    health.status?.connected && "Apple Health",
    health.garmin.status?.connected && "Garmin",
  ]
    .filter(Boolean)
    .join(", ");
  if (!focused) return null;
  return (
    <LoggingDrawer
      testID="settings-drawer"
      dismissLabel="Dismiss settings"
      keyboardToolbar
      scrollToEndOnKeyboard={false}
      onClose={() => {
        if (!profileBusy && !theme.isPending) goBack();
      }}
    >
      <Animated.View
        key={view}
        entering={
          reduced
            ? undefined
            : (view === "main" ? FadeInLeft : FadeInRight).duration(200)
        }
        style={{
          gap: view === "main" ? 22 : 16,
          paddingTop: view === "main" ? 28 : 4,
        }}
      >
        {view !== "main" && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Back to ${titles[parent]}`}
            disabled={profileBusy || theme.isPending}
            onPress={() => {
              setView(parent);
              theme.reset();
            }}
            style={{
              minHeight: 44,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingRight: 44,
            }}
          >
            <ChevronLeft size={18} color={c.muted} />
            <Text style={{ fontSize: 14, color: c.muted }}>
              {`Back to ${titles[parent]}`}
            </Text>
          </Pressable>
        )}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 8,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{
              flex: 1,
              fontSize: view === "main" ? 26 : 18,
              fontWeight: view === "main" ? "700" : "600",
              color: c.text,
            }}
          >
            {titles[view]}
          </Text>
        </View>
        {view === "main" && (
          <>
            <ProfileCard
              name={user.data?.name}
              username={user.data?.username}
              picture={user.data?.picture}
              planType={user.data?.planType}
              onPress={() => setView("profile")}
            />
            <SettingsGroup title="Coach">
              <SettingsRow
                icon={GraduationCap}
                title="Coach profile"
                chevron
                onPress={() => setView("coach")}
              />
              {Platform.OS === "ios" && (
                <SettingsRow
                  icon={Bell}
                  title="Notifications"
                  trailing={
                    <Switch
                      accessibilityLabel="Notifications"
                      disabled={push.isPending}
                      value={!!user.data?.isIosNotificationsEnabled}
                      onValueChange={(enabled) => push.mutate(enabled)}
                      trackColor={{ true: c.accent }}
                    />
                  }
                />
              )}
              <SettingsRow
                icon={Languages}
                title="Languages"
                value={
                  user.data?.spokenLanguages?.length
                    ? languagesSummary(user.data.spokenLanguages)
                    : "Automatic"
                }
                chevron
                onPress={() => setLanguagesOpen(true)}
              />
            </SettingsGroup>
            {languagesOpen && (
              <LanguagesDrawer onClose={() => setLanguagesOpen(false)} />
            )}
            <SettingsGroup title="App">
              <SettingsRow
                icon={Paintbrush}
                title="Appearance"
                value={appearanceSummary(
                  user.data?.themeMode,
                  user.data?.themeBaseColor,
                )}
                chevron
                onPress={() => setView("appearance")}
              />
              <SettingsRow
                icon={KeyRound}
                title="Integrations"
                value={connectedIntegrations}
                chevron
                onPress={() => setView("integrations")}
              />
            </SettingsGroup>
            <SettingsGroup>
              <SettingsRow
                icon={ShieldCheck}
                title="Privacy & safety"
                chevron
                onPress={() => setView("privacy")}
              />
              <SettingsRow
                icon={LifeBuoy}
                title="Get help"
                chevron
                onPress={() => open(`mailto:${SUPPORT_EMAIL}`)}
              />
              <SettingsRow
                icon={Play}
                title="Preview onboarding"
                chevron
                onPress={() => setView("experience")}
              />
            </SettingsGroup>
            <SettingsGroup>
              <SettingsRow
                icon={LogOut}
                title="Log out"
                destructive
                onPress={() =>
                  showActions("Log out of this account?", [
                    {
                      label: "Log out",
                      destructive: true,
                      onPress: () => void auth.signOut().catch(setError),
                    },
                  ])
                }
              />
            </SettingsGroup>
          </>
        )}
        {view === "profile" && (
          <>
            <SettingsGroup>
              {/* Bought in the iOS app: Apple manages it. Bought on the website: Stripe does, but the
                  iOS app never links to web billing (App Review 3.1.1), so web subscribers manage it there. */}
              {user.data?.planType &&
                user.data.planType !== "FREE" &&
                (Platform.OS !== "ios" || hasAppleSubscription(user.data)) && (
                  <SettingsRow
                    icon={CreditCard}
                    title="Manage my subscription"
                    chevron
                    onPress={() =>
                      open(
                        hasAppleSubscription(user.data)
                          ? APPLE_SUBSCRIPTIONS_URL
                          : "https://billing.stripe.com/p/login/eVa03Q46z6Ivchi8ww",
                      )
                    }
                  />
                )}
              <SettingsRow
                icon={Users}
                title="Switch account"
                chevron
                onPress={() => setView("accounts")}
              />
            </SettingsGroup>
            <ProfileSettings onBusyChange={setProfileBusy} />
          </>
        )}
        {view === "accounts" && <Accounts />}
        {view === "appearance" && (
          <>
            <ThemeModes
              selected={user.data?.themeMode}
              busy={theme.isPending}
              onSelect={(mode) => theme.mutate({ themeMode: mode })}
            />
            <ColorPalettes
              selected={user.data?.themeBaseColor}
              busy={theme.isPending}
              onSelect={(color) => theme.mutate({ themeBaseColor: color })}
            />
          </>
        )}
        {view === "integrations" && (
          <>
            <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20 }}>
              Connect health data or let another assistant work with
              tracking.so.
            </Text>
            <SettingsCard
              icon={AppleLogoIcon}
              iconBackground={false}
              color="#ef4444"
              title="Apple Health"
              description="Sync workouts and sleep from your Apple Watch."
              trailing={
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  {health.status?.connected && (
                    <Text style={{ color: "#22c55e", fontSize: 12, fontWeight: "600" }}>
                      Connected
                    </Text>
                  )}
                  <ChevronRight size={20} color={c.muted} />
                </View>
              }
              onPress={() => setView("appleHealth")}
            />
            {/* Hidden until Garmin approves the production key (testers only), unless already connected. */}
            {(health.garmin.status?.available || health.garmin.status?.connected) && (
            <SettingsCard
              icon={GarminLogoIcon}
              iconBackground={false}
              color="#0ea5e9"
              title="Garmin Connect"
              description="Sync Garmin workouts, sleep, and recovery data."
              trailing={
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  {health.garmin.status?.connected && (
                    <Text style={{ color: "#22c55e", fontSize: 12, fontWeight: "600" }}>
                      Connected
                    </Text>
                  )}
                  <ChevronRight size={20} color={c.muted} />
                </View>
              }
              onPress={() => setView("garmin")}
            />
            )}
          </>
        )}
        {view === "appleHealth" && <HealthContent showGarmin={false} />}
        {view === "garmin" && <GarminContent />}
        {view === "coach" && <CoachProfile />}
        {view === "privacy" && (
          <>
            <SettingsGroup footer="Coach, plan setup, voice logs and dictation send your data to AI providers.">
              <SettingsRow
                icon={Sparkles}
                title="AI features"
                trailing={
                  <Switch
                    accessibilityLabel="AI features"
                    disabled={aiOff.isPending}
                    value={aiConsent.allowed}
                    onValueChange={(on) =>
                      on ? void aiConsent.ask() : aiOff.mutate(undefined)
                    }
                    trackColor={{ true: c.accent }}
                  />
                }
              />
            </SettingsGroup>
            <Status error={aiOff.error} />
            {aiConsent.sheet}
            <SettingsGroup>
              <SettingsRow
                icon={UserX}
                title="Blocked people"
                chevron
                onPress={() => setView("blocked")}
              />
              <SettingsRow
                icon={ShieldCheck}
                title="Privacy policy"
                chevron
                onPress={() => open("https://tracking.so/privacy")}
              />
              <SettingsRow
                icon={FileText}
                title="Terms of use"
                chevron
                onPress={() => open("https://tracking.so/terms")}
              />
            </SettingsGroup>
          </>
        )}
        {view === "blocked" && <BlockedPeople />}
        {view === "experience" && (
          <>
            <Copy>
              Walk through the same questions a new user sees, with a fresh,
              temporary plan.
            </Copy>
            <Copy muted>
              Preview answers stay in this preview. Finishing will not create a
              plan, start a trial, change your subscription or send reminders.
            </Copy>
            <Button
              onPress={() => router.push("/onboarding?preview=1" as never)}
            >
              Start preview
            </Button>
          </>
        )}
        <Status
          loading={user.isLoading}
          error={user.error ?? theme.error ?? push.error ?? error}
        />
      </Animated.View>
    </LoggingDrawer>
  );
}
