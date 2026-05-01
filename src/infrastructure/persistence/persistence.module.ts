import { Module, Global } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { ConfigService } from '@/core/config/config.service';
import { ConfigModule } from '@/core/config/config.module';
import * as mainSchema from './main.schema';
import * as auditSchema from './audit.schema';

export const DB_TOKEN = Symbol('DB_TOKEN');
export const AUDIT_DB_TOKEN = Symbol('AUDIT_DB_TOKEN');

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DB_TOKEN,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const connectionString = configService.get('DATABASE_URL');
        const sql = postgres(connectionString);
        return drizzle(sql, { schema: mainSchema });
      },
    },
    {
      provide: AUDIT_DB_TOKEN,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const connectionString = configService.get('AUDIT_DATABASE_URL');
        const sql = postgres(connectionString);
        return drizzle(sql, { schema: auditSchema });
      },
    },
  ],
  exports: [DB_TOKEN, AUDIT_DB_TOKEN],
})
export class PersistenceModule {}
