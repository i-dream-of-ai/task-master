/**
 * @fileoverview TaskMasterCore facade - main entry point for tm-core functionality
 */

import { ConfigManager } from './config/config-manager.js';
import { TaskService, type TaskListResult as ListTasksResult, type GetTaskListOptions } from './services/task-service.js';
import { ERROR_CODES, TaskMasterError } from './errors/task-master-error.js';
import type { IConfiguration } from './interfaces/configuration.interface.js';
import type { Task, TaskStatus, TaskFilter } from './types/index.js';

/**
 * Options for creating TaskMasterCore instance
 */
export interface TaskMasterCoreOptions {
	projectPath: string;
	configuration?: Partial<IConfiguration>;
}

/**
 * Re-export result types from TaskService
 */
export type { TaskListResult as ListTasksResult } from './services/task-service.js';
export type { GetTaskListOptions } from './services/task-service.js';

/**
 * TaskMasterCore facade class
 * Provides simplified API for all tm-core operations
 */
export class TaskMasterCore {
	private configManager: ConfigManager;
	private taskService: TaskService;
	private initialized = false;

	constructor(options: TaskMasterCoreOptions) {
		if (!options.projectPath) {
			throw new TaskMasterError('Project path is required', ERROR_CODES.MISSING_CONFIGURATION);
		}

		// Create config manager
		this.configManager = new ConfigManager(options.projectPath);

		// Create task service
		this.taskService = new TaskService(this.configManager);

		// Apply any provided configuration
		if (options.configuration) {
			// This will be applied after initialization
		}
	}

	/**
	 * Initialize the TaskMasterCore instance
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		try {
			await this.configManager.initialize();
			await this.taskService.initialize();
			this.initialized = true;
		} catch (error) {
			throw new TaskMasterError(
				'Failed to initialize TaskMasterCore',
				ERROR_CODES.INTERNAL_ERROR,
				{ operation: 'initialize' },
				error as Error
			);
		}
	}

	/**
	 * Ensure the instance is initialized
	 */
	private async ensureInitialized(): Promise<void> {
		if (!this.initialized) {
			await this.initialize();
		}
	}

	/**
	 * Get list of tasks with optional filtering
	 * @deprecated Use getTaskList() instead
	 */
	async listTasks(options?: {
		tag?: string;
		filter?: TaskFilter;
		includeSubtasks?: boolean;
	}): Promise<ListTasksResult> {
		return this.getTaskList(options);
	}

	/**
	 * Get list of tasks with optional filtering
	 */
	async getTaskList(options?: GetTaskListOptions): Promise<ListTasksResult> {
		await this.ensureInitialized();
		return this.taskService.getTaskList(options);
	}

	/**
	 * Get a specific task by ID
	 */
	async getTask(taskId: string, tag?: string): Promise<Task | null> {
		await this.ensureInitialized();
		return this.taskService.getTask(taskId, tag);
	}

	/**
	 * Get tasks by status
	 */
	async getTasksByStatus(status: TaskStatus | TaskStatus[], tag?: string): Promise<Task[]> {
		await this.ensureInitialized();
		return this.taskService.getTasksByStatus(status, tag);
	}

	/**
	 * Get task statistics
	 */
	async getTaskStats(tag?: string): Promise<{
		total: number;
		byStatus: Record<TaskStatus, number>;
		withSubtasks: number;
		blocked: number;
	}> {
		await this.ensureInitialized();
		const stats = await this.taskService.getTaskStats(tag);
		// Remove storageType from the return to maintain backward compatibility
		const { storageType, ...restStats } = stats;
		return restStats;
	}

	/**
	 * Get next available task
	 */
	async getNextTask(tag?: string): Promise<Task | null> {
		await this.ensureInitialized();
		return this.taskService.getNextTask(tag);
	}

	/**
	 * Get current storage type
	 */
	getStorageType(): 'file' | 'api' {
		return this.taskService.getStorageType();
	}

	/**
	 * Get current active tag
	 */
	getActiveTag(): string {
		return this.configManager.getActiveTag();
	}

	/**
	 * Set active tag
	 */
	async setActiveTag(tag: string): Promise<void> {
		await this.configManager.setActiveTag(tag);
	}

	/**
	 * Close and cleanup resources
	 */
	async close(): Promise<void> {
		// TaskService handles storage cleanup internally
		this.initialized = false;
	}
}

/**
 * Factory function to create TaskMasterCore instance
 */
export function createTaskMasterCore(
	projectPath: string,
	options?: {
		configuration?: Partial<IConfiguration>;
	}
): TaskMasterCore {
	return new TaskMasterCore({
		projectPath,
		configuration: options?.configuration
	});
}
