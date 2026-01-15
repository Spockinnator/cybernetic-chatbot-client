// src/ApiClient.ts
// HTTP client for AsterMind backend API

import type { Source, SystemSettings } from './types.js';

interface ChatRequest {
    sessionId?: string;
    context?: {
        currentPage?: string;
        pageTitle?: string;
    };
}

interface ChatResponse {
    reply: string;
    sessionId: string;
    sources: Source[];
    usage: {
        tokensUsed: number;
        quotaRemaining: {
            minute: number;
            day: number;
        };
    };
}

interface StreamCallbacks {
    onToken?: (token: string) => void;
    onSources?: (sources: Source[]) => void;
    onComplete?: (data: { fullText: string; sessionId?: string; sources?: Source[] }) => void;
    onError?: (error: Error) => void;
}

interface StatusResponse {
    status: string;
    apiKey: { id: string; scopes: string[] };
    quota: {
        perMinute: { limit: number; remaining: number };
        perDay: { limit: number; remaining: number };
    };
    systemSettings?: SystemSettings;
}

/**
 * HTTP/SSE client for AsterMind backend
 */
export class ApiClient {
    private baseUrl: string;
    private apiKey: string;

    constructor(baseUrl: string, apiKey: string) {
        this.baseUrl = baseUrl.replace(/\/$/, '');  // Remove trailing slash
        this.apiKey = apiKey;
    }

    /**
     * Send chat message and get complete response
     */
    async chat(
        message: string,
        options?: ChatRequest
    ): Promise<ChatResponse> {
        const response = await fetch(`${this.baseUrl}/api/external/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey
            },
            body: JSON.stringify({
                message,
                sessionId: options?.sessionId,
                context: options?.context
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * Send chat message with streaming response via SSE
     */
    async chatStream(
        message: string,
        options: ChatRequest & StreamCallbacks
    ): Promise<void> {
        const response = await fetch(`${this.baseUrl}/api/external/chat/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey
            },
            body: JSON.stringify({
                message,
                sessionId: options?.sessionId,
                context: options?.context
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || `HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('Streaming not supported');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';
        let sources: Source[] = [];
        let sessionId: string | undefined;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        // Event type handled in data line
                    } else if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            if (data.text !== undefined) {
                                // Token event
                                fullText += data.text;
                                options.onToken?.(data.text);
                            } else if (data.sources !== undefined) {
                                // Sources event
                                sources = data.sources;
                                options.onSources?.(sources);
                            } else if (data.sessionId !== undefined) {
                                // Done event
                                sessionId = data.sessionId;
                            }
                        } catch {
                            // Skip malformed JSON
                        }
                    }
                }
            }

            options.onComplete?.({ fullText, sessionId, sources });
        } catch (error) {
            options.onError?.(error as Error);
        }
    }

    /**
     * Get general documents for caching
     */
    async getGeneralDocs(since?: string | null): Promise<Array<{
        id: string;
        title: string;
        content: string;
        updatedAt: string;
    }>> {
        const params = new URLSearchParams();
        if (since) {
            params.set('since', since);
        }

        const url = `${this.baseUrl}/api/external/docs${params.toString() ? '?' + params : ''}`;
        const response = await fetch(url, {
            headers: {
                'X-API-Key': this.apiKey
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.documents;
    }

    /**
     * Get API status, quota, and system settings
     */
    async getStatus(): Promise<StatusResponse> {
        const response = await fetch(`${this.baseUrl}/api/external/status`, {
            headers: {
                'X-API-Key': this.apiKey
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return response.json();
    }

    /**
     * Health check (no auth required)
     */
    async health(): Promise<{ status: string; timestamp: string }> {
        const response = await fetch(`${this.baseUrl}/api/external/health`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return response.json();
    }
}
