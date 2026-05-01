import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@/shared/exceptions';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    if (!request.session || !request.session.userId) {
      throw new UnauthorizedException();
    }

    request.user = { id: request.session.userId };

    return true;
  }
}
