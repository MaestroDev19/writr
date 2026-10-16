export type NoteStatus = "ready" | "failed" | "ingesting"
export type NoteSourceType = "file" | "paste" | "link"

export interface LibraryNote {
  id: string
  title: string
  sourceType: NoteSourceType
  sourceLabel: string
  status: NoteStatus
  shaShort: string
  errorMessage?: string
  createdAt: string
}

export type IngestStage =
  | "idle"
  | "reading"
  | "chunking"
  | "embedding"
  | "saving"
  | "done"

export interface IngestProgressState {
  stage: IngestStage
  embeddingCurrent?: number
  embeddingTotal?: number
  percent: number
  noteTitle?: string
}

export interface SearchHit {
  id: string
  noteId: string
  noteTitle: string
  snippet: string
  ordinal: number
  score?: number
}

export type SetupStepId = "ollama" | "model" | "database"

export type SetupStepStatus = "pending" | "active" | "done" | "error"

export interface SetupStep {
  id: SetupStepId
  label: string
  status: SetupStepStatus
  detail?: string
  progress?: number
}
