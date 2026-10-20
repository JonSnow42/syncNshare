import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  // 1. Zod Validation Errors
  if (err instanceof ZodError || err.name === 'ZodError') {
    const details = err.errors ? err.errors.map((e: any) => ({
      field: e.path.join('.'),
      message: e.message,
    })) : [];
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.errors?.[0]?.message || 'Input validation failed',
        details,
      },
    });
    return;
  }

  // 2. Operational AppError (NotFoundError, UnauthorizedError, etc.)
  if (err instanceof AppError || err.isOperational) {
    res.status(err.statusCode || 400).json({
      error: {
        code: err.code || err.name || 'APPLICATION_ERROR',
        message: err.message,
      },
    });
    return;
  }

  // 3. Mongo Duplicate Key Error (E11000)
  if (err.name === 'MongoServerError' && err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    res.status(409).json({
      error: {
        code: 'DUPLICATE_KEY_ERROR',
        message: `An entry with this ${field} already exists.`,
      },
    });
    return;
  }

  // 4. Mongo CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    res.status(400).json({
      error: {
        code: 'INVALID_ID',
        message: `Invalid identifier format for ${err.path}.`,
      },
    });
    return;
  }

  // 5. Unhandled / Unexpected Server Errors
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled server exception');

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message:
        env.NODE_ENV === 'production'
          ? 'An unexpected error occurred. Please try again later.'
          : err.message || 'Internal server error',
    },
  });
}
