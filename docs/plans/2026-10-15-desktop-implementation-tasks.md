# Desktop implementation tasks

**Status:** ready to execute  
**Date:** 2026-10-15  
**Architecture:** [2026-10-15-desktop-architecture.md](./2026-10-15-desktop-architecture.md)  
**Detail:** [local RAG](./2026-10-15-desktop-local-rag-design.md) · [UI/UX](./2026-10-15-desktop-ui-ux-plan.md)

Work top-down within a phase; do not start Phase 2+ until Phase 1 smoke passes.

---

## Phase 1 — Local RAG + library UI

**Goal:** Setup → add note → hybrid search. No agents.

### 1.1 Tauri DB

- [ ] Add `rusqlite` + sqlite-vec loading to `desktop/src-tauri`
- [ ] App-data path helper for `writr.db`
- [ ] Migrations: `notes`, `chunks`, FTS5, vec table (`model_id`, 768-d)
- [ ] Commands: `db_migrate` / open-on-startup
- [ ] Commands: `note_insert`, `note_update_status`, `note_list`, `note_get`, `note_find_by_sha`
- [ ] Commands: `chunks_replace_for_note`, `embeddings_upsert`
- [ ] Commands: `search_fts`, `search_vec`
- [ ] Wire `@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-opener`

### 1.2 TypeScript pipeline

- [ ] `lib/ollama.ts` — ping, ensure/pull `nomic-embed-text` + progress, embed
- [ ] `lib/document-loader.ts` — DOCX (mammoth), TXT/MD, paste, link (Readability); reject PDF
- [ ] `lib/chunker.ts` — ordinals + metadata; tunable size/overlap
- [ ] `lib/rrf.ts` — reciprocal rank fusion
- [ ] `lib/retrieve.ts` — embed query → vec + FTS → RRF
- [ ] `lib/ingest.ts` — load → sha → dedupe → persist → chunk → embed → status
- [ ] Add npm deps: `mammoth`, `@mozilla/readability`, `linkedom` (or equivalent)

### 1.3 Setup + library UI

- [ ] First-run setup gate: Ollama → model pull → DB migrate → unlock
- [ ] Replace post-auth placeholder with library shell (list | detail/search)
- [ ] Status pill (Ollama / model)
- [ ] Add file via Tauri dialog + progress stages
- [ ] Add paste flow
- [ ] Add link flow (URL required; thin-extract error)
- [ ] Notes list: `ready` / `failed` + Retry
- [ ] Search pane: query → hybrid hits (snippet, title, ordinal)
- [ ] Author-facing errors (unsupported, empty, duplicate, Ollama down)

### 1.4 Phase 1 verification

- [ ] Unit fixtures: loaders (incl. PDF reject), chunker, RRF, dedupe
- [ ] Manual smoke: cold Ollama → setup → ingest md/docx/paste/link → search

**Exit:** one sitting add + search works; failed notes Retry; no canon/agent chrome.

---

## Phase 2 — Project memory (pre-agents)

**Goal:** Structured memory + propose/accept before any agent writes canon.

- [ ] Schema: canon facts (proposal|accepted), characters, events, threads, research notes, graph links
- [ ] Tauri CRUD commands for memory entities
- [ ] Scope rows by `user_id` + `project_id`
- [ ] Minimal UI: list proposals → Accept / Edit / Reject
- [ ] Enforce: accepted canon only via bible path or author UI (API-level guard)

**Exit:** author can accept a manual/proposed fact; nothing else can silently accept.

---

## Phase 3 — Agent Slice A (local tools only)

**Goal:** Harness + five agents; no folders/Notion MCP yet.

### 3.1 Harness

- [ ] Query router → mode + confidence + agent list + memory slices
- [ ] Context assembly (canon/cards/threads + `search_project`; no whole-project dump)
- [ ] Tool registry with per-agent allowlists
- [ ] Validation gate (canon, timeline, identity, citations; mixed chain integrity)
- [ ] Compose reply for UI (draft / findings / proposals / tasks / conflicts)
- [ ] Tracing hooks for later error analysis

### 3.2 Tools (first-party)

- [ ] `search_project` → hybrid retrieve
- [ ] `get_canon` / `propose_canon` (accept stays UI-owned or bible-only)
- [ ] Thread list/update helpers
- [ ] Research: HTTP+Readability fetch; escalate to app-owned browser when thin/JS
- [ ] Model provider setting (hosted / OpenAI / Anthropic / OpenRouter / Ollama / LM Studio)

### 3.3 Agents

- [ ] Write agent (draft, alternatives off-manuscript until accept)
- [ ] Critique agent (evidence + severity required)
- [ ] Story Bible agent (extract → proposals; only path to write structured memory)
- [ ] Research agent (source required on notes)
- [ ] Revision Planner (tasks must name findings)
- [ ] Mixed mode: critique → (bible checks) → planner

### 3.4 Slice A verification

- [ ] Router fixtures per mode + mixed + low-confidence ambiguous
- [ ] Contract tests: non-bible agents cannot accept canon
- [ ] Critique/research/revision invalid-shape tests
- [ ] Validation: contradicting prose fails unless turn overrides
- [ ] Context assembly: single-character query stays small
- [ ] Manual smoke: one write, one critique, one canon ask, one research note

**Exit:** agents run through harness on local memory + RAG only.

---

## Phase 4 — AuthorOS shell (UI Phase 2)

**Goal:** Product chrome around the harness (not a web Dashboard clone).

- [ ] App shell + story sidebar (characters, locations, factions, timeline, threads, notes, revisions)
- [ ] Home: title, words, draft status, health placeholders, open threads, activity
- [ ] Write: editor + assistant dock + continuity warning slot
- [ ] Plan: scene/chapter/thread boards (no agent)
- [ ] Analyse: findings by category + drill-down
- [ ] Research: absorb Phase 1 library + research results/citations
- [ ] Publish: synopsis / blurb / query / metadata / export placeholders
- [ ] Canon explorer entry from sidebar
- [ ] Revision board (critical/high/medium/low columns)
- [ ] Rewrite sandbox branches (do not mutate main until accept)
- [ ] Command palette Ctrl+K → router commands
- [ ] Story health rollup UI (scores → open findings)

**Exit:** navigate all surfaces; palette dispatches a real router call.

---

## Phase 5 — Folder tools (Slice B)

- [ ] Project root setting / picker
- [ ] First-party `fs_list` / `fs_read` / `fs_write` sandboxed to root
- [ ] Wire into Research + Write (load/save manuscript & notes files)
- [ ] UI: folder badge + Open in Explorer
- [ ] Tests: path escape outside root denied

**Exit:** agent/file UI can read/write only under project root.

---

## Phase 6 — Notion MCP (Slice C)

- [ ] MCP host in desktop (connect configured servers)
- [ ] Notion adapter: import page/DB → research notes / proposals (source = Notion URL)
- [ ] Notion adapter: update/write linked pages from accepted local docs
- [ ] Settings: Notion allowlist / OAuth storage in app data
- [ ] UI: link status on note (“linked · last pushed”)
- [ ] Tests: import never auto-accepts canon; local remains source of truth

**Exit:** push/pull Notion without Notion becoming master.

---

## Phase 7 — Eval & error analysis (ongoing from Phase 3)

- [ ] Golden eval set for Write / Critique / Bible / Research / Planner
- [ ] Story health score change when findings open/close
- [ ] Failure taxonomy from harness traces
- [ ] Process: every prod-like fail → fixture before prompt-only fixes
- [ ] Optional power-user diagnostics panel (not primary UX)

---

## Explicitly not tasked (out of scope)

- PDF ingest, cloud note sync, graph server, streaming requirement
- Reader simulations, cross-project series bible
- Replacing `write/` cloud app
- Author-facing “pick which agent”
- Agents beyond the five

---

## Suggested execution order (check off in sequence)

1. Phase 1.1 → 1.2 → 1.3 → 1.4  
2. Phase 2  
3. Phase 3  
4. Phase 4  
5. Phase 5 → 6  
6. Phase 7 continuous after 3  

**Next session start:** Phase **1.1** (Tauri DB).
