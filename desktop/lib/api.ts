import { authClient } from "@/lib/auth-client"

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "https://writr-green.vercel.app"
).replace(/\/$/, "")

async function getAccessToken(): Promise<string | undefined> {
  const token = await authClient.getAccessToken()
  return token ?? undefined
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshed = await authClient.refreshSession()
  return refreshed?.session?.access_token ?? null
}

export async function apiFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers)
  if (!headers.has("Accept")) headers.set("Accept", "application/json")

  const body = init.body
  if (
    body != null &&
    !(typeof FormData !== "undefined" && body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json")
  }

  const token = await getAccessToken()
  if (token) headers.set("Authorization", `Bearer ${token}`)

  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`
  const response = await fetch(url, { ...init, headers })

  if (response.status !== 401) return response

  const nextToken = await refreshAccessToken()
  if (!nextToken) return response

  headers.set("Authorization", `Bearer ${nextToken}`)
  return fetch(url, { ...init, headers })
}

export async function getApiErrorMessage(
  response: Response,
  fallback = "Request failed"
): Promise<string> {
  try {
    const data: unknown = await response.json()
    if (typeof data === "string" && data.trim()) return data
    if (data && typeof data === "object") {
      const detail = (data as { detail?: unknown; message?: unknown }).detail
      if (typeof detail === "string" && detail.trim()) return detail
      const message = (data as { message?: unknown }).message
      if (typeof message === "string" && message.trim()) return message
    }
  } catch {
    // ignore parse errors
  }
  return fallback
}
