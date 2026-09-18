import { useMutation } from "@tanstack/react-query";
import { Image, View } from "react-native";
import { Button, Heading, Status } from "@/components/ui";
import { api } from "@/data/api";
import { appendPhotos, pickPhotos } from "@/native/photos";
import type { PlanBackgroundProps } from "./types";

export function PlanBackground({
  value,
  onChange,
  onBusyChange,
}: PlanBackgroundProps) {
  const upload = useMutation({
    mutationFn: async () => {
      onBusyChange(true);
      try {
        const [photo] = await pickPhotos();
        if (!photo) return;
        const form = new FormData();
        await appendPhotos(form, [photo], "image");
        const response = await api.post<{ url: string }>(
          "/plans/upload-background-image",
          form,
        );
        onChange(response.data.url);
      } finally {
        onBusyChange(false);
      }
    },
  });
  return (
    <View style={{ gap: 12 }}>
      <Heading>Background image</Heading>
      {value && (
        <Image
          accessibilityLabel="Plan background preview"
          source={{ uri: value }}
          style={{ width: "100%", height: 160, borderRadius: 16 }}
        />
      )}
      <Button secondary busy={upload.isPending} onPress={() => upload.mutate()}>
        {value ? "Change background image" : "Add background image"}
      </Button>
      {value && (
        <Button
          secondary
          disabled={upload.isPending}
          onPress={() => onChange(null)}
        >
          Remove background image
        </Button>
      )}
      <Status error={upload.error} />
    </View>
  );
}
