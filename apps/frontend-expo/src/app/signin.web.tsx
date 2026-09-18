import { SignIn } from "@clerk/expo/web";
import { ScrollView, View } from "react-native";
import { Welcome } from "@/auth/Welcome";
import { useColors } from "@/components/ui";
export default function SignInPage() {
  const c = useColors();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <View style={{ width: "100%", maxWidth: 448, alignItems: "center" }}>
        <Welcome />
        <SignIn routing="hash" forceRedirectUrl="/" />
      </View>
    </ScrollView>
  );
}
