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
  method: "post" | "put";
  data?: any & { photo?: SerializablePhotoInPayload };
}

const GENERIC_API_ACTION_TYPE = "GENERIC_API_CALL_V1";

// Define which endpoints support offline functionality
const OFFLINE_SUPPORTED_ENDPOINTS = ["/log-activity"];

export const useOfflineAwareApi = () => {
  const actualApi = useApiWithAuth();
  const { isOnline, addTask, registerActionHandler } = useOfflineActionQueue();

  useEffect(() => {
    const genericApiCallHandler = async (payload: QueuedApiCall) => {
      if (payload.method === "post" || payload.method === "put") {
        // Special handling for specific endpoints
        if (payload.endpoint === "/log-activity") {
          const formData = new FormData();

          // Handle photo and other fields for activity logging
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
              } else if (key !== "photo") {
                formData.append(key, String(payload.data[key]));
              }
            }
          }

          return actualApi.post(payload.endpoint, formData, { headers: {} });
        } else if (
          payload.endpoint.startsWith("/plans/") &&
          payload.endpoint.includes("/update")
        ) {
          // Handle plan updates
          return actualApi.post(payload.endpoint, payload.data, {
            headers: { "Content-Type": "application/json" },
          });
        } else if (
          [
            "/log-metric",
            "/log-todays-note",
            "/skip-metric",
            "/skip-todays-note",
          ].includes(payload.endpoint)
        ) {
          // Handle metric and note logging
          return actualApi.post(payload.endpoint, payload.data, {
            headers: { "Content-Type": "application/json" },
          });
        } else if (payload.endpoint === "/update-user") {
          // Handle user updates
          return actualApi.post(payload.endpoint, payload.data, {
            headers: { "Content-Type": "application/json" },
          });
        } else if (payload.endpoint === "/upsert-activity") {
          // Handle activity creation/updates
          return actualApi.post(payload.endpoint, payload.data, {
            headers: { "Content-Type": "application/json" },
          });
        } else {
          // Generic JSON handling for other supported endpoints
          const method = payload.method === "post" ? "post" : "put";
          return actualApi[method](payload.endpoint, payload.data, {
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      throw new Error(`Unsupported method: ${payload.method}`);
    };

    registerActionHandler(GENERIC_API_ACTION_TYPE, genericApiCallHandler);
  }, [registerActionHandler, actualApi]);

  const post = async (
    endpoint: string,
    data: any,
    config?: { headers?: Record<string, string> },
    offlineMetadata?: {
      title: string;
      successMessage: string;
      errorMessage: string;
    }
  ): Promise<any> => {
    if (isOnline) {
      return actualApi.post(endpoint, data, config);
    }

    // Check if this endpoint supports offline functionality
    const supportsOffline = OFFLINE_SUPPORTED_ENDPOINTS.some(
      (supportedEndpoint) =>
        endpoint === supportedEndpoint ||
        endpoint.startsWith(supportedEndpoint.replace(/\/[^/]*$/, "/"))
    );

    if (!supportsOffline) {
      toast.error(`This action requires an internet connection`);
      return Promise.reject({
        isOfflinePreconditionError: true,
        message: `Endpoint ${endpoint} not supported offline`,
      });
    }

    // Validate data format for offline queuing
    if (data instanceof FormData) {
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
      title: `${endpoint.split("/").pop()}`,
      successMessage: `Offline action synced successfully`,
      errorMessage: `Failed to sync offline action`,
    };

    const queuedCallPayload: QueuedApiCall = {
      endpoint,
      method: "post",
      data,
    };

    await addTask(GENERIC_API_ACTION_TYPE, queuedCallPayload, meta);
    return Promise.resolve({ data: { __queued__: true }, __queued__: true });
  };

  const put = async (
    endpoint: string,
    data: any,
    config?: { headers?: Record<string, string> },
    offlineMetadata?: {
      title: string;
      successMessage: string;
      errorMessage: string;
    }
  ): Promise<any> => {
    if (isOnline) {
      return actualApi.put(endpoint, data, config);
    }

    // Similar offline logic for PUT requests
    const supportsOffline = OFFLINE_SUPPORTED_ENDPOINTS.some(
      (supportedEndpoint) =>
        endpoint === supportedEndpoint ||
        endpoint.startsWith(supportedEndpoint.replace(/\/[^/]*$/, "/"))
    );

    if (!supportsOffline) {
      toast.error(`This action requires an internet connection`);
      return Promise.reject({
        isOfflinePreconditionError: true,
        message: `Endpoint ${endpoint} not supported offline`,
      });
    }

    const meta = offlineMetadata || {
      title: `Update ${endpoint.split("/").pop()}`,
      successMessage: `Offline update synced successfully`,
      errorMessage: `Failed to sync offline update`,
    };

    const queuedCallPayload: QueuedApiCall = {
      endpoint,
      method: "put",
      data,
    };

    await addTask(GENERIC_API_ACTION_TYPE, queuedCallPayload, meta);
    return Promise.resolve({ data: { __queued__: true }, __queued__: true });
  };

  return {
    post,
    put,
    isOnline,
    _actualApiForTesting: actualApi,
  };
};
