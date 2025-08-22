/**
 * @fileoverview UI utilities for Task Master CLI
 * Provides formatting, display, and visual components for the command line interface
 */

import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import type { Task, TaskStatus, TaskPriority } from '@tm/core';

/**
 * Get colored status display
 */
export function getStatusWithColor(status: TaskStatus): string {
	const statusColors: Record<TaskStatus, (text: string) => string> = {
		pending: chalk.yellow,
		'in-progress': chalk.blue,
		done: chalk.green,
		deferred: chalk.gray,
		cancelled: chalk.red,
		blocked: chalk.magenta,
		review: chalk.cyan
	};

	const statusEmojis: Record<TaskStatus, string> = {
		pending: '⏳',
		'in-progress': '🚀',
		done: '✅',
		deferred: '⏸️',
		cancelled: '❌',
		blocked: '🚫',
		review: '👀'
	};

	const colorFn = statusColors[status] || chalk.white;
	const emoji = statusEmojis[status] || '';

	return `${emoji} ${colorFn(status)}`;
}

/**
 * Get colored priority display
 */
export function getPriorityWithColor(priority: TaskPriority): string {
	const priorityColors: Record<TaskPriority, (text: string) => string> = {
		critical: chalk.red.bold,
		high: chalk.red,
		medium: chalk.yellow,
		low: chalk.gray
	};

	const colorFn = priorityColors[priority] || chalk.white;
	return colorFn(priority);
}

/**
 * Get colored complexity display
 */
export function getComplexityWithColor(complexity: number | string): string {
	const score =
		typeof complexity === 'string' ? parseInt(complexity, 10) : complexity;

	if (isNaN(score)) {
		return chalk.gray('N/A');
	}

	if (score >= 8) {
		return chalk.red.bold(`${score} (High)`);
	} else if (score >= 5) {
		return chalk.yellow(`${score} (Medium)`);
	} else {
		return chalk.green(`${score} (Low)`);
	}
}

/**
 * Truncate text to specified length
 */
export function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text;
	}
	return text.substring(0, maxLength - 3) + '...';
}

/**
 * Create a progress bar
 */
export function createProgressBar(
	completed: number,
	total: number,
	width: number = 30
): string {
	if (total === 0) {
		return chalk.gray('No tasks');
	}

	const percentage = Math.round((completed / total) * 100);
	const filled = Math.round((completed / total) * width);
	const empty = width - filled;

	const bar = chalk.green('█').repeat(filled) + chalk.gray('░').repeat(empty);

	return `${bar} ${chalk.cyan(`${percentage}%`)} (${completed}/${total})`;
}

/**
 * Display a fancy banner
 */
export function displayBanner(title: string = 'Task Master'): void {
	console.log(
		boxen(chalk.cyan.bold(title), {
			padding: 1,
			margin: { top: 1, bottom: 1 },
			borderStyle: 'double',
			borderColor: 'cyan',
			textAlignment: 'center'
		})
	);
}

/**
 * Display an error message
 */
export function displayError(message: string, details?: string): void {
	console.error(
		boxen(
			chalk.red.bold('Error: ') +
				chalk.white(message) +
				(details ? '\n\n' + chalk.gray(details) : ''),
			{
				padding: 1,
				borderStyle: 'round',
				borderColor: 'red'
			}
		)
	);
}

/**
 * Display a success message
 */
export function displaySuccess(message: string): void {
	console.log(
		boxen(chalk.green.bold('✓ ') + chalk.white(message), {
			padding: 1,
			borderStyle: 'round',
			borderColor: 'green'
		})
	);
}

/**
 * Display a warning message
 */
export function displayWarning(message: string): void {
	console.log(
		boxen(chalk.yellow.bold('⚠ ') + chalk.white(message), {
			padding: 1,
			borderStyle: 'round',
			borderColor: 'yellow'
		})
	);
}

/**
 * Display info message
 */
export function displayInfo(message: string): void {
	console.log(
		boxen(chalk.blue.bold('ℹ ') + chalk.white(message), {
			padding: 1,
			borderStyle: 'round',
			borderColor: 'blue'
		})
	);
}

/**
 * Format dependencies with their status
 */
export function formatDependenciesWithStatus(
	dependencies: string[] | number[],
	tasks: Task[]
): string {
	if (!dependencies || dependencies.length === 0) {
		return chalk.gray('none');
	}

	const taskMap = new Map(tasks.map((t) => [t.id.toString(), t]));

	return dependencies
		.map((depId) => {
			const task = taskMap.get(depId.toString());
			if (!task) {
				return chalk.red(`${depId} (not found)`);
			}

			const statusIcon =
				task.status === 'done'
					? '✓'
					: task.status === 'in-progress'
						? '►'
						: '○';

			return `${depId}${statusIcon}`;
		})
		.join(', ');
}

/**
 * Create a task table for display
 */
export function createTaskTable(
	tasks: Task[],
	options?: {
		showSubtasks?: boolean;
		showComplexity?: boolean;
		showDependencies?: boolean;
	}
): string {
	const {
		showSubtasks = false,
		showComplexity = false,
		showDependencies = true
	} = options || {};

	const headers = ['ID', 'Title', 'Status', 'Priority'];
	const colWidths = [8, 40, 15, 10];

	if (showDependencies) {
		headers.push('Dependencies');
		colWidths.push(20);
	}

	if (showComplexity) {
		headers.push('Complexity');
		colWidths.push(12);
	}

	const table = new Table({
		head: headers,
		style: { head: ['blue'] },
		colWidths
	});

	tasks.forEach((task) => {
		const row: string[] = [
			chalk.cyan(task.id.toString()),
			truncate(task.title, 38),
			getStatusWithColor(task.status),
			getPriorityWithColor(task.priority)
		];

		if (showDependencies) {
			row.push(formatDependenciesWithStatus(task.dependencies, tasks));
		}

		if (showComplexity && 'complexity' in task) {
			row.push(getComplexityWithColor(task.complexity as number | string));
		}

		table.push(row);

		// Add subtasks if requested
		if (showSubtasks && task.subtasks && task.subtasks.length > 0) {
			task.subtasks.forEach((subtask) => {
				const subRow: string[] = [
					chalk.gray(`  └─ ${task.id}.${subtask.id}`),
					chalk.gray(truncate(subtask.title, 36)),
					getStatusWithColor(subtask.status),
					chalk.gray(subtask.priority || 'medium')
				];

				if (showDependencies) {
					subRow.push(
						chalk.gray(
							subtask.dependencies && subtask.dependencies.length > 0
								? subtask.dependencies.join(', ')
								: 'none'
						)
					);
				}

				if (showComplexity) {
					subRow.push(chalk.gray('--'));
				}

				table.push(subRow);
			});
		}
	});

	return table.toString();
}
