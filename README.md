# @astermind/cybernetic-chatbot-client

Offline-capable AI chatbot client with local RAG fallback and agentic capabilities for AsterMind.

[![npm version](https://img.shields.io/npm/v/@astermind/cybernetic-chatbot-client.svg)](https://www.npmjs.com/package/@astermind/cybernetic-chatbot-client)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Offline-First Architecture**: Works seamlessly when disconnected from the server
- **Local RAG Fallback**: TF-IDF based local search with IndexedDB caching
- **Streaming Responses**: Real-time token streaming via Server-Sent Events
- **Tree-Shakeable**: Import only what you need - core client or full bundle with agentic
- **Agentic Capabilities**: Frontend-only DOM interactions, navigation, and form handling
- **TypeScript**: Full TypeScript support with comprehensive type definitions

## Installation

```bash
npm install @astermind/cybernetic-chatbot-client
```

## Quick Start

### Basic Usage

```typescript
import { CyberneticClient } from '@astermind/cybernetic-chatbot-client';

const client = new CyberneticClient({
  apiUrl: 'https://api.astermind.ai',
  apiKey: 'am_your_api_key',
  fallback: {
    enabled: true,
    cacheOnConnect: true
  },
  onStatusChange: (status) => {
    console.log('Connection status:', status);
  }
});

// Simple question
const response = await client.ask('What is AsterMind?');
console.log(response.reply);

// With streaming
await client.askStream('Tell me about RAG', {
  onToken: (token) => process.stdout.write(token),
  onSources: (sources) => console.log('Sources:', sources),
  onComplete: (response) => console.log('\nDone:', response.sessionId)
});
```

### With Session Management

```typescript
// First message establishes session
const response1 = await client.ask('Hello!');
const sessionId = response1.sessionId;

// Continue conversation
const response2 = await client.ask('Tell me more', { sessionId });
```

## Configuration

```typescript
interface CyberneticConfig {
  apiUrl: string;           // API endpoint URL
  apiKey: string;           // API key (must start with 'am_')
  fallback?: {
    enabled?: boolean;      // Enable offline fallback (default: true)
    cacheOnConnect?: boolean; // Cache responses when online (default: true)
  };
  onStatusChange?: (status: ConnectionStatus) => void;
  onError?: (error: { message: string }) => void;
}

type ConnectionStatus = 'connecting' | 'online' | 'offline' | 'error';
```

## Offline Fallback

When the server is unavailable, the client automatically falls back to local search using cached responses:

```typescript
const client = new CyberneticClient({
  apiUrl: 'https://api.astermind.ai',
  apiKey: 'am_your_api_key',
  fallback: {
    enabled: true,
    cacheOnConnect: true  // Cache responses for offline use
  }
});

// Check connection status
const status = client.getStatus();
console.log(status.connection); // 'online' | 'offline' | 'connecting'

// Response includes offline indicator
const response = await client.ask('cached question');
if (response.offline) {
  console.log('Response from local cache');
}
```

## Agentic Features

The agentic module provides frontend-only DOM interactions. Import separately for tree-shaking:

### Tree-Shakeable Import

```typescript
// Import only core client (smaller bundle)
import { CyberneticClient } from '@astermind/cybernetic-chatbot-client';

// Import agentic features when needed
import { CyberneticAgent, CyberneticIntentClassifier } from '@astermind/cybernetic-chatbot-client/full';
```

### Full Bundle Import

```typescript
// Import everything including agentic
import {
  CyberneticClient,
  CyberneticAgent,
  CyberneticIntentClassifier
} from '@astermind/cybernetic-chatbot-client/full';
```

### Intent Classification

```typescript
import { CyberneticIntentClassifier } from '@astermind/cybernetic-chatbot-client/full';

const classifier = new CyberneticIntentClassifier();

const intent = classifier.classify('take me to the settings page');
// { action: 'navigate', target: 'settings', confidence: 0.92 }

const intent2 = classifier.classify('fill in my email as john@example.com');
// { action: 'fillForm', target: 'email', value: 'john@example.com', confidence: 0.88 }
```

### Agent Actions

```typescript
import { CyberneticAgent } from '@astermind/cybernetic-chatbot-client/full';

const agent = new CyberneticAgent({
  onAction: (action) => console.log('Executing:', action),
  onComplete: (result) => console.log('Result:', result),
  requireConfirmation: true  // Ask user before executing
});

// Execute navigation
await agent.execute({
  type: 'navigate',
  target: '/settings',
  requiresConfirmation: false
});

// Fill form field
await agent.execute({
  type: 'fillForm',
  target: 'input[name="email"]',
  value: 'user@example.com'
});

// Click element
await agent.execute({
  type: 'clickElement',
  target: '#submit-button'
});
```

### Supported Actions

| Action | Description |
|--------|-------------|
| `navigate` | Navigate to a URL or route |
| `fillForm` | Fill form input fields |
| `clickElement` | Click DOM elements |
| `scroll` | Scroll to element or position |
| `highlight` | Highlight elements on page |
| `triggerModal` | Open modal dialogs |
| `custom` | Custom action handlers |

## API Reference

### CyberneticClient

```typescript
class CyberneticClient {
  constructor(config: CyberneticConfig);

  // Send a message and get response
  ask(message: string, options?: { sessionId?: string }): Promise<CyberneticResponse>;

  // Send a message with streaming response
  askStream(
    message: string,
    callbacks: StreamCallbacks,
    options?: { sessionId?: string }
  ): Promise<void>;

  // Get current connection status
  getStatus(): { connection: ConnectionStatus };
}
```

### Response Types

```typescript
interface CyberneticResponse {
  reply: string;
  sessionId: string;
  sources?: Source[];
  confidence: 'high' | 'medium' | 'low';
  offline: boolean;
}

interface Source {
  title: string;
  url?: string;
  snippet?: string;
  score?: number;
}

interface StreamCallbacks {
  onToken?: (token: string) => void;
  onSources?: (sources: Source[]) => void;
  onComplete?: (response: CyberneticResponse) => void;
  onError?: (error: { message: string }) => void;
}
```

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13.1+
- Edge 80+

Requires IndexedDB support for offline caching.

## Bundle Sizes

| Entry Point | Size (minified) |
|-------------|-----------------|
| Core (`index.js`) | ~15KB |
| Full (`full.js`) | ~25KB |

## License

MIT License - see [LICENSE](LICENSE) for details.
