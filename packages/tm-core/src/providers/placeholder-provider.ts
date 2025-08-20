/**
 * @fileoverview Placeholder provider for testing purposes
 * @deprecated This is a placeholder implementation that will be replaced
 */

/**
 * PlaceholderProvider for smoke tests
 */
export class PlaceholderProvider {
	name = 'placeholder';

	async generateResponse(prompt: string): Promise<string> {
		return `Mock response to: ${prompt}`;
	}
}
