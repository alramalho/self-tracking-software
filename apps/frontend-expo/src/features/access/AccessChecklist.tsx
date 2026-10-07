import { useCallback, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, View } from "react-native";
import { Bell, Check, HeartPulse, MapPin } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { useSession } from "@/auth/provider";
import { useCurrentUser } from "@/data/queries";
import { useHealth } from "@/features/health/HealthProvider";
import {
  PreviewButton,
  PreviewSheet,
} from "@/features/messages/entities/PreviewSheet";
import {
  accessTitles,
  buttonLabel,
  pendingKinds,
  shownItems,
  statusLabel,
} from "./model";
import { readStatuses, requestAccess } from "./requests";
import type {
  AccessChecklist,
  AccessKind,
  AccessRequest,
  AccessRowProps,
  AccessSheetProps,
  AccessStatuses,
} from "./types";

const icons: Record<AccessKind, LucideIcon> = {
  notifications: Bell,
  health: HeartPulse,
  location: MapPin,
};
const GREEN = "#22c55e";

// Gradual consent: each feature asks for only what it needs, at the moment the
// person turns it on, as a short checklist that ticks as iOS prompts answer.
export function useAccessChecklist(): AccessChecklist {
  const auth = useSession();
  const user = useCurrentUser(auth.isSignedIn);
  const health = useHealth();
  const [open, setOpen] = useState<{
    request: AccessRequest;
    statuses: AccessStatuses;
    resolve: (statuses: AccessStatuses) => void;
  }>();
  const context = {
    // Until the account loads, trust iOS rather than asking twice.
    notificationsEnabled: user.data ? !!user.data.isIosNotificationsEnabled : true,
    healthAvailable: health.available,
    healthEnabled: health.enabled,
  };
  const ask = useCallback(
    async (request: AccessRequest) => {
      if (Platform.OS !== "ios") return {};
      const statuses = await readStatuses(
        request.items.map((item) => item.kind),
        context,
      );
      const items = shownItems(request.items, statuses);
      if (!pendingKinds(items, statuses).length) return statuses;
      if (request.afterSheet) await new Promise((r) => setTimeout(r, 450));
      return new Promise<AccessStatuses>((resolve) =>
        setOpen({ request: { ...request, items }, statuses, resolve }),
      );
    },
    [context.notificationsEnabled, context.healthAvailable, context.healthEnabled],
  );
  return {
    ask,
    sheet: open ? (
      <AccessSheet
        request={open.request}
        initial={open.statuses}
        onRequest={(kind) =>
          requestAccess(kind, auth.userId ?? undefined, () => void health.connect())
        }
        onDone={(statuses) => {
          open.resolve(statuses);
          setOpen(undefined);
        }}
      />
    ) : null,
  };
}

function AccessSheet({ request, initial, onRequest, onDone }: AccessSheetProps) {
  const c = useColors();
  const [statuses, setStatuses] = useState(initial);
  const [asking, setAsking] = useState<AccessKind>();
  const pending = pendingKinds(request.items, statuses);
  const done = !pending.length && !asking;
  // One Continue walks through every pending iOS prompt in order.
  async function next() {
    if (done) return onDone(statuses);
    let current = statuses;
    for (const kind of pending) {
      setAsking(kind);
      const status = await onRequest(kind).catch(() => "off" as const);
      current = { ...current, [kind]: status };
      setStatuses(current);
    }
    setAsking(undefined);
  }
  return (
    <PreviewSheet
      visible
      title={request.title}
      dismissible={done}
      onClose={() => onDone(statuses)}
    >
      <View style={{ alignItems: "center", gap: 6, paddingTop: 8 }}>
        <Text
          accessibilityRole="header"
          style={{
            color: c.text,
            fontSize: 24,
            lineHeight: 30,
            fontWeight: "700",
            textAlign: "center",
            letterSpacing: -0.4,
          }}
        >
          {request.title}
        </Text>
        <Text
          style={{ color: c.muted, fontSize: 16, lineHeight: 22, textAlign: "center" }}
        >
          {request.subtitle}
        </Text>
      </View>
      <View
        style={{
          backgroundColor: c.card,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: c.inputBorder,
          paddingHorizontal: 16,
        }}
      >
        {request.items.map((item, index) => (
          <AccessRow
            key={item.kind}
            kind={item.kind}
            detail={item.detail}
            status={statuses[item.kind]}
            asking={asking === item.kind}
            first={index === 0}
          />
        ))}
      </View>
      <PreviewButton
        label={asking ? "Waiting for iOS…" : buttonLabel(request.items, statuses)}
        disabled={!!asking}
        onPress={() => void next()}
      />
      <Text style={{ color: c.muted, fontSize: 13, textAlign: "center" }}>
        You can change these anytime in Settings.
      </Text>
    </PreviewSheet>
  );
}

function AccessRow({
  kind,
  detail,
  status,
  asking,
  first,
}: AccessRowProps) {
  const c = useColors();
  const Icon = icons[kind];
  const label = statusLabel(kind, status);
  return (
    <View
      accessible
      accessibilityLabel={`${accessTitles[kind]}. ${detail}${label ? `. ${label}` : ""}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: 16,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.inputBorder,
      }}
    >
      <Icon size={30} color={c.accent} strokeWidth={1.8} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: c.text, fontSize: 17, fontWeight: "600" }}>
          {accessTitles[kind]}
        </Text>
        <Text style={{ color: c.muted, fontSize: 14, lineHeight: 19 }}>{detail}</Text>
      </View>
      {asking ? (
        <ActivityIndicator color={c.muted} />
      ) : status === "allowed" ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 999,
            backgroundColor: "rgba(34,197,94,0.14)",
          }}
        >
          <Check size={14} color={GREEN} strokeWidth={2.6} />
          <Text style={{ color: GREEN, fontSize: 13, fontWeight: "600" }}>{label}</Text>
        </View>
      ) : status === "off" ? (
        // Declined in iOS: only Settings can turn it back on.
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open Settings to turn on ${accessTitles[kind]}`}
          onPress={() => void Linking.openSettings().catch(() => {})}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 999,
            backgroundColor: c.soft,
          }}
        >
          <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600" }}>
            Off · Settings
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
