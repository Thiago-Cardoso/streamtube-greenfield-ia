import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const exceptionResponse = exception.getResponse() as Record<string, unknown>;

    const message =
      Array.isArray(exceptionResponse.message)
        ? exceptionResponse.message
        : [exceptionResponse.message ?? exception.message];

    response.status(400).json({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
      message,
    });
  }
}
