import { z } from 'zod';

export const createDeploymentSchema = z.object({
  environmentId: z.string().uuid(),
  branch: z.string().optional(),
});

export type CreateDeploymentDto = z.infer<typeof createDeploymentSchema>;
