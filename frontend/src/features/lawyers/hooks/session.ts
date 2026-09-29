import { create } from "zustand";
import { authApi } from "../../../api/authApi";

function getInitialSession() {
  try {
    const admin = authApi.getCurrentAdmin();
    const staff = authApi.getCurrentStaff();
    const token = localStorage.getItem("token") || "";
    const role = admin?.role || staff?.role;
    return {
      token,
      roles: role ? [role] : [],
    };
  } catch {
    return {
      token: "",
      roles: [],
    };
  }
}

export const useSession = create<{
  token: string;
  roles: string[];
  signIn: (token: string, roles: string[]) => void;
  signOut: () => void;
}>((set) => ({
  ...getInitialSession(),
  signIn: (token, roles) => {
    localStorage.setItem("token", token);
    set({ token, roles });
  },
  signOut: () => {
    authApi.logoutAll();
    set({ token: "", roles: [] });
  },
}));

