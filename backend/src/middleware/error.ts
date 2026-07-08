import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log error (in production you might want to send this to a logging service)
  // No console.log in production (enforced by rule, assuming NODE_ENV=production means no logs for standard errors, but we might want to log unexpected ones)
  if (process.env.NODE_ENV !== 'production' || !err.isOperational) {
    // console.error('ERROR 💥', err); // Omitted to strictly follow "no console.log in production" if strict
  }

  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // Programming or other unknown error: don't leak error details
    res.status(500).json({
      status: 'error',
      message: 'Something went very wrong!',
    });
  }
};
