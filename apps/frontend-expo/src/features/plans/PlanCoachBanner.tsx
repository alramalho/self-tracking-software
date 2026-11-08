import { Image, ImageBackground, Pressable, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { MessageCircle } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { Status } from "@/components/ui";
import { api } from "@/data/api";
import type { Chat, Coach } from "../messages/types";
import type { PlanSectionProps } from "./types";

export function PlanCoachBanner({ plan }: PlanSectionProps) {
  const client = useQueryClient();
  const coaches = useQuery({
    queryKey: ["human-coaches"],
    enabled: !!plan.coachId,
    queryFn: async () => (await api.get<Coach[]>("/coaches")).data,
  });
  const message = useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.post<{ chat: Chat }>("/chats/direct", {
        userId,
      });
      await client.invalidateQueries({ queryKey: ["chats"] });
      router.push(`/chat/${data.chat.id}`);
    },
  });
  const coach = coaches.data?.find((coach) => coach.id === plan.coachId);
  if (!coach) return null;
  const name = coach.owner.name || coach.owner.username || "Coach";
  return (
    <ImageBackground
      testID="plan-coach-banner"
      source={coach.owner.picture ? { uri: coach.owner.picture } : undefined}
      style={{ borderRadius: 16, overflow: "hidden", backgroundColor: "#111" }}
    >
      <View style={{ padding: 16, gap: 12, backgroundColor: "#0009" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {coach.owner.picture ? (
            <Image
              source={{ uri: coach.owner.picture }}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                borderWidth: 2,
                borderColor: "#fff3",
              }}
            />
          ) : (
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#fff3",
              }}
            >
              <Text style={{ color: "white", fontSize: 18 }}>{name[0]}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: "white", fontWeight: "600" }}>{name}</Text>
            {!!coach.details?.title && (
              <Text style={{ color: "#ffffffb3", fontSize: 12 }}>
                {coach.details.title}
              </Text>
            )}
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Message Coach"
          disabled={message.isPending}
          onPress={() => message.mutate(coach.ownerId)}
          style={({ pressed }) => ({
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            borderRadius: 12,
            backgroundColor: pressed ? "#ffffff4d" : "#fff3",
          })}
        >
          <MessageCircle size={16} color="white" />
          <Text style={{ color: "white", fontSize: 14, fontWeight: "500" }}>
            Message Coach
          </Text>
        </Pressable>
        <Status error={message.error} />
      </View>
    </ImageBackground>
  );
}
