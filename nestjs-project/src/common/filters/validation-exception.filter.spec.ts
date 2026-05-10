import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { ValidationExceptionFilter } from './validation-exception.filter';

describe('ValidationExceptionFilter', () => {
  let filter: ValidationExceptionFilter;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new ValidationExceptionFilter();
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });

    mockHost = {
      switchToHttp: () => ({
        getResponse: () => ({ status: mockStatus }),
      }),
      getArgs: () => [],
      getArgByIndex: () => null,
      switchToRpc: () => ({}) as never,
      switchToWs: () => ({}) as never,
      getType: () => 'http',
    } as unknown as ArgumentsHost;
  });

  it('normalizes class-validator array errors to VALIDATION_ERROR shape', () => {
    const exception = new BadRequestException({
      statusCode: 400,
      message: ['email must be an email', 'password must be longer than or equal to 8 characters'],
      error: 'Bad Request',
    });

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
      message: ['email must be an email', 'password must be longer than or equal to 8 characters'],
    });
  });

  it('wraps a single string message in an array', () => {
    const exception = new BadRequestException('Invalid input');

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
      message: expect.arrayContaining([expect.any(String)]),
    });
  });
});
