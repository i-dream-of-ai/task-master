/**
 * @fileoverview Configuration Manager
 * Handles loading, caching, and accessing configuration including active tag
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { IConfiguration } from '../interfaces/configuration.interface.js';
import { ERROR_CODES, TaskMasterError } from '../errors/task-master-error.js';

/**
 * Configuration state including runtime settings
 */
interface ConfigState {
	/** The loaded configuration */
	config: Partial<IConfiguration>;
	/** Currently active tag (defaults to 'master') */
	activeTag: string;
	/** Project root path */
	projectRoot: string;
}

/**
 * ConfigManager handles all configuration-related operations
 * Single source of truth for configuration and active context
 */
export class ConfigManager {
	private state: ConfigState;
	private configPath: string;
	private initialized = false;

	constructor(projectRoot: string) {
		this.state = {
			config: {},
			activeTag: 'master',
			projectRoot
		};
		this.configPath = path.join(projectRoot, '.taskmaster', 'config.json');
	}

	/**
	 * Initialize by loading configuration from disk
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		try {
			await this.loadConfig();
			this.initialized = true;
		} catch (error) {
			// If config doesn't exist, use defaults
			console.debug('No config.json found, using defaults');
			this.initialized = true;
		}
	}

	/**
	 * Load configuration from config.json
	 */
	private async loadConfig(): Promise<void> {
		try {
			const configData = await fs.readFile(this.configPath, 'utf-8');
			const config = JSON.parse(configData);

			this.state.config = config;

			// Load active tag from config if present
			if (config.activeTag) {
				this.state.activeTag = config.activeTag;
			}

			// Check for environment variable override
			if (process.env.TASKMASTER_TAG) {
				this.state.activeTag = process.env.TASKMASTER_TAG;
			}
		} catch (error: any) {
			if (error.code !== 'ENOENT') {
				throw new TaskMasterError(
					'Failed to load configuration',
					ERROR_CODES.CONFIG_ERROR,
					{ configPath: this.configPath },
					error
				);
			}
			// File doesn't exist, will use defaults
		}
	}

	/**
	 * Save current configuration to disk
	 */
	async saveConfig(): Promise<void> {
		const configDir = path.dirname(this.configPath);

		try {
			// Ensure directory exists
			await fs.mkdir(configDir, { recursive: true });

			// Save config with active tag
			const configToSave = {
				...this.state.config,
				activeTag: this.state.activeTag
			};

			await fs.writeFile(
				this.configPath,
				JSON.stringify(configToSave, null, 2),
				'utf-8'
			);
		} catch (error) {
			throw new TaskMasterError(
				'Failed to save configuration',
				ERROR_CODES.CONFIG_ERROR,
				{ configPath: this.configPath },
				error as Error
			);
		}
	}

	/**
	 * Get the currently active tag
	 */
	getActiveTag(): string {
		return this.state.activeTag;
	}

	/**
	 * Set the active tag
	 */
	async setActiveTag(tag: string): Promise<void> {
		this.state.activeTag = tag;
		await this.saveConfig();
	}

	/**
	 * Get storage configuration
	 */
	getStorageConfig(): {
		type: 'file' | 'api';
		apiEndpoint?: string;
		apiAccessToken?: string;
	} {
		const storage = this.state.config.storage;

		// Check for Hamster/API configuration
		if (
			storage?.type === 'api' &&
			storage.apiEndpoint &&
			storage.apiAccessToken
		) {
			return {
				type: 'api',
				apiEndpoint: storage.apiEndpoint,
				apiAccessToken: storage.apiAccessToken
			};
		}

		// Default to file storage
		return { type: 'file' };
	}

	/**
	 * Get project root path
	 */
	getProjectRoot(): string {
		return this.state.projectRoot;
	}

	/**
	 * Get full configuration
	 */
	getConfig(): Partial<IConfiguration> {
		return this.state.config;
	}

	/**
	 * Update configuration
	 */
	async updateConfig(updates: Partial<IConfiguration>): Promise<void> {
		this.state.config = {
			...this.state.config,
			...updates
		};
		await this.saveConfig();
	}

	/**
	 * Check if using API storage (Hamster)
	 */
	isUsingApiStorage(): boolean {
		return this.getStorageConfig().type === 'api';
	}

	/**
	 * Get model configuration for AI providers
	 */
	getModelConfig() {
		return (
			this.state.config.models || {
				main: 'claude-3-5-sonnet-20241022',
				fallback: 'gpt-4o-mini'
			}
		);
	}
}
