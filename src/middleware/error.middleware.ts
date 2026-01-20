import { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { logger } from "../utils/logger.js";
import { HTTP_STATUS } from "../utils/constants.js";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Global error handling middleware
 */
export async function errorMiddleware(c: Context, next: Next) {
  try {
    await next();
  } catch (error) {
    const requestId = c.get("requestId") || "unknown";

    // Handle known app errors
    if (error instanceof AppError) {
      logger.warn({
        requestId,
        error: error.message,
        code: error.code,
        statusCode: error.statusCode,
      });

      return c.json(
        {
          success: false,
          error: error.message,
          code: error.code,
          details: error.details,
          requestId,
        },
        error.statusCode as 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 503
      );
    }

    // Handle Hono HTTP exceptions
    if (error instanceof HTTPException) {
      logger.warn({
        requestId,
        error: error.message,
        statusCode: error.status,
      });

      return c.json(
        {
          success: false,
          error: error.message,
          requestId,
        },
        error.status
      );
    }

    // Handle unknown errors
    logger.error({
      requestId,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Don't expose internal error details in production
    const isProduction = process.env.NODE_ENV === "production";

    return c.json(
      {
        success: false,
        error: isProduction ? "Internal server error" : (error as Error).message,
        requestId,
        ...(isProduction ? {} : { stack: (error as Error).stack }),
      },
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * Not found handler
 */
export function notFoundHandler(c: Context) {
  return c.json(
    {
      success: false,
      error: "Resource not found",
      code: "NOT_FOUND",
      path: c.req.path,
    },
    HTTP_STATUS.NOT_FOUND
  );
}

// Helper functions to throw common errors
export function throwNotFound(message: string = "Resource not found") {
  throw new AppError(HTTP_STATUS.NOT_FOUND, message, "NOT_FOUND");
}

export function throwBadRequest(message: string, details?: unknown) {
  throw new AppError(HTTP_STATUS.BAD_REQUEST, message, "BAD_REQUEST", details);
}

export function throwUnauthorized(message: string = "Unauthorized") {
  throw new AppError(HTTP_STATUS.UNAUTHORIZED, message, "UNAUTHORIZED");
}

export function throwForbidden(message: string = "Forbidden") {
  throw new AppError(HTTP_STATUS.FORBIDDEN, message, "FORBIDDEN");
}

export function throwConflict(message: string) {
  throw new AppError(HTTP_STATUS.CONFLICT, message, "CONFLICT");
}

export function throwServiceUnavailable(message: string = "Service temporarily unavailable") {
  throw new AppError(HTTP_STATUS.SERVICE_UNAVAILABLE, message, "SERVICE_UNAVAILABLE");
}
