import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password too long")
  .regex(/[a-z]/, "Password must include a lowercase letter (a-z)")
  .regex(/[A-Z]/, "Password must include an uppercase letter (A-Z)")
  .regex(/[0-9]/, "Password must include a number (0-9)")
  .regex(/[^A-Za-z0-9]/, "Password must include a special character like @, #, $, %, &, *, !, etc.");

export const registerSchema = z.object({
  fullName: z.string().min(2).max(80),
  email: z.string().email(),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  sessionDays: z.union([z.literal(1), z.literal(7), z.literal(30)]).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  token: z.string().min(20),
  password: passwordSchema,
});
