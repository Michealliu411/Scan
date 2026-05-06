import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ActiveSessionContext } from '../sessions/sessions.service';

type AuthenticatedRequest = {
  auth?: ActiveSessionContext;
};

export const CurrentUser = createParamDecorator(
  (data: keyof ActiveSessionContext | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const auth = request.auth;

    if (!auth) {
      return undefined;
    }

    return data ? auth[data] : auth;
  }
);
