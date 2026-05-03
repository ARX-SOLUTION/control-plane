import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import type { ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    try {
      return this.schema.parse(value);
    } catch (error) {
      const details = ((error as any).errors ?? [])
        .map((e: any) => `${e.path?.length ? e.path.join('.') + ': ' : ''}${e.message}`)
        .join('; ');
      throw new BadRequestException(`Validation failed: ${details}`);
    }
  }
}
