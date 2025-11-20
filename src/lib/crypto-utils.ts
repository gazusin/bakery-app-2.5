/**
 * Security utilities for encrypting sensitive data, validating inputs, and sanitizing content
 * @module crypto-utils
 */

"use client";

/**
 * Simple encryption/decryption using Web Crypto API
 * Note: This is for LOCAL storage protection, not production-grade security
 */

const ENCRYPTION_KEY_NAME = 'bakery_app_key';
const SALT = 'bakery2.5-salt-2024'; // In production, this should be per-user and stored securely

/**
 * Derives a crypto key from a password
 */
async function deriveKey(password: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(SALT),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Gets or creates an encryption key for the application
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  // For simplicity, using a hardcoded key derivation
  // In a real app, this would be derived from user password or stored securely
  return deriveKey('BakeryApp2024SecureKey!');
}

/**
 * Encrypts data using AES-GCM
 */
export async function encryptData(data: string): Promise<string> {
  try {
    const key = await getEncryptionKey();
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(data)
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    // Convert to base64
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption failed:', error);
    return data; // Fallback to unencrypted in case of error
  }
}

/**
 * Decrypts data using AES-GCM
 */
export async function decryptData(encryptedData: string): Promise<string> {
  try {
    const key = await getEncryptionKey();
    
    // Convert from base64
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    
    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    return encryptedData; // Fallback to encrypted data
  }
}

/**
 * Simple hash function for passwords (client-side)
 * Note: In production, password hashing should be done server-side
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Sanitizes HTML to prevent XSS attacks
 */
export function sanitizeHtml(html: string): string {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

/**
 * Sanitizes user input by removing/escaping dangerous characters
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';
  
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates phone number (basic validation)
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 7;
}

/**
 * Validates that a number is positive
 */
export function isPositiveNumber(value: number | string): boolean {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return !isNaN(num) && num > 0;
}

/**
 * Validates that a number is non-negative
 */
export function isNonNegativeNumber(value: number | string): boolean {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return !isNaN(num) && num >= 0;
}

/**
 * Rate limiter for preventing brute force attacks
 */
class RateLimiter {
  private attempts: Map<string, { count: number; timestamp: number }> = new Map();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  /**
   * Checks if an action is allowed
   */
  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const attempt = this.attempts.get(identifier);

    if (!attempt) {
      this.attempts.set(identifier, { count: 1, timestamp: now });
      return true;
    }

    // Reset if window has passed
    if (now - attempt.timestamp > this.windowMs) {
      this.attempts.set(identifier, { count: 1, timestamp: now });
      return true;
    }

    // Check if limit exceeded
    if (attempt.count >= this.maxAttempts) {
      return false;
    }

    // Increment count
    attempt.count++;
    return true;
  }

  /**
   * Resets attempts for an identifier (e.g., after successful login)
   */
  reset(identifier: string): void {
    this.attempts.delete(identifier);
  }

  /**
   * Gets remaining time until rate limit resets (in seconds)
   */
  getTimeUntilReset(identifier: string): number {
    const attempt = this.attempts.get(identifier);
    if (!attempt) return 0;

    const elapsed = Date.now() - attempt.timestamp;
    const remaining = this.windowMs - elapsed;
    return Math.max(0, Math.ceil(remaining / 1000));
  }
}

// Global rate limiter instance for login attempts
export const loginRateLimiter = new RateLimiter(5, 15 * 60 * 1000); // 5 attempts per 15 minutes

/**
 * Generates a random CSRF token
 */
export function generateCSRFToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Validates CSRF token
 */
export function validateCSRFToken(token: string, storedToken: string): boolean {
  return token === storedToken && token.length === 64;
}

/**
 * Creates a checksum for data integrity
 */
export async function createChecksum(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies data checksum
 */
export async function verifyChecksum(data: string, checksum: string): Promise<boolean> {
  const computedChecksum = await createChecksum(data);
  return computedChecksum === checksum;
}

/**
 * Secure storage wrapper for sensitive data
 */
export const secureStorage = {
  /**
   * Stores encrypted data in localStorage
   */
  async setItem(key: string, value: string): Promise<void> {
    if (typeof window === 'undefined') return;
    
    const encrypted = await encryptData(value);
    const checksum = await createChecksum(encrypted);
    
    localStorage.setItem(key, encrypted);
    localStorage.setItem(`${key}_checksum`, checksum);
  },

  /**
   * Retrieves and decrypts data from localStorage
   */
  async getItem(key: string): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    
    const encrypted = localStorage.getItem(key);
    const storedChecksum = localStorage.getItem(`${key}_checksum`);
    
    if (!encrypted) return null;
    
    // Verify integrity if checksum exists
    if (storedChecksum) {
      const isValid = await verifyChecksum(encrypted, storedChecksum);
      if (!isValid) {
        console.warn(`Data integrity check failed for ${key}`);
        return null;
      }
    }
    
    return await decryptData(encrypted);
  },

  /**
   * Removes item from localStorage
   */
  removeItem(key: string): void {
    if (typeof window === 'undefined') return;
    
    localStorage.removeItem(key);
    localStorage.removeItem(`${key}_checksum`);
  }
};
