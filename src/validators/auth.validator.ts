import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase()),

  password: z
    .string()
    .min(8)
    .max(128)
});