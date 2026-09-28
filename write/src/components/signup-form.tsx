import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useForm, Controller, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertCircle, CheckCircle2, Mail } from "lucide-react"
import { cn } from "cn"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { AvatarUpload } from "@/components/avatar-upload"
import { signupSchema, type SignupFormValues } from "@/types/auth"
import { useAuth } from "@/contexts/auth-context"

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [authError, setAuthError] = useState<string | null>(null)
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      avatar: null,
    },
  })

  const watchedFullName = useWatch({ control, name: "fullName" })

  const onSubmit = async (data: SignupFormValues) => {
    setAuthError(null)

    const result = await signUp({
      email: data.email,
      password: data.password,
      fullName: data.fullName,
      avatarFile: data.avatar,
    })

    if (result.error) {
      setAuthError(result.error)
      return
    }

    if (result.needsEmailConfirmation) {
      setConfirmationEmail(data.email)
      return
    }

    // Auto-confirmed: redirect directly to dashboard
    navigate("/dashboard", { replace: true })
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex flex-col items-center gap-1.5 text-center">
        <div>
          <h1 className="text-2xl font-normal tracking-tight">
            Create your <span className="font-semibold text-primary">Writr</span> account
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-primary underline underline-offset-4 hover:opacity-80"
          >
            Log in
          </Link>
        </p>
      </div>

      {authError ? (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">{authError}</p>
          </div>
        </div>
      ) : null}

      {confirmationEmail ? (
        <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Mail className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Confirm your email address
              </h2>
              <p className="text-xs text-muted-foreground">
                We sent a confirmation link to{" "}
                <span className="font-medium text-foreground">
                  {confirmationEmail}
                </span>
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            Please check your inbox (and spam folder) and click the confirmation link to complete your registration.
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className={buttonVariants({ size: "sm", className: "w-full" })}
            >
              <CheckCircle2 className="size-3.5" data-icon="inline-start" />
              Go to Log in
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup className="gap-5">
            <Field data-invalid={!!errors.avatar}>
              <FieldLabel>Profile photo</FieldLabel>
              <Controller
                name="avatar"
                control={control}
                render={({ field }) => (
                  <AvatarUpload
                    value={field.value}
                    onChange={field.onChange}
                    authorName={watchedFullName}
                    error={errors.avatar?.message}
                    disabled={isSubmitting}
                  />
                )}
              />
            </Field>

            <Field data-invalid={!!errors.fullName}>
              <FieldLabel htmlFor="fullName">Author name</FieldLabel>
              <Input
                id="fullName"
                type="text"
                required
                autoComplete="name"
                placeholder="Virginia Woolf"
                disabled={isSubmitting}
                aria-invalid={!!errors.fullName}
                {...register("fullName")}
              />
              {errors.fullName ? <FieldError errors={[errors.fullName]} /> : null}
            </Field>

            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="author@example.com"
                disabled={isSubmitting}
                aria-invalid={!!errors.email}
                {...register("email")}
              />
              {errors.email ? <FieldError errors={[errors.email]} /> : null}
            </Field>

            <Field data-invalid={!!errors.password}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                required
                autoComplete="new-password"
                placeholder="••••••••"
                disabled={isSubmitting}
                aria-invalid={!!errors.password}
                {...register("password")}
              />
              {errors.password ? (
                <FieldError errors={[errors.password]} />
              ) : (
                <FieldDescription className="text-xs text-muted-foreground">
                  Must be at least 8 characters
                </FieldDescription>
              )}
            </Field>

            <Field>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Creating account..." : "Create account"}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      )}

      <FieldDescription className="px-4 text-center text-xs text-muted-foreground">
        By continuing, you agree to our{" "}
        <a href="#" className="underline underline-offset-4 hover:text-primary">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="#" className="underline underline-offset-4 hover:text-primary">
          Privacy Policy
        </a>
        .
      </FieldDescription>
    </div>
  )
}
