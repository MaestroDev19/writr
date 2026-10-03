import { api } from "@/lib/axios"

export type LibraryDocument = {
  id: string
  name: string
  chunk_count: number
  embedding_status: string
  created_at: string
}

export type ReferenceLibrary = {
  documents: LibraryDocument[]
  count: number
  limit: number
}

export type EnqueuedUpload = {
  job_id: string
  status: string
}

export const listLibrary = async (): Promise<ReferenceLibrary> => {
  const response = await api.get<ReferenceLibrary>("/upload/library")
  return response.data
}

export const deleteLibraryDocument = async (documentId: string): Promise<void> => {
  await api.delete(`/upload/library/${documentId}`)
}

/** In-flight upload job for this account, or null when idle. */
export const getActiveUpload = async (): Promise<EnqueuedUpload | null> => {
  const response = await api.get<{ job_id: string | null; status: string | null }>(
    "/upload/active"
  )
  const data = response.data
  if (!data?.job_id || !data.status) return null
  return { job_id: data.job_id, status: data.status }
}
