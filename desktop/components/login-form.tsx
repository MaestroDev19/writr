"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertCircleIcon } from "lucide-react"
import { cn } from "@/lib/utils"

import { useAuth } from "@/components/auth-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { loginSchema, type LoginFormValues } from "@/types/auth"

const labelClass =
  "w-full normal-case tracking-normal text-[0.8125rem] font-medium text-foreground"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { signIn } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get("from") || "/"

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  const onSubmit = async (data: LoginFormValues) => {
    clearErrors("root.serverError")
    try {
      const result = await signIn(data)
      if (result.error) {
        setError("root.serverError", {
          type: "server",
          message: result.error,
        })
        return
      }
      router.replace(from)
    } catch {
      setError("root.serverError", {
        type: "network",
        message: "Network error. Please retry.",
      })
    }
  }

  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-6", className)} {...props}>
      <div className="flex w-full min-w-0 flex-col gap-2">
        <h1 className="font-heading text-2xl font-medium tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-foreground underline underline-offset-4 hover:opacity-80"
          >
            Create one
          </Link>
        </p>
      </div>

      {errors.root?.serverError ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Could not sign in</AlertTitle>
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

          <Field data-invalid={!!errors.password} className="w-full min-w-0">
            <div className="flex w-full min-w-0 items-center justify-between gap-3">
              <FieldLabel htmlFor="password" className={labelClass}>
                Password
              </FieldLabel>
              <Link
                href="/forgot-password"
                className="shrink-0 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              disabled={isSubmitting}
              aria-invalid={!!errors.password}
              className="w-full"
              {...register("password")}
            />
            {errors.password ? (
              <FieldError errors={[errors.password]} />
            ) : null}
          </Field>

          <Field className="w-full">
            <Button
              type="submit"
              className="w-full rounded-md tracking-normal normal-case"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </Field>
        </FieldGroup>
      </form>

      <FieldDescription className="w-full text-pretty text-center text-xs leading-relaxed text-muted-foreground">
        By continuing, you agree to our Terms of Service and Privacy Policy.
      </FieldDescription>
    </div>
  )
}
