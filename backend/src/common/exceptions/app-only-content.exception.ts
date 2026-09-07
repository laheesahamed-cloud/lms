import { ForbiddenException } from '@nestjs/common';

// Thrown instead of the usual subscription/entitlement error when premium
// content is requested from the website. The frontend keys off `code` to
// branch to the "Open in the App" gate instead of the old "View plans" UI.
export class AppOnlyContentException extends ForbiddenException {
  constructor() {
    super({
      statusCode: 403,
      error: 'Forbidden',
      message: 'This content is only available in the Xyndrome mobile app.',
      code: 'APP_ONLY_CONTENT',
    });
  }
}
