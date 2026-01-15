// src/types.ts
// Type definitions for Cybernetic Chatbot Client

/**
 * Configuration for CyberneticClient
 */
export interface CyberneticConfig {
    /** Backend API URL */
    apiUrl: string;

    /** API key for authentication */
    apiKey: string;

    /** Fallback/offline configuration */
    fallback?: {
        /** Enable offline fallback (default: true) */
        enabled?: boolean;

        /** Cache max age in milliseconds (default: 24 hours) */
        cacheMaxAge?: number;

        /** Sync documents on connect (default: true) */
        cacheOnConnect?: boolean;

        /** Storage type (default: 'indexeddb') */
        cacheStorage?: 'indexeddb' | 'localstorage';
    };

    /** Retry configuration */
    retry?: {
        /** Max retries before fallback (default: 2) */
        maxRetries?: number;

        /** Initial delay in ms (default: 1000) */
        initialDelay?: number;

        /** Use exponential backoff (default: true) */
        exponentialBackoff?: boolean;
    };

    /** Event callbacks */
    onStatusChange?: (status: ConnectionStatus) => void;
    onError?: (error: CyberneticError) => void;

    /** Optional agentic capabilities configuration (requires importing CyberneticAgent) */
    agentic?: AgenticConfig;
}

/**
 * Agentic capabilities configuration
 * Only active when CyberneticAgent is imported AND enabled
 */
export interface AgenticConfig {
    /** Enable agentic DOM interactions (default: false) */
    enabled: boolean;

    /** Confidence threshold for action execution (default: 0.8) */
    confidenceThreshold?: number;

    /** Allowed DOM actions */
    allowedActions?: ('click' | 'fill' | 'scroll' | 'navigate' | 'select')[];

    /** Require user confirmation before actions (default: true) */
    confirmActions?: boolean;

    /**
     * Alias for confirmActions - require user confirmation before actions
     * Use this or confirmActions, not both
     */
    requireConfirmation?: boolean;

    /** Maximum actions per conversation turn (default: 5) */
    maxActionsPerTurn?: number;

    /** CSS selectors to never interact with */
    blockedSelectors?: string[];

    /** Only allow actions within these selectors */
    allowedSelectors?: string[];
}

/**
 * Connection status
 */
export type ConnectionStatus = 'online' | 'offline' | 'connecting' | 'error';

/**
 * Confidence level of response
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'none';

/**
 * Source document from RAG
 */
export interface Source {
    title: string;
    snippet: string;
    relevance: number;
    documentId?: string;
}

/**
 * Response from CyberneticClient
 * Always returned, never throws
 */
export interface CyberneticResponse {
    /** The response text */
    reply: string;

    /** Confidence level of the response */
    confidence: ConfidenceLevel;

    /** Source documents used */
    sources: Source[];

    /** Whether response came from offline fallback */
    offline: boolean;

    /** Session ID for conversation continuity */
    sessionId?: string;

    /** Seconds until retry is suggested (only on failures) */
    retryAfter?: number;

    /** Why confidence is reduced (for debugging) */
    degradedReason?: string;
}

/**
 * Request options for ask()
 */
export interface AskOptions {
    /** Session ID for conversation continuity */
    sessionId?: string;

    /** Context metadata */
    context?: {
        currentPage?: string;
        pageTitle?: string;
    };

    /** Skip offline fallback for this request */
    skipFallback?: boolean;
}

/**
 * Streaming callback for SSE responses
 */
export interface StreamCallbacks {
    onToken?: (token: string) => void;
    onSources?: (sources: Source[]) => void;
    onComplete?: (response: CyberneticResponse) => void;
    onError?: (error: CyberneticError) => void;
}

/**
 * Cached document for offline RAG
 */
export interface CachedDocument {
    id: string;
    title: string;
    content: string;
    updatedAt: string;
    embedding?: number[];  // Pre-computed for local RAG
}

/**
 * Cache status
 */
export interface CacheStatus {
    documentCount: number;
    lastSyncAt: string | null;
    cacheSize: number;  // Approximate bytes
    isStale: boolean;
}

/**
 * Error type for Cybernetic operations
 */
export interface CyberneticError {
    code: 'NETWORK_ERROR' | 'AUTH_ERROR' | 'RATE_LIMIT' | 'SERVER_ERROR' | 'CACHE_ERROR' | 'LOCAL_RAG_ERROR';
    message: string;
    retryAfter?: number;
    originalError?: Error;
}

/**
 * System-wide settings from server (ADR-200)
 */
export interface SystemSettings {
    /** Hours to retain cached data (default: 168 = 7 days) */
    cacheRetentionHours: number;

    /** When true, clients should use cached data only */
    maintenanceMode: boolean;

    /** Optional message to display during maintenance */
    maintenanceMessage?: string;

    /** Force all clients to operate in offline mode */
    forceOfflineClients: boolean;
}
