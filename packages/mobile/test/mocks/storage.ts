/**
 * In-memory storage mock for tests.
 * Replaces the real storage module which depends on localStorage / expo-secure-store.
 */
const store = new Map<string, string>();

export async function getItem(key: string): Promise<string | null> {
  return store.get(key) ?? null;
}

export async function setItem(key: string, value: string): Promise<void> {
  store.set(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  store.delete(key);
}

/** Reset all stored values — call in beforeEach if needed */
export function __resetStorage(): void {
  store.clear();
}
