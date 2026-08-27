import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
});

type AuthTokenProvider = () => Promise<string | null>;
let authTokenProvider: AuthTokenProvider = async () => null;

export function setAuthTokenProvider(provider: AuthTokenProvider) {
  authTokenProvider = provider;
}

export function getAuthToken() {
  return authTokenProvider();
}

// Add auth interceptor ONCE globally
// This gets the fresh token on every request instead of capturing stale closures
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error("Failed to get auth token:", error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// For backwards compatibility, keep the hook but just return the api instance
export const useApiWithAuth = () => {
  return api;
};

export default api;
