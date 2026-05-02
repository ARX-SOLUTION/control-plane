import { Injectable } from '@nestjs/common';
import { envSchema, type EnvConfig } from './env.schema';

@Injectable()
export class ConfigService {
  private readonly config: EnvConfig;

  constructor() {
    const normalizedEnv = Object.fromEntries(
      Object.entries(process.env).filter(([, value]) => value !== ''),
    );

    const result = envSchema.safeParse(normalizedEnv);

    if (!result.success) {
      console.error('❌ Invalid environment variables:');
      console.error(result.error.flatten());
      process.exit(1);
    }

    this.config = result.data;
  }

  get<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
    return this.config[key];
  }

  getAll(): EnvConfig {
    return this.config;
  }

  isDevelopment(): boolean {
    return this.config.NODE_ENV === 'development';
  }

  isProduction(): boolean {
    return this.config.NODE_ENV === 'production';
  }

  isTest(): boolean {
    return this.config.NODE_ENV === 'test';
  }
}
