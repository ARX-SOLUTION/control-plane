import { z } from 'zod';

export const createEnvVarSchema = z.object({
  environmentId: z.string().uuid(),
  key: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[A-Z_][A-Z0-9_]*$/, 'Invalid env var key format'),
  value: z.string(),
});

export type CreateEnvVarDto = z.infer<typeof createEnvVarSchema>;
