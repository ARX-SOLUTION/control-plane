import { z } from 'zod';
import { createProjectSchema } from './create-project.dto';

export const updateProjectSchema = createProjectSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;
