import { api } from "@/lib/axios"

export type EnqueuedUpload = {
  job_id: string
  status: string
}

/** Backend expects form fields, not JSON. */
function formBody(fields: Record<string, string>): FormData {
  const body = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    body.append(key, value)
  }
  return body
}

export const uploadText = async (text: string): Promise<EnqueuedUpload> => {
  const response = await api.post<EnqueuedUpload>("/upload/text", formBody({ text }))
  return response.data
}

export const uploadDocument = async (file: File): Promise<EnqueuedUpload> => {
  const body = new FormData()
  body.append("file", file)
  const response = await api.post<EnqueuedUpload>("/upload/document", body)
  return response.data
}

export const uploadDocuments = async (files: File[]): Promise<EnqueuedUpload> => {
  const body = new FormData()
  for (const file of files) {
    body.append("files", file)
  }
  const response = await api.post<EnqueuedUpload>("/upload/documents", body)
  return response.data
}

export const uploadLink = async (url: string): Promise<EnqueuedUpload> => {
  const response = await api.post<EnqueuedUpload>("/upload/link", formBody({ url }))
  return response.data
}