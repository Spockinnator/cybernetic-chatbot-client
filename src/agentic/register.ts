// src/agentic/register.ts
// Helper for registering agentic capabilities with CyberneticClient

import type { CyberneticClient, AgenticCapabilities } from '../CyberneticClient.js';
import { CyberneticAgent } from './CyberneticAgent.js';
import { CyberneticIntentClassifier } from './CyberneticIntentClassifier.js';

/**
 * Register agentic capabilities with a CyberneticClient
 *
 * This function is the bridge between core and agentic modules.
 * It must be called after creating the client to enable agentic features.
 *
 * @example
 * ```typescript
 * import { CyberneticClient, registerAgenticCapabilities } from '@astermind/cybernetic-chatbot-client';
 *
 * const client = new CyberneticClient({
 *     apiUrl: 'https://api.example.com',
 *     apiKey: 'am_xxx_123',
 *     agentic: {
 *         enabled: true,
 *         allowedActions: ['click', 'fill', 'scroll'],
 *         confirmActions: true
 *     }
 * });
 *
 * // Register agentic capabilities
 * registerAgenticCapabilities(client);
 *
 * // Now client supports agentic responses
 * const response = await client.ask('Click the Add to Cart button');
 * ```
 *
 * @param client - The CyberneticClient instance to register capabilities with
 */
export function registerAgenticCapabilities(client: CyberneticClient): void {
    const capabilities: AgenticCapabilities = {
        agent: CyberneticAgent,
        intentClassifier: CyberneticIntentClassifier
    };
    client.registerAgentic(capabilities);
}
