import { useAuth } from "@clerk/nextjs";
import axios from "axios";

export const useApiWithAuth = () => {
  const { getToken } = useAuth();

  const apiClient = axios.create({
    baseURL: `${process.env.NEXT_PUBLIC_BACKEND_URL}`,
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
