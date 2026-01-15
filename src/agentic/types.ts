// src/agentic/types.ts
// Type definitions for agentic capabilities

/**
 * Action types that can be performed
 */
export type ActionType =
    | 'navigate'      // Navigate to URL
    | 'fillForm'      // Fill form field
    | 'clickElement'  // Click button/link
    | 'triggerModal'  // Open modal dialog
    | 'scroll'        // Scroll to element
    | 'highlight'     // Highlight element
    | 'custom';       // Custom callback

/**
 * Agent action definition
 */
export interface AgentAction {
    /** Unique action ID */
    id: string;
    /** Type of action to perform */
    type: ActionType;
    /** Target - URL, selector, or callback name */
    target: string;
    /** Additional parameters */
    params?: Record<string, unknown>;
    /** Confidence score (0-1) */
    confidence: number;
    /** Human-readable explanation */
    explanation?: string;
}

/**
 * Result of action execution
 */
export interface ActionResult {
    /** Whether action succeeded */
    success: boolean;
    /** Result message */
    message: string;
    /** Error details if failed */
    error?: string;
}

/**
 * Intent classification result
 */
export interface IntentClassification {
    /** Classified action (if any) */
    action: AgentAction | null;
    /** Whether to escalate to backend RAG */
    shouldEscalate: boolean;
    /** Raw confidence before threshold */
    rawConfidence: number;
    /** Matched patterns (for debugging) */
    matchedPatterns?: string[];
}

/**
 * Site map entry for navigation
 */
export interface SiteMapEntry {
    /** URL path pattern */
    path: string;
    /** Display name */
    name: string;
    /** Description for intent matching */
    description?: string;
    /** Allowed query/path parameters */
    params?: Record<string, string[]>;
    /** Whether path has dynamic segments like :id */
    dynamicParams?: boolean;
    /** Aliases for fuzzy matching */
    aliases?: string[];
}

/**
 * Form field configuration
 */
export interface FormFieldConfig {
    /** CSS selector for the field */
    selector: string;
    /** Field name for intent matching */
    name: string;
    /** Aliases for fuzzy matching */
    aliases?: string[];
}

/**
 * Modal trigger configuration
 */
export interface ModalTriggerConfig {
    /** Modal identifier */
    id: string;
    /** CSS selector for trigger element */
    trigger: string;
    /** Aliases for fuzzy matching */
    aliases?: string[];
}

/**
 * Agent configuration (extended from core AgenticConfig)
 */
export interface AgentConfig {
    /** Enable agentic capabilities */
    enabled: boolean;
    /** Confidence threshold for action execution (default: 0.8) */
    confidenceThreshold?: number;
    /** Site map for navigation */
    siteMap?: SiteMapEntry[];
    /** Form field configurations */
    forms?: Record<string, FormFieldConfig>;
    /** Modal trigger configurations */
    modals?: Record<string, ModalTriggerConfig>;
    /** Custom action callbacks */
    customActions?: Record<string, (params?: unknown) => Promise<ActionResult>>;
    /** Enable action preview cards (default: true) */
    requireConfirmation?: boolean;
    /** Allowed DOM actions */
    allowedActions?: ('click' | 'fill' | 'scroll' | 'navigate' | 'select')[];
    /** Maximum actions per conversation turn (default: 5) */
    maxActionsPerTurn?: number;
    /** CSS selectors to never interact with */
    blockedSelectors?: string[];
    /** Only allow actions within these selectors */
    allowedSelectors?: string[];
}
