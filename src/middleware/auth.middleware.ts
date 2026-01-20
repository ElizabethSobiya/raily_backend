import { Context, Next } from "hono";
import jwt from "jsonwebtoken";
import { db } from "../config/database.js";
import { users } from "../../drizzle/schema.js";
import { eq } from "drizzle-orm";
import { HTTP_STATUS } from "../utils/constants.js";

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-key";

export interface JWTPayload {
  userId: string;
  email?: string;
  phone: string;
  iat: number;
  exp: number;
}

declare module "hono" {
  interface ContextVariableMap {
    user: {
      id: string;
      email?: string | null;
      phone: string;
      name?: string | null;
    };
    requestId: string;
  }
}

/**
 * Verify JWT token and attach user to context
 */
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json(
      {
        success: false,
        error: "Authorization header missing or invalid",
        code: "UNAUTHORIZED",
      },
      HTTP_STATUS.UNAUTHORIZED
    );
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;

    // Fetch user from database
    const user = await db
      .select({
        id: users.id,
        email: users.email,
        phone: users.phone,
        name: users.name,
      })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!user.length) {
      return c.json(
        {
          success: false,
          error: "User not found",
          code: "USER_NOT_FOUND",
        },
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    c.set("user", user[0]);
    await next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return c.json(
        {
          success: false,
          error: "Token expired",
          code: "TOKEN_EXPIRED",
        },
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return c.json(
        {
          success: false,
          error: "Invalid token",
          code: "INVALID_TOKEN",
        },
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    throw error;
  }
}

/**
 * Optional auth - doesn't require token but attaches user if present
 */
export async function optionalAuthMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);

    try {
      const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;

      const user = await db
        .select({
          id: users.id,
          email: users.email,
          phone: users.phone,
          name: users.name,
        })
        .from(users)
        .where(eq(users.id, payload.userId))
        .limit(1);

      if (user.length) {
        c.set("user", user[0]);
      }
    } catch {
      // Ignore token errors for optional auth
    }
  }

  await next();
}

/**
 * Generate JWT token
 */
export function generateToken(userId: string, phone: string, email?: string): string {
  const payload: Omit<JWTPayload, "iat" | "exp"> = {
    userId,
    phone,
    email,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: "refresh" }, JWT_SECRET, {
    expiresIn: "30d",
  });
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): { userId: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; type: string };
    if (payload.type !== "refresh") return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}
