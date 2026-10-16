# Desktop UI/UX plan

**Status:** draft for implementation  
**Date:** 2026-10-15  
**Applies to:** Writr desktop (`desktop/`)  
**Parent:** [2026-10-15-desktop-architecture.md](./2026-10-15-desktop-architecture.md) (final synthesis)  
**Depends on:** [2026-10-15-desktop-local-rag-design.md](./2026-10-15-desktop-local-rag-design.md)  
**Related:** AuthorOS Desktop V2 PRD (agents/workspaces — later phases)

This plan defines how the desktop product should feel versus the cloud web app (`write/`), what to ship in the local-library slice, and how UI grows into AuthorOS without cloning the web dashboard.

---

## 1. Product stance

| | Web (`write/`) | Desktop (`desktop/`) |
| :--- | :--- | :--- |
| Metaphor | Browser SaaS: upload notes, call API | Local author workspace: files + DB on this machine |
| Notes | Cloud corpus for agents | Local evidence library (not auto-canon) |
| Blocking deps | Backend + Gemini | Supabase auth + **Ollama** + local DB |
| Primary chrome | Top nav: Home / Write / Review / Settings | Setup gate → Library first; later project shell + sidebar |
| File I/O | `<input type="file">` + cloud job status | Native dialogs, OS paths, in-process progress |

**Do not** port Dashboard/Generate/Critique layouts 1:1. Reuse brand continuity (auth patterns, type/color if desired); change interaction model.

---

## 2. Design principles

1. **Local honesty** — Status always names the real dependency (Ollama, embed model, disk DB), not a generic “syncing.”
2. **One job per screen** — Setup unlocks library; library adds and searches; agents come later.
3. **Native where it matters** — File pick, folder reveal, external install links via Tauri; avoid fake web upload affordances.
4. **Evidence ≠ canon** — Library copy never says “saved to story bible.” Canon/accept UI is a later AuthorOS surface.
5. **Dense, not dashboard-y** — Prefer list + detail + search over card grids and marketing heroes after sign-in.
6. **Keyboard later, structure now** — Reserve space for Ctrl+K; don’t build the full palette until AuthorOS.

---

## 3. Information architecture (phased)

### Web ↔ desktop map (feel parity)

Desktop **chrome matches web** (primary stripe, brand mark, top nav, avatar → Settings / Sign out). Labels adapt to local-first product; cloud job banners and Gemini provider UI stay on web.

| Web (`write/`) | Desktop (`desktop/`) | What lives here |
| :--- | :--- | :--- |
| Home `/dashboard` | **Library** `/library` | Notes evidence: add file / paste / link, list, search |
| Write `/generate` | **Write** `/write` | Agent revises a **target draft**; tools call local `search_notes` |
| Review `/critique` | **Review** `/review` | Agent scores / feedback on a **target draft**; same tools |
| Settings (avatar) | **Settings** `/settings` | Ollama / chat model, later MCP + Notion connections |
| — | Setup gate (fullscreen) | First-run: Ollama + embed model + local DB |

**Target document (Write / Review)** — session draft the agent works on, same idea as web “Your file”:

1. **You upload / open** a `.docx` / `.txt` / `.md` (or paste) into the Write/Review panel. Not auto-canon; not the notes library.
2. **Notes stay separate** — Library is evidence the agent retrieves via `search_notes`.
3. **Agent does not invent a target** — it revises / reviews the file you attached.
4. **Notion import** (Phase 3 / MCP) — pulls into **Library notes** (or proposals), not silently into the target. Optional later: open a linked Notion page as target via MCP tool the author enables.

```text
┌─ App nav (web feel):  Library | Write | Review     [Local · model] [Avatar] ─┐
│                                                                              │
│  Library          Write / Review              Settings                       │
│  notes evidence   target draft (you attach)   Ollama / chat / MCP            │
│  file·paste·link  + agent dock                Notion = connected servers     │
│  search hits      tools → search_notes        not master store               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Phase 0 — Auth (exists)

- Login / signup / forgot password  
- Post-auth → setup gate → Library  

### Phase 1 — Local library (current)

```text
Sign-in
  → First-run setup (Ollama + model + DB)
    → App shell (Library active; Write / Review / Settings reachable)
         Library: notes list · add · search
         Write / Review: honest stubs until agents land
         Settings: local status + model recommendation
```

Nav chrome ships with Phase 1 so the product feels like web immediately; agent pages explain the coming target-doc + tool flow.

### Phase 2 — Agents + AuthorOS growth

- Implement Write / Review UIs (port web session-target pattern; local RAG tools).  
- Later PRD surfaces: **Home · Plan · Analyse · Research · Publish** + story sidebar.  
- Library may become Research / sidebar Notes inside a project.

### Phase 3 — External I/O chrome

- Project folder badge / “Open in Explorer”  
- Notion via MCP: import → library notes; link status on a note (“linked · last pushed”) — sync edge, not master  

---

## 4. Phase 1 screens (detailed)

### 4.1 First-run setup

**Goal:** Unlock ingest only when the machine can embed and store.

| Step | UI | Actions |
| :--- | :--- | :--- |
| 1 | Ollama unreachable | Short explanation + Open install docs (opener) + Retry ping |
| 2 | Model missing | Auto-pull `nomic-embed-text` with determinate progress |
| 3 | DB migrate | Quiet success or hard fail with Retry |
| 4 | Ready | Primary CTA: **Open library** |

**Rules**

- Full-screen gate; do not show an empty library underneath.  
- Re-check on focus/retry if the author installs Ollama mid-session.  
- Auth remains required (`user_id` scope); setup is after sign-in.

### 4.2 Library — layout

Single composition (not a multi-widget dashboard):

```text
┌ Header: Writr · Library          [status pill] [Sign out] ┐
├──────────────────────────────────────────────────────────┤
│ Add: [File] [Paste] [Link]                               │
├─────────────────────┬────────────────────────────────────┤
│ Notes list          │ Detail / Search                    │
│ title, type, status │ selected note meta OR search hits  │
│ Retry if failed     │                                    │
└─────────────────────┴────────────────────────────────────┘
```

- **Left:** scrollable notes; status chip `ready` | `failed`.  
- **Right:** default = search; selecting a note shows title, source, sha short, error + Retry.  
- Avoid embedding-monitor / cloud job banners from web; use **per-note** progress and status.

### 4.3 Add flows

| Source | Affordance | Copy / errors |
| :--- | :--- | :--- |
| File | Button → Tauri dialog; filters `.docx .txt .md` | PDF/unsupported → explicit reject list |
| Paste | Panel: title optional + textarea + Add | Empty → block |
| Link | URL field + Fetch | Require URL; thin extract → fail message |

**Progress:** modal or inline bar — stages `Reading → Chunking → Embedding (n/m) → Saving`. Cancel optional later; v1 can be non-cancellable with clear busy state.

**Dedupe:** toast/inline “Already in library” — do not create a second ready row.

### 4.4 Search

- Query field + Search (Enter).  
- Results: chunk text snippet, note title, ordinal, optional score.  
- Empty: “No matches” vs “Add a note first” vs “Ollama/model unavailable.”  
- No agent reply chrome — raw evidence hits only.

### 4.5 Errors (author-facing)

Match local RAG design: unsupported type, empty extract, thin link, Ollama down, duplicate sha, embed/DB failure → **Retry** on note when `failed`.

---

## 5. Desktop chrome vs web (checklist)

| Pattern | Web | Desktop Phase 1 |
| :--- | :--- | :--- |
| Upload cloud icon / job queue | Yes | No — local progress stages |
| Link to Write/Review from notes | Yes | Omit until agents exist |
| Settings / model provider | Hosted Gemini focus | Defer; show embed model in status pill only |
| Max-width marketing auth | OK for auth | Keep auth; product = wider split pane |
| PDF | Supported | Reject with message |
| Corpus “needs update” | Cloud re-embed semantics | Per-note `failed` + Retry only |

---

## 6. Visual & motion (Phase 1)

- Prefer the desktop app’s existing shadcn/Base UI tokens; don’t invent a second brand for library.  
- Status colors: muted for ready, destructive/warn for failed, accent for in-progress.  
- Motion: progress bar + list row appear; avoid decorative hero motion on the library.  
- Density: comfortable list rows (~40–48px), readable snippets (2–4 lines).

Out of scope for Phase 1: graph, timeline, health gauges, card-heavy bible.

---

## 7. Accessibility & input

- Dialogs and progress must be keyboard-dismiss-safe (don’t trap without Escape where possible).  
- File add is button-triggered (dialog), not hover-only drop (drag-drop nice-to-have).  
- Search results navigable by keyboard in a later pass; mouse-first OK for v1.  
- Announce stage changes to AT when progress updates (aria-live on status region).

---

## 8. Phase 2 preview (AuthorOS — do not build yet)

When agents land, evolve chrome:

| Surface | UX intent |
| :--- | :--- |
| App shell | Sidebar: characters, locations, threads, notes, revisions |
| Home | Title, words, draft status, story health, open threads, activity |
| Write | Editor + assistant dock + continuity warnings beside draft |
| Plan | Boards for scenes/chapters/threads — no agent of its own |
| Analyse | Findings by category; drill into evidence |
| Research | Absorbs Phase 1 library + layered web research + citations |
| Publish | Synopsis/blurb/query — separate from draft |
| Palette | Ctrl+K → router commands |
| Canon | Proposals vs accepted; never silent promote from notes |

**UI implication of earlier architecture decisions**

- Harness failures → structured error in dock (“validation blocked: age conflict”), not a chat blob.  
- Eval is not a user-facing screen; optional later “diagnostics” for power users only.

---

## 9. Implementation order (UI)

1. Replace post-auth placeholder with **setup gate** wired to Ollama ping / pull / DB ready.  
2. **Library shell** (list + detail/search empty states).  
3. **Add file** + progress + list refresh.  
4. Paste + link.  
5. **Search results** pane.  
6. Polish errors + Retry.  
7. Stop — do not start Write/Analyse chrome until AuthorOS agents design is approved.

---

## 10. Success criteria (Phase 1 UX)

- Author who has never used Ollama can complete setup without leaving the app (except install link).  
- Author can add a `.md` or `.docx`, see progress, and find it via search in one sitting.  
- Failed note shows a human message and Retry.  
- No screen implies notes are cloud-synced or canon.  
- Web Dashboard is not required to understand the desktop library.

---

## 11. Out of scope (this plan)

- Pixel-perfect redesign of auth marketing pages  
- Full AuthorOS workspaces, graph, timeline, health scores  
- Notion link UI / folder project picker (Phase 3)  
- Streaming agent transcripts as primary UX  
- Cloning Generate/Critique page structure from `write/`
