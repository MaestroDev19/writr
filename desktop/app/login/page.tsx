import { Suspense } from "react"
import { AuthShell } from "@/components/auth-shell"
import { PublicOnly } from "@/components/auth-guard"
import { LoginForm } from "@/components/login-form"
import { Spinner } from "@/components/ui/spinner"

function LoginFallback() {
  return (
    <div className="flex min-h-40 items-center justify-center">
      <Spinner className="size-5 text-primary" />
    </div>
  )
}

export default function LoginPage() {
  return (
    <PublicOnly>
      <AuthShell
        headline="Pick up where the draft left off."
        support="Sign in to open your local library, attach drafts for Write and Review, and reach the rest of the desktop workspace."
      >
        <Suspense fallback={<LoginFallback />}>
          <LoginForm />
        </Suspense>
      </AuthShell>
    </PublicOnly>
  )
}
