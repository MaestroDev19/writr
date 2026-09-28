import { z } from "zod"

export interface UserProfile {
  id: string
  author_name: string | null
  email: string | null
  avatar_url: string | null
  updated_at: string | null
}

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
})

export const signupSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Author name must be at least 2 characters")
    .max(100, "Author name must be under 100 characters"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  avatar: z
    .custom<File | null | undefined>()
    .optional()
    .refine(
      (file) => !file || file.size <= 5 * 1024 * 1024,
      "Avatar image must be under 5MB"
    )
    .refine(
      (file) =>
        !file ||
        ["image/jpeg", "image/png", "image/webp"].includes(file.type),
      "Supported formats: JPEG, PNG, WebP"
    ),
})

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
})

export type LoginFormValues = z.infer<typeof loginSchema>
export type SignupFormValues = z.infer<typeof signupSchema>
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>
