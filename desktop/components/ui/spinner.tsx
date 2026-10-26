"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { TypingDots, PulseBeacon } from "./loading"

export interface SpinnerProps extends React.ComponentProps<"svg"> {
  /** Visual variant: 'spin' (rotating circle), 'dots' (3 bouncing dots), 'pulse' (radar beacon) */
  variant?: "spin" | "dots" | "pulse"
}

/**
 * Enhanced Spinner component with guaranteed rotation and multi-variant loading styles.
 * Includes both CSS animation and native SVG transform animation for 100% reliable motion.
 */
function Spinner({
  variant = "spin",
  className,
  style,
  ...props
}: SpinnerProps) {
  if (variant === "dots") {
    return <TypingDots size="sm" className={cn("text-primary", className)} />
  }

  if (variant === "pulse") {
    return <PulseBeacon size="sm" className={className} />
  }

  return (
    <svg
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-4 shrink-0 animate-spin text-current", className)}
      style={{ transformOrigin: "center", ...style }}
      {...props}
    >
      <circle cx="12" cy="12" r="9" strokeOpacity="0.2" />
      <path d="M12 3a9 9 0 0 1 9 9" />
      <animateTransform
        attributeName="transform"
        type="rotate"
        from="0 12 12"
        to="360 12 12"
        dur="0.85s"
        repeatCount="indefinite"
      />
    </svg>
  )
}

export { Spinner }
export * from "./loading"
