/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from "react"
import type { User, Session, AuthChangeEvent } from "@supabase/supabase-js"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { LoginFormValues, UserProfile } from "@/types/auth"

interface SignUpParams {
  email: string
  password: string
  fullName: string
  avatarFile?: File | null
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
    .select("id, author_name, email, avatar_url, updated_at")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    console.error("Error fetching user profile:", error.message)
    return null
  }

  return data as UserProfile | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)

  // 1. Listen for Supabase auth state changes and initial session
  useEffect(() => {
    let isMounted = true

    // Fetch initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!isMounted) return
      setSession(initialSession)
      setUser(initialSession?.user ?? null)
      setIsAuthLoading(false)
    })

    // Subscribe to auth state updates
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

  // 2. Fetch profile using TanStack Query
  const {
    data: profile = null,
    isLoading: isProfileLoading,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => (user?.id ? fetchUserProfile(user.id) : Promise.resolve(null)),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  })

  // 3. Helper to upload avatar if provided
  const uploadAvatar = useCallback(
    async (userId: string, file: File): Promise<string | null> => {
      try {
        const fileExt = file.name.split(".").pop() || "png"
        const filePath = `${userId}/${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: true,
          })

        if (uploadError) {
          console.error("Avatar upload failed:", uploadError.message)
          return null
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("avatars").getPublicUrl(filePath)

        return publicUrl
      } catch (err) {
        console.error("Unexpected error uploading avatar:", err)
        return null
      }
    },
    []
  )

  // 4. Sign in handler
  const signIn = useCallback(
    async ({ email, password }: LoginFormValues): Promise<{ error?: string }> => {
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          return { error: error.message }
        }

        return {}
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to sign in"
        return { error: message }
      }
    },
    []
  )

  // 5. Sign up handler
  const signUp = useCallback(
    async ({
      email,
      password,
      fullName,
      avatarFile,
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

        // If user already exists (identities empty), Supabase returns user without session
        if (newUser && newUser.identities && newUser.identities.length === 0) {
          return {
            needsEmailConfirmation: false,
            error: "An account with this email already exists. Please log in.",
          }
        }

        // Check if email confirmation is required
        const needsConfirmation = !!(newUser && !newSession)

        // If session is active (auto-confirm enabled), upload avatar and update profile
        if (newUser && newSession && avatarFile) {
          const avatarUrl = await uploadAvatar(newUser.id, avatarFile)
          if (avatarUrl) {
            await supabase
              .from("profiles")
              .update({
                avatar_url: avatarUrl,
                updated_at: new Date().toISOString(),
              })
              .eq("id", newUser.id)

            await supabase.auth.updateUser({
              data: { avatar_url: avatarUrl },
            })

            queryClient.invalidateQueries({
              queryKey: ["profile", newUser.id],
            })
          }
        }

        return {
          user: newUser,
          session: newSession,
          needsEmailConfirmation: needsConfirmation,
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to sign up"
        return { needsEmailConfirmation: false, error: message }
      }
    },
    [uploadAvatar, queryClient]
  )

  // 6. Sign out handler
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
      queryClient.removeQueries({ queryKey: ["profile"] })
      setSession(null)
      setUser(null)
    } catch (err) {
      console.error("Error signing out:", err)
    }
  }, [queryClient])

  // 7. Reset password handler
  const resetPassword = useCallback(
    async (email: string): Promise<{ error?: string; success: boolean }> => {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login`,
        })

        if (error) {
          return { error: error.message, success: false }
        }

        return { success: true }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to send reset email"
        return { error: message, success: false }
      }
    },
    []
  )

  // 8. Refresh profile handler
  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await refetchProfile()
    }
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
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
