// src/full.ts
// Full package exports (core + agentic)
//
// Use this entry point if tree-shaking doesn't work in your bundler,
// or if you want to ensure all agentic capabilities are included.
//
// Usage:
//   import { CyberneticClient, CyberneticAgent } from '@astermind/cybernetic-chatbot-client/full';

// Core exports (same as index.ts)
export { CyberneticClient } from './CyberneticClient';
export type { AgenticCapabilities } from './CyberneticClient';
export { ApiClient } from './ApiClient';
export { CyberneticCache } from './CyberneticCache';
export { CyberneticLocalRAG } from './CyberneticLocalRAG';
export { loadConfig, validateConfig } from './config';

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
} from './types';

// Agentic exports (explicitly included in this bundle)
export {
    CyberneticAgent,
    CyberneticIntentClassifier,
    registerAgenticCapabilities
} from './agentic/index';

export type {
    ActionType,
    AgentAction,
    ActionResult,
    IntentClassification,
    SiteMapEntry,
    FormFieldConfig,
    ModalTriggerConfig,
    AgentConfig
} from './agentic/types';

// Convenience function for quick setup
import type { CyberneticConfig } from './types';
import { CyberneticClient } from './CyberneticClient';

export function createClient(config: CyberneticConfig): CyberneticClient {
    return new CyberneticClient(config);
}
