import { AppException } from './app.exception';

export class UnauthorizedException extends AppException {
  constructor(msg = 'Not authenticated', meta?: Record<string, unknown>) {
    super('UNAUTHORIZED', 401, msg, meta);
  }
}

export class NotFoundException extends AppException {
  constructor(msg: string, meta?: Record<string, unknown>) {
    super('NOT_FOUND', 404, msg, meta);
  }
}

export class ConflictException extends AppException {
  constructor(msg: string, meta?: Record<string, unknown>) {
    super('CONFLICT', 409, msg, meta);
  }
}

export class ForbiddenException extends AppException {
  constructor(msg: string, meta?: Record<string, unknown>) {
    super('FORBIDDEN', 403, msg, meta);
  }
}

export class ValidationException extends AppException {
  constructor(msg: string, meta?: Record<string, unknown>) {
    super('VALIDATION_ERROR', 422, msg, meta);
  }
}

export class TooManyRequestsException extends AppException {
  constructor(msg = 'Too many requests', meta?: Record<string, unknown>) {
    super('TOO_MANY_REQUESTS', 429, msg, meta);
  }
}
