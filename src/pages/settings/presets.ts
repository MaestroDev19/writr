export interface WorkflowPreset {
  id: string
  name: string
  description: string
  systemPrompt: string
  temperature: number
  maxTokens: number
  topP: number
  frequencyPenalty: number
  contextChunks: number
}

export const GENERATE_PRESETS: WorkflowPreset[] = [
  {
    id: "literary-fiction",
    name: "Literary",
    description: "Rich detail, quiet emotion, careful prose.",
    systemPrompt:
      "You are an accomplished novelist and literary prose stylist. Emulate the cadence, rhythm, and atmospheric depth found in the author's reference library. Prioritize vivid sensory details, emotional subtext, and varied sentence architecture. Avoid melodrama and unearned sentimentality.",
    temperature: 0.75,
    maxTokens: 2048,
    topP: 0.9,
    frequencyPenalty: 1.15,
    contextChunks: 5,
  },
  {
    id: "pacing-tension",
    name: "Tension",
    description: "Short beats, sharp dialogue, fast momentum.",
    systemPrompt:
      "You are a narrative architect focused on kinetic pacing and scene momentum. Write with concise sentence beats, immediate stakes, and sharp dialogue with heavy subtext. Cut extraneous exposition and heighten dramatic tension through rhythmic sentence acceleration.",
    temperature: 0.65,
    maxTokens: 1536,
    topP: 0.85,
    frequencyPenalty: 1.1,
    contextChunks: 4,
  },
  {
    id: "worldbuilding-texture",
    name: "World & place",
    description: "Setting detail, culture, and physical texture.",
    systemPrompt:
      "You are a worldbuilding specialist and scene painter. Draw specific vernacular, architectural motifs, social customs, and material culture from the grounding corpus. Ground the characters directly within the sensory weight of their immediate physical environment.",
    temperature: 0.8,
    maxTokens: 2560,
    topP: 0.92,
    frequencyPenalty: 1.2,
    contextChunks: 7,
  },
  {
    id: "psychological-stream",
    name: "Inner life",
    description: "Thoughts, memory, and subjective pacing.",
    systemPrompt:
      "You are a stylist of psychological realism. Channel the protagonist's fluid perceptions, stream of sensory impressions, and associative memory patterns. Reflect emotional friction through syntactic rhythm and organic transitions.",
    temperature: 0.85,
    maxTokens: 2048,
    topP: 0.95,
    frequencyPenalty: 1.25,
    contextChunks: 6,
  },
]

export const CRITIQUE_PRESETS: WorkflowPreset[] = [
  {
    id: "developmental-structure",
    name: "Structure",
    description: "Order, gaps, and how any story doc or script holds together.",
    systemPrompt:
      "You are an exacting developmental editor. Evaluate the submitted document (scene, script, story bible, character sheet, lore, or other story material) for structure, completeness, internal consistency, and how sections hang together. Name gaps, contradictions, and where reordering or clearer headings would help.",
    temperature: 0.25,
    maxTokens: 1536,
    topP: 0.75,
    frequencyPenalty: 1.0,
    contextChunks: 5,
  },
  {
    id: "cadence-rhythm",
    name: "Flow",
    description: "Clarity and pacing across prose, scripts, and notes.",
    systemPrompt:
      "You are a clarity and pacing editor. Analyze the submitted document for readability, rhythm, dense passages, and places a reader or performer would stumble. Suggest rewrites that improve flow whether the text is prose, dialogue, script format, or reference notes.",
    temperature: 0.35,
    maxTokens: 1536,
    topP: 0.8,
    frequencyPenalty: 1.05,
    contextChunks: 4,
  },
  {
    id: "voice-consistency",
    name: "Voice",
    description: "Tone and character consistency vs your notes.",
    systemPrompt:
      "You are a voice and continuity coach. Audit the submitted document against the author's notes for tone, character voice, naming, and register. Flag slips that break consistency across scenes, scripts, bibles, or character materials.",
    temperature: 0.3,
    maxTokens: 1536,
    topP: 0.8,
    frequencyPenalty: 1.0,
    contextChunks: 6,
  },
  {
    id: "line-edit-polish",
    name: "Line polish",
    description: "Tighten wording in prose, scripts, and other docs.",
    systemPrompt:
      "You are a rigorous line editor. Scrutinize the submitted document for weak phrasing, filler, passive clutter, and repetitive lines. Provide concrete line-level improvements suited to prose, dialogue, scripts, or reference documents.",
    temperature: 0.2,
    maxTokens: 1280,
    topP: 0.7,
    frequencyPenalty: 1.0,
    contextChunks: 3,
  },
]

export const CONTEXT_VARIABLE_TAGS = [
  { tag: "{{reference_corpus}}", label: "Your notes", desc: "Pulls from your notes library" },
  { tag: "{{author_voice}}", label: "Your voice", desc: "Tone and style guidelines" },
  { tag: "{{manuscript_draft}}", label: "Story draft", desc: "Current scene or chapter" },
  { tag: "{{pacing_rubric}}", label: "Pacing guide", desc: "Target rhythm and length" },
]
