# Writr desktop design

Local author workspace. Violet system, Space Grotesk everywhere, light/dark.

## Color

oklch violet system (`--radius: 0`). Light canvas is pure white; primary ~`oklch(0.491 0.27 292.581)`. Accent matches primary. See `app/globals.css` for the full `:root` / `.dark` tokens.

Semantic Tailwind: `bg-primary`, `bg-muted`, `text-muted-foreground`. Legacy `deep-green` / `coral` / `soft-stone` alias to primary / destructive / muted.

## Type

- **Heading + body:** Space Grotesk (`--font-sans` / `--font-heading`)
- **Mono:** JetBrains Mono (`--font-mono-face`) for tools, paths, kbd-adjacent labels

## Density

Desktop chrome stays compact: 48px topbar, labeled sidebar (not icon-rail), 8–16px gaps. Prefer `gap-*` stacks over cards-for-everything.

## AI surfaces

Agent docks follow [shadcn AI Elements](https://ui.shadcn.com/docs/ai-elements):

- **Prompt Input** → `InputGroup` + `Attachment`
- **Message thread** → `Message` + `Bubble`
- Tool / reasoning steps can later sit on `Trace`

## Theme + shortcuts

- Theme: light / dark / system (`next-themes`, class strategy). Toggle in topbar + Settings. `Ctrl/⌘+Shift+L`.
- Shortcuts: `Ctrl/⌘+/` help; `Ctrl/⌘+1–4` nav; `Ctrl/⌘+,` settings.
