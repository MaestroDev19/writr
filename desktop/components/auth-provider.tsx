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
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, author_name, avatar_url, updated_at")
    .eq("id", userId)
    .maybeSingle()

  if (error) return null
  return data as UserProfile | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!isMounted) return
      setSession(initialSession)
      setUser(initialSession?.user ?? null)
      setIsAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, currentSession: Session | null) => {
        if (!isMounted) return
        setSession(currentSession)
        setUser(currentSession?.user ?? null)
        setIsAuthLoading(false)

        if (currentSession?.user?.id) {
          queryClient.invalidateQueries({
            queryKey: ["profile", currentSession.user.id],
          })
        } else {
          queryClient.removeQueries({ queryKey: ["profile"] })
        }
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [queryClient])

  const {
    data: profile = null,
    isLoading: isProfileLoading,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () =>
      user?.id ? fetchUserProfile(user.id) : Promise.resolve(null),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  })

  const signIn = useCallback(
    async ({
      email,
      password,
    }: LoginFormValues): Promise<{ error?: string }> => {
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) return { error: error.message }
        return {}
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : "Failed to sign in",
        }
      }
    },
    []
  )

  const signUp = useCallback(
    async ({
      email,
      password,
      fullName,
    }: SignUpParams): Promise<SignUpResult> => {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              author_name: fullName,
              full_name: fullName,
            },
          },
        })

        if (error) {
          return { needsEmailConfirmation: false, error: error.message }
        }

        const newUser = data.user
        const newSession = data.session

        if (newUser?.identities && newUser.identities.length === 0) {
          return {
            needsEmailConfirmation: false,
            error: "An account with this email already exists. Please log in.",
          }
        }

        return {
          user: newUser,
          session: newSession,
          needsEmailConfirmation: !!(newUser && !newSession),
        }
      } catch (err) {
        return {
          needsEmailConfirmation: false,
          error: err instanceof Error ? err.message : "Failed to sign up",
        }
      }
    },
    []
  )

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
      queryClient.removeQueries({ queryKey: ["profile"] })
      setSession(null)
      setUser(null)
    } catch {
      // Session clear is best-effort
    }
  }, [queryClient])

  const resetPassword = useCallback(
    async (email: string): Promise<{ error?: string; success: boolean }> => {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login`,
        })
        if (error) return { error: error.message, success: false }
        return { success: true }
      } catch (err) {
        return {
          error:
            err instanceof Error ? err.message : "Failed to send reset email",
          success: false,
        }
      }
    },
    []
  )

  const refreshProfile = useCallback(async () => {
    if (user?.id) await refetchProfile()
  }, [user?.id, refetchProfile])

  const contextValue = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      profile,
      isLoading: isAuthLoading,
      isProfileLoading,
      isAuthenticated: !!user,
      signIn,
      signUp,
      signOut,
      resetPassword,
      refreshProfile,
    }),
    [
      user,
      session,
      profile,
      isAuthLoading,
      isProfileLoading,
      signIn,
      signUp,
      signOut,
      resetPassword,
      refreshProfile,
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
