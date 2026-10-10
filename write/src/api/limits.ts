/** Keep in sync with write-backend ``services.connector`` caps. */
export const MAX_REFERENCE_DOCUMENTS_PER_USER = 5
export const MAX_DOCUMENTS_PER_UPLOAD = 3

/**
 * Session book files (.txt, .md, .docx): scenes, outlines, character sheets, scripts, and similar.
 * Checked before `file.text()` / mammoth so a large doc cannot freeze the tab.
 */
export const MAX_TARGET_DRAFT_BYTES = 2 * 1024 * 1024

/**
 * Hard cap for POST /agents/* `content` (instruction + target + wrapper).
 * Keep in sync with write-backend ``router/v1/agents.py``.
 */
export const MAX_AGENT_CONTENT_CHARS = 80_000
