# Writr desktop

Local writing workspace: Next.js 16 static export in a Tauri 2 window. Sign-in is Supabase. Chat and embeddings stay on this machine through Ollama.

Setup, the five agents, skills, and MCP are documented in the [repository README](../README.md#desktop).

```bash
bun install
bun run dev
```

Open http://localhost:3000. For the desktop window, from this folder:

```bash
bunx @tauri-apps/cli dev
```
