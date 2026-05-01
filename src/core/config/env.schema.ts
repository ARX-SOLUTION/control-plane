import { z } from 'zod';

export const envSchema = z.object({
  // App
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.string().default('3000').transform(Number),

  // Database
  DATABASE_URL: z.string().url().or(z.string().startsWith('postgresql://')),
  AUDIT_DATABASE_URL: z
    .string()
    .url()
    .or(z.string().startsWith('postgresql://')),

  // Redis
  REDIS_URL: z.string().url().or(z.string().startsWith('redis://')),

  // Session
  SESSION_SECRET: z.string().min(32),
  SESSION_NAME: z.string().default('control_plane_sid'),
  SESSION_MAX_AGE: z.string().default('86400000').transform(Number), // 24 hours in ms

  // Crypto
  MASTER_KEY: z.string().length(64), // 32 bytes hex

  // Admin bootstrap
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),

  // Docker
  DOCKER_SOCKET_PATH: z.string().default('/var/run/docker.sock'),

  // Caddy
  CADDY_ADMIN_URL: z.string().url().default('http://localhost:2019'),

  // Cloudflare
  CLOUDFLARE_API_TOKEN: z.string().optional(),
  CLOUDFLARE_ZONE_ID: z.string().optional(),

  // RabbitMQ
  RABBITMQ_URL: z
    .string()
    .url()
    .or(z.string().startsWith('amqp://'))
    .optional(),

  // Loki
  LOKI_URL: z.string().url().optional(),

  // Prometheus
  PROMETHEUS_URL: z.string().url().optional(),

  // OpenTelemetry
  OTLP_ENDPOINT: z.string().url().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;
