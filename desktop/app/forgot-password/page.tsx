import { AuthShell } from "@/components/auth-shell"
import { PublicOnly } from "@/components/auth-guard"
import { ForgotPasswordForm } from "@/components/forgot-password-form"

export default function ForgotPasswordPage() {
  return (
    <PublicOnly>
      <AuthShell
        headline="Reset your password."
        support="We email a reset link so you can sign back into the desktop workspace."
      >
        <ForgotPasswordForm />
      </AuthShell>
    </PublicOnly>
  )
}
