import axios from "axios";
import { API_BASE_URL } from "../../../api/apiClient";
import { useSession } from "../hooks/session";
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || `${API_BASE_URL.replace(/\/$/, "")}/api`,
  timeout: 15000,
});
api.interceptors.request.use((config) => {
  const token = useSession.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) useSession.getState().signOut();
    return Promise.reject(error);
  },
);
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data?.errors) return Object.values(data.errors).flat().join(" ");
    if (typeof data === "string") return data;
    return (
      data?.title ||
      (error.response?.status === 403
        ? "Administrator access is required."
        : "Unable to complete the request. Check your connection and try again.")
    );
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}
