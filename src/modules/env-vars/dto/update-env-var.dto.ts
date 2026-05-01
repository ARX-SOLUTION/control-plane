import { z } from 'zod';

export const updateEnvVarSchema = z.object({
  value: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateEnvVarDto = z.infer<typeof updateEnvVarSchema>;
