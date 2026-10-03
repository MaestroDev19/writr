import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios"
import { requestId } from "@/lib/log"
import { supabase } from "@/lib/supabase"

const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "")

type RetriableConfig = InternalAxiosRequestConfig & {
  _retry?: boolean
}

/** Shared refresh so concurrent 401s only hit Supabase once. */
let refreshPromise: Promise<string | null> | null = null

async function getAccessToken(): Promise<string | undefined> {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    throw error
  }
  return data.session?.access_token
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const { data, error } = await supabase.auth.refreshSession()
      if (error || !data.session?.access_token) {
        return null
      }
      return data.session.access_token
    })().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60_000,
  headers: {
    Accept: "application/json",
  },
})

api.interceptors.request.use(
  async (config) => {
    if (!config.headers.has("x-request-id")) {
      config.headers.set("x-request-id", requestId())
    }

    // Browser must set multipart boundary; a fixed JSON content-type breaks uploads.
    if (typeof FormData !== "undefined" && config.data instanceof FormData) {
      config.headers.delete("Content-Type")
    } else if (
      config.data != null &&
      typeof config.data === "object" &&
      !config.headers.has("Content-Type")
    ) {
      config.headers.set("Content-Type", "application/json")
    }

    const token = await getAccessToken()
    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`)
    }

    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined

    if (error.response?.status === 401 && config && !config._retry) {
      config._retry = true

      const token = await refreshAccessToken()
      if (!token) {
        return Promise.reject(error)
      }

      config.headers.set("Authorization", `Bearer ${token}`)
      return api(config)
    }

    return Promise.reject(error)
  }
)

export function isAxiosError(error: unknown): error is AxiosError {
  return axios.isAxiosError(error)
}

export function getApiErrorMessage(error: unknown, fallback = "Request failed"): string {
  if (isAxiosError(error)) {
    const data = error.response?.data
    if (typeof data === "string" && data.trim()) return data
    if (data && typeof data === "object") {
      const detail = (data as { detail?: unknown; message?: unknown }).detail
      if (typeof detail === "string" && detail.trim()) return detail
      const message = (data as { message?: unknown }).message
      if (typeof message === "string" && message.trim()) return message
    }
    if (error.message) return error.message
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}
