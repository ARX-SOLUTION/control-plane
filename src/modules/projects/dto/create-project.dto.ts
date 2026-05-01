import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9-]+$/, 'Name must be lowercase alphanumeric with hyphens'),
  displayName: z.string().min(1).max(255),
  githubUrl: z.string().url().optional(),
  branch: z.string().default('main'),
  buildCommand: z.string().optional(),
  startCommand: z.string().optional(),
  healthCheckPath: z.string().default('/'),
  healthCheckInterval: z.number().int().min(10).max(300).default(30),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateProjectDto = z.infer<typeof createProjectSchema>;
