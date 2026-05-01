import { z } from 'zod';

export const createDomainSchema = z.object({
  environmentId: z.string().uuid(),
  domain: z
    .string()
    .min(3)
    .regex(
      /^[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?)*$/,
      'Invalid domain name',
    ),
  cloudflareZoneId: z.string().optional(),
  serverIp: z.string().regex(/^\d{1,3}(\.\d{1,3}){3}$/, 'Invalid IPv4 address').optional(),
});

export type CreateDomainDto = z.infer<typeof createDomainSchema>;
