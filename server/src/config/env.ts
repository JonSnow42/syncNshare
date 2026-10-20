import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from server directory, or root if exists
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  MONGODB_URI: z
    .string({
      required_error:
        'Missing required environment variable: MONGODB_URI. Follow the database setup instructions in README.md.',
    })
    .min(1, 'Missing required environment variable: MONGODB_URI. Follow the database setup instructions in README.md.'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long').default('development-only-jwt-secret-replace-in-production-1234567890'),
  COOKIE_SECRET: z.string().min(16, 'COOKIE_SECRET must be at least 16 characters long').default('development-only-cookie-secret-replace-in-production-1234567890'),
  LOG_LEVEL: z.string().default('info'),
});

let parsedEnv: z.infer<typeof envSchema>;

try {
  parsedEnv = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    const missing = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('\n');
    console.error('\n======================================================');
    console.error('CONFIGURATION ERROR: Invalid or missing environment variables:\n');
    console.error(missing);
    console.error('\nCheck server/.env or root .env.example for guidance.');
    console.error('======================================================\n');
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }
  // Fallback for test runner if needed
  parsedEnv = {
    NODE_ENV: 'test',
    PORT: 5000,
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/syncnshare_test',
    CLIENT_ORIGIN: 'http://localhost:5173',
    JWT_SECRET: 'test-jwt-secret-key-at-least-16-chars',
    COOKIE_SECRET: 'test-cookie-secret-key-at-least-16-chars',
    LOG_LEVEL: 'warn',
  };
}

export const env = parsedEnv;
