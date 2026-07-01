/**
 * Ensure a local file reference carries a URI scheme. expo-share-intent hands
 * back bare filesystem paths, but expo-file-system and `fetch` both require a
 * scheme. Anything already schemed (file://, content://, http(s)://, data:) is
 * returned unchanged.
 */
export function toFileUri(uri: string): string {
  return /^[a-z][a-z0-9+.-]*:/i.test(uri) ? uri : `file://${uri}`;
}
