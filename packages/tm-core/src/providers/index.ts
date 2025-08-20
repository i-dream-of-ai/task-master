/**
 * @fileoverview Barrel export for provider modules
 */

// Export AI providers from subdirectory
export { BaseProvider } from './ai/base-provider.js';
export type {
	BaseProviderConfig,
	CompletionResult
} from './ai/base-provider.js';

// Export all from AI module
export * from './ai/index.js';

// Storage providers will be exported here when implemented
// export * from './storage/index.js';

// Placeholder provider for tests
export { PlaceholderProvider } from './placeholder-provider.js';
