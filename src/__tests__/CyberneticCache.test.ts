// src/__tests__/CyberneticCache.test.ts
// Unit tests for CyberneticCache

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CyberneticCache } from '../CyberneticCache.js';
import type { CachedDocument } from '../types.js';

describe('CyberneticCache', () => {
    const sampleDocuments: CachedDocument[] = [
        {
            id: 'doc-1',
            title: 'Test Document 1',
            content: 'This is test content for document 1.',
            updatedAt: '2024-01-01T00:00:00Z'
        },
        {
            id: 'doc-2',
            title: 'Test Document 2',
            content: 'This is test content for document 2.',
            updatedAt: '2024-01-02T00:00:00Z'
        }
    ];

    describe('LocalStorage mode', () => {
        let cache: CyberneticCache;

        beforeEach(() => {
            // Clear localStorage
            localStorage.clear();
            cache = new CyberneticCache({
                storage: 'localstorage',
                maxAge: 86400000 // 24 hours
            });
        });

        afterEach(() => {
            localStorage.clear();
        });

        it('should store documents in localStorage', async () => {
            await cache.store(sampleDocuments);

            const stored = localStorage.getItem('cybernetic-cache-docs');
            expect(stored).not.toBeNull();

            const parsed = JSON.parse(stored!);
            expect(parsed).toHaveLength(2);
        });

        it('should retrieve stored documents', async () => {
            await cache.store(sampleDocuments);
            const retrieved = await cache.retrieve();

            expect(retrieved).toHaveLength(2);
            expect(retrieved[0].id).toBe('doc-1');
            expect(retrieved[1].id).toBe('doc-2');
        });

        it('should return empty array when no documents stored', async () => {
            const retrieved = await cache.retrieve();
            expect(retrieved).toHaveLength(0);
        });

        it('should update lastSyncAt on store', async () => {
            const beforeStore = await cache.getLastSync();
            expect(beforeStore).toBeNull();

            await cache.store(sampleDocuments);

            const afterStore = await cache.getLastSync();
            expect(afterStore).not.toBeNull();
        });

        it('should clear all data', async () => {
            await cache.store(sampleDocuments);
            await cache.clear();

            const retrieved = await cache.retrieve();
            expect(retrieved).toHaveLength(0);

            const lastSync = await cache.getLastSync();
            expect(lastSync).toBeNull();
        });

        it('should report correct status', async () => {
            const statusBefore = cache.getStatus();
            expect(statusBefore.documentCount).toBe(0);
            expect(statusBefore.lastSyncAt).toBeNull();

            await cache.store(sampleDocuments);

            const statusAfter = cache.getStatus();
            expect(statusAfter.documentCount).toBe(2);
            expect(statusAfter.lastSyncAt).not.toBeNull();
            expect(statusAfter.isStale).toBe(false);
        });

        it('should report stale status when cache is old', async () => {
            // Create cache with very short maxAge
            const shortCache = new CyberneticCache({
                storage: 'localstorage',
                maxAge: 1 // 1ms
            });

            await shortCache.store(sampleDocuments);

            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 10));

            const status = shortCache.getStatus();
            expect(status.isStale).toBe(true);
        });

        it('should handle localStorage quota exceeded', async () => {
            // Create a very large document array
            const largeDocuments: CachedDocument[] = [];
            for (let i = 0; i < 100; i++) {
                largeDocuments.push({
                    id: `doc-${i}`,
                    title: `Document ${i}`,
                    content: 'x'.repeat(10000), // 10KB each
                    updatedAt: new Date().toISOString()
                });
            }

            // This should not throw even if localStorage is full
            // It will truncate to 50 documents
            await expect(cache.store(largeDocuments)).resolves.not.toThrow();
        });
    });

    describe('getStatus', () => {
        it('should calculate approximate cache size', async () => {
            const cache = new CyberneticCache({
                storage: 'localstorage',
                maxAge: 86400000
            });

            await cache.store(sampleDocuments);

            const status = cache.getStatus();
            expect(status.cacheSize).toBeGreaterThan(0);
            // Rough estimate is 5KB per doc
            expect(status.cacheSize).toBe(2 * 5000);
        });
    });
});
