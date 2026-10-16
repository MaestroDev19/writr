"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertCircleIcon, MailIcon } from "lucide-react"
import { cn } from "@/lib/utils"

import { useAuth } from "@/components/auth-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from "@/types/auth"

const labelClass =
  "w-full normal-case tracking-normal text-[0.8125rem] font-medium text-foreground"

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const { resetPassword } = useAuth()

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  })

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    clearErrors("root.serverError")
    try {
      const result = await resetPassword(data.email)
      if (result.error) {
        setError("root.serverError", {
          type: "server",
          message: result.error,
        })
        return
      }
      setSentTo(data.email)
    } catch {
      setError("root.serverError", {
        type: "network",
        message: "Network error. Please retry.",
      })
    }
  }

  if (sentTo) {
    return (
      <div className={cn("flex w-full min-w-0 flex-col gap-6", className)} {...props}>
        <Alert>
          <MailIcon />
          <AlertTitle>Reset link sent</AlertTitle>
          <AlertDescription>
            If an account exists for{" "}
            <span className="font-medium text-foreground">{sentTo}</span>, you
            will get an email with a reset link shortly.
          </AlertDescription>
        </Alert>
        <Link
          href="/login"
          className={buttonVariants({
            variant: "outline",
            className: "w-full rounded-md tracking-normal normal-case",
          })}
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-6", className)} {...props}>
      <div className="flex w-full min-w-0 flex-col gap-2">
        <h1 className="font-heading text-2xl font-medium tracking-tight text-foreground">
          Reset password
        </h1>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          Enter your email and we will send a reset link.
        </p>
      </div>

      {errors.root?.serverError ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Could not send reset link</AlertTitle>
          <AlertDescription>
            {errors.root.serverError.message}
          </AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="w-full min-w-0">
        <FieldGroup className="w-full gap-5">
          <Field data-invalid={!!errors.email} className="w-full min-w-0">
            <FieldLabel htmlFor="email" className={labelClass}>
              Email
            </FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="author@example.com"
              disabled={isSubmitting}
              aria-invalid={!!errors.email}
              className="w-full"
              {...register("email")}
            />
            {errors.email ? <FieldError errors={[errors.email]} /> : null}
          </Field>

          <Field className="w-full">
            <Button
              type="submit"
              className="w-full rounded-md tracking-normal normal-case"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              {isSubmitting ? "Sending…" : "Send reset link"}
            </Button>
          </Field>
        </FieldGroup>
      </form>

      <p className="w-full text-pretty text-center text-sm leading-relaxed text-muted-foreground">
        Remembered it?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline underline-offset-4 hover:opacity-80"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
