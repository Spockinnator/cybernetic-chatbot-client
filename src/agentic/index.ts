// src/agentic/index.ts
// Agentic module entry point (tree-shakeable)
//
// This module is optional - if not imported, bundlers will exclude it.
// Import CyberneticAgent or registerAgenticCapabilities to enable agentic features.

export { CyberneticAgent } from './CyberneticAgent.js';
export { CyberneticIntentClassifier } from './CyberneticIntentClassifier.js';
export { registerAgenticCapabilities } from './register.js';

// Type exports
export type {
    ActionType,
    AgentAction,
    ActionResult,
    IntentClassification,
    SiteMapEntry,
    FormFieldConfig,
    ModalTriggerConfig,
    AgentConfig
} from './types.js';

// Tool exports (for advanced customization)
export { ClickTool } from './tools/ClickTool.js';
export type { ClickOptions } from './tools/ClickTool.js';

export { FillTool } from './tools/FillTool.js';
export type { FillOptions } from './tools/FillTool.js';

export { ScrollTool } from './tools/ScrollTool.js';
export type { ScrollOptions } from './tools/ScrollTool.js';

export { NavigateTool } from './tools/NavigateTool.js';
export type { NavigateOptions } from './tools/NavigateTool.js';
