// src/config.ts
// Configuration loading and validation

import type { CyberneticConfig } from './types.js';

/**
 * Validate configuration
 */
export function validateConfig(config: unknown): config is CyberneticConfig {
    if (!config || typeof config !== 'object') {
        throw new Error('Config must be an object');
    }

    const c = config as Record<string, unknown>;

    if (!c.apiUrl || typeof c.apiUrl !== 'string') {
        throw new Error('apiUrl is required and must be a string');
    }

    if (!c.apiKey || typeof c.apiKey !== 'string') {
        throw new Error('apiKey is required and must be a string');
    }

    if (!c.apiKey.startsWith('am_')) {
        throw new Error('apiKey must start with "am_"');
    }

    return true;
}

/**
 * Load config from window.astermindConfig or script tag data attributes
 */
export function loadConfig(): CyberneticConfig | null {
    if (typeof window === 'undefined') {
        return null;
    }

    // Check for global config object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).astermindConfig) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const config = (window as any).astermindConfig;
        validateConfig(config);
        return config;
    }

    // Check for script tag with data attributes
    const script = document.querySelector('script[data-astermind-key]');
    if (script) {
        return {
            apiUrl: script.getAttribute('data-astermind-url') || 'https://api.astermind.ai',
            apiKey: script.getAttribute('data-astermind-key') || ''
        };
    }

    return null;
}
