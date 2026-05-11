export abstract class DomainException extends Error {
  abstract readonly errorCode: string;
  abstract readonly httpStatus: number;
}

export class EmailAlreadyExistsException extends DomainException {
  readonly errorCode = 'EMAIL_ALREADY_EXISTS';
  readonly httpStatus = 409;
  constructor() {
    super('Email is already registered');
  }
}

export class InvalidCredentialsException extends DomainException {
  readonly errorCode = 'INVALID_CREDENTIALS';
  readonly httpStatus = 401;
  constructor() {
    super('Invalid email or password');
  }
}

export class EmailNotConfirmedException extends DomainException {
  readonly errorCode = 'EMAIL_NOT_CONFIRMED';
  readonly httpStatus = 403;
  constructor() {
    super('Email not confirmed');
  }
}

export class InvalidTokenException extends DomainException {
  readonly errorCode = 'INVALID_TOKEN';
  readonly httpStatus = 401;
  constructor() {
    super('Invalid or already used token');
  }
}

export class TokenExpiredException extends DomainException {
  readonly errorCode = 'TOKEN_EXPIRED';
  readonly httpStatus = 401;
  constructor() {
    super('Token has expired');
  }
}

export class TokenReuseDetectedException extends DomainException {
  readonly errorCode = 'TOKEN_REUSE_DETECTED';
  readonly httpStatus = 401;
  constructor() {
    super('Token reuse detected — all sessions revoked');
  }
}

export class VideoNotFoundException extends DomainException {
  readonly errorCode = 'VIDEO_NOT_FOUND';
  readonly httpStatus = 404;
  constructor() {
    super('Video not found');
  }
}

export class VideoInvalidMimeTypeException extends DomainException {
  readonly errorCode = 'INVALID_MIME_TYPE';
  readonly httpStatus = 400;
  constructor() {
    super('File type not supported. Accepted formats: mp4, mov, webm, avi');
  }
}

export class VideoUploadFailedException extends DomainException {
  readonly errorCode = 'VIDEO_UPLOAD_FAILED';
  readonly httpStatus = 500;
  constructor() {
    super('Video upload failed');
  }
}
