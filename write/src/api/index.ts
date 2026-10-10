import {
  uploadDocument,
  uploadDocuments,
  uploadLink,
  uploadText,
  getUploadStatus,
} from "./endpoints/upload"
import {
  deleteLibraryDocument,
  getActiveUpload,
  listLibrary,
} from "./endpoints/library"
import {
  getMySettings,
  saveCritiqueSetting,
  saveGenerateSetting,
  type WorkflowSettingUpdate,
} from "./endpoints/setting"
import { critiqueAgent, writeAgent } from "./endpoints/agents"

/** Spread into `useQuery({ ...queryApiHelper(...) })`. */
export function queryApiHelper<T>(
  queryKey: readonly unknown[],
  queryFn: (...args: any[]) => Promise<T>
) {
  return { queryKey, queryFn }
}

/** Spread into `useMutation({ ...mutationApiHelper(...) })`. */
export function mutationApiHelper<TData, TVariables = void>(
  mutationKey: readonly unknown[],
  mutationFn: (variables: TVariables) => Promise<TData>
) {
  return { mutationKey, mutationFn }
}

export const uploadTextMutation = mutationApiHelper(
  ["upload", "text"],
  (text: string) => uploadText(text)
)

export const uploadDocumentMutation = mutationApiHelper(
  ["upload", "document"],
  (file: File) => uploadDocument(file)
)

export const uploadDocumentsMutation = mutationApiHelper(
  ["upload", "documents"],
  (files: File[]) => uploadDocuments(files)
)

export const uploadLinkMutation = mutationApiHelper(
  ["upload", "link"],
  (url: string) => uploadLink(url)
)

export const deleteLibraryDocumentMutation = mutationApiHelper(
  ["upload", "library", "delete"],
  (documentId: string) => deleteLibraryDocument(documentId)
)

/** Persisted notes from ``reference_documents``. */
export const libraryQuery = queryApiHelper(
  ["upload", "library"] as const,
  () => listLibrary()
)

/** In-flight upload job for form lock after refresh. */
export const activeUploadQuery = queryApiHelper(
  ["upload", "active"] as const,
  () => getActiveUpload()
)

/** Poll one upload job. Key includes the id so each job has its own cache entry. */
export function uploadStatusQuery(jobId: string) {
  return queryApiHelper(
    ["upload", "status", jobId] as const,
    () => getUploadStatus(jobId)
  )
}

export const mySettingsQuery = queryApiHelper(
  ["mySetting"] as const,
  () => getMySettings()
)

export const saveGenerateSettingMutation = mutationApiHelper(
  ["mySetting", "generate"],
  (setting: WorkflowSettingUpdate) => saveGenerateSetting(setting)
)

export const saveCritiqueSettingMutation = mutationApiHelper(
  ["mySetting", "critique"],
  (setting: WorkflowSettingUpdate) => saveCritiqueSetting(setting)
)


export const writeAgentMutation = mutationApiHelper(
  ["agents", "write"],
  (content: string) => writeAgent(content)
)

export const critiqueAgentMutation = mutationApiHelper(
  ["agents", "critique"],
  (content: string) => critiqueAgent(content)
)
export {
  MAX_DOCUMENTS_PER_UPLOAD,
  MAX_REFERENCE_DOCUMENTS_PER_USER,
} from "./limits"
