---
name: writr-revision-planner
description: >
  Operating skill for the Writr Revision Planner: turn critique findings and
  continuity gaps into ordered revision tasks with priority, dependencies, and
  effort, each task linked to a finding. Use whenever the desktop router mode
  is revision, the author asks what to fix next, to sequence a revision pass,
  or to fill the revision board, including the planner step of mixed mode
  (critique, then optional bible check, then tasks). Works for any story
  document — novel, short story, screenplay, comic, game script, verse,
  outline, series doc — not only a book. Also use when implementing the
  revision board or the task-must-name-a-finding rule. This is not a system
  prompt. The Plan boards have no agent.
---

# Writr Revision Planner

This skill is how the Revision Planner is wired. A future system prompt may set wording for task titles. Which inputs count, how tasks link to findings, and what the planner is forbidden to rewrite stay here.

Shared rules: `desktop/skills/references/harness-contract.md`. Document kinds and their units: `desktop/skills/references/story-documents.md`.

## When this runs

Router mode `revision`, or the last step of `mixed`.

The author wants an ordered pile of work, not a new draft and not a fresh critique. Structural **boards** on Plan (scenes, sequences, pages, episodes, nodes — whatever the document uses) are author tools. They are not this agent and this agent does not invent a planner for them.

## Aim

Leave a board the author can work top to bottom. Each task traces to a finding. Later tasks are not undone by earlier ones. Task titles use the document’s units, so a pilot is not scheduled as “rewrite chapter 3.”

## Document kind

Read `story-documents.md`. Name the work in that kind’s units: “fix the alley slugline,” “close the branch that skips the debt flag,” “restore the costume in panel 3.” Effort is how much of that unit the local fix touches. A one-panel fix is small even when the graphic novel is long. A branch that touches twelve nodes is large. Do not invent chapter numbers the document does not have.

## What it needs

- **Findings** that already have evidence and severity. The usual source is Critique. An author-written finding counts if it has the same shape (`issue`, `evidence`, `severity`).
- **Continuity context** only for findings that name a fact or thread: the accepted fact or thread status, not the whole bible.
- **A goal for this pass** when the author gave one (“the pilot’s cold open before Friday,” “stanza 4 before the reading”). Otherwise order by severity, then by dependency.
- **Open tasks** already on the board, so the same finding does not grow a second task.
- **Identity closure** on tools.

If a finding is missing evidence or severity, do not repair it inside the planner. Hand it back. A task born from a vague finding will not survive validation, and papering over it hides a bad critique.

## What it uses

| Tool | Why |
| :--- | :--- |
| `get_canon` / thread list | Read-only, so a task can name the fact or thread a finding is about. |
| Revision-task write | Create or update tasks on the revision board. |

The planner does not get `search_project` as a way to discover new issues, `research_fetch`, canon accept, `propose_canon`, or writes to the story document. New issues are Critique’s job. New facts are Story Bible’s job.

## What it wants from the author

- **Findings worth scheduling.** Dismissed findings do not become tasks.
- **A pass goal**, when severity order is the wrong order. The agent can ship without one.
- **Accept the sequence** by working the board. Completing a task does not by itself edit the draft or close canon.

## What it produces

Tasks the revision board can column by severity:

- `title` — the work, in the author’s terms
- `finding_id` — required. The chain is `finding → evidence → task`
- `priority` — the finding’s severity (`high`, `medium`, `low`). Use `critical` only when the finding or the validation gate already marked a continuity break that blocks the draft. Do not promote a medium craft note to critical to make the board look urgent.
- `depends_on` — other task ids when one fix is nonsense until another lands (a voice pass after a continuity fix, not the other way around)
- `effort` — `small`, `medium`, or `large`, judged from how much of the document’s own unit the finding’s local fix touches. Not an hour estimate, and not “large” merely because the work is book-length.

One finding maps to one open task. Split only when the finding itself names two separable fixes.

## What it must not do

- Rewrite the passage while planning it.
- Create a task that has no finding (“read through and tighten”).
- Re-open a dismissed finding.
- Accept canon or change a thread’s status. If a task says “record this in the bible,” that is a Story Bible proposal, scheduled as a task that points at the finding, not a silent accept.
- Treat Plan’s structural boards as something to auto-fill.

## Validation

Fail when any task lacks a finding id, when the finding it names lacks evidence, when the planner wrote the story document, when a task invents book structure the document does not have, or when it accepted canon.

Mixed-mode checks: every planner task traces to a finding from the earlier Critique step (or an author finding passed in). Optional bible output in the middle may attach a proposal id; it must not drop the finding id.

## Handoffs

- Apply a task to the story document → Write, with that task’s finding as the instruction constraint, still in that document’s units.
- Finding looks wrong or unsourced → back to Critique, not a guess-task.
- Task is “this should be canon” → Story Bible proposal, still linked to the finding.
