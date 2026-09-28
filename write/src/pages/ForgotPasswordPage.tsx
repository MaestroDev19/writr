import { useState } from "react"
import { Link } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertCircle } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from "@/types/auth"
import { useAuth } from "@/contexts/auth-context"

export default function ForgotPasswordPage() {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const { resetPassword } = useAuth()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  })

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setAuthError(null)
    const res = await resetPassword(data.email)
    if (res.error) {
      setAuthError(res.error)
      return
    }
    setSubmittedEmail(data.email)
  }

  const handleReset = () => {
    setSubmittedEmail(null)
    setAuthError(null)
    reset()
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-1.5 text-center">
            <h1 className="text-2xl font-normal tracking-tight">
              Reset your <span className="font-semibold text-primary">Writr</span> password
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter your email address and we will send you a reset link.
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

          {submittedEmail ? (
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 text-card-foreground">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-foreground">
                  Reset link sent!
                </p>
                <p className="text-xs text-muted-foreground">
                  Instructions dispatched to{" "}
                  <span className="font-medium text-foreground">{submittedEmail}</span>.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className={buttonVariants({ size: "sm" })}
                >
                  Back to Login
                </Link>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                >
                  Try another email
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <FieldGroup className="gap-5">
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

                <Field>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? "Sending..." : "Send reset instructions"}
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          )}

          <div className="text-center text-xs text-muted-foreground">
            Remember your password?{" "}
            <Link
              to="/login"
              className="font-medium text-primary underline underline-offset-4 hover:opacity-80"
            >
              Log in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
