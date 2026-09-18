import axios from "axios";
import Constants from "expo-constants";
import { Platform } from "react-native";
export const backendUrl: string =
  Constants.expoConfig?.extra?.backendUrl || "http://localhost:3000";
export const api = axios.create({ baseURL: backendUrl, timeout: 120000 });
let tokenProvider: () => Promise<string | null> = async () => null;
export function setTokenProvider(provider: typeof tokenProvider) {
  tokenProvider = provider;
}
export const getAuthToken = () => tokenProvider();
api.interceptors.request.use(async (config) => {
  // Axios otherwise defaults native FormData POSTs to urlencoded. React Native
  // supplies the multipart boundary when given the correct media type.
  if (Platform.OS !== "web" && config.data instanceof FormData)
    config.headers.setContentType("multipart/form-data");
  const token = await tokenProvider();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.error ?? error.response?.data?.message;
    if (typeof detail === "string") return detail;
    if (detail && typeof detail.message === "string") return detail.message;
    return error.response
      ? `Request failed (${error.response.status}). Please try again.`
      : "Unable to reach the server. Check your connection and try again.";
  }
  if (
    error &&
    typeof error === "object" &&
    "errors" in error &&
    Array.isArray(error.errors)
  ) {
    const detail = error.errors[0]?.longMessage ?? error.errors[0]?.message;
    if (typeof detail === "string") return detail;
  }
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
