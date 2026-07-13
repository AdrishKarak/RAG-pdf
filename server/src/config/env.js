import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load environment variables from the server directory .env
process.loadEnvFile?.(join(__dirname, '..', '..', '.env'));

export const env = {
  PORT: process.env.PORT || 8000,
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  QDRANT_URL: process.env.QDRANT_URL || 'http://localhost:6333',
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  UPLOAD_DIR: join(__dirname, '..', '..', 'uploads'),
};
