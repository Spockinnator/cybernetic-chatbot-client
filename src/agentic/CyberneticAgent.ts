// src/agentic/CyberneticAgent.ts
// DOM interaction agent for agentic actions

import { CyberneticIntentClassifier } from './CyberneticIntentClassifier.js';
import type {
    AgentAction,
    ActionResult,
    IntentClassification,
    AgentConfig
} from './types.js';

/**
 * DOM interaction agent
 *
 * Executes actions on the host page based on classified intent.
 * Supports navigation, form filling, clicking, scrolling, and more.
 */
export class CyberneticAgent {
    private config: AgentConfig;
    private classifier: CyberneticIntentClassifier;
    private highlightOverlay: HTMLElement | null = null;
    private actionCount = 0;
    private lastActionReset = Date.now();

    constructor(config: AgentConfig) {
        this.config = config;
        this.classifier = new CyberneticIntentClassifier(config);

        // Inject highlight styles (only in browser)
        if (typeof document !== 'undefined') {
            this.injectStyles();
        }
    }

    /**
     * Interpret user message and determine action
     *
     * @param message - User's message to interpret
     * @returns Intent classification with suggested action
     */
    interpretIntent(message: string): IntentClassification {
        return this.classifier.classify(message);
    }

    /**
     * Execute an agent action
     *
     * @param action - The action to execute
     * @returns Result of action execution
     */
    async executeAction(action: AgentAction): Promise<ActionResult> {
        // Reset action count every minute
        const now = Date.now();
        if (now - this.lastActionReset > 60000) {
            this.actionCount = 0;
            this.lastActionReset = now;
        }

        // Check rate limit
        const maxActions = this.config.maxActionsPerTurn ?? 5;
        if (this.actionCount >= maxActions) {
            return {
                success: false,
                message: `Rate limit exceeded. Maximum ${maxActions} actions per minute.`
            };
        }

        // Validate action is allowed
        if (!this.isActionAllowed(action)) {
            return {
                success: false,
                message: `Action type "${action.type}" is not allowed`
            };
        }

        this.actionCount++;

        switch (action.type) {
            case 'navigate':
                return this.navigate(action.target, action.params);

            case 'fillForm':
                return this.fillForm(action.target, action.params?.value as string);

            case 'clickElement':
                return this.clickElement(action.target);

            case 'triggerModal':
                return this.triggerModal(action.target);

            case 'scroll':
                return this.scrollToElement(action.target);

            case 'highlight':
                return this.highlightElement(action.target);

            case 'custom':
                return this.executeCustomAction(action.target, action.params);

            default:
                return {
                    success: false,
                    message: `Unknown action type: ${action.type}`
                };
        }
    }

    /**
     * Check if an action type is allowed by configuration
     */
    private isActionAllowed(action: AgentAction): boolean {
        const allowedActions = this.config.allowedActions;
        if (!allowedActions) return true; // All allowed by default

        const actionTypeMap: Record<string, string> = {
            'navigate': 'navigate',
            'fillForm': 'fill',
            'clickElement': 'click',
            'scroll': 'scroll',
            'highlight': 'click', // Highlight is a form of interaction
            'triggerModal': 'click',
            'custom': 'click'
        };

        const mappedType = actionTypeMap[action.type] as typeof allowedActions[number];
        return allowedActions.includes(mappedType);
    }

    /**
     * Check if selector is allowed (not blocked)
     */
    private isSelectorAllowed(selector: string): boolean {
        // Check blocked selectors
        if (this.config.blockedSelectors) {
            for (const blocked of this.config.blockedSelectors) {
                if (selector.includes(blocked)) {
                    return false;
                }
            }
        }

        // Check allowed selectors (if specified, only those are allowed)
        if (this.config.allowedSelectors && this.config.allowedSelectors.length > 0) {
            return this.config.allowedSelectors.some(allowed => selector.includes(allowed));
        }

        return true;
    }

    // ==================== ACTION IMPLEMENTATIONS ====================

    /**
     * Navigate to a URL
     */
    private async navigate(
        path: string,
        params?: Record<string, unknown>
    ): Promise<ActionResult> {
        try {
            // Validate URL
            if (!this.validateNavigationUrl(path)) {
                return {
                    success: false,
                    message: 'Invalid or blocked URL'
                };
            }

            // Build URL with params
            let url = path;
            if (params) {
                const searchParams = new URLSearchParams();
                for (const [key, value] of Object.entries(params)) {
                    if (value !== undefined && value !== null) {
                        searchParams.set(key, String(value));
                    }
                }
                const queryString = searchParams.toString();
                if (queryString) {
                    url += (url.includes('?') ? '&' : '?') + queryString;
                }
            }

            // Check if we're in a browser environment
            if (typeof window === 'undefined') {
                return {
                    success: true,
                    message: `Navigation to ${path} would be executed (server-side)`
                };
            }

            // Check if internal or external navigation
            if (this.isInternalUrl(url)) {
                // Try client-side navigation first (SPA support)
                if (this.tryClientSideNavigation(url)) {
                    return {
                        success: true,
                        message: `Navigated to ${path}`
                    };
                }

                // Fallback to full page navigation
                window.location.href = url;
                return {
                    success: true,
                    message: `Navigating to ${path}...`
                };
            }

            // External URL - open in new tab
            window.open(url, '_blank', 'noopener,noreferrer');
            return {
                success: true,
                message: `Opened ${url} in new tab`
            };
        } catch (error) {
            return {
                success: false,
                message: 'Navigation failed',
                error: String(error)
            };
        }
    }

    /**
     * Fill a form field
     */
    private async fillForm(selector: string, value: string): Promise<ActionResult> {
        // Check selector is allowed
        if (!this.isSelectorAllowed(selector)) {
            return {
                success: false,
                message: `Selector "${selector}" is not allowed`
            };
        }

        // Sanitize selector
        const sanitizedSelector = this.sanitizeSelector(selector);

        // Check if we're in a browser environment
        if (typeof document === 'undefined') {
            return {
                success: true,
                message: `Form fill would set "${sanitizedSelector}" to "${value}" (server-side)`
            };
        }

        try {
            const element = document.querySelector(sanitizedSelector);

            if (!element) {
                return {
                    success: false,
                    message: `Element not found: ${sanitizedSelector}`
                };
            }

            if (!(element instanceof HTMLInputElement ||
                    element instanceof HTMLTextAreaElement ||
                    element instanceof HTMLSelectElement)) {
                return {
                    success: false,
                    message: 'Element is not a form field'
                };
            }

            // Focus the element
            element.focus();

            // Set value
            if (element instanceof HTMLSelectElement) {
                // For select, find matching option
                const option = Array.from(element.options).find(
                    opt => opt.value.toLowerCase() === value.toLowerCase() ||
                             opt.text.toLowerCase() === value.toLowerCase()
                );
                if (option) {
                    element.value = option.value;
                } else {
                    return {
                        success: false,
                        message: `Option "${value}" not found`
                    };
                }
            } else {
                element.value = value;
            }

            // Dispatch events to trigger frameworks
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));

            // For React - try to set value natively
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype, 'value'
            )?.set;
            if (nativeInputValueSetter && element instanceof HTMLInputElement) {
                nativeInputValueSetter.call(element, value);
                element.dispatchEvent(new Event('input', { bubbles: true }));
            }

            return {
                success: true,
                message: `Filled field with "${value}"`
            };
        } catch (error) {
            return {
                success: false,
                message: 'Failed to fill form field',
                error: String(error)
            };
        }
    }

    /**
     * Click an element
     */
    private async clickElement(selector: string): Promise<ActionResult> {
        // Check selector is allowed
        if (!this.isSelectorAllowed(selector)) {
            return {
                success: false,
                message: `Selector "${selector}" is not allowed`
            };
        }

        // Sanitize selector
        const sanitizedSelector = this.sanitizeSelector(selector);

        // Check if we're in a browser environment
        if (typeof document === 'undefined') {
            return {
                success: true,
                message: `Click on "${sanitizedSelector}" would be executed (server-side)`
            };
        }

        try {
            const element = document.querySelector(sanitizedSelector);

            if (!element) {
                return {
                    success: false,
                    message: `Element not found: ${sanitizedSelector}`
                };
            }

            if (!(element instanceof HTMLElement)) {
                return {
                    success: false,
                    message: 'Element is not clickable'
                };
            }

            // Scroll into view
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Brief delay for scroll
            await this.sleep(300);

            // Click
            element.click();

            return {
                success: true,
                message: 'Element clicked'
            };
        } catch (error) {
            return {
                success: false,
                message: 'Failed to click element',
                error: String(error)
            };
        }
    }

    /**
     * Trigger a modal by clicking its trigger element
     */
    private async triggerModal(triggerSelector: string): Promise<ActionResult> {
        return this.clickElement(triggerSelector);
    }

    /**
     * Scroll to an element
     */
    private async scrollToElement(selector: string): Promise<ActionResult> {
        // Check if we're in a browser environment
        if (typeof window === 'undefined') {
            return {
                success: true,
                message: `Scroll to "${selector}" would be executed (server-side)`
            };
        }

        try {
            // Special case for top/bottom
            if (selector === 'body') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return { success: true, message: 'Scrolled to top' };
            }

            if (selector === 'body:last-child') {
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                return { success: true, message: 'Scrolled to bottom' };
            }

            const element = document.querySelector(selector);

            if (!element) {
                return {
                    success: false,
                    message: `Element not found: ${selector}`
                };
            }

            element.scrollIntoView({ behavior: 'smooth', block: 'start' });

            return {
                success: true,
                message: 'Scrolled to element'
            };
        } catch (error) {
            return {
                success: false,
                message: 'Failed to scroll',
                error: String(error)
            };
        }
    }

    /**
     * Highlight an element with animation
     */
    async highlightElement(selector: string): Promise<ActionResult> {
        // Check selector is allowed
        if (!this.isSelectorAllowed(selector)) {
            return {
                success: false,
                message: `Selector "${selector}" is not allowed`
            };
        }

        // Check if we're in a browser environment
        if (typeof document === 'undefined') {
            return {
                success: true,
                message: `Highlight on "${selector}" would be shown (server-side)`
            };
        }

        try {
            const element = document.querySelector(selector);

            if (!element) {
                return {
                    success: false,
                    message: `Element not found: ${selector}`
                };
            }

            // Remove existing highlight
            this.removeHighlight();

            // Scroll element into view
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Brief delay for scroll
            await this.sleep(300);

            // Create highlight overlay
            const rect = element.getBoundingClientRect();
            const overlay = document.createElement('div');
            overlay.className = 'astermind-highlight-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: ${rect.top - 4}px;
                left: ${rect.left - 4}px;
                width: ${rect.width + 8}px;
                height: ${rect.height + 8}px;
                border: 3px solid #4F46E5;
                border-radius: 4px;
                pointer-events: none;
                z-index: 999999;
                animation: astermind-highlight-pulse 1s ease-in-out 3;
            `;

            document.body.appendChild(overlay);
            this.highlightOverlay = overlay;

            // Remove after animation
            setTimeout(() => this.removeHighlight(), 3000);

            return {
                success: true,
                message: 'Element highlighted'
            };
        } catch (error) {
            return {
                success: false,
                message: 'Failed to highlight element',
                error: String(error)
            };
        }
    }

    /**
     * Execute a custom action callback
     */
    private async executeCustomAction(
        actionName: string,
        params?: Record<string, unknown>
    ): Promise<ActionResult> {
        // Validate custom action is in whitelist
        if (!this.isAllowedCustomAction(actionName)) {
            return {
                success: false,
                message: `Custom action "${actionName}" not found`
            };
        }

        const callback = this.config.customActions![actionName];

        try {
            return await callback(params);
        } catch (error) {
            return {
                success: false,
                message: `Custom action "${actionName}" failed`,
                error: String(error)
            };
        }
    }

    // ==================== HELPER METHODS ====================

    /**
     * Check if URL is internal to the current site
     */
    private isInternalUrl(url: string): boolean {
        // Relative URLs are internal
        if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
            return true;
        }

        // Check if we're in a browser environment
        if (typeof window === 'undefined') {
            return true;
        }

        // Check if same origin
        try {
            const urlObj = new URL(url, window.location.href);
            return urlObj.origin === window.location.origin;
        } catch {
            return true;  // Assume internal on error
        }
    }

    /**
     * Try client-side navigation for SPAs
     */
    private tryClientSideNavigation(url: string): boolean {
        if (typeof window === 'undefined') {
            return false;
        }

        // Try History API pushState
        try {
            window.history.pushState({}, '', url);
            window.dispatchEvent(new PopStateEvent('popstate'));

            // Also dispatch hashchange for hash routing
            if (url.includes('#')) {
                window.dispatchEvent(new HashChangeEvent('hashchange'));
            }

            return true;
        } catch {
            return false;
        }
    }

    /**
     * Validate navigation URL
     */
    private validateNavigationUrl(url: string): boolean {
        // Reject javascript: and data: URLs
        if (/^(javascript|data):/i.test(url)) {
            return false;
        }

        // Check if we're in a browser environment
        if (typeof window === 'undefined') {
            return true;
        }

        // Only allow relative URLs or same-origin
        try {
            const urlObj = new URL(url, window.location.href);
            return urlObj.origin === window.location.origin || url.startsWith('/');
        } catch {
            return url.startsWith('/');
        }
    }

    /**
     * Sanitize CSS selector to prevent injection
     */
    private sanitizeSelector(selector: string): string {
        // Remove potentially dangerous characters
        return selector
            .replace(/[<>'"]/g, '')
            .replace(/javascript:/gi, '')
            .replace(/data:/gi, '')
            .trim();
    }

    /**
     * Validate custom action is in whitelist
     */
    private isAllowedCustomAction(actionName: string): boolean {
        return this.config.customActions !== undefined &&
                 Object.prototype.hasOwnProperty.call(this.config.customActions, actionName);
    }

    /**
     * Remove highlight overlay
     */
    private removeHighlight(): void {
        if (this.highlightOverlay) {
            this.highlightOverlay.remove();
            this.highlightOverlay = null;
        }
    }

    /**
     * Inject required styles
     */
    private injectStyles(): void {
        if (typeof document === 'undefined') {
            return;
        }

        if (document.getElementById('astermind-agent-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'astermind-agent-styles';
        style.textContent = `
            @keyframes astermind-highlight-pulse {
                0%, 100% {
                    box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.4);
                }
                50% {
                    box-shadow: 0 0 0 10px rgba(79, 70, 229, 0);
                }
            }

            .astermind-highlight-overlay {
                transition: all 0.2s ease-out;
            }
        `;

        document.head.appendChild(style);
    }

    /**
     * Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get agent configuration
     */
    getConfig(): AgentConfig {
        return this.config;
    }

    /**
     * Get the intent classifier
     */
    getClassifier(): CyberneticIntentClassifier {
        return this.classifier;
    }

    /**
     * Reset action count (for testing)
     */
    resetActionCount(): void {
        this.actionCount = 0;
        this.lastActionReset = Date.now();
    }
}
