import axios, { AxiosError } from "axios";

export type ClaimType = "TOP_ROW" | "MIDDLE_ROW" | "BOTTOM_ROW" | "EARLY_FIVE" | "FULL_HOUSE";

export type AuthUser = {
  id: string;
  displayName: string;
  email?: string;
};

export type RoomPlayer = {
  userId: string;
  displayName: string;
};

export type WinnerEntry = {
  claimType: ClaimType;
  winner: {
    userId: string;
    displayName: string;
  };
};

const authBaseURL = process.env.EXPO_PUBLIC_AUTH_BASE_URL ?? "http://localhost:3001/v1";
const gameBaseURL = process.env.EXPO_PUBLIC_GAME_BASE_URL ?? "http://localhost:3003/v1";

const authApi = axios.create({
  baseURL: authBaseURL,
  timeout: 10_000,
  headers: { "Content-Type": "application/json" }
});

const gameApi = axios.create({
  baseURL: gameBaseURL,
  timeout: 10_000,
  headers: { "Content-Type": "application/json" }
});

export function withAuth(token: string, displayName?: string, userId?: string) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(displayName ? { "x-display-name": displayName } : {}),
      ...(userId ? { "x-user-id": userId } : {})
    }
  };
}

function parseApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ error?: string; reason?: string; message?: string }>;
    const errorCode = axiosError.response?.data?.error;
    const reason = axiosError.response?.data?.reason;
    const message = axiosError.response?.data?.message;

    if (errorCode && reason) {
      return `${errorCode}: ${reason}`;
    }

    if (errorCode) {
      return errorCode;
    }

    if (message) {
      return message;
    }

    if (axiosError.message) {
      return axiosError.message;
    }
  }

  return "Something went wrong. Please try again.";
}

async function withFallback<T>(primary: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
  try {
    return await primary();
  } catch (error) {
    if (!fallback || !axios.isAxiosError(error) || error.response?.status !== 404) {
      throw error;
    }

    return fallback();
  }
}

export async function loginApi(input: { email: string; password: string }) {
  try {
    const response = await authApi.post<{
      token: string;
      refreshToken: string;
      user: AuthUser;
    }>("/auth/login", input);

    return response.data;
  } catch (error) {
    throw new Error(parseApiError(error));
  }
}

export async function registerApi(input: { email: string; displayName: string; password: string }) {
  try {
    const response = await authApi.post<{
      token: string;
      refreshToken: string;
      userId: string;
    }>("/auth/register", input);

    return response.data;
  } catch (error) {
    throw new Error(parseApiError(error));
  }
}

export async function createRoomApi(
  token: string,
  input: { maxPlayers: number; callInterval: number; prizes: ClaimType[] },
  user: AuthUser
) {
  try {
    const data = await withFallback(
      () =>
        gameApi
          .post<{ roomId: string; roomCode: string; status: string }>(
            "/rooms",
            input,
            withAuth(token, user.displayName, user.id)
          )
          .then((res) => res.data),
      () =>
        gameApi
          .post<{ roomId: string; roomCode: string; status: string }>(
            "/rooms/create",
            input,
            withAuth(token, user.displayName, user.id)
          )
          .then((res) => res.data)
    );

    return data;
  } catch (error) {
    throw new Error(parseApiError(error));
  }
}

export async function joinRoomApi(token: string, roomCode: string, user: AuthUser) {
  try {
    const response = await gameApi.post<{ roomId: string; status: string; playerCount: number }>(
      "/rooms/join",
      { roomCode },
      withAuth(token, user.displayName, user.id)
    );

    return response.data;
  } catch (error) {
    throw new Error(parseApiError(error));
  }
}

export async function getRoomStateApi(token: string, roomId: string) {
  try {
    return await withFallback(
      () =>
        gameApi
          .get<{
            status: "LOBBY" | "ACTIVE" | "ENDED";
            calledNumbers: number[];
            callIndex: number;
            winners: WinnerEntry[];
          }>(`/rooms/${roomId}/state`, withAuth(token))
          .then((res) => res.data),
      () =>
        gameApi
          .get<{
            status: "LOBBY" | "ACTIVE" | "ENDED";
            calledNumbers?: number[];
            winners?: WinnerEntry[];
            players?: RoomPlayer[];
          }>(`/rooms/${roomId}`, withAuth(token))
          .then((res) => ({
            status: res.data.status,
            calledNumbers: res.data.calledNumbers ?? [],
            callIndex: (res.data.calledNumbers ?? []).length,
            winners: res.data.winners ?? []
          }))
    );
  } catch (error) {
    throw new Error(parseApiError(error));
  }
}

export async function getTicketApi(token: string, roomId: string, user: AuthUser) {
  try {
    const response = await gameApi.get<{ ticketId: string; grid: (number | null)[][] }>(
      `/rooms/${roomId}/ticket`,
      withAuth(token, user.displayName, user.id)
    );

    return response.data;
  } catch (error) {
    throw new Error(parseApiError(error));
  }
}

export async function startGameApi(token: string, roomId: string, user: AuthUser) {
  try {
    return await withFallback(
      () =>
        gameApi
          .post<{ startedAt: string; totalPlayers: number }>(
            `/rooms/${roomId}/start`,
            undefined,
            withAuth(token, user.displayName, user.id)
          )
          .then((res) => res.data),
      () =>
        gameApi
          .post<{ startedAt: string; totalPlayers: number }>(
            "/rooms/start",
            { roomId },
            withAuth(token, user.displayName, user.id)
          )
          .then((res) => res.data)
    );
  } catch (error) {
    throw new Error(parseApiError(error));
  }
}

export async function submitClaimApi(token: string, roomId: string, claimType: ClaimType, user: AuthUser) {
  try {
    return await withFallback(
      () =>
        gameApi
          .post<{ status: "VALID"; prize: ClaimType; winner: { userId: string; displayName: string } }>(
            `/rooms/${roomId}/claim`,
            { claimType },
            withAuth(token, user.displayName, user.id)
          )
          .then((res) => res.data),
      () =>
        gameApi
          .post<{ status: "VALID"; prize: ClaimType; winner: { userId: string; displayName: string } }>(
            "/claim",
            { roomId, claimType },
            withAuth(token, user.displayName, user.id)
          )
          .then((res) => res.data)
    );
  } catch (error) {
    throw new Error(parseApiError(error));
  }
}

export function formatApiError(error: unknown): string {
  return parseApiError(error);
}
