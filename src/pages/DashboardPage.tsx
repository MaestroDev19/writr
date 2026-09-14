import { useAuth } from "@/contexts/auth-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ShieldCheck, Calendar, Mail, Key } from "lucide-react"

function getInitials(name?: string | null, email?: string | null): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  if (email) return email.slice(0, 2).toUpperCase()
  return "W"
}

export default function DashboardPage() {
  const { user, profile } = useAuth()

  const displayName = profile?.author_name || user?.user_metadata?.author_name || "Author"
  const email = profile?.email || user?.email || "Unknown"
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || ""
  const initials = getInitials(displayName, email)

  const createdDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    : "Recently"

  return (
    <div className="mx-auto max-w-5xl py-12 px-6">

      {/* Header section with User Greeting */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="size-14 ring-2 ring-border" size="lg">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
            <AvatarFallback className="bg-muted text-base font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Author Portal
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary">
                <ShieldCheck className="size-3" />
                Supabase Auth
              </span>
            </div>
            <h1 className="text-3xl font-normal tracking-tight sm:text-4xl">
              Welcome, <span className="font-semibold">{displayName}</span>
            </h1>
          </div>
        </div>
      </div>

      {/* Account Profile Card */}
      <div className="mt-8 rounded-xl border border-neutral-200 bg-neutral-50/50 p-5 dark:border-neutral-800 dark:bg-neutral-900/30">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
          Account Details
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3 text-xs">
          <div className="flex items-center gap-2">
            <Mail className="size-4 text-neutral-400" />
            <div>
              <span className="text-neutral-400">Email:</span>{" "}
              <span className="font-medium text-neutral-900 dark:text-neutral-100">{email}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-neutral-400" />
            <div>
              <span className="text-neutral-400">Joined:</span>{" "}
              <span className="font-medium text-neutral-900 dark:text-neutral-100">{createdDate}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Key className="size-4 text-neutral-400" />
            <div className="truncate">
              <span className="text-neutral-400">User ID:</span>{" "}
              <span className="font-mono text-[11px] text-neutral-600 dark:text-neutral-300 truncate">
                {user?.id ? `${user.id.slice(0, 8)}...${user.id.slice(-4)}` : "None"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
          <div className="text-xs uppercase tracking-wider text-neutral-400">Total API Calls</div>
          <div className="mt-2 text-2xl font-medium">1,248,390</div>
          <div className="mt-1 text-xs text-neutral-500">+12% from last week</div>
        </div>
        <div className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
          <div className="text-xs uppercase tracking-wider text-neutral-400">Active Models</div>
          <div className="mt-2 text-2xl font-medium">Command R+</div>
          <div className="mt-1 text-xs text-neutral-500">Embed v3, Rerank v3</div>
        </div>
        <div className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
          <div className="text-xs uppercase tracking-wider text-neutral-400">Avg Latency</div>
          <div className="mt-2 text-2xl font-medium">124 ms</div>
          <div className="mt-1 text-xs text-neutral-500">99.98% uptime</div>
        </div>
      </div>

      {/* Dummy Activity List */}
      <div className="mt-10 rounded-xl border border-neutral-200 p-6 dark:border-neutral-800">
        <h2 className="text-lg font-medium">Recent Activity</h2>
        <div className="mt-4 divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
          <div className="flex items-center justify-between py-3">
            <div>
              <span className="font-mono text-xs text-neutral-400">POST</span>{" "}
              <span className="font-medium">/v1/chat</span> (Command R+)
            </div>
            <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs dark:bg-neutral-800">
              200 OK
            </span>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <span className="font-mono text-xs text-neutral-400">POST</span>{" "}
              <span className="font-medium">/v1/embed</span> (Embed v3)
            </div>
            <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs dark:bg-neutral-800">
              200 OK
            </span>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <span className="font-mono text-xs text-neutral-400">POST</span>{" "}
              <span className="font-medium">/v1/rerank</span> (Rerank v3)
            </div>
            <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs dark:bg-neutral-800">
              200 OK
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
