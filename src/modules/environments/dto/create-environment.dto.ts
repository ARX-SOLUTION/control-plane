import { z } from 'zod';

export const createEnvironmentSchema = z.object({
  projectId: z.string().uuid(),
  name: z.enum(['dev', 'stage', 'prod']),
  displayName: z.string().min(1).max(255),
});

export type CreateEnvironmentDto = z.infer<typeof createEnvironmentSchema>;
