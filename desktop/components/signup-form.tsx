"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertCircleIcon, CheckCircle2Icon, MailIcon } from "lucide-react"
import { cn } from "@/lib/utils"

import { useAuth } from "@/components/auth-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { signupSchema, type SignupFormValues } from "@/types/auth"

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(
    null
  )
  const { signUp } = useAuth()
  const router = useRouter()

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
    },
  })

  const onSubmit = async (data: SignupFormValues) => {
    clearErrors("root.serverError")
    try {
      const result = await signUp({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
      })

      if (result.error) {
        setError("root.serverError", {
          type: "server",
          message: result.error,
        })
        return
      }

      if (result.needsEmailConfirmation) {
        setConfirmationEmail(data.email)
        return
      }

      router.replace("/")
    } catch {
      setError("root.serverError", {
        type: "network",
        message: "Network error. Please retry.",
      })
    }
  }

  const labelClass =
    "w-full normal-case tracking-normal text-[0.8125rem] font-medium text-foreground"

  if (confirmationEmail) {
    return (
      <div className={cn("flex w-full min-w-0 flex-col gap-6", className)} {...props}>
        <Alert>
          <MailIcon />
          <AlertTitle>Check your email</AlertTitle>
          <AlertDescription>
            We sent a confirmation link to{" "}
            <span className="font-medium text-foreground">
              {confirmationEmail}
            </span>
            . Open it to finish creating your account.
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
          Create your account
        </h1>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          Already writing here?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline underline-offset-4 hover:opacity-80"
          >
            Sign in
          </Link>
        </p>
      </div>

      {errors.root?.serverError ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Could not create account</AlertTitle>
          <AlertDescription>
            {errors.root.serverError.message}
          </AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="w-full min-w-0">
        <FieldGroup className="w-full gap-5">
          <Field data-invalid={!!errors.fullName} className="w-full min-w-0">
            <FieldLabel htmlFor="fullName" className={labelClass}>
              Author name
            </FieldLabel>
            <Input
              id="fullName"
              autoComplete="name"
              placeholder="Ada Lovelace"
              disabled={isSubmitting}
              aria-invalid={!!errors.fullName}
              className="w-full"
              {...register("fullName")}
            />
            {errors.fullName ? (
              <FieldError errors={[errors.fullName]} />
            ) : null}
          </Field>

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

          <Field data-invalid={!!errors.password} className="w-full min-w-0">
            <FieldLabel htmlFor="password" className={labelClass}>
              Password
            </FieldLabel>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              disabled={isSubmitting}
              aria-invalid={!!errors.password}
              className="w-full"
              {...register("password")}
            />
            {errors.password ? (
              <FieldError errors={[errors.password]} />
            ) : (
              <FieldDescription>
                Use at least 8 characters.
              </FieldDescription>
            )}
          </Field>

          <Field className="w-full">
            <Button
              type="submit"
              className="w-full rounded-md tracking-normal normal-case"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              {isSubmitting ? "Creating account…" : "Create account"}
            </Button>
          </Field>
        </FieldGroup>
      </form>

      <p className="flex w-full items-start gap-2 text-pretty text-xs leading-relaxed text-muted-foreground">
        <CheckCircle2Icon className="mt-0.5 size-3.5 shrink-0 text-primary" />
        Your notes and drafts stay tied to this account across web and desktop.
      </p>
    </div>
  )
}
