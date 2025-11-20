import { describe, it, expect } from 'vitest';
import {
    sanitizeInput,
    sanitizeHtml,
    isValidEmail,
    isValidPhone,
    isPositiveNumber,
    isNonNegativeNumber,
    loginRateLimiter,
    generateCSRFToken,
    validateCSRFToken,
} from '../crypto-utils';

describe('crypto-utils', () => {
    describe('sanitizeInput', () => {
        it('should escape HTML special characters', () => {
            const maliciousInput = '<script>alert("XSS")</script>';
            const sanitized = sanitizeInput(maliciousInput);

            expect(sanitized).not.toContain('<script>');
            expect(sanitized).toContain('&lt;script&gt;');
        });

        it('should handle quotes and slashes', () => {
            const input = `Hello "world" & 'test' / end`;
            const sanitized = sanitizeInput(input);

            expect(sanitized).toContain('&quot;');
            expect(sanitized).toContain('&#x27;');
            expect(sanitized).toContain('&#x2F;');
        });

        it('should return empty string for null/undefined', () => {
            expect(sanitizeInput('')).toBe('');
            expect(sanitizeInput(null as any)).toBe('');
            expect(sanitizeInput(undefined as any)).toBe('');
        });
    });

    describe('isValidEmail', () => {
        it('should validate correct emails', () => {
            expect(isValidEmail('user@example.com')).toBe(true);
            expect(isValidEmail('test.user@domain.co.uk')).toBe(true);
        });

        it('should reject invalid emails', () => {
            expect(isValidEmail('notanemail')).toBe(false);
            expect(isValidEmail('@example.com')).toBe(false);
            expect(isValidEmail('user@')).toBe(false);
        });
    });

    describe('isValidPhone', () => {
        it('should validate phone numbers', () => {
            expect(isValidPhone('+1234567890')).toBe(true);
            expect(isValidPhone('123-456-7890')).toBe(true);
            expect(isValidPhone('(123) 456-7890')).toBe(true);
        });

        it('should reject invalid phones', () => {
            expect(isValidPhone('123')).toBe(false);
            expect(isValidPhone('abc')).toBe(false);
        });
    });

    describe('isPositiveNumber', () => {
        it('should validate positive numbers', () => {
            expect(isPositiveNumber(10)).toBe(true);
            expect(isPositiveNumber(0.1)).toBe(true);
            expect(isPositiveNumber('5')).toBe(true);
        });

        it('should reject zero and negative numbers', () => {
            expect(isPositiveNumber(0)).toBe(false);
            expect(isPositiveNumber(-5)).toBe(false);
            expect(isPositiveNumber('0')).toBe(false);
        });
    });

    describe('isNonNegativeNumber', () => {
        it('should validate non-negative numbers', () => {
            expect(isNonNegativeNumber(0)).toBe(true);
            expect(isNonNegativeNumber(10)).toBe(true);
            expect(isNonNegativeNumber('5')).toBe(true);
        });

        it('should reject negative numbers', () => {
            expect(isNonNegativeNumber(-1)).toBe(false);
            expect(isNonNegativeNumber('-5')).toBe(false);
        });
    });

    describe('loginRateLimiter', () => {
        it('should allow first attempts', () => {
            const userId = `test_${Date.now()}`;
            expect(loginRateLimiter.isAllowed(userId)).toBe(true);
        });

        it('should track multiple attempts', () => {
            const userId = `test_multi_${Date.now()}`;

            // First 5 should be allowed
            for (let i = 0; i < 5; i++) {
                expect(loginRateLimiter.isAllowed(userId)).toBe(true);
            }

            // 6th attempt should be blocked
            expect(loginRateLimiter.isAllowed(userId)).toBe(false);
        });

        it('should reset after successful login', () => {
            const userId = `test_reset_${Date.now()}`;

            loginRateLimiter.isAllowed(userId);
            loginRateLimiter.isAllowed(userId);

            loginRateLimiter.reset(userId);

            // Should be allowed again after reset
            expect(loginRateLimiter.isAllowed(userId)).toBe(true);
        });
    });

    describe('CSRF Token', () => {
        it('should generate valid tokens', () => {
            const token1 = generateCSRFToken();
            const token2 = generateCSRFToken();

            expect(token1).toHaveLength(64);
            expect(token2).toHaveLength(64);
            expect(token1).not.toBe(token2); // Should be unique
        });

        it('should validate matching tokens', () => {
            const token = generateCSRFToken();
            expect(validateCSRFToken(token, token)).toBe(true);
        });

        it('should reject mismatched tokens', () => {
            const token1 = generateCSRFToken();
            const token2 = generateCSRFToken();
            expect(validateCSRFToken(token1, token2)).toBe(false);
        });

        it('should reject invalid token lengths', () => {
            expect(validateCSRFToken('short', 'short')).toBe(false);
        });
    });
});
