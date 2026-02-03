import * as SecureStore from 'expo-secure-store';

/**
 * Native platform storage using expo-secure-store
 * Provides secure encrypted storage on iOS and Android
 */

export async function getItem(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    console.error(`Error getting item "${key}" from storage:`, error);
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (error) {
    console.error(`Error setting item "${key}" in storage:`, error);
    throw error;
  }
}

export async function deleteItem(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    console.error(`Error deleting item "${key}" from storage:`, error);
    throw error;
  }
}
