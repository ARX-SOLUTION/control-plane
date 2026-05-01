import { z } from 'zod';

export const encryptedDataSchema = z.object({
  ciphertext: z.string(),
  encrypted_dek: z.string(),
  iv: z.string(),
  auth_tag: z.string(),
  key_version: z.number(),
});

export type EncryptedData = z.infer<typeof encryptedDataSchema>;

export interface DecryptionContext {
  purpose?: string;
  userId?: string;
  resourceType?: string;
  resourceId?: string;
}
