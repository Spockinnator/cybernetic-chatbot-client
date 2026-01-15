// src/CyberneticLocalRAG.ts
// Local RAG processing for offline fallback

import type { CachedDocument } from './types.js';

interface LocalRAGResult {
    answer: string;
    sources: Array<{
        title: string;
        snippet: string;
        score: number;
    }>;
    topScore: number;
}

interface IndexedDocument {
    id: string;
    title: string;
    content: string;
    tokens: string[];
    tfidf: Map<string, number>;
}

/**
 * Local RAG engine using TF-IDF similarity
 *
 * Provides offline fallback when backend is unavailable.
 * Uses simple TF-IDF for document matching (no vector embeddings).
 */
export class CyberneticLocalRAG {
    private documents: IndexedDocument[] = [];
    private idf: Map<string, number> = new Map();
    private indexed = false;

    /**
     * Check if documents are indexed
     */
    isIndexed(): boolean {
        return this.indexed && this.documents.length > 0;
    }

    /**
     * Index documents for local search
     */
    async index(documents: CachedDocument[]): Promise<void> {
        this.documents = [];
        this.idf = new Map();

        // Tokenize and build document frequency
        const docFreq = new Map<string, number>();

        for (const doc of documents) {
            const tokens = this.tokenize(doc.content);
            const uniqueTokens = new Set(tokens);

            // Count document frequency
            for (const token of uniqueTokens) {
                docFreq.set(token, (docFreq.get(token) || 0) + 1);
            }

            // Store indexed document
            this.documents.push({
                id: doc.id,
                title: doc.title,
                content: doc.content,
                tokens,
                tfidf: new Map()  // Computed after IDF is known
            });
        }

        // Compute IDF
        const N = documents.length;
        for (const [term, df] of docFreq) {
            this.idf.set(term, Math.log((N + 1) / (df + 1)) + 1);
        }

        // Compute TF-IDF for each document
        for (const doc of this.documents) {
            const termFreq = this.computeTermFrequency(doc.tokens);
            for (const [term, tf] of termFreq) {
                const idf = this.idf.get(term) || 1;
                doc.tfidf.set(term, tf * idf);
            }
        }

        this.indexed = true;
    }

    /**
     * Process query and generate response
     */
    async ask(query: string): Promise<LocalRAGResult> {
        if (!this.indexed || this.documents.length === 0) {
            return {
                answer: 'I don\'t have any information available offline.',
                sources: [],
                topScore: 0
            };
        }

        // Tokenize query and compute TF-IDF
        const queryTokens = this.tokenize(query);
        const queryTf = this.computeTermFrequency(queryTokens);
        const queryTfidf = new Map<string, number>();

        for (const [term, tf] of queryTf) {
            const idf = this.idf.get(term) || 1;
            queryTfidf.set(term, tf * idf);
        }

        // Compute similarity scores
        const scores = this.documents.map(doc => ({
            doc,
            score: this.cosineSimilarity(queryTfidf, doc.tfidf)
        }));

        // Sort by score descending
        scores.sort((a, b) => b.score - a.score);

        // Take top 3 results
        const topResults = scores.slice(0, 3).filter(r => r.score > 0.1);

        if (topResults.length === 0) {
            return {
                answer: 'I couldn\'t find relevant information for your question in my offline data.',
                sources: [],
                topScore: scores[0]?.score || 0
            };
        }

        // Generate simple answer from top result
        const topDoc = topResults[0].doc;
        const snippet = this.extractRelevantSnippet(topDoc.content, queryTokens);

        return {
            answer: snippet,
            sources: topResults.map(r => ({
                title: r.doc.title,
                snippet: r.doc.content.substring(0, 200) + '...',
                score: r.score
            })),
            topScore: topResults[0].score
        };
    }

    /**
     * Reset the index
     */
    reset(): void {
        this.documents = [];
        this.idf = new Map();
        this.indexed = false;
    }

    // ==================== PRIVATE METHODS ====================

    /**
     * Tokenize text into words
     */
    private tokenize(text: string): string[] {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(token => token.length > 2 && !this.isStopWord(token));
    }

    /**
     * Compute term frequency
     */
    private computeTermFrequency(tokens: string[]): Map<string, number> {
        const freq = new Map<string, number>();
        for (const token of tokens) {
            freq.set(token, (freq.get(token) || 0) + 1);
        }

        // Normalize by document length
        const maxFreq = Math.max(...freq.values());
        if (maxFreq > 0) {
            for (const [term, f] of freq) {
                freq.set(term, f / maxFreq);
            }
        }

        return freq;
    }

    /**
     * Compute cosine similarity between two TF-IDF vectors
     */
    private cosineSimilarity(
        vec1: Map<string, number>,
        vec2: Map<string, number>
    ): number {
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        for (const [term, val1] of vec1) {
            const val2 = vec2.get(term) || 0;
            dotProduct += val1 * val2;
            norm1 += val1 * val1;
        }

        for (const val of vec2.values()) {
            norm2 += val * val;
        }

        if (norm1 === 0 || norm2 === 0) return 0;
        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }

    /**
     * Extract most relevant snippet from content
     */
    private extractRelevantSnippet(content: string, queryTokens: string[]): string {
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);

        // Score sentences by query token overlap
        const scored = sentences.map(sentence => {
            const sentenceTokens = new Set(this.tokenize(sentence));
            let score = 0;
            for (const qt of queryTokens) {
                if (sentenceTokens.has(qt)) score++;
            }
            return { sentence: sentence.trim(), score };
        });

        scored.sort((a, b) => b.score - a.score);

        // Take top 2-3 sentences
        const topSentences = scored.slice(0, 3).filter(s => s.score > 0);

        if (topSentences.length === 0) {
            return content.substring(0, 300) + '...';
        }

        return topSentences.map(s => s.sentence).join('. ') + '.';
    }

    /**
     * Check if word is a stop word
     */
    private isStopWord(word: string): boolean {
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
            'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
            'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
            'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their',
            'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how',
            'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
            'such', 'no', 'not', 'only', 'same', 'so', 'than', 'too', 'very'
        ]);
        return stopWords.has(word);
    }
}
