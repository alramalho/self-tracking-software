import { useLocalSearchParams } from "expo-router";
import ProfileScreen from "@/features/profile/ProfileScreen";

// Someone's profile above the tabs; see openProfile.
export default function UserProfile() {
  const { username } = useLocalSearchParams<{ username: string }>();
  return <ProfileScreen username={username} />;
}
