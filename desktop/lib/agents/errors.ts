import { McpConfigError } from "@/lib/mcp/policy"

/**
 * Failure classes for a desktop turn.
 * LangGraph retries a node only when retryOn returns true. Contract and
 * configuration failures return false so the turn stops.
 */

export type FailureClass = "config" | "transient" | "contract"

export class ContractError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "ContractError"
    this.code = code
  }
}

export class CircuitOpenError extends Error {
  readonly serverId: string

  constructor(serverId: string) {
    super(`Stopped calling ${serverId} after repeated failures.`)
    this.name = "CircuitOpenError"
    this.serverId = serverId
  }
}

const CLIENT_STATUS = new Set([400, 401, 402, 403, 404, 405, 406, 407, 409])

export function classifyFailure(error: unknown): FailureClass {
  if (error instanceof ContractError) return "contract"
  if (error instanceof McpConfigError || error instanceof CircuitOpenError) return "config"
  if (isAbort(error)) return "config"
  const status = httpStatus(error)
  if (status !== undefined && CLIENT_STATUS.has(status)) return "config"
  if (status === 408 || status === 429 || (status !== undefined && status >= 500)) return "transient"
  if (isNetwork(error)) return "transient"
  return "transient"
}

export function failureCode(error: unknown): string {
  if (error instanceof ContractError) return error.code
  if (error instanceof CircuitOpenError) return "mcp_circuit_open"
  if (error instanceof McpConfigError) return "mcp_config"
  if (isAbort(error)) return "aborted"
  const status = httpStatus(error)
  if (status !== undefined) return `http_${status}`
  if (isNetwork(error)) return "network"
  return "transient"
}

/** True only while attempts remain and the error is transient. maxAttempts includes the first try. */
export function shouldRetry(error: unknown, attempt: number, maxAttempts = 3): boolean {
  if (attempt >= maxAttempts - 1) return false
  return classifyFailure(error) === "transient"
}

/** Delay before the next try. attempt is the zero-based index of the failed try. */
export function retryDelayMs(attempt: number, random: () => number = Math.random): number {
  const initial = 500
  const factor = 2
  const cap = 128_000
  const base = Math.min(cap, initial * factor ** attempt)
  const jitter = Math.floor(random() * Math.min(1_000, base))
  return base + jitter
}

export async function withTransientRetry<T>(
  run: () => Promise<T>,
  options?: { maxAttempts?: number; sleep?: (ms: number) => Promise<void> },
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 3
  const sleep = options?.sleep ?? delay
  let last: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await run()
    } catch (error) {
      last = error
      if (!shouldRetry(error, attempt, maxAttempts)) throw error
      await sleep(retryDelayMs(attempt))
    }
  }
  throw last
}

/** Per MCP server. Three failures open it. One success closes it. */
export class ToolCircuit {
  private failures = 0
  private openedAt: number | null = null

  constructor(
    readonly serverId: string,
    private readonly threshold = 3,
    private readonly recoveryMs = 60_000,
  ) {}

  allow(now = Date.now()): boolean {
    if (this.openedAt === null) return true
    if (now - this.openedAt < this.recoveryMs) return false
    return true
  }

  assertClosed(now = Date.now()): void {
    if (!this.allow(now)) throw new CircuitOpenError(this.serverId)
  }

  recordSuccess(): void {
    this.failures = 0
    this.openedAt = null
  }

  recordFailure(now = Date.now()): void {
    this.failures += 1
    if (this.failures >= this.threshold) this.openedAt = now
  }
}

function isAbort(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.name === "AbortError" || error.message.startsWith("Cancel") || error.message.startsWith("AbortError")
}

function isNetwork(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const code = "code" in error ? String(error.code) : ""
  return code === "ECONNRESET" || code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "EAI_AGAIN" || code === "ECONNABORTED"
}

function httpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined
  const record = error as { status?: unknown; response?: { status?: unknown } }
  const status = record.status ?? record.response?.status
  return typeof status === "number" ? status : undefined
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
