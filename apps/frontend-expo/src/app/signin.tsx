import { AuthView } from "@clerk/expo/native";
import { StyleSheet, View } from "react-native";
import { Welcome } from "@/auth/Welcome";
import { useColors } from "@/components/ui";

export default function SignIn() {
  const c = useColors();
  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <View style={styles.form}>
        <AuthView mode="signInOrUp" isDismissible={false} logo={<Welcome />} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center" },
  // Clerk owns scrolling, safe areas, and keyboard avoidance inside this frame.
  form: { flex: 1, width: "100%", maxWidth: 440, paddingHorizontal: 24 },
});
