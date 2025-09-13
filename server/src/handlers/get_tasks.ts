import { db } from '../db';
import { type GetTasksInput, type Task } from '../schema';
import { sql } from 'drizzle-orm';

export const getTasks = async (input: GetTasksInput): Promise<Task[]> => {
  try {
    // Build the SQL query with proper parameterization
    let baseQuery = `
      SELECT id, user_id, title, description, completed, priority, due_date, created_at, updated_at
      FROM tasks
      WHERE user_id = ${input.user_id}
    `;
    
    const conditions: string[] = [];
    
    // Add optional filters
    if (input.completed !== undefined) {
      conditions.push(`completed = ${input.completed}`);
    }
    
    if (input.priority !== undefined) {
      conditions.push(`priority = '${input.priority}'`);
    }
    
    if (input.due_before !== undefined) {
      conditions.push(`due_date <= '${input.due_before.toISOString()}'`);
    }
    
    // Append additional conditions
    if (conditions.length > 0) {
      baseQuery += ' AND ' + conditions.join(' AND ');
    }
    
    // Add ordering and pagination
    baseQuery += ` ORDER BY created_at DESC LIMIT ${input.limit} OFFSET ${input.offset}`;
    
    const results = await db.execute(sql.raw(baseQuery));
    
    // Type the results as Task array with proper type casting
    return (results.rows as any[]).map((row: any) => ({
      id: Number(row.id),
      user_id: Number(row.user_id),
      title: String(row.title),
      description: row.description ? String(row.description) : null,
      completed: Boolean(row.completed),
      priority: String(row.priority) as 'low' | 'medium' | 'high',
      due_date: row.due_date ? new Date(row.due_date) : null,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    }));
  } catch (error) {
    console.error('Get tasks failed:', error);
    throw error;
  }
};