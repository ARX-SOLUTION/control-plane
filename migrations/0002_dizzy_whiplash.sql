ALTER TABLE "projects" ADD COLUMN "webhook_secret_ciphertext" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "webhook_secret_encrypted_dek" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "webhook_secret_iv" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "webhook_secret_auth_tag" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "webhook_secret_key_version" integer;