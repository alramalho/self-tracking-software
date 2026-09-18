import { useLocalSearchParams } from "expo-router";
import ProfileScreen from "@/features/profile/ProfileScreen";

export default function Profile() {
  const { username } = useLocalSearchParams<{ username: string }>();
  return <ProfileScreen username={username} />;
}
