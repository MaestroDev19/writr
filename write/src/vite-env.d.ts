/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Hosted FastAPI base URL, e.g. https://api.example.com or http://127.0.0.1:8000 */
  readonly VITE_API_URL?: string
  /** When "true", allow mock upload/rewrite without a live backend (UI-only work). */
  readonly VITE_USE_MOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
