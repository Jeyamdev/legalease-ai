import axios from "axios";
import { api, errorMessage } from "../lawyers/api/client";
import type { LoginValues, RegisterValues } from "./schemas";

type LoginResponse = {
  token: string;
  email: string;
  role: string;
  roles: string[];
};
export async function login(values: LoginValues) {
  const { data } = await api.post<LoginResponse>("/member1/auth/login", values);
  return data;
}
export async function registerCustomer(values: RegisterValues) {
  const { fullName, email, password } = values;
  await api.post("/member1/auth/register", {
    fullName,
    email,
    password,
    role: "Customer",
  });
}
export function authError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response)
      return "Unable to connect to the server. Please try again.";
    if (error.response.status === 401) return "Invalid email or password.";
    if (error.response.data === "Email already exists")
      return "An account with this email already exists. Please sign in.";
  }
  return errorMessage(error);
}
