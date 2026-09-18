import { supabase } from "@/lib/supabase"
import type {
  DocumentRole,
  GenerateRevisionsPayload,
  GenerateRevisionsResponse,
  UploadFileResponse,
} from "@/types/document-roles"

const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "")
const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true"

export class ApiConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ApiConfigError"
  }
}

function assertBackendConfigured(): void {
  if (!API_BASE_URL && !USE_MOCK) {
    throw new ApiConfigError(
      "VITE_API_URL is not set. Point it at your hosted FastAPI (or http://127.0.0.1:8000 for local API), or set VITE_USE_MOCK=true for UI-only work."
    )
  }
}

function isLiveApi(): boolean {
  return Boolean(API_BASE_URL) && !USE_MOCK
}

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    throw new Error(`Auth session error: ${error.message}`)
  }
  const token = data.session?.access_token
  if (!token) {
    throw new Error("Sign in required. No Supabase access token.")
  }
  return token
}

async function authHeaders(json = false): Promise<HeadersInit> {
  const token = await getAccessToken()
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  }
  if (json) {
    headers["Content-Type"] = "application/json"
  }
  return headers
}

/**
 * Upload a notes-library file to the cloud corpus.
 * Always treated as a reference note — never use for Write session drafts.
 */
export async function uploadFileApi(
  file: File,
  role: DocumentRole,
  onProgress?: (progress: number) => void
): Promise<UploadFileResponse> {
  assertBackendConfigured()

  if (role === "target") {
    throw new Error(
      "Session story drafts are not uploaded to the notes library. Use the Write run endpoint instead."
    )
  }

  if (isLiveApi()) {
    const formData = new FormData()
    formData.append("file", file)

    const res = await fetch(`${API_BASE_URL}/cloud/references/upload`, {
      method: "POST",
      headers: await authHeaders(false),
      body: formData,
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText)
      throw new Error(`Notes upload failed (${res.status}): ${detail}`)
    }

    onProgress?.(100)
    const data = (await res.json()) as UploadFileResponse
    return { ...data, role: "reference" }
  }

  // Mock path (VITE_USE_MOCK=true)
  return mockUpload(file, onProgress)
}

export interface CloudWriteRequest {
  instruction: string
  target_file_id?: string
  target_text?: string
  target_filename?: string
  temperature?: number
  max_tokens?: number
  top_p?: number
  frequency_penalty?: number
  context_chunks?: number
  system_prompt?: string
}

/**
 * Write / rewrite: session draft only. Never persists into the notes library.
 */
export async function generateRevisionsApi(
  payload: GenerateRevisionsPayload,
  targetFileName?: string,
  referenceFileNames: string[] = [],
  extras?: {
    targetText?: string
    targetFile?: File
    systemPrompt?: string
    topP?: number
    frequencyPenalty?: number
    contextChunks?: number
  }
): Promise<GenerateRevisionsResponse> {
  assertBackendConfigured()
  const startTime = performance.now()

  if (isLiveApi()) {
    const body: CloudWriteRequest = {
      instruction: payload.prompt,
      target_file_id: payload.target_file_id,
      target_text: extras?.targetText,
      target_filename: targetFileName,
      temperature: payload.temperature,
      max_tokens: payload.max_tokens,
      top_p: extras?.topP,
      frequency_penalty: extras?.frequencyPenalty,
      context_chunks: extras?.contextChunks,
      system_prompt: extras?.systemPrompt,
    }

    // Prefer JSON when we have text; if only a File, send multipart.
    if (extras?.targetFile && !extras.targetText) {
      const formData = new FormData()
      formData.append("instruction", payload.prompt)
      formData.append("file", extras.targetFile)
      if (targetFileName) formData.append("target_filename", targetFileName)
      if (payload.target_file_id) formData.append("target_file_id", payload.target_file_id)
      if (payload.temperature != null) {
        formData.append("temperature", String(payload.temperature))
      }
      if (payload.max_tokens != null) {
        formData.append("max_tokens", String(payload.max_tokens))
      }

      const res = await fetch(`${API_BASE_URL}/cloud/run`, {
        method: "POST",
        headers: await authHeaders(false),
        body: formData,
      })

      if (!res.ok) {
        const detail = await res.text().catch(() => res.statusText)
        throw new Error(`Write failed (${res.status}): ${detail}`)
      }

      return (await res.json()) as GenerateRevisionsResponse
    }

    const res = await fetch(`${API_BASE_URL}/cloud/run`, {
      method: "POST",
      headers: await authHeaders(true),
      body: JSON.stringify({ ...body, target_stored: false }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText)
      throw new Error(`Write failed (${res.status}): ${detail}`)
    }

    return (await res.json()) as GenerateRevisionsResponse
  }

  return mockRevision(payload, targetFileName, referenceFileNames, startTime)
}

export interface CloudReviewRequest {
  instruction: string
  target_text: string
  target_stored: false
  temperature?: number
  max_tokens?: number
  context_chunks?: number
  system_prompt?: string
}

/**
 * Review: pasted text only. Never uploaded as a reference note.
 */
export async function reviewDocumentApi(
  request: CloudReviewRequest
): Promise<{
  report_text?: string
  score_overall?: number
  pacing_score?: number
  voice_score?: number
  friction_score?: number
  recommendations?: Array<{
    category: string
    severity: "high" | "medium" | "low"
    issue: string
    revised_example: string
  }>
  [key: string]: unknown
}> {
  assertBackendConfigured()

  if (isLiveApi()) {
    const res = await fetch(`${API_BASE_URL}/cloud/run`, {
      method: "POST",
      headers: await authHeaders(true),
      body: JSON.stringify({
        ...request,
        target_stored: false,
        mode: "review",
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText)
      throw new Error(`Review failed (${res.status}): ${detail}`)
    }

    return await res.json()
  }

  // Mock: empty payload so UI can keep local simulation
  return {}
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function mockUpload(
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadFileResponse> {
  const calculatedChunks = Math.max(12, Math.round(file.size / 800))

  return new Promise((resolve) => {
    let progress = 10
    onProgress?.(progress)

    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 25) + 15
      if (progress >= 100) {
        progress = 100
        clearInterval(interval)
        onProgress?.(100)
        resolve({
          id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          size: formatFileSize(file.size),
          role: "reference",
          chunks: calculatedChunks,
          uploaded_at: new Date().toISOString(),
          status: "ready",
        })
      } else {
        onProgress?.(progress)
      }
    }, 250)
  })
}

function mockRevision(
  payload: GenerateRevisionsPayload,
  targetFileName: string | undefined,
  referenceFileNames: string[],
  startTime: number
): Promise<GenerateRevisionsResponse> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const targetName = targetFileName || "target_draft.md"
      const referencesList =
        referenceFileNames.length > 0
          ? referenceFileNames
          : ["reference_lore.md", "psychology_notes.pdf"]

      const revisedText = generateSimulatedRevisionProse(
        payload.prompt,
        targetName,
        referencesList
      )

      const words = revisedText.trim().split(/\s+/).length
      const characters = revisedText.length
      const tokens = Math.round(words * 1.35)
      const latency = Math.round(performance.now() - startTime)

      resolve({
        target_file_id: payload.target_file_id,
        target_filename: targetName,
        revised_text: revisedText,
        word_count: words,
        character_count: characters,
        tokens,
        latency_ms: latency,
        referenced_documents: referencesList,
      })
    }, 1400)
  })
}

function generateSimulatedRevisionProse(
  prompt: string,
  targetDoc: string,
  references: string[]
): string {
  const refMentions = references.map((r) => `*${r}*`).join(" and ")

  return `### Revised Manuscript Draft: ${targetDoc}
*Synthesized using context grounded in ${refMentions}*
*Directive: "${prompt}"*

---

Marcus hesitated on the granite threshold, the damp harbor wind snapping the edges of his collar. He did not pull the door shut immediately; his fingers lingered on the iron latch with the slow, deliberate hesitation of a man perpetually cataloging the escape routes he knew he would never take.

"You're late," Elena said from behind the ledger desk. She didn't look up from her inkwell, but her pen hovered a millimeter above the page—a measured stillness that acknowledged his presence without yielding ground.

"The tide was against the lower quay," Marcus replied, his voice level, stripped of the defensiveness she expected. He had learned to modulate his cadence, smoothing down the edges where panic usually gathered. The psychology of their stalemate was familiar: silence was not empty space between them, but an active negotiation.

He unrolled the map across the scarred cedar tabletop. The ink had blurred slightly where salt spray had seeped into the grain, but the contour lines remained sharp.

"Look here," he said, tapping the eastern estuary. "If the courier vessels follow the shoal rather than the dredged channel, they will bypass the lantern patrol completely. We don't need forty minutes of darkness. We only need twelve."

Elena leaned forward, her amber eyes tracking the salt-bitten perimeter. For the first time in six weeks, the ledger remained dry.`
}
