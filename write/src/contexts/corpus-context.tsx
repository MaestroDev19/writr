/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  activeUploadQuery,
  deleteLibraryDocumentMutation,
  libraryQuery,
  MAX_REFERENCE_DOCUMENTS_PER_USER,
} from "@/api"
import type { LibraryDocument } from "@/api/endpoints/library"
import { useAuth } from "@/contexts/auth-context"
import type {
  EmbeddingStatus,
  NoteSource,
  ReferenceDocumentItem,
} from "@/types/document-roles"

interface CorpusContextType {
  referenceDocuments: ReferenceDocumentItem[]
  isEmbedding: boolean
  isLoading: boolean
  totalChunks: number
  totalFiles: number
  libraryLimit: number
  remainingSlots: number
  /** In-flight upload job id from the server (survives refresh). */
  activeJobId: string | null
  activeJobStatus: string | null
  refreshLibrary: () => Promise<void>
  deleteReferenceDocument: (id: string) => Promise<void>
  isDeleting: boolean
}

const CorpusContext = React.createContext<CorpusContextType | undefined>(undefined)

function mapEmbeddingStatus(status: string | undefined): EmbeddingStatus {
  switch (status) {
    case "completed":
      return "ready"
    case "processing":
      return "embedding"
    case "failed":
      return "error"
    case "pending":
      return "queued"
    default:
      return "idle"
  }
}

function inferSource(name: string): NoteSource | undefined {
  const lower = name.toLowerCase()
  if (lower.startsWith("untitled text") || lower.startsWith("pasted note")) {
    return "text"
  }
  if (lower.startsWith("untitled url") || /^https?:\/\//i.test(name)) {
    return "link"
  }
  return "file"
}

function mapLibraryDocument(doc: LibraryDocument): ReferenceDocumentItem {
  const embeddingStatus = mapEmbeddingStatus(doc.embedding_status)
  return {
    id: doc.id,
    name: doc.name || "Untitled note",
    size: doc.chunk_count > 0 ? `${doc.chunk_count} sections` : "Preparing",
    role: "reference",
    source: inferSource(doc.name || ""),
    uploadedAt: doc.created_at ? new Date(doc.created_at) : new Date(),
    embeddingStatus,
    embeddingProgress:
      embeddingStatus === "ready" ? 100 : embeddingStatus === "embedding" ? 55 : 10,
    chunks: doc.chunk_count || 0,
    isStale: false,
    error: embeddingStatus === "error" ? "Could not prepare this note." : undefined,
  }
}

export function CorpusProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()

  const library = useQuery({
    ...libraryQuery,
    enabled: isAuthenticated,
  })

  const activeUpload = useQuery({
    ...activeUploadQuery,
    enabled: isAuthenticated,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === "queued" || status === "running") return 2000
      // Keep a slow poll so a refresh mid-job still unlocks when work finishes.
      return false
    },
  })

  const deleteMutation = useMutation({
    ...deleteLibraryDocumentMutation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: libraryQuery.queryKey })
    },
  })

  const referenceDocuments = React.useMemo(
    () => (library.data?.documents ?? []).map(mapLibraryDocument),
    [library.data?.documents]
  )

  const libraryLimit = library.data?.limit ?? MAX_REFERENCE_DOCUMENTS_PER_USER
  const totalFiles = library.data?.count ?? referenceDocuments.length
  const remainingSlots = Math.max(0, libraryLimit - totalFiles)

  const isEmbedding =
    activeUpload.data?.status === "queued" ||
    activeUpload.data?.status === "running" ||
    referenceDocuments.some(
      (d) => d.embeddingStatus === "embedding" || d.embeddingStatus === "queued"
    )

  const totalChunks = referenceDocuments
    .filter((d) => d.embeddingStatus === "ready")
    .reduce((acc, d) => acc + d.chunks, 0)

  const refreshLibrary = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: libraryQuery.queryKey }),
      queryClient.invalidateQueries({ queryKey: activeUploadQuery.queryKey }),
    ])
  }, [queryClient])

  const deleteReferenceDocument = React.useCallback(
    async (id: string) => {
      await deleteMutation.mutateAsync(id)
    },
    [deleteMutation]
  )

  const value = React.useMemo(
    () => ({
      referenceDocuments,
      isEmbedding,
      isLoading: library.isLoading,
      totalChunks,
      totalFiles,
      libraryLimit,
      remainingSlots,
      activeJobId: activeUpload.data?.job_id ?? null,
      activeJobStatus: activeUpload.data?.status ?? null,
      refreshLibrary,
      deleteReferenceDocument,
      isDeleting: deleteMutation.isPending,
    }),
    [
      referenceDocuments,
      isEmbedding,
      library.isLoading,
      totalChunks,
      totalFiles,
      libraryLimit,
      remainingSlots,
      activeUpload.data?.job_id,
      activeUpload.data?.status,
      refreshLibrary,
      deleteReferenceDocument,
      deleteMutation.isPending,
    ]
  )

  return (
    <CorpusContext.Provider value={value}>
      {children}
    </CorpusContext.Provider>
  )
}

export function useCorpus(): CorpusContextType {
  const context = React.useContext(CorpusContext)
  if (!context) {
    throw new Error("useCorpus must be used within a CorpusProvider")
  }
  return context
}
