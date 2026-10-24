"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { Session, User } from "@supabase/supabase-js"
import { authClient, type SessionData, type UserData } from "@/lib/auth-client"
import type { LoginFormValues, UserProfile } from "@/types/auth"

interface SignUpParams {
  email: string
  password: string
  fullName: string
}

interface SignUpResult {
  user?: User | null
  session?: Session | null
  needsEmailConfirmation: boolean
  error?: string
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  isLoading: boolean
  isProfileLoading: boolean
  isAuthenticated: boolean
  signIn: (credentials: LoginFormValues) => Promise<{ error?: string }>
  signUp: (params: SignUpParams) => Promise<SignUpResult>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error?: string; success: boolean }>
  refreshProfile: () => Promise<void>
  updateProfile: (data: { authorName?: string; avatarUrl?: string }) => Promise<{ error?: string; profile?: UserProfile }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    // Synchronize initial state from localStorage / token validation
    authClient.init().then((state) => {
      if (!isMounted) return
      setSession(state.session as unknown as Session)
      setUser(state.user as unknown as User)
      setProfile(state.profile)
      setIsAuthLoading(false)
    })

    const unsubscribe = authClient.subscribe((state) => {
      if (!isMounted) return
      setSession(state.session as unknown as Session)
      setUser(state.user as unknown as User)
      setProfile(state.profile)
      setIsAuthLoading(false)
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  const signIn = useCallback(
    async (credentials: LoginFormValues): Promise<{ error?: string }> => {
      return authClient.signIn(credentials)
    },
    []
  )

  const signUp = useCallback(
    async (params: SignUpParams): Promise<SignUpResult> => {
      const result = await authClient.signUp(params)
      return {
        user: (result.user as unknown as User) ?? null,
        session: (result.session as unknown as Session) ?? null,
        needsEmailConfirmation: result.needsEmailConfirmation,
        error: result.error,
      }
    },
    []
  )

  const signOut = useCallback(async () => {
    await authClient.signOut()
    setSession(null)
    setUser(null)
    setProfile(null)
  }, [])

  const resetPassword = useCallback(
    async (email: string): Promise<{ error?: string; success: boolean }> => {
      return authClient.resetPassword(email)
    },
    []
  )

  const refreshProfile = useCallback(async () => {
    const updated = await authClient.syncMe()
    if (updated?.profile) {
      setProfile(updated.profile)
    }
  }, [])

  const updateProfile = useCallback(
    async (data: { authorName?: string; avatarUrl?: string }) => {
      return authClient.updateProfile(data)
    },
    []
  )

  const contextValue = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      profile,
      isLoading: isAuthLoading,
      isProfileLoading: false,
      isAuthenticated: !!user,
      signIn,
      signUp,
      signOut,
      resetPassword,
      refreshProfile,
      updateProfile,
    }),
    [
      user,
      session,
      profile,
      isAuthLoading,
      signIn,
      signUp,
      signOut,
      resetPassword,
      refreshProfile,
      updateProfile,
    ]
  )

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
