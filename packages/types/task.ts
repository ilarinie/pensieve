/**
 * Allowed task status values.
 */
export type TaskStatus = 'pending' | 'done' | 'snoozed' | 'cancelled'

/**
 * Allowed task priority values (1 = high, 2 = medium, 3 = low).
 */
export type TaskPriority = 1 | 2 | 3

/**
 * A task record extracted from a memory or created directly.
 */
export type Task = {
  id: string
  title: string
  description: string | null
  status: string
  priority: number | null
  dueDate: Date | null
  reminderAt: Date | null
  snoozedUntil: Date | null
  completedAt: Date | null
  sourceMemoryId: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Input for creating a new task. Omits auto-generated fields.
 */
export type NewTask = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>
