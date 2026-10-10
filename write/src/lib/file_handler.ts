import { MAX_AGENT_CONTENT_CHARS, MAX_TARGET_DRAFT_BYTES } from "@/api/limits"
import { formatFileSize } from "@/lib/format-file-size"

/** Matches what `fileHandler` can extract for a Write session file. */
export const TARGET_FILE_ACCEPT = ".txt,.md,.docx"

export const TARGET_FILE_TYPES_LABEL = "Text, Markdown, or Word"

const TARGET_EXTENSIONS = new Set(["txt", "md", "docx"])

function getExtension(name: string): string {
  const dot = name.lastIndexOf(".")
  if (dot <= 0 || dot === name.length - 1) return ""
  return name.slice(dot + 1).toLowerCase()
}

/**
 * Sync gate: extension and size only. Call before any file read.
 * Library uploads are a different path and are not checked here.
 */
export function assertTargetDraftFile(file: File): void {
  const extension = getExtension(file.name)
  if (!TARGET_EXTENSIONS.has(extension)) {
    throw new Error("Use a .txt, .md, or .docx file.")
  }
  if (file.size === 0) {
    throw new Error("That file is empty.")
  }
  if (file.size > MAX_TARGET_DRAFT_BYTES) {
    throw new Error(
      `That file is too large (${formatFileSize(file.size)}). Book files must be ${formatFileSize(MAX_TARGET_DRAFT_BYTES)} or smaller.`
    )
  }
}

export async function fileHandler(file: File): Promise<string> {
  assertTargetDraftFile(file)
  const extension = getExtension(file.name)

  let text = ""
  if (extension === "txt" || extension === "md") {
    text = (await file.text()).trim()
  } else {
    const mammoth = await import("mammoth")
    const extractRawText =
      mammoth.extractRawText ?? mammoth.default?.extractRawText
    if (!extractRawText) {
      throw new Error("Could not read that Word file.")
    }
    const arrayBuffer = await file.arrayBuffer()
    const result = await extractRawText({ arrayBuffer })
    text = result.value.trim()
  }

  if (!text) {
    throw new Error(
      "No text found in that file. It may be empty, image-only, or damaged."
    )
  }

  if (text.length > MAX_AGENT_CONTENT_CHARS) {
    throw new Error(
      `That file is too long (${text.length.toLocaleString()} characters). Keep it under ${MAX_AGENT_CONTENT_CHARS.toLocaleString()} characters.`
    )
  }

  return text
}
