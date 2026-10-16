import { AuthShell } from "@/components/auth-shell"
import { PublicOnly } from "@/components/auth-guard"
import { SignupForm } from "@/components/signup-form"

export default function SignupPage() {
  return (
    <PublicOnly>
      <AuthShell
        headline="Set up your author account."
        support="One identity for web and desktop. Notes and drafts stay local on this machine after setup."
      >
        <SignupForm />
      </AuthShell>
    </PublicOnly>
  )
}
