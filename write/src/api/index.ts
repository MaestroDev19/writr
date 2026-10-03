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

export const getUploadStatusQuery = queryApiHelper(
  ["upload", "status"],
  (job_id: string) => getUploadStatus(job_id)
)
