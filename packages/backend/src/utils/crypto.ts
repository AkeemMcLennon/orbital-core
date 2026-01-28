import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { settings } from "../config";

/**
 * Encryption service for protecting sensitive data at rest (OAuth tokens, API keys)
 * Uses AES-256-GCM (Authenticated Encryption with Associated Data)
 */
class CryptoService {
  private key: Buffer | null = null;
  private readonly algorithm = "aes-256-gcm";

  /**
   * Initialize encryption service.
   * Key can be passed directly, or it will lazy-load from settings.
   */
  constructor(encryptionKey?: string) {
    if (encryptionKey) {
      this.setKey(encryptionKey);
    }
  }

  /**
   * Set or update the encryption key
   * @param encryptionKey - 32-byte base64url-encoded secret
   */
  setKey(encryptionKey: string): void {
    const base64 = encryptionKey.replace(/-/g, "+").replace(/_/g, "/");
    this.key = Buffer.from(base64, "base64");
    if (this.key.length !== 32) {
      throw new Error("Encryption key must be exactly 32 bytes (256 bits)");
    }
  }

  /**
   * Ensure the encryption key is initialized from settings if not already set
   */
  private ensureInitialized(): void {
    if (!this.key) {
      const keyEnv = settings.DB_ENCRYPTION_KEY;
      if (!keyEnv) {
        throw new Error(
          "Encryption key not initialized. Set DB_ENCRYPTION_KEY environment variable.",
        );
      }
      this.setKey(keyEnv);
    }
  }

  /**
   * Encrypt plaintext using AES-256-GCM
   * @param plaintext - The text to encrypt
   * @param context - Optional identifier (e.g., UserId) to bind to this ciphertext to prevent substitution attacks
   * @returns Encrypted token as base64url string
   */
  encrypt(plaintext: string, context?: string): string {
    this.ensureInitialized();

    const iv = randomBytes(12); // 96-bit IV recommended for GCM
    const cipher = createCipheriv(this.algorithm, this.key!, iv);

    // Bind the context to the encryption tag (AAD)
    if (context) {
      cipher.setAAD(Buffer.from(context, "utf8"));
    }

    const encryptedBuffer = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    // Combine IV (12) + encrypted data + auth tag (16)
    const combined = Buffer.concat([iv, encryptedBuffer, authTag]);
    return this.toBase64Url(combined);
  }

  /**
   * Decrypt AES-256-GCM token
   * @param token - Encrypted token as base64url string
   * @param context - Optional identifier that was used during encryption
   * @returns Decrypted plaintext
   */
  decrypt(token: string, context?: string): string {
    this.ensureInitialized();

    let combined: Buffer;
    try {
      combined = this.fromBase64Url(token);
    } catch (err) {
      throw new Error("Decryption failed: Invalid format");
    }

    if (combined.length < 28) {
      throw new Error("Decryption failed: Ciphertext too short");
    }

    const iv = combined.subarray(0, 12);
    const authTag = combined.subarray(-16);
    const encrypted = combined.subarray(12, -16);

    const decipher = createDecipheriv(this.algorithm, this.key!, iv);
    decipher.setAuthTag(authTag);

    // Verify the context matches the one used during encryption
    if (context) {
      decipher.setAAD(Buffer.from(context, "utf8"));
    }

    const decryptedBuffer = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decryptedBuffer.toString("utf8");
  }

  /**
   * Convert Buffer to base64url string
   */
  private toBase64Url(buffer: Buffer): string {
    return buffer
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  /**
   * Convert base64url string to Buffer
   */
  private fromBase64Url(str: string): Buffer {
    const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return Buffer.from(padded, "base64");
  }
}

// Instantiate without args to allow lazy-loading from settings to prevent startup race conditions
export const crypto = new CryptoService();

export type { CryptoService };
