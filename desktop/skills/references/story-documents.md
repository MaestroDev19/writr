# Story documents

Writr agents work on story documents of every kind. A novel is one kind. The same five agents also work a short story, a screenplay, a stage play, an audio drama, a comic script, a game or visual-novel script, narrative verse, a picture book, an outline, a series or episode doc, a character or world sheet, and the short documents on the Publish surface.

Narrative nonfiction (memoir, personal essay, reported narrative) uses the same agents. Real-world claims go through Research. Story-internal facts go through Story Bible. Do not file a real person as a fiction character card unless the author asks.

Technical docs, academic papers, and legal drafts are not story documents. Leave them alone.

## How to infer the kind

Infer the kind from the target’s form first, then from the instruction. A file of sluglines is a screenplay even if the author says “chapter.” If the instruction explicitly converts (“turn this scene into a comic page”), the instruction wins, and the one-line note after the artifact says the kind changed.

When the target is ambiguous, say which kind you assumed in one line. Do not silently treat it as a book.

## Catalog

Use the kind’s own units. A “scene” in a screenplay is a slugline block. In a comic it is a run of panels. In a game it is often a node. Do not translate those into chapters.

| Kind | Units | Preserve | Do not invent |
| :--- | :--- | :--- | :--- |
| Novel, novella, web-serial installment | chapter, scene, beat | prose, POV, tense | a chapter break the text does not have |
| Short story, flash, vignette | the piece, beat, paragraph | prose; often no chapters | a chapter outline for a 1,200-word story |
| Feature, short, TV episode, pilot | act, sequence, scene (slug), action, dialogue | sluglines, character cues | novel prose in place of action lines |
| Stage play | act, scene, line, stage direction | play format | novelized stage directions |
| Audio, radio, podcast drama | scene, cue, dialogue, SFX | sound cues | a silent prose scene that drops the cues |
| Comic or graphic-novel script | page, panel, caption, balloon, SFX | panel breaks | prose paragraphs with no panels |
| Game, visual novel, interactive fiction | node, branch, quest, line, flag, bark | ids and branches | one linear scene that deletes the other branches |
| Narrative verse, verse novel | stanza, line, turn | line breaks; meter if it is already there | paragraphing the poem |
| Picture book, read-aloud | spread, page, line | sparse text, rhythm | interior monologue the format does not hold |
| Outline, beat sheet, treatment | beat, sequence, act | list or treatment prose | the full draft |
| Series, season, episode doc | episode, sequence, runner | those headings | treating a season doc as chapter 1 of a novel |
| Character, relationship, location, culture, system, timeline, faction sheet | fields | headings and fields | a scene written over the sheet |
| Logline, blurb, query, synopsis | the short document | the market form that was asked for | a paste of the draft |

A collection (stories, poems, episodes, quests) is many documents. Work the one that was attached. Do not merge siblings into a single plot unless the instruction says so.

## Position locator

Structured memory has a position field (the architecture calls it `chapter`). Store a position in the document’s own unit: `Ch 4`, `SC.12 INT. ALLEY`, `p.12 panel 3`, `EP2 cold open`, `node dock-03`, `stanza 4`. Writing “Chapter 1” onto a pilot, a poem, or a quest corrupts the bible, because later search will pretend the work is a book.

## Format conversion

Only Write converts kind, and only when the instruction asks. Critique reviews the document in the kind it already is. Story Bible extracts facts from any kind without changing the document. The Revision Planner names tasks in the document’s units. Research does not care which kind will eventually use the fact.

## Continuity is kind-blind, shape is not

Names, timeline, rules, and prior events are the same facts in a novel and in a dialogue tree. What changes is the shape of the edit: a continuity break in a game may be a flag that never fires; in a comic it may be a costume that changes between panels; in a poem it may be a fact stated in a line. Judge and fix it in that shape.
