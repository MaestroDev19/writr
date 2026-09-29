/**
 * Browser logger. One JSON object per call; field names match the API.
 * High-cardinality ids (event_id, request_id, session_id, user_id, hashes)
 * dominate every line so individual sessions stay queryable.
 * ``session_id`` is a per-tab correlation id, not an auth token.
 */

const SESSION_KEY = "writr.session_id"

type LogValue = string | number | boolean | null | undefined

export type LogFields = Record<string, LogValue>

function sessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY)
    if (existing) return existing
    const created = crypto.randomUUID()
    sessionStorage.setItem(SESSION_KEY, created)
    return created
  } catch {
    return crypto.randomUUID()
  }
}

const instanceId = crypto.randomUUID()

function emit(fields: LogFields, level: "info" | "error"): void {
  const requestIdValue =
    typeof fields.request_id === "string" && fields.request_id
      ? fields.request_id
      : crypto.randomUUID()
  const event: Record<string, LogValue> = {
    timestamp: new Date().toISOString(),
    event_id: fields.event_id ?? crypto.randomUUID(),
    instance_id: instanceId,
    session_id: sessionId(),
    request_id: requestIdValue,
    span_id: fields.span_id ?? crypto.randomUUID(),
    trace_id: fields.trace_id ?? requestIdValue,
    level,
  }
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) {
      event[key] = value
    }
  }
  const line = JSON.stringify(event)
  if (level === "error") {
    console.error(line)
  } else {
    console.info(line)
  }
}

export const logger = {
  info(fields: LogFields): void {
    emit(fields, "info")
  },
  error(fields: LogFields): void {
    emit(fields, "error")
  },
}

export function logError(fields: LogFields): void {
  logger.error({ outcome: "error", ...fields })
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

export function requestId(): string {
  return crypto.randomUUID()
}
