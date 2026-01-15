// src/agentic/CyberneticIntentClassifier.ts
// Hybrid intent classification for agentic capabilities

import type {
    IntentClassification,
    SiteMapEntry,
    FormFieldConfig,
    ModalTriggerConfig,
    AgentConfig
} from './types.js';

/**
 * Action intent patterns with weights
 */
const ACTION_PATTERNS: Record<string, { pattern: RegExp; type: string; weight: number }[]> = {
    navigate: [
        { pattern: /^(go to|navigate to|take me to|open|show me|bring up)\s+(.+)/i, type: 'navigate', weight: 0.9 },
        { pattern: /^(i want to see|i need to go to|let me see)\s+(.+)/i, type: 'navigate', weight: 0.85 },
        { pattern: /^(where is|how do i get to)\s+(.+)/i, type: 'navigate', weight: 0.6 },  // Lower - might be question
    ],
    fillForm: [
        { pattern: /^(search for|find|look up|search)\s+(.+)/i, type: 'fillForm', weight: 0.88 },
        { pattern: /^(filter by|set .+ to|change .+ to)\s+(.+)/i, type: 'fillForm', weight: 0.85 },
        { pattern: /^(enter|type|put)\s+(.+)\s+(in|into)\s+(.+)/i, type: 'fillForm', weight: 0.9 },
    ],
    clickElement: [
        { pattern: /^(click|press|hit|tap)\s+(the\s+)?(.+)\s+(button|link)/i, type: 'clickElement', weight: 0.9 },
        { pattern: /^(submit|send|confirm|save|cancel|delete)/i, type: 'clickElement', weight: 0.85 },
    ],
    triggerModal: [
        { pattern: /^(open|show|display)\s+(the\s+)?(.+)\s+(modal|dialog|popup|window)/i, type: 'triggerModal', weight: 0.9 },
        { pattern: /^(open|show)\s+(help|settings|preferences|options)/i, type: 'triggerModal', weight: 0.85 },
    ],
    scroll: [
        { pattern: /^(scroll to|jump to|go to)\s+(the\s+)?(.+)\s+(section|area|part)/i, type: 'scroll', weight: 0.85 },
        { pattern: /^(show me|take me to)\s+(the\s+)?(bottom|top|end|beginning)/i, type: 'scroll', weight: 0.8 },
    ],
    highlight: [
        { pattern: /^(highlight|show me|point to|where is)\s+(the\s+)?(.+)/i, type: 'highlight', weight: 0.7 },
    ],
    custom: [
        { pattern: /^(export|download|refresh|reload|sync)/i, type: 'custom', weight: 0.85 },
    ]
};

/**
 * Intent classifier for agentic actions
 *
 * Classifies user messages to determine if they should trigger
 * a local DOM action or be sent to the backend RAG.
 */
export class CyberneticIntentClassifier {
    private config: AgentConfig;
    private siteMapIndex: Map<string, SiteMapEntry>;
    private formIndex: Map<string, FormFieldConfig>;
    private modalIndex: Map<string, ModalTriggerConfig>;

    constructor(config: AgentConfig) {
        this.config = config;
        this.siteMapIndex = new Map();
        this.formIndex = new Map();
        this.modalIndex = new Map();

        // Build indexes for fast lookup
        this.buildIndexes();
    }

    /**
     * Build search indexes from configuration
     */
    private buildIndexes(): void {
        // Site map index
        if (this.config.siteMap) {
            for (const entry of this.config.siteMap) {
                // Index by name and aliases
                const keys = [
                    entry.name.toLowerCase(),
                    entry.path.toLowerCase(),
                    ...(entry.aliases || []).map(a => a.toLowerCase())
                ];
                for (const key of keys) {
                    this.siteMapIndex.set(key, entry);
                }
            }
        }

        // Form fields index
        if (this.config.forms) {
            for (const [key, field] of Object.entries(this.config.forms)) {
                const keys = [
                    key.toLowerCase(),
                    field.name.toLowerCase(),
                    ...(field.aliases || []).map(a => a.toLowerCase())
                ];
                for (const k of keys) {
                    this.formIndex.set(k, field);
                }
            }
        }

        // Modal triggers index
        if (this.config.modals) {
            for (const [key, modal] of Object.entries(this.config.modals)) {
                const keys = [
                    key.toLowerCase(),
                    modal.id.toLowerCase(),
                    ...(modal.aliases || []).map(a => a.toLowerCase())
                ];
                for (const k of keys) {
                    this.modalIndex.set(k, modal);
                }
            }
        }
    }

    /**
     * Classify user message intent
     *
     * @param message - User's message to classify
     * @returns Classification result with action and confidence
     */
    classify(message: string): IntentClassification {
        if (!this.config.enabled) {
            return {
                action: null,
                shouldEscalate: true,
                rawConfidence: 0
            };
        }

        const normalizedMessage = message.trim().toLowerCase();

        // Try each action type
        for (const [actionType, patterns] of Object.entries(ACTION_PATTERNS)) {
            for (const { pattern, weight } of patterns) {
                const match = message.match(pattern);
                if (match) {
                    const result = this.buildAction(actionType, match, weight);
                    if (result) {
                        return result;
                    }
                }
            }
        }

        // No pattern match - try fuzzy site map match
        const siteMapResult = this.fuzzyMatchSiteMap(normalizedMessage);
        if (siteMapResult) {
            return siteMapResult;
        }

        // Check for custom action keywords
        const customResult = this.matchCustomAction(normalizedMessage);
        if (customResult) {
            return customResult;
        }

        // No match - escalate to backend
        return {
            action: null,
            shouldEscalate: true,
            rawConfidence: 0,
            matchedPatterns: []
        };
    }

    /**
     * Build action from pattern match
     */
    private buildAction(
        actionType: string,
        match: RegExpMatchArray,
        baseWeight: number
    ): IntentClassification | null {
        const threshold = this.config.confidenceThreshold ?? 0.8;

        switch (actionType) {
            case 'navigate': {
                const target = this.extractTarget(match);
                const siteMatch = this.findSiteMapMatch(target);

                if (siteMatch) {
                    const confidence = baseWeight * siteMatch.similarity;
                    return {
                        action: {
                            id: `action-${Date.now()}`,
                            type: 'navigate',
                            target: siteMatch.entry.path,
                            confidence,
                            explanation: `Navigate to ${siteMatch.entry.name}`
                        },
                        shouldEscalate: confidence < threshold,
                        rawConfidence: confidence,
                        matchedPatterns: ['navigate', siteMatch.entry.name]
                    };
                }
                break;
            }

            case 'fillForm': {
                const target = this.extractTarget(match);
                const { field, value } = this.parseFormIntent(match);

                if (field) {
                    const confidence = baseWeight * 0.95;
                    return {
                        action: {
                            id: `action-${Date.now()}`,
                            type: 'fillForm',
                            target: field.selector,
                            params: { value },
                            confidence,
                            explanation: `Fill "${field.name}" with "${value}"`
                        },
                        shouldEscalate: confidence < threshold,
                        rawConfidence: confidence,
                        matchedPatterns: ['fillForm', field.name]
                    };
                }

                // Default to search field
                if (this.config.forms?.search) {
                    const confidence = baseWeight * 0.9;
                    return {
                        action: {
                            id: `action-${Date.now()}`,
                            type: 'fillForm',
                            target: this.config.forms.search.selector,
                            params: { value: target },
                            confidence,
                            explanation: `Search for "${target}"`
                        },
                        shouldEscalate: confidence < threshold,
                        rawConfidence: confidence,
                        matchedPatterns: ['fillForm', 'search']
                    };
                }
                break;
            }

            case 'clickElement': {
                const buttonName = this.extractTarget(match);
                const selector = this.findButtonSelector(buttonName);

                if (selector) {
                    const confidence = baseWeight * 0.95;
                    return {
                        action: {
                            id: `action-${Date.now()}`,
                            type: 'clickElement',
                            target: selector,
                            confidence,
                            explanation: `Click "${buttonName}" button`
                        },
                        shouldEscalate: confidence < threshold,
                        rawConfidence: confidence,
                        matchedPatterns: ['clickElement', buttonName]
                    };
                }
                break;
            }

            case 'triggerModal': {
                const modalName = this.extractTarget(match);
                const modal = this.findModalConfig(modalName);

                if (modal) {
                    const confidence = baseWeight * 0.95;
                    return {
                        action: {
                            id: `action-${Date.now()}`,
                            type: 'triggerModal',
                            target: modal.trigger,
                            confidence,
                            explanation: `Open ${modal.id} modal`
                        },
                        shouldEscalate: confidence < threshold,
                        rawConfidence: confidence,
                        matchedPatterns: ['triggerModal', modal.id]
                    };
                }
                break;
            }

            case 'scroll': {
                const target = this.extractTarget(match);
                const selector = this.findScrollTarget(target);

                if (selector) {
                    const confidence = baseWeight * 0.9;
                    return {
                        action: {
                            id: `action-${Date.now()}`,
                            type: 'scroll',
                            target: selector,
                            confidence,
                            explanation: `Scroll to ${target}`
                        },
                        shouldEscalate: confidence < threshold,
                        rawConfidence: confidence,
                        matchedPatterns: ['scroll', target]
                    };
                }
                break;
            }

            case 'highlight': {
                // Highlighting is typically lower confidence
                const target = this.extractTarget(match);
                const selector = this.findElementByDescription(target);

                if (selector) {
                    const confidence = baseWeight * 0.85;
                    return {
                        action: {
                            id: `action-${Date.now()}`,
                            type: 'highlight',
                            target: selector,
                            confidence,
                            explanation: `Highlight ${target}`
                        },
                        shouldEscalate: confidence < threshold,
                        rawConfidence: confidence,
                        matchedPatterns: ['highlight', target]
                    };
                }
                break;
            }

            case 'custom': {
                const actionName = match[1]?.toLowerCase();
                if (this.config.customActions?.[actionName]) {
                    const confidence = baseWeight * 0.95;
                    return {
                        action: {
                            id: `action-${Date.now()}`,
                            type: 'custom',
                            target: actionName,
                            confidence,
                            explanation: `Execute ${actionName} action`
                        },
                        shouldEscalate: confidence < threshold,
                        rawConfidence: confidence,
                        matchedPatterns: ['custom', actionName]
                    };
                }
                break;
            }
        }

        return null;
    }

    /**
     * Extract target from regex match
     */
    private extractTarget(match: RegExpMatchArray): string {
        // Get the last non-empty capture group
        for (let i = match.length - 1; i >= 1; i--) {
            if (match[i]) {
                return match[i].trim();
            }
        }
        return '';
    }

    /**
     * Find site map match for target string
     */
    private findSiteMapMatch(target: string): { entry: SiteMapEntry; similarity: number } | null {
        const normalizedTarget = target.toLowerCase().replace(/[^a-z0-9\s]/g, '');

        // Exact match
        const exact = this.siteMapIndex.get(normalizedTarget);
        if (exact) {
            return { entry: exact, similarity: 1.0 };
        }

        // Fuzzy match
        let bestMatch: SiteMapEntry | null = null;
        let bestScore = 0;

        for (const [key, entry] of this.siteMapIndex) {
            const score = this.calculateSimilarity(normalizedTarget, key);
            if (score > bestScore && score > 0.6) {
                bestScore = score;
                bestMatch = entry;
            }
        }

        if (bestMatch) {
            return { entry: bestMatch, similarity: bestScore };
        }

        return null;
    }

    /**
     * Fuzzy match against site map for unstructured queries
     */
    private fuzzyMatchSiteMap(message: string): IntentClassification | null {
        const threshold = this.config.confidenceThreshold ?? 0.8;

        // Look for page/site name mentions
        for (const [key, entry] of this.siteMapIndex) {
            if (message.includes(key)) {
                const confidence = 0.75;  // Lower confidence for implicit matches
                return {
                    action: {
                        id: `action-${Date.now()}`,
                        type: 'navigate',
                        target: entry.path,
                        confidence,
                        explanation: `Navigate to ${entry.name}`
                    },
                    shouldEscalate: confidence < threshold,
                    rawConfidence: confidence,
                    matchedPatterns: ['fuzzy-sitemap', key]
                };
            }
        }

        return null;
    }

    /**
     * Match custom action keywords
     */
    private matchCustomAction(message: string): IntentClassification | null {
        if (!this.config.customActions) return null;

        const threshold = this.config.confidenceThreshold ?? 0.8;

        for (const actionName of Object.keys(this.config.customActions)) {
            if (message.includes(actionName.toLowerCase())) {
                const confidence = 0.85;
                return {
                    action: {
                        id: `action-${Date.now()}`,
                        type: 'custom',
                        target: actionName,
                        confidence,
                        explanation: `Execute ${actionName}`
                    },
                    shouldEscalate: confidence < threshold,
                    rawConfidence: confidence,
                    matchedPatterns: ['custom', actionName]
                };
            }
        }

        return null;
    }

    /**
     * Parse form fill intent
     */
    private parseFormIntent(match: RegExpMatchArray): {
        field: FormFieldConfig | null;
        value: string;
    } {
        const fullText = match[0];

        // Try to extract field name and value
        for (const [, field] of this.formIndex) {
            if (fullText.toLowerCase().includes(field.name.toLowerCase())) {
                // Extract value - everything after the field name
                const valueMatch = fullText.match(new RegExp(`${field.name}[^a-z]*(.+)`, 'i'));
                return {
                    field,
                    value: valueMatch?.[1]?.trim() || ''
                };
            }
        }

        return { field: null, value: this.extractTarget(match) };
    }

    /**
     * Find button selector by name
     */
    private findButtonSelector(name: string): string | null {
        const normalizedName = name.toLowerCase();

        // Check if we're in a browser environment
        if (typeof document === 'undefined') {
            // Return a generic selector for server-side contexts
            return `button:contains("${name}")`;
        }

        // Common button selectors
        const selectors = [
            `[data-action="${normalizedName}"]`,
            `[aria-label*="${normalizedName}" i]`,
            `.btn-${normalizedName}`,
            `#${normalizedName}-button`,
            `button.${normalizedName}`
        ];

        // Check if any selector matches
        for (const selector of selectors) {
            try {
                if (document.querySelector(selector)) {
                    return selector;
                }
            } catch {
                // Invalid selector, continue
            }
        }

        // Fallback - try to find any button with matching text
        const buttons = document.querySelectorAll('button, [role="button"], a.btn');
        for (const btn of buttons) {
            if (btn.textContent?.toLowerCase().includes(normalizedName)) {
                return this.generateUniqueSelector(btn);
            }
        }

        return null;
    }

    /**
     * Find modal config by name
     */
    private findModalConfig(name: string): ModalTriggerConfig | null {
        return this.modalIndex.get(name.toLowerCase()) || null;
    }

    /**
     * Find scroll target selector
     */
    private findScrollTarget(target: string): string | null {
        const normalizedTarget = target.toLowerCase();

        // Special cases
        if (normalizedTarget === 'top' || normalizedTarget === 'beginning') {
            return 'body';
        }
        if (normalizedTarget === 'bottom' || normalizedTarget === 'end') {
            return 'body:last-child';
        }

        // Check if we're in a browser environment
        if (typeof document === 'undefined') {
            return `#${normalizedTarget.replace(/\s+/g, '-')}`;
        }

        // Try to find section by id or class
        const selectors = [
            `#${normalizedTarget.replace(/\s+/g, '-')}`,
            `[data-section="${normalizedTarget}"]`,
            `.${normalizedTarget.replace(/\s+/g, '-')}-section`,
            `section[aria-label*="${normalizedTarget}" i]`
        ];

        for (const selector of selectors) {
            try {
                if (document.querySelector(selector)) {
                    return selector;
                }
            } catch {
                continue;
            }
        }

        return null;
    }

    /**
     * Find element by description
     */
    private findElementByDescription(description: string): string | null {
        const normalizedDesc = description.toLowerCase();

        // Check if we're in a browser environment
        if (typeof document === 'undefined') {
            return `[aria-label*="${normalizedDesc}" i]`;
        }

        // Try common patterns
        const selectors = [
            `[aria-label*="${normalizedDesc}" i]`,
            `[data-testid*="${normalizedDesc}" i]`,
            `[title*="${normalizedDesc}" i]`
        ];

        for (const selector of selectors) {
            try {
                if (document.querySelector(selector)) {
                    return selector;
                }
            } catch {
                continue;
            }
        }

        return null;
    }

    /**
     * Generate unique selector for an element
     */
    private generateUniqueSelector(element: Element): string {
        // Try ID first
        if (element.id) {
            return `#${element.id}`;
        }

        // Try data attributes
        if (element.getAttribute('data-testid')) {
            return `[data-testid="${element.getAttribute('data-testid')}"]`;
        }

        // Build path selector
        const path: string[] = [];
        let current: Element | null = element;

        while (current && current !== document.body) {
            let selector = current.tagName.toLowerCase();

            if (current.className && typeof current.className === 'string') {
                const classes = current.className.split(' ').filter(c => c && !c.includes(' '));
                if (classes.length > 0) {
                    selector += `.${classes.slice(0, 2).join('.')}`;
                }
            }

            path.unshift(selector);
            current = current.parentElement;
        }

        return path.join(' > ');
    }

    /**
     * Calculate string similarity (Jaccard index)
     */
    private calculateSimilarity(a: string, b: string): number {
        const setA = new Set(a.split(/\s+/));
        const setB = new Set(b.split(/\s+/));

        const intersection = new Set([...setA].filter(x => setB.has(x)));
        const union = new Set([...setA, ...setB]);

        return intersection.size / union.size;
    }

    /**
     * Get configuration
     */
    getConfig(): AgentConfig {
        return this.config;
    }
}
