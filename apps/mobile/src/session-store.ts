import * as SecureStore from "expo-secure-store";

const SESSION_KEY = "radio.active-session.v1";

export interface StoredSession {
  domain: string;
  sessionId: string;
  userId: string;
  token: string;
}

export async function loadStoredSession(): Promise<StoredSession | null> {
  const value = await SecureStore.getItemAsync(SESSION_KEY);
  if (!value) return null;
  try {
    const session = JSON.parse(value) as Partial<StoredSession>;
    if ([session.domain, session.sessionId, session.userId, session.token].every((item) => typeof item === "string" && item.length > 0)) {
      return session as StoredSession;
    }
  } catch {
    // Corrupt local state is discarded below.
  }
  await clearStoredSession();
  return null;
}

export async function saveStoredSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearStoredSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

