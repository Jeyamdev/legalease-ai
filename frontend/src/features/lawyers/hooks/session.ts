import { create } from "zustand";
// Keep bearer tokens in memory; refreshing requires signing in again.
export const useSession = create<{
  token: string;
  roles: string[];
  signIn: (token: string, roles: string[]) => void;
  signOut: () => void;
}>((set) => ({
  token: "",
  roles: [],
  signIn: (token, roles) => set({ token, roles }),
  signOut: () => set({ token: "", roles: [] }),
}));
