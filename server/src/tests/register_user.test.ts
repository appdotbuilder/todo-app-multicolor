import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createHash } from 'crypto';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { type RegisterUserInput } from '../schema';
import { registerUser } from '../handlers/register_user';

// Helper function to verify password hash
function verifyPassword(password: string, hash: string): boolean {
  const expectedHash = createHash('sha256').update(password + 'salt').digest('hex');
  return expectedHash === hash;
}

// Helper function to decode our simple token
function decodeToken(token: string): any {
  try {
    return JSON.parse(Buffer.from(token, 'base64').toString());
  } catch {
    return null;
  }
}

// Test input with all required fields
const testInput: RegisterUserInput = {
  email: 'test@example.com',
  password: 'password123',
  name: 'Test User',
  ui_color_theme: 'blue'
};

describe('registerUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should register a new user successfully', async () => {
    const result = await registerUser(testInput);

    // Verify return structure
    expect(result.user).toBeDefined();
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');

    // Verify user data
    expect(result.user.email).toEqual('test@example.com');
    expect(result.user.name).toEqual('Test User');
    expect(result.user.ui_color_theme).toEqual('blue');
    expect(result.user.id).toBeDefined();
    expect(typeof result.user.id).toBe('number');
    expect(result.user.created_at).toBeInstanceOf(Date);
    expect(result.user.updated_at).toBeInstanceOf(Date);

    // Verify password_hash is not exposed in response
    expect((result.user as any).password_hash).toBeUndefined();
  });

  it('should save user to database with hashed password', async () => {
    const result = await registerUser(testInput);

    // Query database to verify user was created
    const queryResult = await db.execute(
      sql`SELECT * FROM users WHERE id = ${result.user.id}`
    );

    expect(queryResult.rows).toHaveLength(1);
    const savedUser = queryResult.rows[0] as any;
    
    expect(savedUser.email).toEqual('test@example.com');
    expect(savedUser.name).toEqual('Test User');
    expect(savedUser.ui_color_theme).toEqual('blue');
    expect(new Date(savedUser.created_at)).toBeInstanceOf(Date);
    expect(new Date(savedUser.updated_at)).toBeInstanceOf(Date);
    
    // Verify password is hashed (not plain text)
    expect(savedUser.password_hash).toBeDefined();
    expect(savedUser.password_hash).not.toEqual('password123');
    
    // Verify password can be validated
    const isValidPassword = verifyPassword('password123', savedUser.password_hash);
    expect(isValidPassword).toBe(true);
  });

  it('should generate valid token', async () => {
    const result = await registerUser(testInput);

    // Verify token can be decoded
    const decoded = decodeToken(result.token!);
    expect(decoded).toBeDefined();
    expect(decoded.userId).toEqual(result.user.id);
    expect(decoded.email).toEqual(result.user.email);
    expect(decoded.exp).toBeDefined(); // Token should have expiration
    expect(typeof decoded.exp).toBe('number');
  });

  it('should use provided ui_color_theme', async () => {
    const customThemeInput: RegisterUserInput = {
      email: 'theme-test@example.com',
      password: 'password123',
      name: 'Theme Test User',
      ui_color_theme: 'green'
    };

    const result = await registerUser(customThemeInput);
    expect(result.user.ui_color_theme).toEqual('green');
  });

  it('should reject duplicate email registration', async () => {
    // Register first user
    await registerUser(testInput);

    // Attempt to register with same email
    const duplicateInput: RegisterUserInput = {
      email: 'test@example.com', // Same email
      password: 'differentpassword',
      name: 'Different User',
      ui_color_theme: 'red'
    };

    await expect(registerUser(duplicateInput))
      .rejects.toThrow(/email is already registered/i);
  });

  it('should handle different ui_color_theme values', async () => {
    const redThemeInput: RegisterUserInput = {
      email: 'red-theme@example.com',
      password: 'password123',
      name: 'Red Theme User',
      ui_color_theme: 'red'
    };

    const result = await registerUser(redThemeInput);
    expect(result.user.ui_color_theme).toEqual('red');
  });

  it('should handle case-sensitive emails correctly', async () => {
    // Register with lowercase email
    await registerUser({
      ...testInput,
      email: 'test@example.com'
    });

    // Attempt to register with uppercase email
    const uppercaseEmailInput: RegisterUserInput = {
      email: 'TEST@EXAMPLE.COM',
      password: 'password123',
      name: 'Test User 2',
      ui_color_theme: 'blue'
    };

    // This should succeed since emails are case-sensitive in our implementation
    const result = await registerUser(uppercaseEmailInput);
    expect(result.user.email).toEqual('TEST@EXAMPLE.COM');
  });

  it('should create users with unique IDs', async () => {
    const input1: RegisterUserInput = {
      email: 'user1@example.com',
      password: 'password123',
      name: 'User One',
      ui_color_theme: 'blue'
    };

    const input2: RegisterUserInput = {
      email: 'user2@example.com',
      password: 'password456',
      name: 'User Two',
      ui_color_theme: 'red'
    };

    const result1 = await registerUser(input1);
    const result2 = await registerUser(input2);

    expect(result1.user.id).not.toEqual(result2.user.id);
    expect(result1.user.id).toBeDefined();
    expect(result2.user.id).toBeDefined();
  });

  it('should verify password hashing is working correctly', async () => {
    const input1: RegisterUserInput = {
      email: 'hash1@example.com',
      password: 'password123',
      name: 'Hash Test 1',
      ui_color_theme: 'blue'
    };

    const input2: RegisterUserInput = {
      email: 'hash2@example.com',
      password: 'password456',
      name: 'Hash Test 2',
      ui_color_theme: 'blue'
    };

    const result1 = await registerUser(input1);
    const result2 = await registerUser(input2);

    // Get stored password hashes
    const user1Result = await db.execute(
      sql`SELECT password_hash FROM users WHERE id = ${result1.user.id}`
    );
    const user2Result = await db.execute(
      sql`SELECT password_hash FROM users WHERE id = ${result2.user.id}`
    );

    const hash1 = (user1Result.rows[0] as any).password_hash;
    const hash2 = (user2Result.rows[0] as any).password_hash;

    // Different passwords should produce different hashes
    expect(hash1).not.toEqual(hash2);

    // Verify each password matches its hash
    expect(verifyPassword('password123', hash1)).toBe(true);
    expect(verifyPassword('password456', hash2)).toBe(true);
    
    // Verify wrong passwords don't match
    expect(verifyPassword('password456', hash1)).toBe(false);
    expect(verifyPassword('password123', hash2)).toBe(false);
  });
});