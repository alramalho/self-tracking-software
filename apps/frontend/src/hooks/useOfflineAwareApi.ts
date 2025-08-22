"use client";

import { useEffect } from "react";
import { useApiWithAuth } from "@/api";
import { useOfflineActionQueue } from "./useOfflineActionQueue";
import { toast } from "react-hot-toast";

interface SerializablePhotoInPayload {
  buffer: ArrayBuffer;
  name: string;
  type: string;
}

interface QueuedApiCall {
  endpoint: string;
  method: "post";
  data?: any & { photo?: SerializablePhotoInPayload };
  // Headers are removed from here; they will be determined by the handler based on endpoint needs
}

const GENERIC_API_ACTION_TYPE = "GENERIC_API_CALL_V1";

export const useOfflineAwareApi = () => {
  const actualApi = useApiWithAuth();
  const { isOnline, addTask, registerActionHandler } = useOfflineActionQueue();

  useEffect(() => {
    const genericApiCallHandler = async (payload: QueuedApiCall) => {
      if (payload.method === "post") {
        // For /log-activity, we ALWAYS send FormData as per backend/routers/activities.py
        if (payload.endpoint === "/log-activity") {
          const formData = new FormData();
          let hasPhoto = false;

          // Append all fields from payload.data to formData
          // Handle the photo field specifically if it exists
          for (const key in payload.data) {
            if (payload.data.hasOwnProperty(key)) {
              if (
                key === "photo" &&
                payload.data.photo &&
                payload.data.photo.buffer instanceof ArrayBuffer
              ) {
                const photoData = payload.data
                  .photo as SerializablePhotoInPayload;
                const photoFile = new File([photoData.buffer], photoData.name, {
                  type: photoData.type,
                });
                formData.append("photo", photoFile);
                hasPhoto = true;
              } else if (key !== "photo") {
                // Append other non-photo data
                // FastAPI Form fields are expected as strings, ensure conversion for numbers/booleans if not already string
                formData.append(key, String(payload.data[key]));
              }
            }
          }

          // Ensure required fields for /log-activity are present, even if null/undefined from original payload
          // as FastAPI Form fields expect them. ActivityPhotoUploader should ensure these are in payload.data.
          // Example: description might be null but should be sent if backend expects it.
          // If payload.data.description is undefined, formData.append('description', 'undefined') or similar if needed.
          // For now, we assume payload.data contains all necessary fields correctly stringified by ActivityPhotoUploader.

          return actualApi.post(payload.endpoint, formData, { headers: {} }); // Let browser set Content-Type for FormData
        } else {
          // For other endpoints, if we support them in the future, we might send JSON
          // This part would need more sophisticated Content-Type handling based on endpoint
          console.warn(
            `Endpoint ${payload.endpoint} not explicitly handled for content type in genericApiCallHandler. Assuming JSON.`
          );
          return actualApi.post(payload.endpoint, payload.data, {
            headers: { "Content-Type": "application/json" },
          });
        }
      }
      console.error(
        `Unsupported method in genericApiCallHandler: ${payload.method}`
      );
      throw new Error(`Unsupported method: ${payload.method}`);
    };

    registerActionHandler(GENERIC_API_ACTION_TYPE, genericApiCallHandler);
  }, [registerActionHandler]);

  const post = async (
    endpoint: string,
    data: any,
    config?: { headers?: Record<string, string> }, // config.headers are for an ONLINE JSON call
    offlineMetadata?: {
      title: string;
      successMessage: string;
      errorMessage: string;
    }
  ): Promise<any> => {
    if (isOnline) {
      return actualApi.post(endpoint, data, config); // Online: pass data (JSON or FormData) and config as is
    }

    // ---- OFFLINE PATH ----
    // Data received here from ActivityPhotoUploader is expected to be a plain object,
    // potentially with data.photo = { buffer, name, type } for offline photo storage.

    if (data instanceof FormData) {
      // This should ideally not be hit if calling components prepare data as plain objects for offline.
      toast.error(
        "Offline error: FormData cannot be directly queued. Data was not prepared for offline submission."
      );
      return Promise.reject({
        isOfflinePreconditionError: true,
        message:
          "FormData was passed to offline API post. Prepare as plain object with file ArrayBuffer for offline.",
      });
    }

    const meta = offlineMetadata || {
      title: `Request to ${endpoint.split("/").pop()}`,
      successMessage: `Offline request to ${endpoint.split("/").pop()} synced.`,
      errorMessage: `Failed to sync offline request to ${endpoint
        .split("/")
        .pop()}.`,
    };

    // When queueing, we don't store the original headers from the `config` argument
    // because the genericApiCallHandler will determine the correct headers/content-type
    // (e.g., always FormData for /log-activity).
    const queuedCallPayload: QueuedApiCall = {
      endpoint,
      method: "post",
      data, // This is the plain object, possibly with data.photo.buffer
      // headers field removed from QueuedApiCall for now, or set by handler
    };

    await addTask(GENERIC_API_ACTION_TYPE, queuedCallPayload, meta);
    return Promise.resolve({ data: { __queued__: true }, __queued__: true });
  };

  return {
    post,
    isOnline,
    _actualApiForTesting: actualApi,
  };
};
