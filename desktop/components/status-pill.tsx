import { cn } from "@/lib/utils"

export function StatusPill({
  label,
  tone = "muted",
  className,
}: {
  label: string
  tone?: "muted" | "ok" | "error" | "busy"
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold tracking-wide uppercase",
        tone === "muted" && "border-border bg-muted/60 text-muted-foreground",
        tone === "ok" && "border-primary/25 bg-primary/10 text-primary",
        tone === "error" && "border-destructive/30 bg-destructive/10 text-destructive",
        tone === "busy" && "border-primary/20 bg-primary/5 text-foreground",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          tone === "muted" && "bg-muted-foreground/50",
          tone === "ok" && "bg-primary",
          tone === "error" && "bg-destructive",
          tone === "busy" && "bg-primary/70"
        )}
      />
      {label}
    </span>
  )
}
