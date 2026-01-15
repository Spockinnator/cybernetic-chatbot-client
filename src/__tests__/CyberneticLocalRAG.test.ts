// src/__tests__/CyberneticLocalRAG.test.ts
// Unit tests for CyberneticLocalRAG

import { describe, it, expect, beforeEach } from 'vitest';
import { CyberneticLocalRAG } from '../CyberneticLocalRAG.js';
import type { CachedDocument } from '../types.js';

describe('CyberneticLocalRAG', () => {
    let rag: CyberneticLocalRAG;

    const sampleDocuments: CachedDocument[] = [
        {
            id: 'doc-1',
            title: 'Return Policy',
            content: 'Our return policy allows returns within 30 days of purchase. Items must be in original condition with tags attached. Refunds are processed within 5-7 business days.',
            updatedAt: '2024-01-01T00:00:00Z'
        },
        {
            id: 'doc-2',
            title: 'Shipping Information',
            content: 'We offer free shipping on orders over $50. Standard shipping takes 5-7 business days. Express shipping is available for an additional fee and delivers in 2-3 business days.',
            updatedAt: '2024-01-01T00:00:00Z'
        },
        {
            id: 'doc-3',
            title: 'Product Warranty',
            content: 'All products come with a one year manufacturer warranty. Extended warranty options are available at checkout. Contact customer service for warranty claims.',
            updatedAt: '2024-01-01T00:00:00Z'
        }
    ];

    beforeEach(() => {
        rag = new CyberneticLocalRAG();
    });

    describe('isIndexed', () => {
        it('should return false before indexing', () => {
            expect(rag.isIndexed()).toBe(false);
        });

        it('should return true after indexing documents', async () => {
            await rag.index(sampleDocuments);
            expect(rag.isIndexed()).toBe(true);
        });

        it('should return false after reset', async () => {
            await rag.index(sampleDocuments);
            rag.reset();
            expect(rag.isIndexed()).toBe(false);
        });
    });

    describe('index', () => {
        it('should index documents without error', async () => {
            await expect(rag.index(sampleDocuments)).resolves.not.toThrow();
        });

        it('should handle empty document array', async () => {
            await rag.index([]);
            expect(rag.isIndexed()).toBe(false);
        });

        it('should re-index when called multiple times', async () => {
            await rag.index(sampleDocuments);
            await rag.index([sampleDocuments[0]]);
            expect(rag.isIndexed()).toBe(true);
        });
    });

    describe('ask', () => {
        it('should return no-info response when not indexed', async () => {
            const result = await rag.ask('What is the return policy?');
            expect(result.answer).toContain('don\'t have any information');
            expect(result.sources).toHaveLength(0);
            expect(result.topScore).toBe(0);
        });

        it('should find relevant document for return policy question', async () => {
            await rag.index(sampleDocuments);
            const result = await rag.ask('What is your return policy?');

            expect(result.sources.length).toBeGreaterThan(0);
            expect(result.sources[0].title).toBe('Return Policy');
            expect(result.topScore).toBeGreaterThan(0);
        });

        it('should find relevant document for shipping question', async () => {
            await rag.index(sampleDocuments);
            const result = await rag.ask('How long does shipping take?');

            expect(result.sources.length).toBeGreaterThan(0);
            expect(result.sources[0].title).toBe('Shipping Information');
        });

        it('should find relevant document for warranty question', async () => {
            await rag.index(sampleDocuments);
            const result = await rag.ask('Do you offer warranty on products?');

            expect(result.sources.length).toBeGreaterThan(0);
            expect(result.sources[0].title).toBe('Product Warranty');
        });

        it('should return low score for unrelated question', async () => {
            await rag.index(sampleDocuments);
            const result = await rag.ask('What is the weather like today?');

            // Should still return something, but with low relevance
            expect(result.topScore).toBeLessThan(0.3);
        });

        it('should extract relevant snippets in answer', async () => {
            await rag.index(sampleDocuments);
            const result = await rag.ask('How many days for returns?');

            expect(result.answer).toContain('30 days');
        });
    });

    describe('reset', () => {
        it('should clear all indexed data', async () => {
            await rag.index(sampleDocuments);
            expect(rag.isIndexed()).toBe(true);

            rag.reset();

            expect(rag.isIndexed()).toBe(false);
            const result = await rag.ask('return policy');
            expect(result.sources).toHaveLength(0);
        });
    });
});
