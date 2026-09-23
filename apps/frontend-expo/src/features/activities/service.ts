import { api } from "@/data/api";
import { appendPhotos } from "@/native/photos";
import type { ActivityEntry, LogActivityInput, LogActivityResult, Photo } from "@/core/types";
export function validateLogActivity(input: LogActivityInput) {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0)
    throw new Error("Quantity must be a whole number greater than zero.");
  if (!Number.isFinite(input.datetime.getTime()) || input.datetime > new Date())
    throw new Error("Choose a valid activity date in the past.");
}

export async function uploadActivityPhotos(entryId: string, photos: Photo[], clientRequestId: string) {
  const form = new FormData();
  form.append("clientRequestId", clientRequestId);
  await appendPhotos(form, photos);
  return (await api.put<ActivityEntry>(`/activities/activity-entries/${entryId}/photo`, form, {
    timeout: 15000,
  })).data;
}

export async function logActivity(input: LogActivityInput, options?: { timeout: number }) {
  validateLogActivity(input);
  const form = new FormData();
  form.append("activityId", input.activityId);
  form.append("iso_date_string", input.datetime.toISOString());
  form.append("quantity", String(input.quantity));
  form.append("timezone", input.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  if (input.clientRequestId) form.append("clientRequestId", input.clientRequestId);
  form.append("description", input.description ?? "");
  if (input.privateNotes !== undefined)
    form.append("privateNotes", input.privateNotes);
  if (input.withUserId) form.append("withUserId", input.withUserId);
  if (input.latitude != null && input.longitude != null) {
    form.append("latitude", String(input.latitude));
    form.append("longitude", String(input.longitude));
  }
  await appendPhotos(form, input.photos ?? []);
  return (
    await api.post<LogActivityResult>("/activities/log-activity", form, {
      timeout: options?.timeout,
      onUploadProgress: (event) => {
        if (event.total)
          input.onUploadProgress?.(
            Math.round((event.loaded * 100) / event.total),
          );
      },
    })
  ).data;
}
