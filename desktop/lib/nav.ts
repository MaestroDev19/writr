import type { LucideIcon } from "lucide-react"
import {
  BookOpen,
  FileSearch,
  Home,
  Kanban,
  MessageSquareQuote,
  Microscope,
  Send,
  Settings,
  Sparkles,
} from "lucide-react"

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  /** Agent surfaces that work a target draft */
  kind: "workspace" | "library" | "agent" | "settings"
  /** Live now vs chrome-only preview */
  status: "live" | "soon"
  blurb: string
}

export const workspaceNav: NavItem[] = [
  {
    label: "Home",
    href: "/home",
    icon: Home,
    kind: "workspace",
    status: "live",
    blurb: "Workspace overview and what is next",
  },
  {
    label: "Library",
    href: "/library",
    icon: BookOpen,
    kind: "library",
    status: "live",
    blurb: "Local notes evidence - file, paste, link, later Notion",
  },
]

export const agentNav: NavItem[] = [
  {
    label: "Write",
    href: "/write",
    icon: Sparkles,
    kind: "agent",
    status: "soon",
    blurb: "Revise a target draft with local note search",
  },
  {
    label: "Review",
    href: "/review",
    icon: MessageSquareQuote,
    kind: "agent",
    status: "soon",
    blurb: "Score and feedback on a target draft",
  },
  {
    label: "Plan",
    href: "/plan",
    icon: Kanban,
    kind: "agent",
    status: "soon",
    blurb: "Scenes, chapters, and threads - boards, not a chat agent",
  },
  {
    label: "Analyse",
    href: "/analyse",
    icon: Microscope,
    kind: "agent",
    status: "soon",
    blurb: "Findings by category with evidence drill-down",
  },
  {
    label: "Research",
    href: "/research",
    icon: FileSearch,
    kind: "agent",
    status: "soon",
    blurb: "Layered research on top of Library notes",
  },
  {
    label: "Publish",
    href: "/publish",
    icon: Send,
    kind: "agent",
    status: "soon",
    blurb: "Synopsis, blurb, and query - separate from the draft",
  },
]

export const settingsNav: NavItem[] = [
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    kind: "settings",
    status: "live",
    blurb: "Ollama, chat models, later MCP and Notion",
  },
]

export const allNav = [...workspaceNav, ...agentNav, ...settingsNav]
