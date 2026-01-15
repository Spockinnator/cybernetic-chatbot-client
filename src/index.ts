// src/index.ts
// Main package exports (core + tree-shakeable agentic)

// Core exports
export { CyberneticClient } from './CyberneticClient.js';
export type { AgenticCapabilities } from './CyberneticClient.js';
export { ApiClient } from './ApiClient.js';
export { CyberneticCache } from './CyberneticCache.js';
export { CyberneticLocalRAG } from './CyberneticLocalRAG.js';
export { loadConfig, validateConfig } from './config.js';

export type {
    CyberneticConfig,
    CyberneticResponse,
    CyberneticError,
    Source,
    CachedDocument,
    CacheStatus,
    ConnectionStatus,
    ConfidenceLevel,
    AskOptions,
    StreamCallbacks,
    SystemSettings,
    AgenticConfig
} from './types.js';

// Re-export agentic module (tree-shakeable - only included when imported)
export {
    CyberneticAgent,
    CyberneticIntentClassifier,
    registerAgenticCapabilities
} from './agentic/index.js';

export type {
    ActionType,
    AgentAction,
    ActionResult,
    IntentClassification,
    AgentConfig
} from './agentic/types.js';

// Convenience function for quick setup
import type { CyberneticConfig } from './types.js';
import { CyberneticClient } from './CyberneticClient.js';

export function createClient(config: CyberneticConfig): CyberneticClient {
    return new CyberneticClient(config);
}
