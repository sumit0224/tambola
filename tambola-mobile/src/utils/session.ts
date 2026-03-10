import AsyncStorage from "@react-native-async-storage/async-storage";

export type SessionUser = {
  id: string;
  displayName: string;
  email?: string;
};

export type SessionData = {
  token: string;
  user: SessionUser;
};

const SESSION_KEY = "tambola.mobile.session.v1";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSession(raw: string): SessionData | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed)) {
      return null;
    }

    if (typeof parsed.token !== "string") {
      return null;
    }

    const user = parsed.user;
    if (!isObject(user)) {
      return null;
    }

    if (typeof user.id !== "string" || typeof user.displayName !== "string") {
      return null;
    }

    return {
      token: parsed.token,
      user: {
        id: user.id,
        displayName: user.displayName,
        email: typeof user.email === "string" ? user.email : undefined
      }
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionData | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  const parsed = parseSession(raw);
  if (!parsed) {
    await AsyncStorage.removeItem(SESSION_KEY);
    return null;
  }

  return parsed;
}

export async function setSession(session: SessionData): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}
