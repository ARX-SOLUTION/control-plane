import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { AppException } from './app.exception';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof AppException) {
      res.status(exception.statusCode).json({
        code: exception.code,
        statusCode: exception.statusCode,
        message: exception.message,
      });
    } else if (exception instanceof HttpException) {
      res.status(exception.getStatus()).json(exception.getResponse());
    } else {
      this.logger.error('Unhandled exception', exception);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        statusCode: 500,
        message: 'Internal server error',
      });
    }
  }
}
