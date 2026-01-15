// src/CyberneticCache.ts
// IndexedDB cache for offline document storage

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { CachedDocument, CacheStatus } from './types.js';

interface CyberneticCacheDB extends DBSchema {
    documents: {
        key: string;
        value: CachedDocument;
        indexes: {
            'by-updated': string;
        };
    };
    metadata: {
        key: string;
        value: {
            key: string;
            value: string | number;
        };
    };
}

interface CacheConfig {
    storage: 'indexeddb' | 'localstorage';
    maxAge: number;  // milliseconds
}

/**
 * Document cache for offline RAG fallback
 */
export class CyberneticCache {
    private config: CacheConfig;
    private db: IDBPDatabase<CyberneticCacheDB> | null = null;
    private dbPromise: Promise<IDBPDatabase<CyberneticCacheDB>> | null = null;
    private documentCount = 0;
    private lastSyncAt: string | null = null;

    constructor(config: CacheConfig) {
        this.config = config;

        if (config.storage === 'indexeddb' && typeof indexedDB !== 'undefined') {
            this.dbPromise = this.initDB();
        } else if (config.storage === 'localstorage') {
            // Load cached metadata from localStorage
            this.loadLocalStorageMetadata();
        }
    }

    /**
     * Load metadata from localStorage
     */
    private loadLocalStorageMetadata(): void {
        try {
            const meta = localStorage.getItem('cybernetic-cache-meta');
            if (meta) {
                const parsed = JSON.parse(meta);
                this.documentCount = parsed.documentCount || 0;
                this.lastSyncAt = parsed.lastSyncAt || null;
            }
        } catch {
            // Ignore parse errors
        }
    }

    /**
     * Initialize IndexedDB
     */
    private async initDB(): Promise<IDBPDatabase<CyberneticCacheDB>> {
        this.db = await openDB<CyberneticCacheDB>('cybernetic-cache', 1, {
            upgrade(db) {
                // Documents store
                if (!db.objectStoreNames.contains('documents')) {
                    const docStore = db.createObjectStore('documents', { keyPath: 'id' });
                    docStore.createIndex('by-updated', 'updatedAt');
                }

                // Metadata store
                if (!db.objectStoreNames.contains('metadata')) {
                    db.createObjectStore('metadata', { keyPath: 'key' });
                }
            }
        });

        // Load cached metadata
        await this.loadMetadata();

        return this.db;
    }

    /**
     * Get database instance
     */
    private async getDB(): Promise<IDBPDatabase<CyberneticCacheDB>> {
        if (this.db) return this.db;
        if (this.dbPromise) return this.dbPromise;
        throw new Error('Database not available');
    }

    /**
     * Load cached metadata (count, last sync)
     */
    private async loadMetadata(): Promise<void> {
        if (!this.db) return;

        const countMeta = await this.db.get('metadata', 'documentCount');
        this.documentCount = countMeta?.value as number || 0;

        const syncMeta = await this.db.get('metadata', 'lastSyncAt');
        this.lastSyncAt = syncMeta?.value as string || null;
    }

    /**
     * Store documents in cache
     */
    async store(documents: CachedDocument[]): Promise<void> {
        if (this.config.storage === 'localstorage') {
            return this.storeLocalStorage(documents);
        }

        const db = await this.getDB();
        const tx = db.transaction(['documents', 'metadata'], 'readwrite');

        // Store documents
        for (const doc of documents) {
            await tx.objectStore('documents').put(doc);
        }

        // Update metadata
        this.documentCount = await tx.objectStore('documents').count();
        this.lastSyncAt = new Date().toISOString();

        await tx.objectStore('metadata').put({
            key: 'documentCount',
            value: this.documentCount
        });
        await tx.objectStore('metadata').put({
            key: 'lastSyncAt',
            value: this.lastSyncAt
        });

        await tx.done;
    }

    /**
     * Retrieve all cached documents
     */
    async retrieve(): Promise<CachedDocument[]> {
        if (this.config.storage === 'localstorage') {
            return this.retrieveLocalStorage();
        }

        const db = await this.getDB();
        return db.getAll('documents');
    }

    /**
     * Get last sync timestamp
     */
    async getLastSync(): Promise<string | null> {
        return this.lastSyncAt;
    }

    /**
     * Get cache status
     */
    getStatus(): CacheStatus {
        const now = Date.now();
        const lastSync = this.lastSyncAt ? new Date(this.lastSyncAt).getTime() : 0;
        const isStale = now - lastSync > this.config.maxAge;

        return {
            documentCount: this.documentCount,
            lastSyncAt: this.lastSyncAt,
            cacheSize: this.documentCount * 5000,  // Rough estimate: ~5KB per doc
            isStale
        };
    }

    /**
     * Clear all cached data
     */
    async clear(): Promise<void> {
        if (this.config.storage === 'localstorage') {
            localStorage.removeItem('cybernetic-cache-docs');
            localStorage.removeItem('cybernetic-cache-meta');
            this.documentCount = 0;
            this.lastSyncAt = null;
            return;
        }

        const db = await this.getDB();
        const tx = db.transaction(['documents', 'metadata'], 'readwrite');
        await tx.objectStore('documents').clear();
        await tx.objectStore('metadata').clear();
        await tx.done;

        this.documentCount = 0;
        this.lastSyncAt = null;
    }

    // ==================== LocalStorage fallback ====================

    private storeLocalStorage(documents: CachedDocument[]): void {
        try {
            localStorage.setItem('cybernetic-cache-docs', JSON.stringify(documents));
            this.documentCount = documents.length;
            this.lastSyncAt = new Date().toISOString();
            localStorage.setItem('cybernetic-cache-meta', JSON.stringify({
                documentCount: this.documentCount,
                lastSyncAt: this.lastSyncAt
            }));
        } catch {
            // LocalStorage full - clear and retry with limit
            localStorage.removeItem('cybernetic-cache-docs');
            const limited = documents.slice(0, 50);  // Keep only 50 docs
            localStorage.setItem('cybernetic-cache-docs', JSON.stringify(limited));
            this.documentCount = limited.length;
        }
    }

    private retrieveLocalStorage(): CachedDocument[] {
        try {
            const data = localStorage.getItem('cybernetic-cache-docs');
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    }
}
