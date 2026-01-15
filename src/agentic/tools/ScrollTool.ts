// src/agentic/tools/ScrollTool.ts
// Scroll tool for DOM interaction

import type { ActionResult } from '../types.js';

/**
 * Options for scroll action
 */
export interface ScrollOptions {
    /** Scroll behavior */
    behavior?: ScrollBehavior;
    /** Block position for scrollIntoView */
    block?: ScrollLogicalPosition;
    /** Inline position for scrollIntoView */
    inline?: ScrollLogicalPosition;
}

/**
 * Tool for scrolling the page or elements
 */
export class ScrollTool {
    /**
     * Scroll to an element
     *
     * @param selector - CSS selector for the element
     * @param options - Scroll options
     * @returns Action result
     */
    static async execute(selector: string, options: ScrollOptions = {}): Promise<ActionResult> {
        const {
            behavior = 'smooth',
            block = 'start',
            inline = 'nearest'
        } = options;

        // Check browser environment
        if (typeof document === 'undefined' || typeof window === 'undefined') {
            return {
                success: true,
                message: `Scroll to "${selector}" would be executed (server-side)`
            };
        }

        try {
            // Handle special selectors
            if (selector === 'top' || selector === 'body') {
                window.scrollTo({ top: 0, behavior });
                return { success: true, message: 'Scrolled to top' };
            }

            if (selector === 'bottom') {
                window.scrollTo({ top: document.body.scrollHeight, behavior });
                return { success: true, message: 'Scrolled to bottom' };
            }

            const element = document.querySelector(selector);

            if (!element) {
                return {
                    success: false,
                    message: `Element not found: ${selector}`
                };
            }

            element.scrollIntoView({ behavior, block, inline });

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
     * Scroll to top of page
     *
     * @param behavior - Scroll behavior
     * @returns Action result
     */
    static async toTop(behavior: ScrollBehavior = 'smooth'): Promise<ActionResult> {
        return ScrollTool.execute('top', { behavior });
    }

    /**
     * Scroll to bottom of page
     *
     * @param behavior - Scroll behavior
     * @returns Action result
     */
    static async toBottom(behavior: ScrollBehavior = 'smooth'): Promise<ActionResult> {
        return ScrollTool.execute('bottom', { behavior });
    }

    /**
     * Scroll by a specific amount
     *
     * @param x - Horizontal scroll amount (pixels)
     * @param y - Vertical scroll amount (pixels)
     * @param behavior - Scroll behavior
     * @returns Action result
     */
    static async by(
        x: number,
        y: number,
        behavior: ScrollBehavior = 'smooth'
    ): Promise<ActionResult> {
        if (typeof window === 'undefined') {
            return {
                success: true,
                message: `Scroll by (${x}, ${y}) would be executed (server-side)`
            };
        }

        try {
            window.scrollBy({ left: x, top: y, behavior });
            return {
                success: true,
                message: `Scrolled by (${x}, ${y})`
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
     * Scroll to a specific position
     *
     * @param x - Horizontal position (pixels)
     * @param y - Vertical position (pixels)
     * @param behavior - Scroll behavior
     * @returns Action result
     */
    static async to(
        x: number,
        y: number,
        behavior: ScrollBehavior = 'smooth'
    ): Promise<ActionResult> {
        if (typeof window === 'undefined') {
            return {
                success: true,
                message: `Scroll to (${x}, ${y}) would be executed (server-side)`
            };
        }

        try {
            window.scrollTo({ left: x, top: y, behavior });
            return {
                success: true,
                message: `Scrolled to position (${x}, ${y})`
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
     * Scroll within a scrollable container
     *
     * @param containerSelector - CSS selector for the scrollable container
     * @param targetSelector - CSS selector for the target element within container
     * @param options - Scroll options
     * @returns Action result
     */
    static async withinContainer(
        containerSelector: string,
        targetSelector: string,
        options: ScrollOptions = {}
    ): Promise<ActionResult> {
        const { behavior = 'smooth' } = options;

        if (typeof document === 'undefined') {
            return {
                success: true,
                message: `Scroll within container would be executed (server-side)`
            };
        }

        try {
            const container = document.querySelector(containerSelector);
            if (!container) {
                return {
                    success: false,
                    message: `Container not found: ${containerSelector}`
                };
            }

            const target = container.querySelector(targetSelector);
            if (!target) {
                return {
                    success: false,
                    message: `Target not found within container: ${targetSelector}`
                };
            }

            // Calculate scroll position within container
            const containerRect = container.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();

            const scrollTop = container.scrollTop + (targetRect.top - containerRect.top);

            container.scrollTo({
                top: scrollTop,
                behavior
            });

            return {
                success: true,
                message: 'Scrolled within container'
            };
        } catch (error) {
            return {
                success: false,
                message: 'Failed to scroll within container',
                error: String(error)
            };
        }
    }

    /**
     * Check if an element is in the viewport
     *
     * @param selector - CSS selector for the element
     * @returns Whether the element is visible
     */
    static isInViewport(selector: string): boolean {
        if (typeof document === 'undefined' || typeof window === 'undefined') {
            return false;
        }

        const element = document.querySelector(selector);
        if (!element) {
            return false;
        }

        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }
}
