import { z } from 'zod';

export const queryLogsSchema = z.object({
  query: z.string().min(1),
  start: z.string().optional().default(() => new Date(Date.now() - 3600_000).toISOString()),
  end: z.string().optional().default(() => new Date().toISOString()),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(100),
});

export type QueryLogsDto = z.infer<typeof queryLogsSchema>;
