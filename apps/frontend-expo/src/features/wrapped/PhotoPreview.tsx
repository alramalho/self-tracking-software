import {
  Image,
  Modal,
  Pressable,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { format } from "date-fns";
import { Text } from "@/components/typography/Text";
import { photoUrl } from "./model";
import { getCountryName, timezoneToCountryCode } from "./timezoneToCountry";
import type { PhotoPreviewProps } from "./types";
export function PhotoPreview({ entry, activity, onClose }: PhotoPreviewProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const code = timezoneToCountryCode(entry?.timezone);
  return (
    <Modal
      visible={!!entry}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {entry && (
        <View
          style={{
            flex: 1,
            backgroundColor: "#000000ed",
            justifyContent: "center",
          }}
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
        >
          <Pressable
            accessibilityLabel="Dismiss memory"
            accessibilityRole="button"
            onPress={onClose}
            style={{ position: "absolute", inset: 0 }}
          />
          <View
            pointerEvents="box-none"
            style={{ gap: 12, paddingHorizontal: 16 }}
          >
            <Image
              accessibilityLabel="Wrapped memory"
              source={{ uri: photoUrl(entry) }}
              style={{ width: "100%", height: height * 0.56, borderRadius: 12 }}
              resizeMode="contain"
            />
            <Text style={{ color: "#fff", fontSize: 16 }}>
              {activity?.emoji} {entry.quantity} {activity?.measure} ·{" "}
              {format(new Date(entry.datetime), "MMM d, yyyy")}
              {code ? ` · ${getCountryName(code)}` : ""}
            </Text>
            {!!entry.description && (
              <Text style={{ color: "#ffffffb3", fontSize: 14 }}>
                {entry.description}
              </Text>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close memory"
            onPress={onClose}
            style={{
              position: "absolute",
              top: insets.top + 8,
              right: 16,
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: "#ffffff20",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={24} color="white" />
          </Pressable>
        </View>
      )}
    </Modal>
  );
}
