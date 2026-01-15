// src/__tests__/ApiClient.test.ts
// Unit tests for ApiClient

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiClient } from '../ApiClient.js';

describe('ApiClient', () => {
    let client: ApiClient;
    const baseUrl = 'https://api.test.com';
    const apiKey = 'am_test_xxx_123456';

    beforeEach(() => {
        client = new ApiClient(baseUrl, apiKey);
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should remove trailing slash from baseUrl', () => {
            const clientWithSlash = new ApiClient('https://api.test.com/', apiKey);
            // We can verify this by checking the URL in a mocked fetch call
            const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
                new Response(JSON.stringify({ status: 'ok' }))
            );

            clientWithSlash.health();

            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.test.com/api/external/health'
            );
        });
    });

    describe('chat', () => {
        it('should send POST request with correct headers and body', async () => {
            const mockResponse = {
                reply: 'Hello!',
                sessionId: 'session-123',
                sources: [],
                usage: { tokensUsed: 10, quotaRemaining: { minute: 100, day: 1000 } }
            };

            const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
                new Response(JSON.stringify(mockResponse))
            );

            const result = await client.chat('Hello', { sessionId: 'session-123' });

            expect(mockFetch).toHaveBeenCalledWith(
                `${baseUrl}/api/external/chat`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': apiKey
                    },
                    body: JSON.stringify({
                        message: 'Hello',
                        sessionId: 'session-123',
                        context: undefined
                    })
                }
            );

            expect(result.reply).toBe('Hello!');
            expect(result.sessionId).toBe('session-123');
        });

        it('should include context when provided', async () => {
            const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
                new Response(JSON.stringify({ reply: 'Hi', sessionId: '123', sources: [], usage: {} }))
            );

            await client.chat('Hello', {
                context: { currentPage: '/products', pageTitle: 'Products' }
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    body: JSON.stringify({
                        message: 'Hello',
                        sessionId: undefined,
                        context: { currentPage: '/products', pageTitle: 'Products' }
                    })
                })
            );
        });

        it('should throw error on non-OK response', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(
                new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 })
            );

            await expect(client.chat('Hello')).rejects.toThrow('Unauthorized');
        });

        it('should throw generic error when response has no message', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(
                new Response('{}', { status: 500, statusText: 'Internal Server Error' })
            );

            await expect(client.chat('Hello')).rejects.toThrow('HTTP 500: Internal Server Error');
        });
    });

    describe('getGeneralDocs', () => {
        it('should fetch documents without since parameter', async () => {
            const mockDocs = {
                documents: [
                    { id: 'doc-1', title: 'Doc 1', content: 'Content 1', updatedAt: '2024-01-01' }
                ]
            };

            const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
                new Response(JSON.stringify(mockDocs))
            );

            const result = await client.getGeneralDocs();

            expect(mockFetch).toHaveBeenCalledWith(
                `${baseUrl}/api/external/docs`,
                { headers: { 'X-API-Key': apiKey } }
            );

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('doc-1');
        });

        it('should include since parameter when provided', async () => {
            const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
                new Response(JSON.stringify({ documents: [] }))
            );

            await client.getGeneralDocs('2024-01-01T00:00:00Z');

            expect(mockFetch).toHaveBeenCalledWith(
                `${baseUrl}/api/external/docs?since=2024-01-01T00%3A00%3A00Z`,
                expect.any(Object)
            );
        });

        it('should throw error on non-OK response', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(
                new Response('', { status: 403 })
            );

            await expect(client.getGeneralDocs()).rejects.toThrow('HTTP 403');
        });
    });

    describe('getStatus', () => {
        it('should fetch API status', async () => {
            const mockStatus = {
                status: 'ok',
                apiKey: { id: 'key-123', scopes: ['chat', 'docs'] },
                quota: {
                    perMinute: { limit: 100, remaining: 95 },
                    perDay: { limit: 1000, remaining: 950 }
                },
                systemSettings: {
                    cacheRetentionHours: 168,
                    maintenanceMode: false,
                    forceOfflineClients: false
                }
            };

            const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
                new Response(JSON.stringify(mockStatus))
            );

            const result = await client.getStatus();

            expect(mockFetch).toHaveBeenCalledWith(
                `${baseUrl}/api/external/status`,
                { headers: { 'X-API-Key': apiKey } }
            );

            expect(result.status).toBe('ok');
            expect(result.apiKey.id).toBe('key-123');
            expect(result.quota.perMinute.remaining).toBe(95);
            expect(result.systemSettings?.maintenanceMode).toBe(false);
        });

        it('should throw error on non-OK response', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(
                new Response('', { status: 401 })
            );

            await expect(client.getStatus()).rejects.toThrow('HTTP 401');
        });
    });

    describe('health', () => {
        it('should fetch health status without auth', async () => {
            const mockHealth = { status: 'ok', timestamp: '2024-01-01T00:00:00Z' };

            const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
                new Response(JSON.stringify(mockHealth))
            );

            const result = await client.health();

            // Health check should NOT include API key
            expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/api/external/health`);

            expect(result.status).toBe('ok');
            expect(result.timestamp).toBe('2024-01-01T00:00:00Z');
        });

        it('should throw error on non-OK response', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(
                new Response('', { status: 503 })
            );

            await expect(client.health()).rejects.toThrow('HTTP 503');
        });
    });
});
