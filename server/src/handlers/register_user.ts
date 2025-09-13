import { createHash } from 'crypto';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { type RegisterUserInput, type AuthResponse } from '../schema';

// Simple password hashing using built-in crypto
function hashPassword(password: string): string {
  return createHash('sha256').update(password + 'salt').digest('hex');
}

// Simple JWT-like token generation
function generateToken(userId: number, email: string): string {
  const payload = { userId, email, exp: Date.now() + 24 * 60 * 60 * 1000 };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

// Ensure users table exists
async function ensureUsersTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      ui_color_theme VARCHAR(50) NOT NULL DEFAULT 'blue',
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
}

export async function registerUser(input: RegisterUserInput): Promise<AuthResponse> {
  try {
    // Ensure table exists
    await ensureUsersTable();

    // Check if email is already registered
    const existingUsers = await db.execute(
      sql`SELECT id FROM users WHERE email = ${input.email}`
    );

    if (existingUsers.rows.length > 0) {
      throw new Error('Email is already registered');
    }

    // Hash the password
    const password_hash = hashPassword(input.password);

    // Create the user record
    const result = await db.execute(sql`
      INSERT INTO users (email, password_hash, name, ui_color_theme, created_at, updated_at)
      VALUES (${input.email}, ${password_hash}, ${input.name}, ${input.ui_color_theme}, NOW(), NOW())
      RETURNING id, email, name, ui_color_theme, created_at, updated_at
    `);

    if (result.rows.length === 0) {
      throw new Error('Failed to create user');
    }

    const user = result.rows[0] as any;

    // Generate token
    const token = generateToken(user.id, user.email);

    // Return public user data with token
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        ui_color_theme: user.ui_color_theme,
        created_at: new Date(user.created_at),
        updated_at: new Date(user.updated_at)
      },
      token
    };
  } catch (error) {
    console.error('User registration failed:', error);
    throw error;
  }
}