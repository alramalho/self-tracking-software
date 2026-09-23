import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import type { Photo } from "@/core/types";
import type { QueuedLog } from "./types";

export const queueKey = (userId: string) => `trackingso:offline-logs:v1:${userId}`;

export async function readQueue(userId: string): Promise<QueuedLog[]> {
  const raw = await AsyncStorage.getItem(queueKey(userId));
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error("Saved activity queue is unreadable. Please keep this app installed and contact support.");
  if (!value.every((item): item is QueuedLog =>
    item && typeof item.id === "string" && typeof item.activityId === "string" &&
    typeof item.datetime === "string" && Number.isInteger(item.quantity) &&
    Array.isArray(item.photos)))
    throw new Error("Saved activity queue is unreadable. Please keep this app installed and contact support.");
  return value.map((item) => ({ ...item, status: item.status === "error" ? "error" : "pending" }));
}

export async function writeQueue(userId: string, logs: QueuedLog[]) {
  await AsyncStorage.setItem(queueKey(userId), JSON.stringify(logs));
}

// Picker cache files may disappear after a restart. Copy selected photos to
// Documents before acknowledging that the log was saved locally.
export async function stagePhotos(id: string, photos: Photo[]): Promise<Photo[]> {
  if (!photos.length) return [];
  const base = `${FileSystem.documentDirectory}offline-logs/${id}/`;
  await FileSystem.makeDirectoryAsync(base, { intermediates: true });
  try {
    return await Promise.all(photos.map(async (photo, index) => {
      const extension = photo.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "jpg";
      const uri = `${base}${index}.${extension}`;
      await FileSystem.copyAsync({ from: photo.uri, to: uri });
      return { uri, name: photo.name, type: photo.type };
    }));
  } catch (error) {
    await FileSystem.deleteAsync(base, { idempotent: true });
    throw error;
  }
}

export async function removeStagedPhotos(id: string) {
  await FileSystem.deleteAsync(`${FileSystem.documentDirectory}offline-logs/${id}/`, { idempotent: true });
}
