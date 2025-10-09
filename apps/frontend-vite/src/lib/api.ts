import axios from "axios";
import { useAuth } from "@/contexts/auth";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Custom hook for authenticated API calls
export const useApiWithAuth = () => {
  const { getToken } = useAuth();

  // Add auth interceptor
  api.interceptors.request.use(
    async (config) => {
      try {
        const token = await getToken();
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

  return api;
};

export default api;
