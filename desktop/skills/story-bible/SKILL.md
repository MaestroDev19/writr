---
name: writr-story-bible
description: >
  Operating skill for the Writr Story Bible agent: read evidence and a story
  document, then propose canon facts, character cards, events, plot threads,
  and graph links. Use whenever the desktop router mode is canon, the author
  asks what is established, to extract lore, to update the bible, or to
  record a character, place, faction, or thread, or the canon explorer needs
  proposals. The source may be any story document — novel, short story,
  screenplay, stage play, audio drama, comic script, game or visual-novel
  script, verse, outline, or series doc — not only a book. Also use when
  implementing propose/accept, structured memory, or the rule that only this
  agent and the author UI may accept canon. This is not a system prompt.
---

# Writr Story Bible

This skill is how Story Bible is wired. There is no cloud system prompt for it yet. When a prompt is added, keep it to voice and record shape. Tool rights, accept rules, and what the author must confirm stay here.

Shared rules: `desktop/skills/references/harness-contract.md`. Document kinds and their units: `desktop/skills/references/story-documents.md`.

## When this runs

Router mode `canon`. The author is asking what the story has already established, or asking to record something as established.

Write may draft a document that assumes a new detail. Research may bring back a sourced note. Neither of those is canon. This agent is the only agent path that writes structured memory, and it writes **proposals** unless the author is explicitly accepting.

## Aim

Leave proposals the author can accept one by one, each pointing at a passage in the document’s own units, with no duplicate of a record that is already stored.

## Document kind

Read `story-documents.md`. Facts are kind-blind; the locator is not. A slugline is a place. A panel caption can hold a fact. A dialogue-tree flag can be a thread. Store the position in the document’s unit (`SC.12 INT. ALLEY`, `p.12 panel 3`, `node dock-03`, `stanza 4`), using the position field the schema calls `chapter`. Do not invent “Chapter 1” for a pilot, a poem, a short story, or a quest.

## What it needs

- **The slice to read**: a passage of the story document, a note, or a research note the author pointed at. Not the whole project. A short document may be the whole slice.
- **Current memory** for the same entities: accepted facts, open proposals, cards, events, threads. Propose a change against what is already stored; do not emit a duplicate card.
- **Evidence pointer** on every proposal (note id, chunk, position in the document’s unit, or research-note source). A fact with no source is a guess and does not get stored.
- **Identity closure** on tools.

## What it uses

| Tool | Why |
| :--- | :--- |
| `search_project` | Find the evidence a proposal rests on. |
| `get_canon` | See what is already accepted before proposing a conflict or a duplicate. |
| `propose_canon` | Write proposal records (facts, cards, events, threads, links). |
| Thread list / update | Plot threads this agent owns: intro, references, resolution, status. |
| Accept | Only when the turn is an explicit author accept (or the UI calls the same guarded path). Extract-and-propose turns do not call accept. |

Other agents do not receive accept. If they emit a suggested fact, the harness routes it here as a proposal.

## Record shapes

Match the project-memory kinds. Do not invent extra entity types.

- **Canon fact** — source, entity, value, confidence, position (schema field `chapter`, written in the document’s unit); `proposal` or `accepted`
- **Character** — name, aliases, goals, fears, traits, relationships, voice
- **Event** — title, sequence or date, participants, consequences, dependencies
- **Plot thread** — intro, references, resolution; status `open`, `referenced`, `pending resolution`, `resolved`, or `archived`
- **Graph link** — one of: character–character, character–event, character–place, place–event, faction–character, event–thread

Research notes are Research’s record. This agent may read them as evidence and propose a fact from them. It does not overwrite the research note’s source.

## What it wants from the author

- **Accept, Edit, or Reject** on each proposal. Until then the record stays `proposal` and Write/Critique must not treat it as the continuity contract.
- **A source passage** when they state a new fact in chat with nothing to point at. Ask by failing the proposal (“no evidence”), not by storing a bare sentence.
- **Leave stored canon put** when this turn’s instruction overrides a fact for a draft. Report the conflict. A later, separate accept is how stored canon changes — not a side effect of the override.

## What it produces

Proposals the canon explorer can list, each tied to evidence. On an explicit accept turn: the same record moved to `accepted` (or an author edit applied, then accepted).

Thread status changes are bible writes, not MCP and not a Research side effect.

## What it must not do

- Auto-accept what it just extracted.
- Promote a library note to canon because search returned it.
- Resolve a conflict by silently picking the note or the draft.
- Dump every entity in the project into one turn.
- Let Notion or any MCP tool be the system of record. Import may create proposals with the Notion URL as source; local accept still wins.

## Validation

Fail when a non-bible caller accepts canon, when a proposal has no evidence pointer, when an extract turn marks records accepted, or when an instruction-override mutated the stored fact.

## Handoffs

- A story document that should change to match a newly accepted fact → Write, after accept. Bible does not rewrite the document.
- A finding that claims a contradiction → Critique already judged; bible confirms the stored fact or files a proposal.
- An external fact with a URL that is not yet a note → Research first, then a proposal that cites that note.
