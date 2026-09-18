import { api } from "@/data/api";
import { appendPhotos } from "@/native/photos";
import type { LogActivityInput, LogActivityResult } from "@/core/types";
export async function logActivity(input: LogActivityInput) {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0)
    throw new Error("Quantity must be a whole number greater than zero.");
  if (!Number.isFinite(input.datetime.getTime()) || input.datetime > new Date())
    throw new Error("Choose a valid activity date in the past.");
  const form = new FormData();
  form.append("activityId", input.activityId);
  form.append("iso_date_string", input.datetime.toISOString());
  form.append("quantity", String(input.quantity));
  form.append("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
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
      onUploadProgress: (event) => {
        if (event.total)
          input.onUploadProgress?.(
            Math.round((event.loaded * 100) / event.total),
          );
      },
    })
  ).data;
}
