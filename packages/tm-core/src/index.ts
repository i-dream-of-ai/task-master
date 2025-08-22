/**
 * @fileoverview Main entry point for the tm-core package
 * This file exports all public APIs from the core Task Master library
 */

// Export main facade
export {
	TaskMasterCore,
	createTaskMasterCore,
	type TaskMasterCoreOptions,
	type ListTasksResult
} from './task-master-core.js';

// Re-export types
export type * from './types/index';

// Re-export interfaces (types only to avoid conflicts)
export type * from './interfaces/index';

// Re-export providers
export * from './providers/index';

// Re-export storage (selectively to avoid conflicts)
export { FileStorage, ApiStorage, StorageFactory, type ApiStorageConfig } from './storage/index';
export { PlaceholderStorage, type StorageAdapter } from './storage/index';

// Re-export parser
export * from './parser/index';

// Re-export utilities
export * from './utils/index';

// Re-export errors
export * from './errors/index';

// Re-export entities
export { TaskEntity } from './entities/task.entity.js';

// Package metadata
export const version = '1.0.0';
export const name = '@task-master/tm-core';
