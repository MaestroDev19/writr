/**
 * Markdown cleaner and processor for author-facing AI responses.
 *
 * Authors want to read, copy, and apply clean prose without raw LLM syntax artifacts
 * (such as ### headings, **bold**, *italics*, ```markdown code fences, or <think> reasoning tokens).
 */

export interface ParsedAgentOutput {
  /** Reasoning or chain-of-thought extracted from <think>...</think> tags */
  reasoning: string | null
  /** Clean content with reasoning removed */
  content: string
  /** Pure prose with all markdown styling stripped (for novel drafts / copy-pasting) */
  cleanProse: string
  /** Word count of clean prose */
  wordCount: number
  /** Estimated reading time in minutes */
  readingTimeMinutes: number
}

/**
 * Extracts <think>...</think> tags (used by Qwen 2.5 / 3.5, DeepSeek, and Ollama reasoning models)
 * from raw streaming or completed text.
 */
export function extractReasoning(rawText: string): { reasoning: string | null; cleanContent: string } {
  if (!rawText) return { reasoning: null, cleanContent: "" }

  const thinkRegex = /<think>([\s\S]*?)(?:<\/think>|$)/i
  const match = rawText.match(thinkRegex)

  if (!match) {
    return { reasoning: null, cleanContent: rawText.trim() }
  }

  const reasoning = match[1] ? match[1].trim() : null
  const cleanContent = rawText.replace(thinkRegex, "").trim()

  return { reasoning, cleanContent }
}

/**
 * Strips markdown markup syntax while preserving novel formatting:
 * - Keeps paragraph breaks and line breaks intact
 * - Preserves dialogue punctuation and speech marks
 * - Strips headers (#, ##, ###), bold/italic markers (**, *, __, _), fences (```), blockquotes (>), links [text](url)
 */
export function stripMarkdown(markdown: string): string {
  if (!markdown) return ""

  let text = markdown

  // Remove code blocks and fences
  text = text.replace(/```[\w-]*\n([\s\S]*?)```/g, "$1")
  text = text.replace(/```/g, "")

  // Remove inline code
  text = text.replace(/`([^`]+)`/g, "$1")

  // Remove headers (# Header -> Header)
  text = text.replace(/^#{1,6}\s+(.*)$/gm, "$1")

  // Remove horizontal rules
  text = text.replace(/^(?:---|\*\*\*|___)\s*$/gm, "")

  // Remove blockquotes (> Quote -> Quote)
  text = text.replace(/^>\s?(.*)$/gm, "$1")

  // Replace links [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")

  // Remove images ![alt](url) -> ""
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, "")

  // Remove bold and italic formatting
  // ***text*** or ___text___
  text = text.replace(/(\*\*\*|___)(.*?)\1/g, "$2")
  // **text** or __text__
  text = text.replace(/(\*\*|__)(.*?)\1/g, "$2")
  // *text* or _text_ (ensure not touching snake_case identifiers or single asterisks in dialogue)
  text = text.replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, "$1")
  text = text.replace(/(?<!\w)_([^_]+)_(?!\w)/g, "$1")

  // Remove strikethrough ~~text~~ -> text
  text = text.replace(/~~(.*?)~~/g, "$1")

  // Clean bullet list markers (- Item -> Item)
  text = text.replace(/^[\s]*[-*+]\s+(.*)$/gm, "$1")

  // Clean numbered lists (1. Item -> Item)
  text = text.replace(/^[\s]*\d+\.\s+(.*)$/gm, "$1")

  // Collapse 3+ consecutive newlines to 2
  text = text.replace(/\n{3,}/g, "\n\n")

  return text.trim()
}

/**
 * Full parser that extracts reasoning and prepares both formatted and clean prose versions.
 */
export function parseAgentOutput(rawText: string): ParsedAgentOutput {
  const { reasoning, cleanContent } = extractReasoning(rawText)
  const cleanProse = stripMarkdown(cleanContent)
  const words = cleanProse ? (cleanProse.match(/\S+/g)?.length ?? 0) : 0
  const readingTimeMinutes = Math.max(1, Math.ceil(words / 225))

  return {
    reasoning,
    content: cleanContent,
    cleanProse,
    wordCount: words,
    readingTimeMinutes,
  }
}
