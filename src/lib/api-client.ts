import type {
  DocumentRole,
  GenerateRevisionsPayload,
  GenerateRevisionsResponse,
  UploadFileResponse,
} from "@/types/document-roles"

const API_BASE_URL = import.meta.env.VITE_API_URL || ""

/**
 * 1. Upload file contract:
 *    FormData payload will include: file (Binary), role ('target' | 'reference')
 */
export async function uploadFileApi(
  file: File,
  role: DocumentRole,
  onProgress?: (progress: number) => void
): Promise<UploadFileResponse> {
  // If a live backend endpoint is configured, try posting FormData
  if (API_BASE_URL) {
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("role", role)

      const res = await fetch(`${API_BASE_URL}/api/documents/upload`, {
        method: "POST",
        body: formData,
      })

      if (res.ok) {
        return (await res.json()) as UploadFileResponse
      }
    } catch {
      // Fallback to simulated lifecycle
    }
  }

  // Realistic mock simulation calculating realistic chunk count from file size
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
          role,
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

/**
 * 2. Generate contract:
 *    JSON payload will include: { target_file_id: string, prompt: string }
 */
export async function generateRevisionsApi(
  payload: GenerateRevisionsPayload,
  targetFileName?: string,
  referenceFileNames: string[] = []
): Promise<GenerateRevisionsResponse> {
  const startTime = performance.now()

  // If a live backend endpoint is configured, try posting JSON
  if (API_BASE_URL) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/revisions/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const data = await res.json()
        return data as GenerateRevisionsResponse
      }
    } catch {
      // Fallback to simulated generator
    }
  }

  // Simulated revision engine synthesizing target draft with reference documents
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

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
