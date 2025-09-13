import { z } from 'zod';

// User schema
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password_hash: z.string(),
  name: z.string(),
  ui_color_theme: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Public user schema (without sensitive data)
export const publicUserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  name: z.string(),
  ui_color_theme: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type PublicUser = z.infer<typeof publicUserSchema>;

// Task schema
export const taskSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  completed: z.boolean(),
  priority: z.enum(['low', 'medium', 'high']),
  due_date: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Task = z.infer<typeof taskSchema>;

// Input schema for user registration
export const registerUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  ui_color_theme: z.string().default('blue')
});

export type RegisterUserInput = z.infer<typeof registerUserInputSchema>;

// Input schema for user login
export const loginUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type LoginUserInput = z.infer<typeof loginUserInputSchema>;

// Input schema for updating user profile
export const updateUserInputSchema = z.object({
  id: z.number(),
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  ui_color_theme: z.string().optional(),
  current_password: z.string().optional(),
  new_password: z.string().min(6).optional()
});

export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

// Input schema for creating tasks
export const createTaskInputSchema = z.object({
  user_id: z.number(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  due_date: z.coerce.date().nullable().optional()
});

export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

// Input schema for updating tasks
export const updateTaskInputSchema = z.object({
  id: z.number(),
  user_id: z.number(), // To ensure user owns the task
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  completed: z.boolean().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  due_date: z.coerce.date().nullable().optional()
});

export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;

// Input schema for getting tasks with filters
export const getTasksInputSchema = z.object({
  user_id: z.number(),
  completed: z.boolean().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  due_before: z.coerce.date().optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0)
});

export type GetTasksInput = z.infer<typeof getTasksInputSchema>;

// Input schema for deleting tasks
export const deleteTaskInputSchema = z.object({
  id: z.number(),
  user_id: z.number() // To ensure user owns the task
});

export type DeleteTaskInput = z.infer<typeof deleteTaskInputSchema>;

// Authentication response schema
export const authResponseSchema = z.object({
  user: publicUserSchema,
  token: z.string().optional() // JWT token for session management
});

export type AuthResponse = z.infer<typeof authResponseSchema>;