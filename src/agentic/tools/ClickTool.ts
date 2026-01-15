// src/agentic/tools/ClickTool.ts
// Click action tool for DOM interaction

import type { ActionResult } from '../types.js';

/**
 * Options for click action
 */
export interface ClickOptions {
    /** Wait time before clicking (ms) */
    delay?: number;
    /** Scroll element into view before clicking */
    scrollIntoView?: boolean;
    /** Block behavior for scrollIntoView */
    scrollBlock?: ScrollLogicalPosition;
}

/**
 * Tool for clicking DOM elements
 */
export class ClickTool {
    /**
     * Click an element by selector
     *
     * @param selector - CSS selector for the element
     * @param options - Click options
     * @returns Action result
     */
    static async execute(selector: string, options: ClickOptions = {}): Promise<ActionResult> {
        const {
            delay = 0,
            scrollIntoView = true,
            scrollBlock = 'center'
        } = options;

        // Check browser environment
        if (typeof document === 'undefined') {
            return {
                success: true,
                message: `Click on "${selector}" would be executed (server-side)`
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

            if (!(element instanceof HTMLElement)) {
                return {
                    success: false,
                    message: 'Element is not clickable'
                };
            }

            // Scroll into view if requested
            if (scrollIntoView) {
                element.scrollIntoView({ behavior: 'smooth', block: scrollBlock });
                // Wait for scroll animation
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            // Optional delay
            if (delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            // Click the element
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
     * Click an element by text content
     *
     * @param text - Text to search for
     * @param tagName - Optional tag name to filter (e.g., 'button', 'a')
     * @returns Action result
     */
    static async clickByText(text: string, tagName?: string): Promise<ActionResult> {
        if (typeof document === 'undefined') {
            return {
                success: true,
                message: `Click by text "${text}" would be executed (server-side)`
            };
        }

        try {
            const selector = tagName || '*';
            const elements = document.querySelectorAll(selector);
            const normalizedText = text.toLowerCase().trim();

            for (const element of elements) {
                if (element.textContent?.toLowerCase().trim().includes(normalizedText)) {
                    if (element instanceof HTMLElement) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        await new Promise(resolve => setTimeout(resolve, 300));
                        element.click();
                        return {
                            success: true,
                            message: `Clicked element with text "${text}"`
                        };
                    }
                }
            }

            return {
                success: false,
                message: `Element with text "${text}" not found`
            };
        } catch (error) {
            return {
                success: false,
                message: 'Failed to click element by text',
                error: String(error)
            };
        }
    }

    /**
     * Double-click an element
     *
     * @param selector - CSS selector for the element
     * @returns Action result
     */
    static async doubleClick(selector: string): Promise<ActionResult> {
        if (typeof document === 'undefined') {
            return {
                success: true,
                message: `Double-click on "${selector}" would be executed (server-side)`
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

            if (!(element instanceof HTMLElement)) {
                return {
                    success: false,
                    message: 'Element is not clickable'
                };
            }

            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await new Promise(resolve => setTimeout(resolve, 300));

            // Dispatch double-click event
            const event = new MouseEvent('dblclick', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            element.dispatchEvent(event);

            return {
                success: true,
                message: 'Element double-clicked'
            };
        } catch (error) {
            return {
                success: false,
                message: 'Failed to double-click element',
                error: String(error)
            };
        }
    }
}
