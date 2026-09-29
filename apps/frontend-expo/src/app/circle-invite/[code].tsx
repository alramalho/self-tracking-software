import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { IconButton, Screen, Status } from "@/components/ui";
import { goBack } from "@/core/navigation";
import { useInvite } from "@/features/circles/api";
import { CircleCardView } from "@/features/circles/components";
import { JoinSheet } from "@/features/circles/JoinSheet";
import { useState } from "react";

// Opened from a friend's invite link.
export default function CircleInvite() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const invite = useInvite(code);
  const [open, setOpen] = useState(true);
  return (
    <Screen title="Circle invite" leading={<IconButton label="Back" icon={ChevronLeft} onPress={goBack} />}>
      <Status loading={invite.isLoading} error={invite.error} retry={() => void invite.refetch()} />
      {invite.data && <CircleCardView card={invite.data} onPress={() => setOpen(true)} />}
      <JoinSheet
        card={open ? invite.data ?? null : null}
        inviteCode={code}
        onClose={() => setOpen(false)}
        onJoined={(id) => router.replace(`/circle/${id}?proof=1` as never)}
      />
    </Screen>
  );
}
