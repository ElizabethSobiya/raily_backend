import { Hono } from "hono";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "../config/database.js";
import { users } from "../../drizzle/schema.js";
import { eq, or } from "drizzle-orm";
import { validateBody } from "../middleware/validation.middleware.js";
import { authMiddleware, generateToken, generateRefreshToken, verifyRefreshToken } from "../middleware/auth.middleware.js";
import { strictRateLimiter } from "../middleware/ratelimit.middleware.js";
import { throwBadRequest, throwUnauthorized, throwConflict } from "../middleware/error.middleware.js";
import { HTTP_STATUS } from "../utils/constants.js";

const auth = new Hono();

// Validation schemas
const registerSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number"),
  email: z.string().email().optional(),
  name: z.string().min(2).max(100).optional(),
  password: z.string().min(6).max(100),
});

const loginSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number"),
  password: z.string().min(1),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
});

// Register new user
auth.post("/register", strictRateLimiter(), validateBody(registerSchema), async (c) => {
  const { phone, email, name, password } = await c.req.json();

  // Check if user already exists
  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.phone, phone), email ? eq(users.email, email) : undefined))
    .limit(1);

  if (existingUser.length > 0) {
    throwConflict("User with this phone or email already exists");
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Create user
  const [newUser] = await db
    .insert(users)
    .values({
      phone,
      email,
      name,
      passwordHash,
    })
    .returning({
      id: users.id,
      phone: users.phone,
      email: users.email,
      name: users.name,
    });

  // Generate tokens
  const token = generateToken(newUser.id, newUser.phone, newUser.email || undefined);
  const refreshToken = generateRefreshToken(newUser.id);

  return c.json(
    {
      success: true,
      data: {
        user: newUser,
        token,
        refreshToken,
      },
    },
    HTTP_STATUS.CREATED
  );
});

// Login
auth.post("/login", strictRateLimiter(), validateBody(loginSchema), async (c) => {
  const { phone, password } = await c.req.json();

  // Find user
  const user = await db
    .select()
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);

  if (!user.length || !user[0].passwordHash) {
    throwUnauthorized("Invalid credentials");
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user[0].passwordHash);
  if (!isValidPassword) {
    throwUnauthorized("Invalid credentials");
  }

  // Generate tokens
  const token = generateToken(user[0].id, user[0].phone, user[0].email || undefined);
  const refreshToken = generateRefreshToken(user[0].id);

  return c.json({
    success: true,
    data: {
      user: {
        id: user[0].id,
        phone: user[0].phone,
        email: user[0].email,
        name: user[0].name,
      },
      token,
      refreshToken,
    },
  });
});

// Refresh token
auth.post("/refresh", validateBody(refreshTokenSchema), async (c) => {
  const { refreshToken } = await c.req.json();

  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    throwUnauthorized("Invalid or expired refresh token");
  }

  // Get user
  const user = await db
    .select({
      id: users.id,
      phone: users.phone,
      email: users.email,
      name: users.name,
    })
    .from(users)
    .where(eq(users.id, payload!.userId))
    .limit(1);

  if (!user.length) {
    throwUnauthorized("User not found");
  }

  // Generate new tokens
  const newToken = generateToken(user[0].id, user[0].phone, user[0].email || undefined);
  const newRefreshToken = generateRefreshToken(user[0].id);

  return c.json({
    success: true,
    data: {
      token: newToken,
      refreshToken: newRefreshToken,
    },
  });
});

// Get current user
auth.get("/me", authMiddleware, async (c) => {
  const user = c.get("user");

  // Get full user details
  const fullUser = await db
    .select({
      id: users.id,
      phone: users.phone,
      email: users.email,
      name: users.name,
      preferences: users.preferences,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  return c.json({
    success: true,
    data: fullUser[0],
  });
});

// Update profile
auth.put("/me", authMiddleware, validateBody(updateProfileSchema), async (c) => {
  const user = c.get("user");
  const updates = await c.req.json();

  // Check if email is already taken
  if (updates.email) {
    const existingEmail = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, updates.email))
      .limit(1);

    if (existingEmail.length > 0 && existingEmail[0].id !== user.id) {
      throwConflict("Email already in use");
    }
  }

  // Update user
  const [updatedUser] = await db
    .update(users)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))
    .returning({
      id: users.id,
      phone: users.phone,
      email: users.email,
      name: users.name,
    });

  return c.json({
    success: true,
    data: updatedUser,
  });
});

// Update preferences
auth.put("/me/preferences", authMiddleware, async (c) => {
  const user = c.get("user");
  const preferences = await c.req.json();

  await db
    .update(users)
    .set({
      preferences,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return c.json({
    success: true,
    message: "Preferences updated",
  });
});

// Register FCM token
auth.post("/fcm/register", authMiddleware, async (c) => {
  const user = c.get("user");
  const { fcmToken } = await c.req.json();

  if (!fcmToken) {
    throwBadRequest("FCM token is required");
  }

  await db.update(users).set({ fcmToken }).where(eq(users.id, user.id));

  return c.json({
    success: true,
    message: "FCM token registered",
  });
});

// Logout (remove FCM token)
auth.post("/logout", authMiddleware, async (c) => {
  const user = c.get("user");

  await db.update(users).set({ fcmToken: null }).where(eq(users.id, user.id));

  return c.json({
    success: true,
    message: "Logged out successfully",
  });
});

export default auth;
