// src/__tests__/config.test.ts
// Unit tests for config module

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateConfig, loadConfig } from '../config.js';

describe('config', () => {
    describe('validateConfig', () => {
        it('should accept valid config', () => {
            const config = {
                apiUrl: 'https://api.example.com',
                apiKey: 'am_live_xxx_1234567890'
            };

            expect(validateConfig(config)).toBe(true);
        });

        it('should throw for null config', () => {
            expect(() => validateConfig(null)).toThrow('Config must be an object');
        });

        it('should throw for undefined config', () => {
            expect(() => validateConfig(undefined)).toThrow('Config must be an object');
        });

        it('should throw for non-object config', () => {
            expect(() => validateConfig('string')).toThrow('Config must be an object');
        });

        it('should throw for missing apiUrl', () => {
            const config = {
                apiKey: 'am_live_xxx_1234567890'
            };

            expect(() => validateConfig(config)).toThrow('apiUrl is required');
        });

        it('should throw for non-string apiUrl', () => {
            const config = {
                apiUrl: 123,
                apiKey: 'am_live_xxx_1234567890'
            };

            expect(() => validateConfig(config)).toThrow('apiUrl is required and must be a string');
        });

        it('should throw for missing apiKey', () => {
            const config = {
                apiUrl: 'https://api.example.com'
            };

            expect(() => validateConfig(config)).toThrow('apiKey is required');
        });

        it('should throw for non-string apiKey', () => {
            const config = {
                apiUrl: 'https://api.example.com',
                apiKey: 12345
            };

            expect(() => validateConfig(config)).toThrow('apiKey is required and must be a string');
        });

        it('should throw for apiKey not starting with am_', () => {
            const config = {
                apiUrl: 'https://api.example.com',
                apiKey: 'invalid_key_format'
            };

            expect(() => validateConfig(config)).toThrow('apiKey must start with "am_"');
        });

        it('should accept apiKey with different prefixes starting with am_', () => {
            const configs = [
                { apiUrl: 'https://api.example.com', apiKey: 'am_live_xxx_123' },
                { apiUrl: 'https://api.example.com', apiKey: 'am_test_xxx_123' },
                { apiUrl: 'https://api.example.com', apiKey: 'am_dev_xxx_123' }
            ];

            configs.forEach(config => {
                expect(validateConfig(config)).toBe(true);
            });
        });
    });

    describe('loadConfig', () => {
        let originalWindow: typeof globalThis.window;

        beforeEach(() => {
            // Store original window
            originalWindow = globalThis.window;
        });

        afterEach(() => {
            // Restore window
            globalThis.window = originalWindow;
            // Clean up any global config
            if (typeof window !== 'undefined') {
                delete (window as any).astermindConfig;
            }
        });

        it('should return null when window is undefined', () => {
            // Simulate Node.js environment
            const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
            delete (globalThis as any).window;

            const result = loadConfig();
            expect(result).toBeNull();

            // Restore window
            if (windowDescriptor) {
                Object.defineProperty(globalThis, 'window', windowDescriptor);
            }
        });

        it('should load config from window.astermindConfig', () => {
            (window as any).astermindConfig = {
                apiUrl: 'https://api.test.com',
                apiKey: 'am_test_xxx_123'
            };

            const result = loadConfig();

            expect(result).not.toBeNull();
            expect(result?.apiUrl).toBe('https://api.test.com');
            expect(result?.apiKey).toBe('am_test_xxx_123');
        });

        it('should load config from script tag data attributes', () => {
            // Remove global config
            delete (window as any).astermindConfig;

            // Create script tag with data attributes
            const script = document.createElement('script');
            script.setAttribute('data-astermind-key', 'am_script_xxx_456');
            script.setAttribute('data-astermind-url', 'https://api.script.com');
            document.body.appendChild(script);

            const result = loadConfig();

            expect(result).not.toBeNull();
            expect(result?.apiKey).toBe('am_script_xxx_456');
            expect(result?.apiUrl).toBe('https://api.script.com');

            // Cleanup
            document.body.removeChild(script);
        });

        it('should use default URL when not specified in script tag', () => {
            delete (window as any).astermindConfig;

            const script = document.createElement('script');
            script.setAttribute('data-astermind-key', 'am_script_xxx_789');
            document.body.appendChild(script);

            const result = loadConfig();

            expect(result?.apiUrl).toBe('https://api.astermind.ai');

            document.body.removeChild(script);
        });

        it('should return null when no config source available', () => {
            delete (window as any).astermindConfig;
            // No script tags with data attributes

            const result = loadConfig();
            expect(result).toBeNull();
        });
    });
});
