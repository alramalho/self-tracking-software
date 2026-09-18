import { goBack } from "@/core/navigation";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Button, Copy, Panel, Screen, Status } from "@/components/ui";
import { useAction } from "@/data/queries";
import { api } from "@/data/api";
import type { AppNotification } from "@/features/social/types";
export default function Notifications() {
  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: async () =>
      (await api.get<AppNotification[]>("/notifications")).data,
  });
  const read = useAction(async (id: string) =>
    api.post("/notifications/mark-notification-opened", null, {
      params: { notification_id: id },
    }),
  );
  return (
    <Screen title="Notifications">
      <Button secondary onPress={() => goBack()}>
        Back
      </Button>
      <Status
        loading={query.isPending}
        error={query.error ?? read.error}
        retry={() => void query.refetch()}
        empty={query.data?.length === 0 ? "No notifications yet." : undefined}
      />
      {query.data?.map((item) => (
        <Panel key={item.id}>
          <Copy>{item.title}</Copy>
          <Copy muted>{item.message ?? item.body}</Copy>
          {item.status !== "OPENED" && (
            <Button
              secondary
              busy={read.isPending}
              onPress={() => read.mutate(item.id)}
            >
              Mark as read
            </Button>
          )}
        </Panel>
      ))}
    </Screen>
  );
}
