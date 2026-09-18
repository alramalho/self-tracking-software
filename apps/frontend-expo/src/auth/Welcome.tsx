import { Image, StyleSheet, View } from "react-native";

/** Compact app identity; Clerk supplies the sign-in heading and instructions. */
export function Welcome() {
  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/icon.png")}
        accessibilityLabel="tracking.so"
        accessibilityRole="image"
        style={styles.icon}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", paddingVertical: 20 },
  icon: { width: 80, height: 80, borderRadius: 20 },
});
