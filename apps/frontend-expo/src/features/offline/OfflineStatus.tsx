import { Pressable, View } from "react-native";
import { CloudOff, RotateCw, UploadCloud, CircleAlert } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/theme";
import { useOfflineLogs } from "./provider";

export function OfflineStatus() {
  const { logs, retry, storageError } = useOfflineLogs();
  const c = useColors();
  if (!logs.length && !storageError) return null;
  const syncing = logs.some((log) => log.status === "syncing");
  const failed = !!storageError || logs.some((log) => log.status === "error");
  const Icon = failed ? CircleAlert : syncing ? UploadCloud : CloudOff;
  return (
    <View testID="offline-logs-status" style={{ padding: 16, borderRadius: 16,
      borderWidth: 1, borderColor: failed ? c.accent : c.border, backgroundColor: c.card, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Icon size={25} color={failed ? c.accent : c.muted} strokeWidth={1.8} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: c.text }}>
            {storageError ? "Saved activity storage unavailable" : failed ? "Activity needs attention" : syncing ? "Syncing activities" : "Saved on this phone"}
          </Text>
          <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>
            {storageError && !logs.length ? "Retry to read saved activities" :
              `${logs.length} ${logs.length === 1 ? "activity" : "activities"} waiting to sync`}
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Retry activity sync"
          testID="offline-retry" onPress={() => void retry()} style={{ padding: 10 }}>
          <RotateCw size={20} color={c.accent} />
        </Pressable>
      </View>
      {!!storageError && <Text style={{ color: c.text, fontSize: 12 }}>{storageError}</Text>}
      {logs.map((log) => (
        <View key={log.id} style={{ gap: 2 }}>
          <Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }}>
            {log.activityTitle} · {log.quantity} · {new Date(log.datetime).toLocaleString()}
          </Text>
          {!!log.description && <Text style={{ color: c.muted, fontSize: 12 }}>{log.description}</Text>}
          <Text style={{ color: log.status === "error" ? c.text : c.muted, fontSize: 12 }}>
            {log.status === "syncing" ? (log.entryId ? "Uploading photos" : "Syncing activity") :
              log.status === "error" ? `Needs retry${log.entryId ? " for photos" : ""}: ${log.error ?? "Could not sync"}` :
                log.error ? `Waiting to retry${log.entryId ? " photos" : ""}: ${log.error}` :
                  log.entryId ? "Photos pending" : "Pending"}
          </Text>
        </View>
      ))}
    </View>
  );
}
