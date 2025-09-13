import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { type GetTasksInput } from '../schema';
import { getTasks } from '../handlers/get_tasks';
import { sql } from 'drizzle-orm';

describe('getTasks', () => {
  beforeEach(async () => {
    await createDB();
    
    // Create tables manually since schema is not available
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        ui_color_theme VARCHAR(50) NOT NULL DEFAULT 'blue',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));

    await db.execute(sql.raw(`
      CREATE TYPE priority_enum AS ENUM ('low', 'medium', 'high')
    `));

    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        completed BOOLEAN NOT NULL DEFAULT false,
        priority priority_enum NOT NULL DEFAULT 'medium',
        due_date TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
  });

  afterEach(resetDB);

  // Helper to create test user using raw SQL
  const createTestUser = async () => {
    const result = await db.execute(sql.raw(`
      INSERT INTO users (email, password_hash, name, ui_color_theme)
      VALUES ('test@example.com', 'hashedpassword', 'Test User', 'blue')
      RETURNING id, email, name, ui_color_theme, created_at, updated_at
    `));
    return (result.rows as any[])[0];
  };

  // Helper to create test task using raw SQL
  const createTestTask = async (userId: number, overrides: any = {}) => {
    const title = overrides.title || 'Test Task';
    const description = overrides.description || 'A test task';
    const completed = overrides.completed !== undefined ? overrides.completed : false;
    const priority = overrides.priority || 'medium';
    const dueDate = overrides.due_date || null;
    
    const dueDateValue = dueDate ? `'${dueDate.toISOString()}'` : 'NULL';
    
    const result = await db.execute(sql.raw(`
      INSERT INTO tasks (user_id, title, description, completed, priority, due_date)
      VALUES (${userId}, '${title}', '${description}', ${completed}, '${priority}', ${dueDateValue})
      RETURNING id, user_id, title, description, completed, priority, due_date, created_at, updated_at
    `));
    return (result.rows as any[])[0];
  };

  it('should get tasks for user', async () => {
    const user = await createTestUser();
    await createTestTask(Number(user.id), { title: 'Task 1' });
    await createTestTask(Number(user.id), { title: 'Task 2' });

    const input: GetTasksInput = {
      user_id: Number(user.id),
      limit: 50,
      offset: 0
    };

    const result = await getTasks(input);

    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Task 2'); // Most recent first due to ordering
    expect(result[1].title).toBe('Task 1');
    expect(result[0].user_id).toBe(Number(user.id));
    expect(result[0].id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);
  });

  it('should filter by completed status', async () => {
    const user = await createTestUser();
    await createTestTask(Number(user.id), { title: 'Incomplete Task', completed: false });
    await createTestTask(Number(user.id), { title: 'Complete Task', completed: true });

    const input: GetTasksInput = {
      user_id: Number(user.id),
      completed: true,
      limit: 50,
      offset: 0
    };

    const result = await getTasks(input);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Complete Task');
    expect(result[0].completed).toBe(true);
  });

  it('should filter by priority', async () => {
    const user = await createTestUser();
    await createTestTask(Number(user.id), { title: 'Low Priority', priority: 'low' });
    await createTestTask(Number(user.id), { title: 'High Priority', priority: 'high' });
    await createTestTask(Number(user.id), { title: 'Medium Priority', priority: 'medium' });

    const input: GetTasksInput = {
      user_id: Number(user.id),
      priority: 'high',
      limit: 50,
      offset: 0
    };

    const result = await getTasks(input);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('High Priority');
    expect(result[0].priority).toBe('high');
  });

  it('should filter by due_before date', async () => {
    const user = await createTestUser();
    
    const pastDate = new Date('2024-01-01');
    const futureDate = new Date('2024-12-31');
    const filterDate = new Date('2024-06-01');

    await createTestTask(Number(user.id), { 
      title: 'Past Task', 
      due_date: pastDate 
    });
    await createTestTask(Number(user.id), { 
      title: 'Future Task', 
      due_date: futureDate 
    });
    await createTestTask(Number(user.id), { 
      title: 'No Due Date', 
      due_date: null 
    });

    const input: GetTasksInput = {
      user_id: Number(user.id),
      due_before: filterDate,
      limit: 50,
      offset: 0
    };

    const result = await getTasks(input);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Past Task');
    expect(result[0].due_date).toEqual(pastDate);
  });

  it('should apply pagination correctly', async () => {
    const user = await createTestUser();
    
    // Create 5 tasks
    for (let i = 1; i <= 5; i++) {
      await createTestTask(Number(user.id), { title: `Task ${i}` });
    }

    // Get first 2 tasks
    const input1: GetTasksInput = {
      user_id: Number(user.id),
      limit: 2,
      offset: 0
    };

    const result1 = await getTasks(input1);
    expect(result1).toHaveLength(2);
    expect(result1[0].title).toBe('Task 5'); // Most recent first
    expect(result1[1].title).toBe('Task 4');

    // Get next 2 tasks
    const input2: GetTasksInput = {
      user_id: Number(user.id),
      limit: 2,
      offset: 2
    };

    const result2 = await getTasks(input2);
    expect(result2).toHaveLength(2);
    expect(result2[0].title).toBe('Task 3');
    expect(result2[1].title).toBe('Task 2');
  });

  it('should return empty array for different user', async () => {
    const user1 = await createTestUser();
    const user2 = await db.execute(sql.raw(`
      INSERT INTO users (email, password_hash, name, ui_color_theme)
      VALUES ('user2@example.com', 'hashedpassword', 'User Two', 'red')
      RETURNING id, email, name, ui_color_theme, created_at, updated_at
    `));

    await createTestTask(Number(user1.id), { title: 'User 1 Task' });

    const input: GetTasksInput = {
      user_id: Number((user2.rows as any[])[0].id),
      limit: 50,
      offset: 0
    };

    const result = await getTasks(input);

    expect(result).toHaveLength(0);
  });

  it('should order tasks by creation date descending', async () => {
    const user = await createTestUser();
    
    // Create tasks with slight delays to ensure different timestamps
    await createTestTask(Number(user.id), { title: 'First Task' });
    await new Promise(resolve => setTimeout(resolve, 10));
    await createTestTask(Number(user.id), { title: 'Second Task' });
    await new Promise(resolve => setTimeout(resolve, 10));
    await createTestTask(Number(user.id), { title: 'Third Task' });

    const input: GetTasksInput = {
      user_id: Number(user.id),
      limit: 50,
      offset: 0
    };

    const result = await getTasks(input);

    expect(result).toHaveLength(3);
    expect(result[0].title).toBe('Third Task'); // Most recent first
    expect(result[1].title).toBe('Second Task');
    expect(result[2].title).toBe('First Task');
    expect(result[0].created_at >= result[1].created_at).toBe(true);
    expect(result[1].created_at >= result[2].created_at).toBe(true);
  });
});