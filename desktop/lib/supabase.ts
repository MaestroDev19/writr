import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import {
  authClient,
  getCurrentUserId,
  getCachedUserProfile,
  getUserProfile,
} from "./auth-client"
import type { UserProfile } from "@/types/auth"

export { getCurrentUserId, getCachedUserProfile, getUserProfile }

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let client: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient {
  if (!client) {
    if (supabaseUrl && supabaseKey) {
      client = createClient(supabaseUrl, supabaseKey)
    } else {
      // Safe fallback proxy when keys are not bundled in desktop app
      client = new Proxy({} as SupabaseClient, {
        get(_target, prop) {
          if (prop === "auth") {
            return {
              getSession: async () => ({
                data: { session: authClient.getState().session },
                error: null,
              }),
              getUser: async () => ({
                data: { user: authClient.getState().user },
                error: null,
              }),
              signOut: async () => authClient.signOut(),
            }
          }
          return () => ({
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          })
        },
      })
    }
  }
  return client
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabaseClient(), prop, receiver)
  },
})