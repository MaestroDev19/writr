import type { LoginFormValues, UserProfile } from "@/types/auth"
import { invoke } from "@tauri-apps/api/core"

export interface SessionData {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in?: number
  expires_at?: number
}

export interface UserData {
  id: string
  email?: string
  user_metadata?: Record<string, unknown>
}

export interface AuthState {
  session: SessionData | null
  user: UserData | null
  profile: UserProfile | null
}

const STORAGE_KEY = "writr.auth.session"

function getApiBaseUrl(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "")
  }
  return "https://writr-green.vercel.app"
}

type AuthListener = (state: AuthState) => void

class AuthClient {
  private state: AuthState = {
    session: null,
    user: null,
    profile: null,
  }
  private listeners: Set<AuthListener> = new Set()
  private initialized = false
  private refreshPromise: Promise<AuthState | null> | null = null

  constructor() {
    if (typeof window !== "undefined") {
      this.loadFromStorage()
    }
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AuthState>
        if (parsed.session?.access_token && parsed.user?.id) {
          this.state = {
            session: parsed.session,
            user: parsed.user,
            profile: parsed.profile ?? null,
          }
        }
      }
    } catch {
      // Ignore parse/storage errors
    }
  }

  private saveToStorage(state: AuthState): void {
    this.state = state
    try {
      if (state.session && state.user) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
        // Sync to local SQLite profile mirror if in Tauri environment
        this.mirrorProfileToSqlite(state.profile)
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      // Ignore storage errors
    }
    this.notify()
  }

  private async mirrorProfileToSqlite(profile: UserProfile | null): Promise<void> {
    if (!profile?.id) return
    try {
      await invoke("upsert_profile", {
        id: profile.id,
        authorName: profile.author_name || "Author",
        avatarUrl: profile.avatar_url || null,
        updatedAt: profile.updated_at || new Date().toISOString(),
      })
    } catch {
      // In web browser or before SQLite is ready, ignore mirror error
    }
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state)
    }
  }

  public subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  public getState(): AuthState {
    if (!this.initialized && typeof window !== "undefined") {
      this.loadFromStorage()
    }
    return this.state
  }

  public async init(): Promise<AuthState> {
    this.initialized = true
    this.loadFromStorage()

    if (!this.state.session?.refresh_token) {
      return this.state
    }

    // If token is expiring within 60s or expired, refresh it
    const nowSec = Math.floor(Date.now() / 1000)
    const expiresAt = this.state.session.expires_at || 0

    if (expiresAt && expiresAt < nowSec + 60) {
      const refreshed = await this.refreshSession()
      if (refreshed) return refreshed
    } else {
      // Fetch fresh profile in the background to sync any updates from backend/Supabase
      void this.syncMe()
    }

    return this.state
  }

  public async getAccessToken(): Promise<string | null> {
    if (!this.state.session) return null

    const nowSec = Math.floor(Date.now() / 1000)
    const expiresAt = this.state.session.expires_at || 0

    if (expiresAt && expiresAt < nowSec + 60) {
      const refreshed = await this.refreshSession()
      return refreshed?.session?.access_token ?? null
    }

    return this.state.session.access_token
  }

  public async signIn(credentials: LoginFormValues): Promise<{ error?: string }> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        return { error: data.detail || data.message || "Failed to sign in" }
      }

      const newState: AuthState = {
        session: data.session,
        user: data.user,
        profile: data.profile ?? null,
      }
      this.saveToStorage(newState)
      return {}
    } catch (err) {
      return {
        error:
          err instanceof Error
            ? err.message
            : "Could not connect to authentication service",
      }
    }
  }

  public async signUp(params: {
    email: string
    password: string
    fullName: string
  }): Promise<{
    user?: UserData | null
    session?: SessionData | null
    needsEmailConfirmation: boolean
    error?: string
  }> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: params.email,
          password: params.password,
          full_name: params.fullName,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        return {
          needsEmailConfirmation: false,
          error: data.detail || data.message || "Sign up failed",
        }
      }

      if (data.session && data.user) {
        this.saveToStorage({
          session: data.session,
          user: data.user,
          profile: data.profile ?? null,
        })
      }

      return {
        user: data.user,
        session: data.session,
        needsEmailConfirmation: Boolean(data.needs_email_confirmation),
      }
    } catch (err) {
      return {
        needsEmailConfirmation: false,
        error:
          err instanceof Error
            ? err.message
            : "Could not connect to registration service",
      }
    }
  }

  public async refreshSession(): Promise<AuthState | null> {
    if (this.refreshPromise) return this.refreshPromise

    this.refreshPromise = (async () => {
      const refreshToken = this.state.session?.refresh_token
      if (!refreshToken) {
        this.clear()
        return null
      }

      try {
        const res = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        })

        if (!res.ok) {
          this.clear()
          return null
        }

        const data = await res.json()
        const newState: AuthState = {
          session: data.session,
          user: data.user ?? this.state.user,
          profile: data.profile ?? this.state.profile,
        }
        this.saveToStorage(newState)
        return newState
      } catch {
        // Network error: preserve existing session if still within token window
        return this.state
      } finally {
        this.refreshPromise = null
      }
    })()

    return this.refreshPromise
  }

  public async syncMe(): Promise<AuthState | null> {
    const token = await this.getAccessToken()
    if (!token) return null

    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return null

      const data = await res.json()
      const updated: AuthState = {
        ...this.state,
        user: data.user,
        profile: data.profile ?? this.state.profile,
      }
      this.saveToStorage(updated)
      return updated
    } catch {
      return this.state
    }
  }

  public async updateProfile(payload: {
    authorName?: string
    avatarUrl?: string
  }): Promise<{ error?: string; profile?: UserProfile }> {
    const token = await this.getAccessToken()
    if (!token) return { error: "Not authenticated" }

    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          author_name: payload.authorName,
          avatar_url: payload.avatarUrl,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        return { error: data.detail || "Failed to update profile" }
      }

      const updatedProfile = data as UserProfile
      this.saveToStorage({
        ...this.state,
        profile: updatedProfile,
      })

      return { profile: updatedProfile }
    } catch (err) {
      return {
        error:
          err instanceof Error
            ? err.message
            : "Failed to update profile on backend",
      }
    }
  }

  public async resetPassword(
    email: string
  ): Promise<{ error?: string; success: boolean }> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        return { error: data.detail || "Failed to send reset email", success: false }
      }
      return { success: true }
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Network error",
        success: false,
      }
    }
  }

  public async signOut(): Promise<void> {
    const token = this.state.session?.access_token
    if (token) {
      try {
        await fetch(`${getApiBaseUrl()}/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        })
      } catch {
        // Best effort logout on server
      }
    }
    this.clear()
  }

  public clear(): void {
    this.saveToStorage({ session: null, user: null, profile: null })
  }
}

export const authClient = new AuthClient()

export function getCurrentUserId(): string | null {
  return authClient.getState().user?.id ?? null
}

export function getCachedUserProfile(): UserProfile | null {
  return authClient.getState().profile
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const cached = getCachedUserProfile()
  if (cached) return cached

  const state = await authClient.syncMe()
  return state?.profile ?? null
}
