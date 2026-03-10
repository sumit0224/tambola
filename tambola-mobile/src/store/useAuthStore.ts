import { create } from "zustand";
import { registerApi, loginApi, type AuthUser } from "../services/api";
import { connectSocket, disconnectSocket } from "../services/socket";
import { clearSession, getSession, setSession } from "../utils/session";
import { useGameStore } from "./useGameStore";

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  hydrating: boolean;
  login: (input: { email: string; password: string }) => Promise<void>;
  register: (input: { email: string; displayName: string; password: string }) => Promise<void>;
  hydrate: () => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  hydrating: true,

  async hydrate() {
    set({ hydrating: true });

    const session = await getSession();
    if (!session) {
      set({ token: null, user: null, hydrating: false });
      return;
    }

    connectSocket(session.token, session.user.displayName);
    set({ token: session.token, user: session.user, hydrating: false });
  },

  async login(input) {
    const response = await loginApi(input);

    await setSession({ token: response.token, user: response.user });
    connectSocket(response.token, response.user.displayName);

    set({ token: response.token, user: response.user, hydrating: false });
  },

  async register(input) {
    const response = await registerApi(input);

    const user: AuthUser = {
      id: response.userId,
      displayName: input.displayName,
      email: input.email
    };

    await setSession({ token: response.token, user });
    connectSocket(response.token, user.displayName);

    set({ token: response.token, user, hydrating: false });
  },

  async logout() {
    disconnectSocket();
    useGameStore.getState().resetRoom();
    await clearSession();
    set({ token: null, user: null, hydrating: false });
  }
}));
