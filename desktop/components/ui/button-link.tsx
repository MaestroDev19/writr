import Link from "next/link"
import type { VariantProps } from "class-variance-authority"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ButtonLinkProps = Omit<
  React.ComponentProps<typeof Link>,
  "className" | "children"
> &
  VariantProps<typeof buttonVariants> & {
    className?: string
    children?: React.ReactNode
  }

/**
 * Link styled as a Button. Prefer this over Button + render={<Link />} —
 * Base UI's nativeButton check fights Next.js Link hosts.
 */
export function ButtonLink({
  className,
  variant = "default",
  size = "default",
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </Link>
  )
}
