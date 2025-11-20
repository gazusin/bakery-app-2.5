import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
    cleanup();
});

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};

    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
            store[key] = value;
        },
        removeItem: (key: string) => {
            delete store[key];
        },
        clear: () => {
            store = {};
        },
    };
})();

global.localStorage = localStorageMock as any;
global.sessionStorage = localStorageMock as any;

// Mock crypto for tests (Node doesn't have Web Crypto API by default)
if (typeof global.crypto === 'undefined') {
    const { webcrypto } = require('crypto');
    global.crypto = webcrypto as any;
}
