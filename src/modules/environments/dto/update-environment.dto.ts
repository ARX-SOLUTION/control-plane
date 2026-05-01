import { z } from 'zod';

export const updateEnvironmentSchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateEnvironmentDto = z.infer<typeof updateEnvironmentSchema>;
