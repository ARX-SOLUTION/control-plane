import { z } from 'zod';

export const auditEventSchema = z.object({
  id: z.string().uuid(),
  actor_user_id: z.string().uuid().nullable(),
  action: z.string().min(1).max(100),
  resource_type: z.string().min(1).max(50),
  resource_id: z.string().max(255).nullable(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  ip: z.string().nullable(),
  user_agent: z.string().max(500).nullable(),
  created_at: z.date(),
});

export type AuditEvent = z.infer<typeof auditEventSchema>;

export interface CreateAuditEventInput {
  actor_user_id?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  metadata?: Record<string, any>;
  ip?: string;
  user_agent?: string;
}

export type AuditAction =
  | 'user.login'
  | 'user.logout'
  | 'user.create'
  | 'secret.create'
  | 'secret.update'
  | 'secret.delete'
  | 'secret.reveal'
  | 'project.create'
  | 'project.update'
  | 'project.delete'
  | 'deployment.create'
  | 'deployment.start'
  | 'deployment.rollback';
