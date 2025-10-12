import axios from "axios";
import { supabase } from "@/services/supabase";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Add auth interceptor ONCE globally
// This gets the fresh token on every request instead of capturing stale closures
api.interceptors.request.use(
  async (config) => {
    try {
      // Get the current session directly from Supabase (always fresh)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
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
