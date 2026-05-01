import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
} from 'drizzle-orm/pg-core';

// Users table (already exists from initial migration)
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Projects table
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  githubUrl: text('github_url'),
  branch: varchar('branch', { length: 255 }).default('main'),
  buildCommand: text('build_command'),
  startCommand: text('start_command'),
  healthCheckPath: varchar('health_check_path', { length: 255 }).default('/'),
  healthCheckInterval: integer('health_check_interval').default(30), // seconds
  appPort: integer('app_port').default(3000).notNull(),
  webhookSecretCiphertext: text('webhook_secret_ciphertext'),
  webhookSecretEncryptedDek: text('webhook_secret_encrypted_dek'),
  webhookSecretIv: text('webhook_secret_iv'),
  webhookSecretAuthTag: text('webhook_secret_auth_tag'),
  webhookSecretKeyVersion: integer('webhook_secret_key_version'),
  isActive: boolean('is_active').default(true).notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Environments table
export const environments = pgTable('environments', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 50 }).notNull(), // dev, stage, prod
  displayName: varchar('display_name', { length: 255 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Environment variables table
export const envVars = pgTable('env_vars', {
  id: uuid('id').primaryKey().defaultRandom(),
  environmentId: uuid('environment_id')
    .notNull()
    .references(() => environments.id, { onDelete: 'cascade' }),
  key: varchar('key', { length: 255 }).notNull(),
  // Encrypted values using CryptoService
  ciphertext: text('ciphertext').notNull(),
  encryptedDek: text('encrypted_dek').notNull(),
  iv: text('iv').notNull(),
  authTag: text('auth_tag').notNull(),
  keyVersion: integer('key_version').notNull(),
  version: integer('version').default(1).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdById: uuid('created_by_id').references(() => users.id),
});

// Deployments table
export const deployments = pgTable('deployments', {
  id: uuid('id').primaryKey().defaultRandom(),
  environmentId: uuid('environment_id')
    .notNull()
    .references(() => environments.id),
  status: varchar('status', { length: 50 }).notNull(), // pending, cloning, building, starting, health_check, switching, success, failed, rolled_back
  branch: varchar('branch', { length: 255 }), // override; null = use project default
  commitHash: varchar('commit_hash', { length: 40 }),
  commitMessage: text('commit_message'),
  buildLogs: text('build_logs'),
  deployLogs: text('deploy_logs'),
  errorMessage: text('error_message'),
  containerName: varchar('container_name', { length: 255 }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  deployedById: uuid('deployed_by_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Domains table
export const domains = pgTable('domains', {
  id: uuid('id').primaryKey().defaultRandom(),
  environmentId: uuid('environment_id')
    .notNull()
    .references(() => environments.id, { onDelete: 'cascade' }),
  domain: varchar('domain', { length: 255 }).notNull().unique(),
  isActive: boolean('is_active').default(true).notNull(),
  sslEnabled: boolean('ssl_enabled').default(true).notNull(),
  cloudflareZoneId: varchar('cloudflare_zone_id', { length: 255 }),
  cloudflareRecordId: varchar('cloudflare_record_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Databases table
export const databases = pgTable('databases', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(), // postgres, redis
  name: varchar('name', { length: 255 }).notNull().unique(),
  containerName: varchar('container_name', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 255 }),
  // Password encrypted using CryptoService
  passwordCiphertext: text('password_ciphertext'),
  passwordEncryptedDek: text('password_encrypted_dek'),
  passwordIv: text('password_iv'),
  passwordAuthTag: text('password_auth_tag'),
  passwordKeyVersion: integer('password_key_version'),
  host: varchar('host', { length: 255 }).notNull(),
  port: integer('port').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
