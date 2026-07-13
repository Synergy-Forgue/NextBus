import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../types';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('[Error]', err.message);
  const body: ApiError = {
    error: 'InternalServerError',
    message: err.message || 'An unexpected error occurred.',
  };
  res.status(500).json(body);
};

export const notFound = (_req: Request, res: Response): void => {
  const body: ApiError = {
    error: 'NotFound',
    message: 'The requested resource does not exist.',
  };
  res.status(404).json(body);
};
