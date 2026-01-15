// src/agentic/tools/NavigateTool.ts
// Navigation tool for page routing

import type { ActionResult } from '../types.js';

/**
 * Options for navigation
 */
export interface NavigateOptions {
    /** Try client-side navigation first (for SPAs) */
    preferClientSide?: boolean;
    /** Open in new tab */
    newTab?: boolean;
    /** Replace current history entry */
    replace?: boolean;
    /** Query parameters to append */
    params?: Record<string, string | number | boolean>;
}

/**
 * Tool for page navigation
 */
export class NavigateTool {
    /**
     * Navigate to a URL
     *
     * @param url - URL or path to navigate to
     * @param options - Navigation options
     * @returns Action result
     */
    static async execute(url: string, options: NavigateOptions = {}): Promise<ActionResult> {
        const {
            preferClientSide = true,
            newTab = false,
            replace = false,
            params
        } = options;

        // Validate URL
        if (!NavigateTool.isValidUrl(url)) {
            return {
                success: false,
                message: 'Invalid or blocked URL'
            };
        }

        // Build full URL with params
        let fullUrl = url;
        if (params) {
            const searchParams = new URLSearchParams();
            for (const [key, value] of Object.entries(params)) {
                if (value !== undefined && value !== null) {
                    searchParams.set(key, String(value));
                }
            }
            const queryString = searchParams.toString();
            if (queryString) {
                fullUrl += (url.includes('?') ? '&' : '?') + queryString;
            }
        }

        // Check browser environment
        if (typeof window === 'undefined') {
            return {
                success: true,
                message: `Navigation to ${fullUrl} would be executed (server-side)`
            };
        }

        try {
            // New tab navigation
            if (newTab) {
                window.open(fullUrl, '_blank', 'noopener,noreferrer');
                return {
                    success: true,
                    message: `Opened ${fullUrl} in new tab`
                };
            }

            // Check if internal URL
            const isInternal = NavigateTool.isInternalUrl(fullUrl);

            // Try client-side navigation for internal URLs
            if (isInternal && preferClientSide) {
                const clientSideSuccess = NavigateTool.tryClientSideNavigation(fullUrl, replace);
                if (clientSideSuccess) {
                    return {
                        success: true,
                        message: `Navigated to ${fullUrl}`
                    };
                }
            }

            // Full page navigation
            if (replace) {
                window.location.replace(fullUrl);
            } else {
                window.location.href = fullUrl;
            }

            return {
                success: true,
                message: `Navigating to ${fullUrl}...`
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
     * Navigate back in history
     *
     * @returns Action result
     */
    static async back(): Promise<ActionResult> {
        if (typeof window === 'undefined') {
            return {
                success: true,
                message: 'Navigate back would be executed (server-side)'
            };
        }

        try {
            window.history.back();
            return {
                success: true,
                message: 'Navigated back'
            };
        } catch (error) {
            return {
                success: false,
                message: 'Failed to navigate back',
                error: String(error)
            };
        }
    }

    /**
     * Navigate forward in history
     *
     * @returns Action result
     */
    static async forward(): Promise<ActionResult> {
        if (typeof window === 'undefined') {
            return {
                success: true,
                message: 'Navigate forward would be executed (server-side)'
            };
        }

        try {
            window.history.forward();
            return {
                success: true,
                message: 'Navigated forward'
            };
        } catch (error) {
            return {
                success: false,
                message: 'Failed to navigate forward',
                error: String(error)
            };
        }
    }

    /**
     * Reload the current page
     *
     * @param forceFetch - Force reload from server (bypass cache)
     * @returns Action result
     */
    static async reload(forceFetch: boolean = false): Promise<ActionResult> {
        if (typeof window === 'undefined') {
            return {
                success: true,
                message: 'Reload would be executed (server-side)'
            };
        }

        try {
            window.location.reload();
            return {
                success: true,
                message: forceFetch ? 'Hard reloading...' : 'Reloading...'
            };
        } catch (error) {
            return {
                success: false,
                message: 'Failed to reload',
                error: String(error)
            };
        }
    }

    /**
     * Get the current URL
     *
     * @returns Current URL or null if not in browser
     */
    static getCurrentUrl(): string | null {
        if (typeof window === 'undefined') {
            return null;
        }
        return window.location.href;
    }

    /**
     * Get the current path
     *
     * @returns Current path or null if not in browser
     */
    static getCurrentPath(): string | null {
        if (typeof window === 'undefined') {
            return null;
        }
        return window.location.pathname;
    }

    /**
     * Check if a URL is valid and safe
     */
    private static isValidUrl(url: string): boolean {
        // Reject javascript: and data: URLs
        if (/^(javascript|data):/i.test(url)) {
            return false;
        }
        return true;
    }

    /**
     * Check if URL is internal to the current site
     */
    private static isInternalUrl(url: string): boolean {
        // Relative URLs are internal
        if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
            return true;
        }

        if (typeof window === 'undefined') {
            return true;
        }

        // Check if same origin
        try {
            const urlObj = new URL(url, window.location.href);
            return urlObj.origin === window.location.origin;
        } catch {
            return true;
        }
    }

    /**
     * Try client-side navigation using History API
     */
    private static tryClientSideNavigation(url: string, replace: boolean): boolean {
        if (typeof window === 'undefined') {
            return false;
        }

        try {
            if (replace) {
                window.history.replaceState({}, '', url);
            } else {
                window.history.pushState({}, '', url);
            }

            // Dispatch navigation events
            window.dispatchEvent(new PopStateEvent('popstate'));

            // Dispatch hashchange if URL has hash
            if (url.includes('#')) {
                window.dispatchEvent(new HashChangeEvent('hashchange'));
            }

            return true;
        } catch {
            return false;
        }
    }

    /**
     * Navigate to a hash/anchor on the current page
     *
     * @param hash - Hash/anchor name (without #)
     * @returns Action result
     */
    static async toHash(hash: string): Promise<ActionResult> {
        if (typeof window === 'undefined') {
            return {
                success: true,
                message: `Navigate to #${hash} would be executed (server-side)`
            };
        }

        try {
            window.location.hash = hash;
            return {
                success: true,
                message: `Navigated to #${hash}`
            };
        } catch (error) {
            return {
                success: false,
                message: 'Failed to navigate to hash',
                error: String(error)
            };
        }
    }

    /**
     * Open URL in new window with specific dimensions
     *
     * @param url - URL to open
     * @param width - Window width
     * @param height - Window height
     * @returns Action result
     */
    static async openPopup(
        url: string,
        width: number = 600,
        height: number = 400
    ): Promise<ActionResult> {
        if (!NavigateTool.isValidUrl(url)) {
            return {
                success: false,
                message: 'Invalid or blocked URL'
            };
        }

        if (typeof window === 'undefined') {
            return {
                success: true,
                message: `Open popup ${url} would be executed (server-side)`
            };
        }

        try {
            const left = (window.screen.width - width) / 2;
            const top = (window.screen.height - height) / 2;

            const features = [
                `width=${width}`,
                `height=${height}`,
                `left=${left}`,
                `top=${top}`,
                'noopener',
                'noreferrer'
            ].join(',');

            window.open(url, '_blank', features);

            return {
                success: true,
                message: `Opened popup window for ${url}`
            };
        } catch (error) {
            return {
                success: false,
                message: 'Failed to open popup',
                error: String(error)
            };
        }
    }
}
