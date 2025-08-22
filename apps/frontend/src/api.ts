import axios from "axios";
import { useAuth } from "@clerk/nextjs";

export const useApiWithAuth = () => {
  const { getToken } = useAuth();

  const apiClient = axios.create({
    baseURL: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api`,
  });

  apiClient.interceptors.request.use(async (config) => {
    const token = await getToken();
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  });

  return apiClient;
};
