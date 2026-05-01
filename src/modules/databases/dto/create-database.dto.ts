import { z } from 'zod';

export const createDatabaseSchema = z.object({
  projectId: z.string().uuid(),
  type: z.enum(['postgres', 'redis']),
  name: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9_]+$/, 'Only lowercase letters, numbers and underscores'),
});

export type CreateDatabaseDto = z.infer<typeof createDatabaseSchema>;
