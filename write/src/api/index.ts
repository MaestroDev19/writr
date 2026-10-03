import {
  uploadDocument,
  uploadDocuments,
  uploadLink,
  uploadText,
  getUploadStatus,
} from "./endpoints/upload"

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

/** Poll one upload job. Key includes the id so each job has its own cache entry. */
export function uploadStatusQuery(jobId: string) {
  return queryApiHelper(
    ["upload", "status", jobId] as const,
    () => getUploadStatus(jobId)
  )
}
