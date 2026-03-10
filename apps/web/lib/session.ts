export type ClientSession = {
  userId: string;
  displayName: string;
  token: string;
};

const SESSION_KEY = "tambola.session.v1";
const TOKEN_COOKIE = "tambola_token";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSession(raw: string): ClientSession | null {
  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!isObject(parsed)) {
      return null;
    }

    const userId = typeof parsed.userId === "string" ? parsed.userId : null;
    const displayName = typeof parsed.displayName === "string" ? parsed.displayName : null;
    const token = typeof parsed.token === "string" ? parsed.token : null;

    if (!userId || !displayName || !token) {
      return null;
    }

    return {
      userId,
      displayName,
      token
    };
  } catch {
    return null;
  }
}

function writeAuthCookie(token: string): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=604800; SameSite=Lax`;
}

function clearAuthCookie(): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function getSession(): ClientSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  const session = parseSession(raw);
  if (!session) {
    window.localStorage.removeItem(SESSION_KEY);
    clearAuthCookie();
    return null;
  }

  return session;
}

export function setSession(session: ClientSession): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  writeAuthCookie(session.token);
}

export function clearSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SESSION_KEY);
  clearAuthCookie();
}

export function isAuthenticated(): boolean {
  return getSession() !== null;
}

export const saveSession = setSession;
