import { supabase } from "@/lib/supabase"

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "")

let refreshPromise: Promise<string | null> | null = null

async function getAccessToken(): Promise<string | undefined> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session?.access_token
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const { data, error } = await supabase.auth.refreshSession()
      if (error || !data.session?.access_token) return null
      return data.session.access_token
    })().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
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
