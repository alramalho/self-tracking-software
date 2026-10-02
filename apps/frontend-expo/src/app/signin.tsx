import { AuthView } from "@clerk/expo/native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSession } from "@/auth/provider";
import { Welcome } from "@/auth/Welcome";
import { Status, useColors } from "@/components/ui";

export default function SignIn() {
  const c = useColors();
  const session = useSession();
  // After "Add account", closing sign-in returns to the account that was active.
  const [previous] = session.accounts;
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const returnToPrevious = () =>
    session.switchAccount(previous.userId).catch((failure) => {
      setError(failure);
      setAttempt((count) => count + 1);
    });
  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <View style={styles.form}>
        <AuthView
          key={attempt}
          mode="signInOrUp"
          isDismissible={!!previous}
          onDismiss={previous ? returnToPrevious : undefined}
          logo={<Welcome />}
        />
        <Status error={error} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center" },
  // Clerk owns scrolling, safe areas, and keyboard avoidance inside this frame.
  form: { flex: 1, width: "100%", maxWidth: 440, paddingHorizontal: 24 },
});
