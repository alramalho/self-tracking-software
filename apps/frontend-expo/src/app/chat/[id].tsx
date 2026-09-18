import { useLocalSearchParams } from "expo-router";
import { Conversation } from "@/features/messages/Conversation";
export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Conversation key={id} id={id} />;
}
