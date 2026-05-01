import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  schema: './src/infrastructure/persistence/audit.schema.ts',
  out: './migrations-audit',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.AUDIT_DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});