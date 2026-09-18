import { useState } from "react";
import { Image, View } from "react-native";
import { Button, Field, Sheet, Status, s } from "@/components/ui";
import { api } from "@/data/api";
import { useAction } from "@/data/queries";
import { appendPhotos, pickPhotos } from "@/native/photos";
import type { Photo } from "@/core/types";
import type { AchievementEditorProps } from "./types";

export function AchievementEditor({ post, onClose }: AchievementEditorProps) {
  const [message, setMessage] = useState(post.message ?? "");
  const [images, setImages] = useState(post.images ?? []);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [photoError, setPhotoError] = useState<unknown>();
  const save = useAction(async () => {
    const form = new FormData();
    form.append("message", message.trim());
    form.append(
      "imageIdsToKeep",
      JSON.stringify(images.map((image) => image.id)),
    );
    await appendPhotos(form, photos);
    await api.patch(`/achievements/${post.id}`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  });
  const remove = useAction(async () => api.delete(`/achievements/${post.id}`));
  const busy = save.isPending || remove.isPending;
  return (
    <Sheet
      visible
      title="Edit achievement post"
      onClose={() => !busy && onClose()}
    >
      <Field
        label="Message"
        multiline
        value={message}
        onChangeText={setMessage}
      />
      <View style={s.wrap}>
        {images.map((image) => (
          <View key={image.id}>
            <Image
              source={{ uri: image.url }}
              style={{ width: 100, height: 100, borderRadius: 12 }}
            />
            <Button
              secondary
              onPress={() =>
                setImages((current) =>
                  current.filter((value) => value.id !== image.id),
                )
              }
            >
              Remove photo
            </Button>
          </View>
        ))}
        {photos.map((photo) => (
          <View key={photo.uri}>
            <Image
              source={{ uri: photo.uri }}
              style={{ width: 100, height: 100, borderRadius: 12 }}
            />
            <Button secondary onPress={() => setPhotos([])}>
              Remove new photo
            </Button>
          </View>
        ))}
      </View>
      <Button
        secondary
        disabled={busy}
        onPress={async () => {
          try {
            setPhotoError(undefined);
            const picked = await pickPhotos();
            if (picked.length) {
              setImages([]);
              setPhotos(picked.slice(0, 1));
            }
          } catch (error) {
            setPhotoError(error);
          }
        }}
      >
        Choose photo
      </Button>
      <Button
        busy={save.isPending}
        disabled={busy}
        onPress={() => save.mutate(undefined, { onSuccess: onClose })}
      >
        Save Changes
      </Button>
      <Button secondary disabled={busy} onPress={() => setConfirmDelete(true)}>
        Delete Achievement Post
      </Button>
      {confirmDelete && (
        <Button
          busy={remove.isPending}
          disabled={busy}
          onPress={() => remove.mutate(undefined, { onSuccess: onClose })}
        >
          Confirm Delete
        </Button>
      )}
      <Status error={save.error ?? remove.error ?? photoError} />
    </Sheet>
  );
}
