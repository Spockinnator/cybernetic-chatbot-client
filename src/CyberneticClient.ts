// src/CyberneticClient.ts
// Main client with API calls and offline fallback

import { ApiClient } from './ApiClient.js';
import { CyberneticCache } from './CyberneticCache.js';
import { CyberneticLocalRAG } from './CyberneticLocalRAG.js';
import type {
    CyberneticConfig,
    CyberneticResponse,
    CyberneticError,
    ConnectionStatus,
    AskOptions,
    StreamCallbacks,
    CacheStatus,
    SystemSettings,
    AgenticConfig
} from './types.js';

/**
 * Interface for agentic capabilities registration
 * Used by registerAgenticCapabilities() helper from agentic module
 */
export interface AgenticCapabilities {
    /** CyberneticAgent class for DOM interactions */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    agent: any;
    /** CyberneticIntentClassifier class for intent detection */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    intentClassifier?: any;
}

/**
 * Internal config with all defaults applied
 */
interface ResolvedConfig {
    apiUrl: string;
    apiKey: string;
    fallback: {
        enabled: boolean;
        cacheMaxAge: number;
        cacheOnConnect: boolean;
        cacheStorage: 'indexeddb' | 'localstorage';
    };
    retry: {
        maxRetries: number;
        initialDelay: number;
        exponentialBackoff: boolean;
    };
    agentic: AgenticConfig | null;
    onStatusChange: (status: ConnectionStatus) => void;
    onError: (error: CyberneticError) => void;
}

/**
 * Cybernetic Chatbot Client
 *
 * Provides API access to AsterMind backend with offline fallback.
 * Always returns a response, never throws exceptions.
 */
export class CyberneticClient {
    private config: ResolvedConfig;
    private apiClient: ApiClient;
    private cache: CyberneticCache;
    private localRAG: CyberneticLocalRAG;
    private status: ConnectionStatus = 'connecting';
    private lastError: CyberneticError | null = null;

    // Maintenance mode tracking (ADR-200)
    private systemSettings: SystemSettings | null = null;
    private settingsLastChecked: number = 0;
    private readonly SETTINGS_CHECK_INTERVAL = 300000; // 5 minutes

    // Agentic capabilities (optional, registered separately via registerAgenticCapabilities)
    private agenticCapabilities: AgenticCapabilities | null = null;

    constructor(config: CyberneticConfig) {
        // Apply defaults
        this.config = {
            apiUrl: config.apiUrl,
            apiKey: config.apiKey,
            fallback: {
                enabled: config.fallback?.enabled ?? true,
                cacheMaxAge: config.fallback?.cacheMaxAge ?? 86400000, // 24 hours
                cacheOnConnect: config.fallback?.cacheOnConnect ?? true,
                cacheStorage: config.fallback?.cacheStorage ?? 'indexeddb'
            },
            retry: {
                maxRetries: config.retry?.maxRetries ?? 2,
                initialDelay: config.retry?.initialDelay ?? 1000,
                exponentialBackoff: config.retry?.exponentialBackoff ?? true
            },
            agentic: config.agentic ?? null,
            onStatusChange: config.onStatusChange || (() => {}),
            onError: config.onError || (() => {})
        };

        // Initialize components
        this.apiClient = new ApiClient(this.config.apiUrl, this.config.apiKey);
        this.cache = new CyberneticCache({
            storage: this.config.fallback.cacheStorage,
            maxAge: this.config.fallback.cacheMaxAge
        });
        this.localRAG = new CyberneticLocalRAG();

        // Monitor connection status
        this.monitorConnection();

        // Pre-cache documents on init if enabled
        if (this.config.fallback.enabled && this.config.fallback.cacheOnConnect) {
            this.syncCache().catch(() => {
                // Silent failure on init - cache may be stale but usable
            });
        }
    }

    // ==================== AGENTIC CAPABILITIES ====================

    /**
     * Register agentic capabilities
     * Called by registerAgenticCapabilities() helper from agentic module
     *
     * @example
     * ```typescript
     * import { CyberneticClient, registerAgenticCapabilities } from '@astermind/cybernetic-chatbot-client';
     * const client = new CyberneticClient(config);
     * registerAgenticCapabilities(client);
     * ```
     */
    registerAgentic(capabilities: AgenticCapabilities): void {
        this.agenticCapabilities = capabilities;
        console.log('[Cybernetic] Agentic capabilities registered');
    }

    /**
     * Check if agentic capabilities are available and enabled
     */
    isAgenticEnabled(): boolean {
        return this.agenticCapabilities !== null &&
               this.config.agentic?.enabled === true;
    }

    /**
     * Get registered agentic capabilities (for advanced use)
     */
    getAgenticCapabilities(): AgenticCapabilities | null {
        return this.agenticCapabilities;
    }

    /**
     * Get agentic configuration
     */
    getAgenticConfig(): AgenticConfig | null {
        return this.config.agentic;
    }

    /**
     * Classify user message intent for agentic action
     * Only works if agentic capabilities are registered and enabled
     *
     * @param message - User's message to classify
     * @returns Intent classification or null if agentic not available
     */
    classifyIntent(message: string): {
        action: {
            id: string;
            type: string;
            target: string;
            confidence: number;
            explanation?: string;
            params?: Record<string, unknown>;
        } | null;
        shouldEscalate: boolean;
        rawConfidence: number;
        matchedPatterns?: string[];
    } | null {
        if (!this.isAgenticEnabled() || !this.agenticCapabilities) {
            return null;
        }

        // Create agent instance if needed for classification
        const agentConfig = this.config.agentic!;
        const AgentClass = this.agenticCapabilities.agent;
        const agent = new AgentClass(agentConfig);

        return agent.interpretIntent(message);
    }

    /**
     * Execute an agent action
     * Only works if agentic capabilities are registered and enabled
     *
     * @param action - Action to execute
     * @returns Action result or error
     */
    async executeAction(action: {
        id: string;
        type: string;
        target: string;
        confidence: number;
        params?: Record<string, unknown>;
    }): Promise<{
        success: boolean;
        message: string;
        error?: string;
    }> {
        if (!this.isAgenticEnabled() || !this.agenticCapabilities) {
            return {
                success: false,
                message: 'Agentic capabilities not enabled'
            };
        }

        const agentConfig = this.config.agentic!;
        const AgentClass = this.agenticCapabilities.agent;
        const agent = new AgentClass(agentConfig);

        return agent.executeAction(action);
    }

    /**
     * Smart ask - checks for action intent first, then falls back to RAG
     * Combines agentic classification with standard RAG query
     *
     * @param message - User's message
     * @param options - Optional request configuration
     * @returns Object containing response, action, and/or action result
     */
    async smartAsk(message: string, options?: AskOptions): Promise<{
        response?: CyberneticResponse;
        action?: {
            id: string;
            type: string;
            target: string;
            confidence: number;
            explanation?: string;
            params?: Record<string, unknown>;
        };
        actionResult?: {
            success: boolean;
            message: string;
            error?: string;
        };
    }> {
        // Check for actionable intent if agentic is enabled
        const classification = this.classifyIntent(message);

        if (classification && classification.action && !classification.shouldEscalate) {
            // High confidence action detected
            if (this.config.agentic?.requireConfirmation !== false) {
                // Return action for UI confirmation without executing
                return { action: classification.action };
            }

            // Auto-execute if confirmation not required
            const result = await this.executeAction(classification.action);
            return {
                action: classification.action,
                actionResult: result
            };
        }

        // Low confidence or no action - proceed to RAG
        const response = await this.ask(message, options);
        return { response };
    }

    // ==================== CORE METHODS ====================

    /**
     * Send a message to the chatbot
     * Always returns a response, never throws
     *
     * @param message - User's message
     * @param options - Optional request configuration
     */
    async ask(message: string, options?: AskOptions): Promise<CyberneticResponse> {
        // Validate input
        if (!message || typeof message !== 'string') {
            return this.createErrorResponse('Message is required', 'none');
        }

        // Check maintenance mode before API call (ADR-200)
        const settings = await this.checkSystemStatus();

        if (settings.maintenanceMode || settings.forceOfflineClients) {
            console.log('[Cybernetic] Maintenance mode active, using cached data');

            // Return maintenance response if no cached data
            if (!this.isCacheValid()) {
                return {
                    reply: settings.maintenanceMessage ||
                        'The service is currently under maintenance. Please try again later.',
                    confidence: 'none',
                    sources: [],
                    offline: true,
                    degradedReason: 'Maintenance mode active, no valid cache available'
                };
            }

            // Use local fallback during maintenance
            return await this.fallbackAsk(message);
        }

        // Try API first
        try {
            const response = await this.apiWithRetry(message, options);
            this.setStatus('online');
            return {
                reply: response.reply,
                confidence: 'high',
                sources: response.sources || [],
                offline: false,
                sessionId: response.sessionId
            };
        } catch (error) {
            const omegaError = this.normalizeError(error);
            this.lastError = omegaError;
            this.config.onError(omegaError);

            // Rate limit - don't fallback, return error response
            if (omegaError.code === 'RATE_LIMIT') {
                return {
                    reply: 'I\'m receiving too many requests right now. Please try again in a moment.',
                    confidence: 'none',
                    sources: [],
                    offline: false,
                    retryAfter: omegaError.retryAfter
                };
            }

            // Try fallback if enabled and not explicitly skipped
            if (this.config.fallback.enabled && !options?.skipFallback) {
                return await this.fallbackAsk(message);
            }

            // No fallback - return error response
            return this.createErrorResponse(
                'Unable to connect to the chatbot service. Please try again later.',
                'none',
                omegaError.retryAfter
            );
        }
    }

    /**
     * Send a message with streaming response
     *
     * @param message - User's message
     * @param callbacks - Streaming event callbacks
     * @param options - Optional request configuration
     */
    async askStream(
        message: string,
        callbacks: StreamCallbacks,
        options?: AskOptions
    ): Promise<void> {
        if (!message || typeof message !== 'string') {
            callbacks.onError?.({
                code: 'LOCAL_RAG_ERROR',
                message: 'Message is required'
            });
            return;
        }

        // Check maintenance mode before API call (ADR-200)
        const settings = await this.checkSystemStatus();

        if (settings.maintenanceMode || settings.forceOfflineClients) {
            console.log('[Cybernetic] Maintenance mode active, falling back to offline');
            const response = await this.fallbackAsk(message);
            callbacks.onComplete?.(response);
            return;
        }

        try {
            await this.apiClient.chatStream(message, {
                sessionId: options?.sessionId,
                context: options?.context,
                onToken: callbacks.onToken,
                onSources: callbacks.onSources,
                onComplete: (data) => {
                    this.setStatus('online');
                    callbacks.onComplete?.({
                        reply: data.fullText,
                        confidence: 'high',
                        sources: data.sources || [],
                        offline: false,
                        sessionId: data.sessionId
                    });
                },
                onError: (error) => {
                    const omegaError = this.normalizeError(error);
                    this.config.onError(omegaError);
                    callbacks.onError?.(omegaError);
                }
            });
        } catch (error) {
            const omegaError = this.normalizeError(error);
            this.lastError = omegaError;
            this.config.onError(omegaError);

            // Fall back to non-streaming if enabled
            if (this.config.fallback.enabled && !options?.skipFallback) {
                const response = await this.fallbackAsk(message);
                callbacks.onComplete?.(response);
            } else {
                callbacks.onError?.(omegaError);
            }
        }
    }

    /**
     * Sync documents to local cache for offline use
     */
    async syncCache(): Promise<void> {
        try {
            const lastSync = await this.cache.getLastSync();
            const docs = await this.apiClient.getGeneralDocs(lastSync);

            if (docs.length > 0) {
                await this.cache.store(docs);
                await this.localRAG.index(docs);
                console.log(`[Cybernetic] Cache synced: ${docs.length} documents`);
            }

            this.setStatus('online');
        } catch (error) {
            console.warn('[Cybernetic] Cache sync failed:', error);
            // Don't change status - we may still have cached data
        }
    }

    /**
     * Get current connection status including system settings
     */
    getStatus(): {
        connection: ConnectionStatus;
        cache: CacheStatus;
        lastError: CyberneticError | null;
        systemSettings: SystemSettings | null;
    } {
        return {
            connection: this.status,
            cache: this.cache.getStatus(),
            lastError: this.lastError,
            systemSettings: this.systemSettings
        };
    }

    /**
     * Clear local cache
     */
    async clearCache(): Promise<void> {
        await this.cache.clear();
        this.localRAG.reset();
    }

    /**
     * Manually check if backend is reachable
     */
    async checkConnection(): Promise<boolean> {
        try {
            await this.apiClient.getStatus();
            this.setStatus('online');
            return true;
        } catch {
            this.setStatus('offline');
            return false;
        }
    }

    // ==================== MAINTENANCE MODE METHODS (ADR-200) ====================

    /**
     * Check system status including maintenance mode
     * Called periodically and before API calls
     */
    async checkSystemStatus(): Promise<SystemSettings> {
        // Use cached settings if recently checked
        if (this.systemSettings &&
            Date.now() - this.settingsLastChecked < this.SETTINGS_CHECK_INTERVAL) {
            return this.systemSettings;
        }

        try {
            const status = await this.apiClient.getStatus();

            // Extract system settings from status response
            this.systemSettings = {
                cacheRetentionHours: status.systemSettings?.cacheRetentionHours ?? 168,
                maintenanceMode: status.systemSettings?.maintenanceMode ?? false,
                maintenanceMessage: status.systemSettings?.maintenanceMessage,
                forceOfflineClients: status.systemSettings?.forceOfflineClients ?? false
            };
            this.settingsLastChecked = Date.now();

            return this.systemSettings;
        } catch {
            // On error, return cached settings or safe defaults
            return this.systemSettings || {
                cacheRetentionHours: 168,
                maintenanceMode: false,
                forceOfflineClients: false
            };
        }
    }

    /**
     * Check if maintenance mode is active
     */
    isMaintenanceMode(): boolean {
        return this.systemSettings?.maintenanceMode ?? false;
    }

    /**
     * Get maintenance message if in maintenance mode
     */
    getMaintenanceMessage(): string | undefined {
        return this.systemSettings?.maintenanceMessage;
    }

    /**
     * Validate cache using server-configured retention hours
     */
    isCacheValid(): boolean {
        const cacheStatus = this.cache.getStatus();
        if (!cacheStatus.lastSyncAt) return false;

        // Use server-configured retention or default 168 hours (7 days)
        const retentionHours = this.systemSettings?.cacheRetentionHours || 168;
        const retentionMs = retentionHours * 60 * 60 * 1000;

        const lastSyncTime = new Date(cacheStatus.lastSyncAt).getTime();

        return Date.now() - lastSyncTime < retentionMs;
    }

    // ==================== PRIVATE METHODS ====================

    /**
     * API call with retry logic
     */
    private async apiWithRetry(
        message: string,
        options?: AskOptions
    ): Promise<{
        reply: string;
        sessionId?: string;
        sources?: Array<{ title: string; snippet: string; relevance: number }>;
    }> {
        const { maxRetries, initialDelay, exponentialBackoff } = this.config.retry;
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await this.apiClient.chat(message, {
                    sessionId: options?.sessionId,
                    context: options?.context
                });
            } catch (error) {
                lastError = error as Error;

                // Don't retry on auth or rate limit errors
                const omegaError = this.normalizeError(error);
                if (omegaError.code === 'AUTH_ERROR' || omegaError.code === 'RATE_LIMIT') {
                    throw error;
                }

                // Wait before retry
                if (attempt < maxRetries) {
                    const delay = exponentialBackoff
                        ? initialDelay * Math.pow(2, attempt)
                        : initialDelay;
                    await this.sleep(delay);
                }
            }
        }

        throw lastError;
    }

    /**
     * Fallback to local RAG processing
     */
    private async fallbackAsk(message: string): Promise<CyberneticResponse> {
        this.setStatus('offline');

        // Check if we have cached documents
        const cacheStatus = this.cache.getStatus();

        if (cacheStatus.documentCount === 0) {
            return {
                reply: 'I\'m currently offline and don\'t have any cached information. Please check your connection and try again.',
                confidence: 'none',
                sources: [],
                offline: true,
                degradedReason: 'No cached documents available'
            };
        }

        try {
            // Get documents from cache
            const docs = await this.cache.retrieve();

            // Ensure local RAG is indexed
            if (!this.localRAG.isIndexed()) {
                await this.localRAG.index(docs);
            }

            // Process with local RAG
            const result = await this.localRAG.ask(message);

            // Determine confidence based on match quality
            let confidence: 'high' | 'medium' | 'low' = 'medium';
            if (result.topScore < 0.3) {
                confidence = 'low';
            } else if (result.topScore > 0.7) {
                confidence = 'medium';  // Never 'high' for offline
            }

            return {
                reply: result.answer,
                confidence,
                sources: result.sources.map(s => ({
                    title: s.title,
                    snippet: s.snippet,
                    relevance: s.score
                })),
                offline: true,
                degradedReason: cacheStatus.isStale
                    ? 'Using stale cached data'
                    : 'Processed locally without server'
            };
        } catch (error) {
            console.error('[Cybernetic] Local RAG error:', error);
            return {
                reply: 'I\'m having trouble processing your request offline. Please try again when you\'re back online.',
                confidence: 'none',
                sources: [],
                offline: true,
                degradedReason: 'Local RAG processing failed'
            };
        }
    }

    /**
     * Monitor browser online/offline events
     */
    private monitorConnection(): void {
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => {
                this.syncCache().catch(() => {});
            });

            window.addEventListener('offline', () => {
                this.setStatus('offline');
            });

            // Set initial status
            if (!navigator.onLine) {
                this.setStatus('offline');
            }
        }
    }

    /**
     * Update connection status and notify listeners
     */
    private setStatus(status: ConnectionStatus): void {
        if (this.status !== status) {
            this.status = status;
            this.config.onStatusChange(status);
        }
    }

    /**
     * Normalize various error types to CyberneticError
     */
    private normalizeError(error: unknown): CyberneticError {
        if (error instanceof Error) {
            // Check for specific error types
            if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                return {
                    code: 'AUTH_ERROR',
                    message: 'Invalid or expired API key',
                    originalError: error
                };
            }

            if (error.message.includes('429') || error.message.includes('Rate limit')) {
                const match = error.message.match(/retry after (\d+)/i);
                return {
                    code: 'RATE_LIMIT',
                    message: 'Rate limit exceeded',
                    retryAfter: match ? parseInt(match[1], 10) : 60,
                    originalError: error
                };
            }

            if (error.message.includes('5') || error.message.includes('Server')) {
                return {
                    code: 'SERVER_ERROR',
                    message: 'Server error occurred',
                    originalError: error
                };
            }

            return {
                code: 'NETWORK_ERROR',
                message: error.message || 'Network error',
                originalError: error
            };
        }

        return {
            code: 'NETWORK_ERROR',
            message: 'Unknown error occurred'
        };
    }

    /**
     * Create standardized error response
     */
    private createErrorResponse(
        message: string,
        confidence: 'none' | 'low',
        retryAfter?: number
    ): CyberneticResponse {
        return {
            reply: message,
            confidence,
            sources: [],
            offline: false,
            retryAfter
        };
    }

    /**
     * Async sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
