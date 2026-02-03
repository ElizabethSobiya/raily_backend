import { Context, Next } from "hono";
import { z, ZodError, ZodSchema } from "zod";
import { HTTP_STATUS } from "../utils/constants.js";

/**
 * Validate request body against a Zod schema
 */
export function validateBody<T extends ZodSchema>(schema: T) {
  return async (c: Context, next: Next) => {
    try {
      const body = await c.req.json();
      const validated = schema.parse(body);
      c.set("validatedBody", validated);
      await next();
    } catch (error) {
      if (error instanceof ZodError) {
        return c.json(
          {
            success: false,
            error: "Validation failed",
            code: "VALIDATION_ERROR",
            details: (error as ZodError).errors.map((e) => ({
              field: e.path.join("."),
              message: e.message,
            })),
          },
          HTTP_STATUS.BAD_REQUEST
        );
      }

      if (error instanceof SyntaxError) {
        return c.json(
          {
            success: false,
            error: "Invalid JSON body",
            code: "INVALID_JSON",
          },
          HTTP_STATUS.BAD_REQUEST
        );
      }

      throw error;
    }
  };
}

/**
 * Validate query parameters against a Zod schema
 */
export function validateQuery<T extends ZodSchema>(schema: T) {
  return async (c: Context, next: Next) => {
    try {
      const query = c.req.query();
      const validated = schema.parse(query);
      c.set("validatedQuery", validated);
      await next();
    } catch (error) {
      if (error instanceof ZodError) {
        return c.json(
          {
            success: false,
            error: "Invalid query parameters",
            code: "VALIDATION_ERROR",
            details: (error as ZodError).errors.map((e) => ({
              field: e.path.join("."),
              message: e.message,
            })),
          },
          HTTP_STATUS.BAD_REQUEST
        );
      }

      throw error;
    }
  };
}

/**
 * Validate URL parameters against a Zod schema
 */
export function validateParams<T extends ZodSchema>(schema: T) {
  return async (c: Context, next: Next) => {
    try {
      const params = c.req.param();
      const validated = schema.parse(params);
      c.set("validatedParams", validated);
      await next();
    } catch (error) {
      if (error instanceof ZodError) {
        return c.json(
          {
            success: false,
            error: "Invalid URL parameters",
            code: "VALIDATION_ERROR",
            details: (error as ZodError).errors.map((e) => ({
              field: e.path.join("."),
              message: e.message,
            })),
          },
          HTTP_STATUS.BAD_REQUEST
        );
      }

      throw error;
    }
  };
}

// Common validation schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

export const trainNumberSchema = z.string().regex(/^\d{4,5}$/, "Train number must be 4-5 digits");

export const stationCodeSchema = z
  .string()
  .min(2)
  .max(5)
  .transform((val) => val.toUpperCase());

export const pnrSchema = z.string().regex(/^\d{10}$/, "PNR must be a 10-digit number");

// Type helpers
export type PaginationQuery = z.infer<typeof paginationSchema>;
