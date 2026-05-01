import { z } from 'zod';

export const queryInstantSchema = z.object({
  query: z.string().min(1),
  time: z.string().optional(),
});

export const queryRangeSchema = z.object({
  query: z.string().min(1),
  start: z.string(),
  end: z.string(),
  step: z.string().default('60s'),
});

export type QueryInstantDto = z.infer<typeof queryInstantSchema>;
export type QueryRangeDto = z.infer<typeof queryRangeSchema>;
