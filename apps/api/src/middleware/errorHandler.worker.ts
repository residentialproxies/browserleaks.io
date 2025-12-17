/**
 * Global Error Handler for Hono Worker
 *
 * Catches all unhandled errors and formats them as JSON responses.
 */

import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';

/**
 * Custom error classes for structured error handling
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public isOperational = true
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public details?: unknown) {
    super(400, 'VALIDATION_ERROR', message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, 'NOT_FOUND', message);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, 'UNAUTHORIZED', message);
    this.name = 'UnauthorizedError';
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded', public retryAfter?: number) {
    super(429, 'RATE_LIMIT_EXCEEDED', message);
    this.name = 'RateLimitError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message = 'External service error') {
    super(502, 'EXTERNAL_SERVICE_ERROR', `${service}: ${message}`);
    this.name = 'ExternalServiceError';
  }
}

/**
 * Format Zod validation errors
 */
function formatZodError(error: ZodError): { field: string; message: string }[] {
  return error.errors.map((e) => ({
    field: e.path.join('.'),
    message: e.message,
  }));
}

/**
 * Global error handler
 */
export function errorHandler(error: Error, c: Context): Response {
  console.error('Error caught:', {
    name: error.name,
    message: error.message,
    stack: error.stack,
  });

  // Handle Hono HTTP exceptions
  if (error instanceof HTTPException) {
    return c.json(
      {
        success: false,
        error: {
          code: `HTTP_${error.status}`,
          message: error.message,
        },
      },
      error.status
    );
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: formatZodError(error),
        },
      },
      400
    );
  }

  // Handle custom app errors
  if (error instanceof AppError) {
    const response: Record<string, unknown> = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    };

    if (error instanceof ValidationError && error.details) {
      response.error = { ...response.error as object, details: error.details };
    }

    if (error instanceof RateLimitError && error.retryAfter) {
      c.header('Retry-After', error.retryAfter.toString());
    }

    return c.json(response, error.statusCode as 400 | 401 | 404 | 429 | 500 | 502);
  }

  // Handle JSON parse errors
  if (error instanceof SyntaxError && 'body' in error) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'Invalid JSON in request body',
        },
      },
      400
    );
  }

  // Generic error (hide details in production)
  const isProduction = (c.env as { NODE_ENV?: string })?.NODE_ENV === 'production';

  return c.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: isProduction ? 'An unexpected error occurred' : error.message,
        ...(isProduction ? {} : { stack: error.stack }),
      },
    },
    500
  );
}
