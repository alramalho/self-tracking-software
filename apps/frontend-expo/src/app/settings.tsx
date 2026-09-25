import { useEffect, useState } from "react";
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
  GraduationCap,
  KeyRound,
  LogOut,
  Moon,
  Paintbrush,
  Play,
  Smartphone,
  Sun,
  UserPen,
} from "lucide-react-native";
import { router, useIsFocused } from "expo-router";
import { goBack } from "@/core/navigation";
import {
  enableIosNotifications,
  disableIosNotifications,
} from "@/native/notifications";
import { Button, Copy, Field, Status, useColors } from "@/components/ui";
import { Text } from "@/components/typography/Text";
import { useSession } from "@/auth/provider";
import { useAction, useCurrentUser } from "@/data/queries";
import { api } from "@/data/api";
import { pickPhotos, appendPhotos } from "@/native/photos";
import { LoggingDrawer } from "@/features/activities/logging/LoggingDrawer";
import { SettingsRow } from "@/features/settings/SettingsRow";
import { ApiKeys } from "@/features/settings/ApiKeys";
import { ColorPalettes, ThemeModes } from "@/features/settings/Appearance";
import { SettingsCard } from "@/features/settings/SettingsCard";
import { ProfileSettings } from "@/features/settings/ProfileSettings";
import { useHealth } from "@/features/health/HealthProvider";
import {
  AppleLogoIcon,
  GarminContent,
  GarminLogoIcon,
  HealthContent,
} from "@/features/health/HealthScreen";
import { CoachProfile } from "@/features/settings/CoachProfile";
import type { SettingsView } from "@/features/settings/types";
const titles: Record<SettingsView, string> = {
  main: "Settings",
  profile: "User Settings",
  palette: "Color Themes",
  theme: "Theme Mode",
  integrations: "Integrations",
  coach: "Coach Profile",
  experience: "Preview onboarding",
  apiKeys: "Bring your own teacher",
  appleHealth: "Apple Health",
  garmin: "Garmin Connect",
};
export default function Settings() {
  const focused = useIsFocused();
  const user = useCurrentUser(),
    auth = useSession(),
    c = useColors(),
    reduced = useReducedMotion();
  const health = useHealth();
  const [view, setView] = useState<SettingsView>("main");
  const [confirm, setConfirm] = useState<"logout" | null>(null);
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
  const open = (url: string) => void Linking.openURL(url).catch(setError);
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
          gap: view === "main" ? 12 : 16,
          paddingTop: view === "main" ? 28 : 4,
        }}
      >
        {view !== "main" && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              view === "apiKeys" || view === "appleHealth" || view === "garmin"
                ? "Back to Integrations"
                : "Back to Settings"
            }
            disabled={profileBusy || theme.isPending}
            onPress={() => {
              setView(
                view === "apiKeys" || view === "appleHealth" || view === "garmin"
                  ? "integrations"
                  : "main",
              );
              setConfirm(null);
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
              {view === "apiKeys" || view === "appleHealth" || view === "garmin"
                ? "Back to Integrations"
                : "Back to Settings"}
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
          {view === "main" && (
            <Text
              style={{
                fontFamily: "Caveat",
                fontSize: 23,
                color: user.data?.planType === "FREE" ? c.muted : c.accent,
              }}
            >{`On ${user.data?.planType || "FREE"} Plan`}</Text>
          )}
        </View>
        {view === "main" && (
          <>
            {Platform.OS === "ios" && (
              <View
                style={{
                  backgroundColor: c.soft + "88",
                  padding: 12,
                  borderRadius: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontSize: 16 }}>
                    Push Notifications
                  </Text>
                  <Text style={{ color: c.muted, fontSize: 13, marginTop: 3 }}>
                    {user.data?.isIosNotificationsEnabled
                      ? "Notifications enabled"
                      : "Enable notifications for updates"}
                  </Text>
                </View>
                <Bell size={22} color={c.muted} />
                <Switch
                  accessibilityLabel="Push Notifications"
                  disabled={push.isPending}
                  value={!!user.data?.isIosNotificationsEnabled}
                  onValueChange={(enabled) => push.mutate(enabled)}
                  trackColor={{ true: c.accent }}
                />
              </View>
            )}
            {user.data?.planType && user.data.planType !== "FREE" && (
              <SettingsRow
                icon={CreditCard}
                title="Manage my subscription"
                onPress={() =>
                  open("https://billing.stripe.com/p/login/eVa03Q46z6Ivchi8ww")
                }
              />
            )}
            <SettingsRow
              icon={UserPen}
              title="User Settings"
              onPress={() => setView("profile")}
            />
            <SettingsRow
              icon={GraduationCap}
              title="Coach Profile"
              onPress={() => setView("coach")}
            />
            <SettingsRow
              icon={KeyRound}
              title="Integrations & API Keys"
              onPress={() => setView("integrations")}
            />
            <SettingsRow
              icon={Paintbrush}
              title="Color Palette"
              onPress={() => setView("palette")}
            />
            <SettingsRow
              icon={Moon}
              title="Theme Mode"
              onPress={() => setView("theme")}
            />
            <SettingsRow
              icon={Play}
              title="Preview onboarding"
              onPress={() => setView("experience")}
            />
            <SettingsRow
              icon={LogOut}
              title="Logout"
              onPress={() => setConfirm("logout")}
            />
            {confirm === "logout" && (
              <>
                <Copy>Log out of this account?</Copy>
                <Button
                  danger
                  onPress={() => void auth.signOut().catch(setError)}
                >
                  Confirm logout
                </Button>
                <Button secondary onPress={() => setConfirm(null)}>
                  Cancel
                </Button>
              </>
            )}
          </>
        )}
        {view === "profile" && (
          <ProfileSettings onBusyChange={setProfileBusy} />
        )}
        {view === "theme" && (
          <ThemeModes
            selected={user.data?.themeMode}
            busy={theme.isPending}
            onSelect={(mode) =>
              theme.mutate(
                { themeMode: mode },
                { onSuccess: () => setView("main") },
              )
            }
          />
        )}
        {view === "palette" && (
          <ColorPalettes
            selected={user.data?.themeBaseColor}
            busy={theme.isPending}
            onSelect={(color) =>
              theme.mutate(
                { themeBaseColor: color },
                { onSuccess: () => setView("main") },
              )
            }
          />
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
            <SettingsCard
              icon={KeyRound}
              title="API keys"
              description="Connect Codex, Claude, or another MCP client."
              onPress={() => setView("apiKeys")}
            />
          </>
        )}
        {view === "apiKeys" && <ApiKeys />}
        {view === "appleHealth" && <HealthContent showGarmin={false} />}
        {view === "garmin" && <GarminContent />}
        {view === "coach" && <CoachProfile />}
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
            <Copy muted>
              To test signup and checkout too, sign out and use a separate test
              account.
            </Copy>
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
