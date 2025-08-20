/**
 * @fileoverview TaskMasterCore facade - main entry point for tm-core functionality
 */

import { TaskEntity } from './core/entities/task.entity.js';
import { ERROR_CODES, TaskMasterError } from './errors/task-master-error.js';
import type { IConfiguration } from './interfaces/configuration.interface.js';
import type { IStorage } from './interfaces/storage.interface.js';
import { FileStorage } from './storage/file-storage.js';
import type { Task, TaskFilter, TaskStatus } from './types/index.js';

/**
 * Options for creating TaskMasterCore instance
 */
export interface TaskMasterCoreOptions {
	projectPath: string;
	configuration?: Partial<IConfiguration>;
	storage?: IStorage;
}

/**
 * List tasks result with metadata
 */
export interface ListTasksResult {
	tasks: Task[];
	total: number;
	filtered: number;
	tag?: string;
}

/**
 * TaskMasterCore facade class
 * Provides simplified API for all tm-core operations
 */
export class TaskMasterCore {
	private storage: IStorage;
	private projectPath: string;
	private configuration: Partial<IConfiguration>;
	private initialized = false;

	constructor(options: TaskMasterCoreOptions) {
		if (!options.projectPath) {
			throw new TaskMasterError('Project path is required', ERROR_CODES.MISSING_CONFIGURATION);
		}

		this.projectPath = options.projectPath;
		this.configuration = options.configuration || {};

		// Use provided storage or create default FileStorage
		this.storage = options.storage || new FileStorage(this.projectPath);
	}

	/**
	 * Initialize the TaskMasterCore instance
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		try {
			await this.storage.initialize();
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
	 * List all tasks with optional filtering
	 */
	async listTasks(options?: {
		tag?: string;
		filter?: TaskFilter;
		includeSubtasks?: boolean;
	}): Promise<ListTasksResult> {
		await this.ensureInitialized();

		try {
			// Load tasks from storage
			const rawTasks = await this.storage.loadTasks(options?.tag);

			// Convert to TaskEntity for business logic
			const taskEntities = TaskEntity.fromArray(rawTasks);

			// Apply filters if provided
			let filteredTasks = taskEntities;

			if (options?.filter) {
				filteredTasks = this.applyFilters(taskEntities, options.filter);
			}

			// Convert back to plain objects
			const tasks = filteredTasks.map((entity) => entity.toJSON());

			// Optionally exclude subtasks
			const finalTasks =
				options?.includeSubtasks === false
					? tasks.map((task) => ({ ...task, subtasks: [] }))
					: tasks;

			return {
				tasks: finalTasks,
				total: rawTasks.length,
				filtered: filteredTasks.length,
				tag: options?.tag
			};
		} catch (error) {
			throw new TaskMasterError(
				'Failed to list tasks',
				ERROR_CODES.INTERNAL_ERROR,
				{
					operation: 'listTasks',
					tag: options?.tag
				},
				error as Error
			);
		}
	}

	/**
	 * Get a specific task by ID
	 */
	async getTask(taskId: string, tag?: string): Promise<Task | null> {
		await this.ensureInitialized();

		const result = await this.listTasks({ tag });
		const task = result.tasks.find((t) => t.id === taskId);

		return task || null;
	}

	/**
	 * Get tasks by status
	 */
	async getTasksByStatus(status: TaskStatus | TaskStatus[], tag?: string): Promise<Task[]> {
		const statuses = Array.isArray(status) ? status : [status];
		const result = await this.listTasks({
			tag,
			filter: { status: statuses }
		});

		return result.tasks;
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
		const result = await this.listTasks({ tag });

		const stats = {
			total: result.total,
			byStatus: {} as Record<TaskStatus, number>,
			withSubtasks: 0,
			blocked: 0
		};

		// Initialize status counts
		const statuses: TaskStatus[] = [
			'pending',
			'in-progress',
			'done',
			'deferred',
			'cancelled',
			'blocked',
			'review'
		];

		statuses.forEach((status) => {
			stats.byStatus[status] = 0;
		});

		// Count tasks
		result.tasks.forEach((task) => {
			stats.byStatus[task.status]++;

			if (task.subtasks && task.subtasks.length > 0) {
				stats.withSubtasks++;
			}

			if (task.status === 'blocked') {
				stats.blocked++;
			}
		});

		return stats;
	}

	/**
	 * Apply filters to tasks
	 */
	private applyFilters(tasks: TaskEntity[], filter: TaskFilter): TaskEntity[] {
		return tasks.filter((task) => {
			// Filter by status
			if (filter.status) {
				const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
				if (!statuses.includes(task.status)) {
					return false;
				}
			}

			// Filter by priority
			if (filter.priority) {
				const priorities = Array.isArray(filter.priority) ? filter.priority : [filter.priority];
				if (!priorities.includes(task.priority)) {
					return false;
				}
			}

			// Filter by tags
			if (filter.tags && filter.tags.length > 0) {
				if (!task.tags || !filter.tags.some((tag) => task.tags?.includes(tag))) {
					return false;
				}
			}

			// Filter by assignee
			if (filter.assignee) {
				if (task.assignee !== filter.assignee) {
					return false;
				}
			}

			// Filter by complexity
			if (filter.complexity) {
				const complexities = Array.isArray(filter.complexity)
					? filter.complexity
					: [filter.complexity];
				if (!task.complexity || !complexities.includes(task.complexity)) {
					return false;
				}
			}

			// Filter by search term
			if (filter.search) {
				const searchLower = filter.search.toLowerCase();
				const inTitle = task.title.toLowerCase().includes(searchLower);
				const inDescription = task.description.toLowerCase().includes(searchLower);
				const inDetails = task.details.toLowerCase().includes(searchLower);

				if (!inTitle && !inDescription && !inDetails) {
					return false;
				}
			}

			// Filter by hasSubtasks
			if (filter.hasSubtasks !== undefined) {
				const hasSubtasks = task.subtasks.length > 0;
				if (hasSubtasks !== filter.hasSubtasks) {
					return false;
				}
			}

			return true;
		});
	}

	/**
	 * Close and cleanup resources
	 */
	async close(): Promise<void> {
		if (this.storage) {
			await this.storage.close();
		}
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
		storage?: IStorage;
	}
): TaskMasterCore {
	return new TaskMasterCore({
		projectPath,
		configuration: options?.configuration,
		storage: options?.storage
	});
}
