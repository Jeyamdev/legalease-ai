import { z } from "zod";

const email = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .email("Enter a valid email address.")
  .max(254);
export const loginSchema = z.object({
  email,
  password: z
    .string()
    .min(1, "Password is required.")
    .max(72, "Password must be at most 72 characters."),
});
export const registerSchema = loginSchema
  .extend({
    fullName: z.string().trim().min(1, "Full name is required.").max(200),
    password: z
      .string()
      .min(12, "Password must contain at least 12 characters.")
      .max(72, "Password must be at most 72 characters.")
      .refine((value) => value.trim().length > 0, "Password cannot be blank."),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords must match.",
  });
export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
