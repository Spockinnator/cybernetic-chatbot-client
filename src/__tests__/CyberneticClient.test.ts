// src/__tests__/CyberneticClient.test.ts
// Unit tests for CyberneticClient

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CyberneticClient } from '../CyberneticClient.js';
import type { CyberneticConfig, ConnectionStatus, CyberneticError } from '../types.js';

describe('CyberneticClient', () => {
    let client: CyberneticClient;
    let statusChanges: ConnectionStatus[];
    let errors: CyberneticError[];

    const defaultConfig: CyberneticConfig = {
        apiUrl: 'https://api.test.com',
        apiKey: 'am_test_xxx_123456',
        fallback: {
            enabled: true,
            cacheOnConnect: false // Disable auto-sync for tests
        },
        onStatusChange: (status) => statusChanges.push(status),
        onError: (error) => errors.push(error)
    };

    beforeEach(() => {
        statusChanges = [];
        errors = [];
        localStorage.clear();
        vi.restoreAllMocks();
    });

    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should create client with default config values', () => {
            const minimalConfig: CyberneticConfig = {
                apiUrl: 'https://api.test.com',
                apiKey: 'am_test_xxx_123'
            };

            // Disable cache sync to avoid fetch during construction
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(
                new Response(JSON.stringify({ documents: [] }))
            );

            const minimalClient = new CyberneticClient(minimalConfig);
            const status = minimalClient.getStatus();

            expect(status.connection).toBe('connecting');
        });
    });

    describe('ask', () => {
        beforeEach(() => {
            client = new CyberneticClient({
                ...defaultConfig,
                fallback: { enabled: false, cacheOnConnect: false }
            });
        });

        it('should return error response for empty message', async () => {
            const response = await client.ask('');

            expect(response.reply).toBe('Message is required');
            expect(response.confidence).toBe('none');
            expect(response.offline).toBe(false);
        });

        it('should return error response for non-string message', async () => {
            const response = await client.ask(null as any);

            expect(response.reply).toBe('Message is required');
            expect(response.confidence).toBe('none');
        });

        it('should return successful API response', async () => {
            const statusResponse = {
                status: 'ok',
                apiKey: { id: 'key-1', scopes: [] },
                quota: { perMinute: { limit: 100, remaining: 100 }, perDay: { limit: 1000, remaining: 1000 } },
                systemSettings: { cacheRetentionHours: 168, maintenanceMode: false, forceOfflineClients: false }
            };
            const chatResponse = {
                reply: 'Hello! How can I help you?',
                sessionId: 'session-123',
                sources: [{ title: 'FAQ', snippet: 'Help section', relevance: 0.9 }],
                usage: { tokensUsed: 15, quotaRemaining: { minute: 100, day: 1000 } }
            };

            vi.spyOn(globalThis, 'fetch')
                .mockResolvedValueOnce(new Response(JSON.stringify(statusResponse)))
                .mockResolvedValueOnce(new Response(JSON.stringify(chatResponse)));

            const response = await client.ask('Hello');

            expect(response.reply).toBe('Hello! How can I help you?');
            expect(response.confidence).toBe('high');
            expect(response.offline).toBe(false);
            expect(response.sessionId).toBe('session-123');
            expect(response.sources).toHaveLength(1);
        });

        it('should update status to online on successful API call', async () => {
            const statusResponse = {
                status: 'ok',
                apiKey: { id: 'key-1', scopes: [] },
                quota: { perMinute: { limit: 100, remaining: 100 }, perDay: { limit: 1000, remaining: 1000 } },
                systemSettings: { cacheRetentionHours: 168, maintenanceMode: false, forceOfflineClients: false }
            };

            vi.spyOn(globalThis, 'fetch')
                .mockResolvedValueOnce(new Response(JSON.stringify(statusResponse)))
                .mockResolvedValueOnce(new Response(JSON.stringify({
                    reply: 'Hi',
                    sessionId: '123',
                    sources: [],
                    usage: {}
                })));

            await client.ask('Hello');

            expect(statusChanges).toContain('online');
        });

        it('should handle rate limit error without fallback', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(
                new Response(JSON.stringify({ message: 'Rate limit exceeded, retry after 60' }), { status: 429 })
            );

            const response = await client.ask('Hello');

            expect(response.reply).toContain('too many requests');
            expect(response.confidence).toBe('none');
            expect(response.retryAfter).toBeDefined();
        });

        it('should return error response when API fails and fallback disabled', async () => {
            vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

            const response = await client.ask('Hello');

            expect(response.reply).toContain('Unable to connect');
            expect(response.confidence).toBe('none');
            expect(errors).toHaveLength(1);
            expect(errors[0].code).toBe('NETWORK_ERROR');
        });
    });

    describe('ask with fallback', () => {
        beforeEach(() => {
            client = new CyberneticClient({
                ...defaultConfig,
                fallback: {
                    enabled: true,
                    cacheOnConnect: false,
                    cacheStorage: 'localstorage'
                }
            });
        });

        it('should fall back to offline mode when API fails', async () => {
            // Pre-populate cache
            const docs = [
                { id: 'doc-1', title: 'FAQ', content: 'Return policy allows 30 day returns.', updatedAt: '2024-01-01' }
            ];
            localStorage.setItem('cybernetic-cache-docs', JSON.stringify(docs));
            localStorage.setItem('cybernetic-cache-meta', JSON.stringify({
                documentCount: 1,
                lastSyncAt: new Date().toISOString()
            }));

            // Create new client to pick up cached data
            client = new CyberneticClient({
                ...defaultConfig,
                fallback: {
                    enabled: true,
                    cacheOnConnect: false,
                    cacheStorage: 'localstorage'
                }
            });

            vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

            const response = await client.ask('What is the return policy?');

            expect(response.offline).toBe(true);
            expect(response.confidence).not.toBe('none');
            expect(statusChanges).toContain('offline');
        });

        it('should return no-cache response when offline with empty cache', async () => {
            vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

            const response = await client.ask('Hello');

            expect(response.offline).toBe(true);
            expect(response.reply).toContain('offline');
            expect(response.reply).toContain('cached information');
            expect(response.confidence).toBe('none');
        });

        it('should skip fallback when skipFallback option is true', async () => {
            vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

            const response = await client.ask('Hello', { skipFallback: true });

            expect(response.offline).toBe(false);
            expect(response.reply).toContain('Unable to connect');
        });
    });

    describe('maintenance mode', () => {
        beforeEach(() => {
            client = new CyberneticClient({
                ...defaultConfig,
                fallback: {
                    enabled: true,
                    cacheOnConnect: false,
                    cacheStorage: 'localstorage'
                }
            });
        });

        it('should use fallback when maintenanceMode is true', async () => {
            // Mock status endpoint to return maintenance mode
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(
                new Response(JSON.stringify({
                    status: 'ok',
                    apiKey: { id: 'key-1', scopes: [] },
                    quota: { perMinute: { limit: 100, remaining: 100 }, perDay: { limit: 1000, remaining: 1000 } },
                    systemSettings: {
                        cacheRetentionHours: 168,
                        maintenanceMode: true,
                        maintenanceMessage: 'System is under maintenance',
                        forceOfflineClients: false
                    }
                }))
            );

            const response = await client.ask('Hello');

            // Should show maintenance message since no cache
            expect(response.reply).toContain('maintenance');
            expect(response.offline).toBe(true);
        });

        it('should use fallback when forceOfflineClients is true', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(
                new Response(JSON.stringify({
                    status: 'ok',
                    apiKey: { id: 'key-1', scopes: [] },
                    quota: { perMinute: { limit: 100, remaining: 100 }, perDay: { limit: 1000, remaining: 1000 } },
                    systemSettings: {
                        cacheRetentionHours: 168,
                        maintenanceMode: false,
                        forceOfflineClients: true
                    }
                }))
            );

            const response = await client.ask('Hello');

            expect(response.offline).toBe(true);
        });

        it('should return maintenance message when provided', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(
                new Response(JSON.stringify({
                    status: 'ok',
                    apiKey: { id: 'key-1', scopes: [] },
                    quota: { perMinute: { limit: 100, remaining: 100 }, perDay: { limit: 1000, remaining: 1000 } },
                    systemSettings: {
                        cacheRetentionHours: 168,
                        maintenanceMode: true,
                        maintenanceMessage: 'Back in 2 hours!',
                        forceOfflineClients: false
                    }
                }))
            );

            const response = await client.ask('Hello');

            expect(response.reply).toContain('Back in 2 hours!');
        });
    });

    describe('getStatus', () => {
        beforeEach(() => {
            client = new CyberneticClient({
                ...defaultConfig,
                fallback: { enabled: true, cacheOnConnect: false, cacheStorage: 'localstorage' }
            });
        });

        it('should return connection status', () => {
            const status = client.getStatus();

            expect(status).toHaveProperty('connection');
            expect(status).toHaveProperty('cache');
            expect(status).toHaveProperty('lastError');
            expect(status).toHaveProperty('systemSettings');
        });

        it('should include cache status', () => {
            const status = client.getStatus();

            expect(status.cache).toHaveProperty('documentCount');
            expect(status.cache).toHaveProperty('lastSyncAt');
            expect(status.cache).toHaveProperty('isStale');
        });
    });

    describe('clearCache', () => {
        beforeEach(() => {
            client = new CyberneticClient({
                ...defaultConfig,
                fallback: { enabled: true, cacheOnConnect: false, cacheStorage: 'localstorage' }
            });
        });

        it('should clear cache data', async () => {
            // Add some cache data
            localStorage.setItem('cybernetic-cache-docs', JSON.stringify([{ id: '1' }]));

            await client.clearCache();

            expect(localStorage.getItem('cybernetic-cache-docs')).toBeNull();
        });
    });

    describe('checkConnection', () => {
        beforeEach(() => {
            client = new CyberneticClient({
                ...defaultConfig,
                fallback: { enabled: false, cacheOnConnect: false }
            });
        });

        it('should return true and set online status when API reachable', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(
                new Response(JSON.stringify({
                    status: 'ok',
                    apiKey: { id: 'key-1', scopes: [] },
                    quota: { perMinute: { limit: 100, remaining: 100 }, perDay: { limit: 1000, remaining: 1000 } }
                }))
            );

            const result = await client.checkConnection();

            expect(result).toBe(true);
            expect(statusChanges).toContain('online');
        });

        it('should return false and set offline status when API unreachable', async () => {
            vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

            const result = await client.checkConnection();

            expect(result).toBe(false);
            expect(statusChanges).toContain('offline');
        });
    });

    describe('isMaintenanceMode', () => {
        beforeEach(() => {
            client = new CyberneticClient({
                ...defaultConfig,
                fallback: { enabled: false, cacheOnConnect: false }
            });
        });

        it('should return false by default', () => {
            expect(client.isMaintenanceMode()).toBe(false);
        });

        it('should return true after checking status with maintenance mode', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(
                new Response(JSON.stringify({
                    status: 'ok',
                    apiKey: { id: 'key-1', scopes: [] },
                    quota: { perMinute: { limit: 100, remaining: 100 }, perDay: { limit: 1000, remaining: 1000 } },
                    systemSettings: { maintenanceMode: true, cacheRetentionHours: 168, forceOfflineClients: false }
                }))
            );

            await client.checkSystemStatus();

            expect(client.isMaintenanceMode()).toBe(true);
        });
    });

    describe('retry logic', () => {
        beforeEach(() => {
            client = new CyberneticClient({
                ...defaultConfig,
                fallback: { enabled: false, cacheOnConnect: false },
                retry: {
                    maxRetries: 2,
                    initialDelay: 10, // Short delay for tests
                    exponentialBackoff: false
                }
            });
        });

        it('should retry on network errors', async () => {
            const mockFetch = vi.spyOn(globalThis, 'fetch')
                .mockRejectedValueOnce(new Error('Network error'))
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce(
                    new Response(JSON.stringify({
                        reply: 'Success!',
                        sessionId: '123',
                        sources: [],
                        usage: {}
                    }))
                );

            const response = await client.ask('Hello');

            expect(mockFetch).toHaveBeenCalledTimes(3);
            expect(response.reply).toBe('Success!');
        });

        it('should not retry on auth errors', async () => {
            const mockFetch = vi.spyOn(globalThis, 'fetch')
                .mockResolvedValueOnce(
                    new Response(JSON.stringify({
                        status: 'ok',
                        apiKey: { id: 'key-1', scopes: [] },
                        quota: { perMinute: { limit: 100, remaining: 100 }, perDay: { limit: 1000, remaining: 1000 } }
                    }))
                )
                .mockResolvedValue(
                    new Response(JSON.stringify({ message: '401 Unauthorized' }), { status: 401 })
                );

            await client.ask('Hello');

            // Should have called status once, then chat once (no retry on auth error)
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('should not retry on rate limit errors', async () => {
            const mockFetch = vi.spyOn(globalThis, 'fetch')
                .mockResolvedValueOnce(
                    new Response(JSON.stringify({
                        status: 'ok',
                        apiKey: { id: 'key-1', scopes: [] },
                        quota: { perMinute: { limit: 100, remaining: 100 }, perDay: { limit: 1000, remaining: 1000 } }
                    }))
                )
                .mockResolvedValue(
                    new Response(JSON.stringify({ message: '429 Rate limit' }), { status: 429 })
                );

            await client.ask('Hello');

            // Should have called status once, then chat once (no retry on rate limit)
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });
});
