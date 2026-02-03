import * as storage from '../utils/storage';

/**
 * Stores a JWT token in secure storage
 */
export async function setAuthToken(token: string): Promise<void> {
  try {
    await storage.setItem('auth_token', token);
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
    return await storage.getItem('auth_token');
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
    await storage.deleteItem('auth_token');
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
