import * as SecureStore from 'expo-secure-store';

/**
 * Stores a JWT token in secure storage
 */
export async function setAuthToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync('auth_token', token);
  } catch (error) {
    console.error('Error storing auth token:', error);
    throw error;
  }
}

/**
 * Retrieves the stored JWT token
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync('auth_token');
  } catch (error) {
    console.error('Error retrieving auth token:', error);
    return null;
  }
}

/**
 * Clears the stored JWT token (logout)
 */
export async function clearAuthToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync('auth_token');
  } catch (error) {
    console.error('Error clearing auth token:', error);
    throw error;
  }
}

/**
 * Checks if an auth token is currently stored
 */
export async function hasAuthToken(): Promise<boolean> {
  const token = await getAuthToken();
  return token !== null && token.length > 0;
}
