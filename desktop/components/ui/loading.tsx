"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface TypingDotsProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: "xs" | "sm" | "default" | "lg"
}

/**
 * Three animated typing/pulsing dots with staggered timing.
 * Accessible, lightweight, and works seamlessly inside text or buttons.
 */
export function TypingDots({
  size = "default",
  className,
  ...props
}: TypingDotsProps) {
  const dotSizes = {
    xs: "size-1",
    sm: "size-1.5",
    default: "size-2",
    lg: "size-2.5",
  }

  return (
    <span
      role="status"
      aria-label="Loading"
      data-loading="dots"
      className={cn("inline-flex items-center gap-1 text-current shrink-0", className)}
      {...props}
    >
      <span className={cn(dotSizes[size], "rounded-full bg-current animate-bounce [animation-delay:-0.32s]")} />
      <span className={cn(dotSizes[size], "rounded-full bg-current animate-bounce [animation-delay:-0.16s]")} />
      <span className={cn(dotSizes[size], "rounded-full bg-current animate-bounce")} />
    </span>
  )
}

export interface PulseBeaconProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: "xs" | "sm" | "default" | "lg"
}

/**
 * Modern radar beacon dot with a soft expanding halo ring.
 */
export function PulseBeacon({
  size = "default",
  className,
  ...props
}: PulseBeaconProps) {
  const containerSizes = {
    xs: "size-2.5",
    sm: "size-3.5",
    default: "size-4",
    lg: "size-5",
  }

  const dotSizes = {
    xs: "size-1",
    sm: "size-1.5",
    default: "size-2",
    lg: "size-2.5",
  }

  return (
    <span
      role="status"
      aria-label="Active"
      data-loading="pulse"
      className={cn("relative inline-flex items-center justify-center shrink-0", containerSizes[size], className)}
      {...props}
    >
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/40 opacity-75" />
      <span className={cn("relative inline-flex rounded-full bg-primary", dotSizes[size])} />
    </span>
  )
}

export interface LoadingTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Array of messages to cycle through, or a single message */
  messages?: string[] | string
  /** Interval in ms between message changes (default 2400) */
  intervalMs?: number
  /** Whether to append typing dots */
  showDots?: boolean
}

const DEFAULT_MESSAGES = [
  "Thinking through response…",
  "Checking continuity & lore…",
  "Synthesizing notes…",
  "Polishing draft…",
]

/**
 * Text that cyclically transitions through status messages.
 * Uses React state so changes are always visible even if CSS animations are disabled.
 */
export function LoadingText({
  messages = DEFAULT_MESSAGES,
  intervalMs = 2400,
  showDots = false,
  className,
  ...props
}: LoadingTextProps) {
  const messageList = React.useMemo(() => {
    if (typeof messages === "string") return [messages]
    return messages.length > 0 ? messages : DEFAULT_MESSAGES
  }, [messages])

  const [index, setIndex] = React.useState(0)
  const [visible, setVisible] = React.useState(true)

  React.useEffect(() => {
    if (messageList.length <= 1) return

    const timer = setInterval(() => {
      // Micro fade transition
      setVisible(false)
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % messageList.length)
        setVisible(true)
      }, 180)
    }, intervalMs)

    return () => clearInterval(timer)
  }, [messageList, intervalMs])

  const currentMessage = messageList[index] ?? messageList[0]

  return (
    <span
      role="status"
      aria-live="polite"
      data-loading="text"
      className={cn(
        "inline-flex items-center gap-1.5 font-medium transition-all duration-200",
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-0.5",
        className
      )}
      {...props}
    >
      <span>{currentMessage}</span>
      {showDots ? <TypingDots size="xs" className="opacity-80" /> : null}
    </span>
  )
}

export interface LoadingIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  messages?: string[] | string
  intervalMs?: number
  variant?: "dots" | "pulse" | "spin" | "none"
  indicatorPosition?: "start" | "end" | "top"
}

/**
 * Pre-composed loading indicator combining indicator glyph and dynamic status text.
 */
export function LoadingIndicator({
  messages,
  intervalMs = 2400,
  variant = "dots",
  indicatorPosition = "start",
  className,
  ...props
}: LoadingIndicatorProps) {
  const isTop = indicatorPosition === "top"

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-2.5 text-xs text-muted-foreground",
        isTop && "flex-col justify-center text-center",
        className
      )}
      {...props}
    >
      {variant === "dots" && indicatorPosition === "start" && (
        <TypingDots size="sm" className="text-primary" />
      )}
      {variant === "pulse" && indicatorPosition === "start" && (
        <PulseBeacon size="sm" />
      )}

      <LoadingText messages={messages} intervalMs={intervalMs} showDots={false} />

      {variant === "dots" && indicatorPosition === "end" && (
        <TypingDots size="sm" className="text-primary" />
      )}
      {variant === "pulse" && indicatorPosition === "end" && (
        <PulseBeacon size="sm" />
      )}
    </div>
  )
}
