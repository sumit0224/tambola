import type { ClaimType } from "../types/game";
import type { ClientSession } from "./session";

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010").replace(/\/$/, "");
const apiV1Url = `${apiBaseUrl}/v1`;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const hasBody = init?.body !== undefined && init?.body !== null;

  if (hasBody && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(url, {
    ...init,
    headers
  });

  const text = await response.text();
  let payload: Record<string, unknown> = {};

  if (text) {
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    const error = payload.error ? String(payload.error) : `HTTP_${response.status}`;
    const reason = payload.reason ? `: ${String(payload.reason)}` : "";
    throw new Error(`${error}${reason}`);
  }

  return payload as T;
}

function authHeaders(session: ClientSession): Record<string, string> {
  return {
    authorization: `Bearer ${session.token}`
  };
}

export type AuthResponse = {
  token: string;
  refreshToken: string;
  user?: {
    id: string;
    email: string;
    displayName: string;
  };
  userId?: string;
};

export async function registerUser(input: {
  email: string;
  displayName: string;
  password: string;
}): Promise<AuthResponse> {
  return request<AuthResponse>(`${apiV1Url}/auth/register`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function loginUser(input: { email: string; password: string }): Promise<AuthResponse> {
  return request<AuthResponse>(`${apiV1Url}/auth/login`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export type RoomResponse = {
  roomId: string;
  roomCode: string;
  status: "LOBBY" | "ACTIVE" | "ENDED";
};

export async function createRoom(
  session: ClientSession,
  input: { maxPlayers: number; callInterval: number; prizes: ClaimType[] }
): Promise<RoomResponse> {
  return request<RoomResponse>(`${apiV1Url}/rooms`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(input)
  });
}

export async function joinRoom(
  session: ClientSession,
  roomCode: string
): Promise<{ roomId: string; status: string; playerCount: number }> {
  return request<{ roomId: string; status: string; playerCount: number }>(`${apiV1Url}/rooms/join`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify({ roomCode })
  });
}

export async function startGame(
  session: ClientSession,
  roomId: string
): Promise<{ startedAt: string; totalPlayers: number }> {
  return request<{ startedAt: string; totalPlayers: number }>(`${apiV1Url}/rooms/${roomId}/start`, {
    method: "POST",
    headers: authHeaders(session)
  });
}

export async function getMyTicket(
  session: ClientSession,
  roomId: string
): Promise<{ ticketId: string; grid: (number | null)[][] }> {
  return request<{ ticketId: string; grid: (number | null)[][] }>(`${apiV1Url}/rooms/${roomId}/ticket`, {
    method: "GET",
    headers: authHeaders(session)
  });
}

export async function claimPrize(
  session: ClientSession,
  roomId: string,
  claimType: ClaimType
): Promise<{ status: "VALID"; prize: ClaimType; winner: { userId: string; displayName: string } }> {
  return request<{ status: "VALID"; prize: ClaimType; winner: { userId: string; displayName: string } }>(
    `${apiV1Url}/rooms/${roomId}/claim`,
    {
      method: "POST",
      headers: authHeaders(session),
      body: JSON.stringify({ claimType })
    }
  );
}

export async function getRoomState(roomId: string): Promise<{
  status: "LOBBY" | "ACTIVE" | "ENDED";
  calledNumbers: number[];
  callIndex: number;
  winners: Array<{ claimType: ClaimType; winner: { userId: string; displayName: string } }>;
}> {
  return request<{
    status: "LOBBY" | "ACTIVE" | "ENDED";
    calledNumbers: number[];
    callIndex: number;
    winners: Array<{ claimType: ClaimType; winner: { userId: string; displayName: string } }>;
  }>(`${apiV1Url}/rooms/${roomId}/state`, {
    method: "GET"
  });
}
