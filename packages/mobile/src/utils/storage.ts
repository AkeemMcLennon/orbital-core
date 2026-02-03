/**
 * Web platform storage using localStorage
 * Provides async interface matching expo-secure-store API
 */

export async function getItem(key: string): Promise<string | null> {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      console.warn('localStorage is not available');
      return null;
    }
    return window.localStorage.getItem(key);
  } catch (error) {
    console.error(`Error getting item "${key}" from storage:`, error);
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      throw new Error('localStorage is not available');
    }
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.error(`Error setting item "${key}" in storage:`, error);
    throw error;
  }
}

export async function deleteItem(key: string): Promise<void> {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      throw new Error('localStorage is not available');
    }
    window.localStorage.removeItem(key);
  } catch (error) {
    console.error(`Error deleting item "${key}" from storage:`, error);
    throw error;
  }
}
