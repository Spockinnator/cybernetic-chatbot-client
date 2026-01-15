// src/agentic/tools/FillTool.ts
// Form fill tool for DOM interaction

import type { ActionResult } from '../types.js';

/**
 * Options for form fill action
 */
export interface FillOptions {
    /** Trigger input events after filling */
    triggerEvents?: boolean;
    /** Clear existing value before filling */
    clearFirst?: boolean;
    /** Focus element before filling */
    focus?: boolean;
}

/**
 * Tool for filling form fields
 */
export class FillTool {
    /**
     * Fill a form field with a value
     *
     * @param selector - CSS selector for the input element
     * @param value - Value to fill
     * @param options - Fill options
     * @returns Action result
     */
    static async execute(
        selector: string,
        value: string,
        options: FillOptions = {}
    ): Promise<ActionResult> {
        const {
            triggerEvents = true,
            clearFirst = true,
            focus = true
        } = options;

        // Check browser environment
        if (typeof document === 'undefined') {
            return {
                success: true,
                message: `Fill "${selector}" with "${value}" would be executed (server-side)`
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

            if (!(element instanceof HTMLInputElement ||
                    element instanceof HTMLTextAreaElement ||
                    element instanceof HTMLSelectElement)) {
                return {
                    success: false,
                    message: 'Element is not a form field'
                };
            }

            // Focus the element
            if (focus) {
                element.focus();
            }

            // Handle different element types
            if (element instanceof HTMLSelectElement) {
                return FillTool.fillSelect(element, value, triggerEvents);
            }

            // Clear existing value if requested
            if (clearFirst) {
                element.value = '';
            }

            // Set the value
            element.value = value;

            // Trigger events if requested
            if (triggerEvents) {
                FillTool.triggerInputEvents(element);
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
     * Fill a select element
     */
    private static fillSelect(
        element: HTMLSelectElement,
        value: string,
        triggerEvents: boolean
    ): ActionResult {
        // Find matching option by value or text
        const option = Array.from(element.options).find(
            opt => opt.value.toLowerCase() === value.toLowerCase() ||
                     opt.text.toLowerCase() === value.toLowerCase()
        );

        if (!option) {
            return {
                success: false,
                message: `Option "${value}" not found in select`
            };
        }

        element.value = option.value;

        if (triggerEvents) {
            FillTool.triggerInputEvents(element);
        }

        return {
            success: true,
            message: `Selected "${option.text}"`
        };
    }

    /**
     * Trigger input and change events on an element
     */
    private static triggerInputEvents(element: HTMLElement): void {
        // Dispatch input event
        element.dispatchEvent(new Event('input', { bubbles: true }));

        // Dispatch change event
        element.dispatchEvent(new Event('change', { bubbles: true }));

        // For React - try native value setter
        if (element instanceof HTMLInputElement) {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype, 'value'
            )?.set;
            if (nativeInputValueSetter) {
                const currentValue = element.value;
                nativeInputValueSetter.call(element, currentValue);
                element.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    }

    /**
     * Fill multiple form fields at once
     *
     * @param fields - Map of selector to value
     * @param options - Fill options
     * @returns Action result with details for each field
     */
    static async fillMany(
        fields: Record<string, string>,
        options: FillOptions = {}
    ): Promise<ActionResult> {
        const results: string[] = [];
        let allSuccess = true;

        for (const [selector, value] of Object.entries(fields)) {
            const result = await FillTool.execute(selector, value, options);
            if (!result.success) {
                allSuccess = false;
            }
            results.push(`${selector}: ${result.message}`);
        }

        return {
            success: allSuccess,
            message: allSuccess
                ? `Filled ${Object.keys(fields).length} fields`
                : `Some fields failed: ${results.join(', ')}`
        };
    }

    /**
     * Clear a form field
     *
     * @param selector - CSS selector for the input element
     * @returns Action result
     */
    static async clear(selector: string): Promise<ActionResult> {
        return FillTool.execute(selector, '', { clearFirst: true });
    }

    /**
     * Type text character by character (simulates typing)
     *
     * @param selector - CSS selector for the input element
     * @param text - Text to type
     * @param delayMs - Delay between characters in ms
     * @returns Action result
     */
    static async type(
        selector: string,
        text: string,
        delayMs: number = 50
    ): Promise<ActionResult> {
        if (typeof document === 'undefined') {
            return {
                success: true,
                message: `Type "${text}" into "${selector}" would be executed (server-side)`
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

            if (!(element instanceof HTMLInputElement ||
                    element instanceof HTMLTextAreaElement)) {
                return {
                    success: false,
                    message: 'Element is not a text input'
                };
            }

            element.focus();
            element.value = '';

            for (const char of text) {
                element.value += char;
                element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
                element.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));

                await new Promise(resolve => setTimeout(resolve, delayMs));
            }

            element.dispatchEvent(new Event('change', { bubbles: true }));

            return {
                success: true,
                message: `Typed "${text}"`
            };
        } catch (error) {
            return {
                success: false,
                message: 'Failed to type text',
                error: String(error)
            };
        }
    }
}
