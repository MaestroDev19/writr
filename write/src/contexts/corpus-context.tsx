/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { uploadFileApi } from "@/lib/api-client"
import { formatFileSize } from "@/lib/format-file-size"
import type { NoteSource, ReferenceDocumentItem } from "@/types/document-roles"

interface CorpusContextType {
  referenceDocuments: ReferenceDocumentItem[]
  isEmbedding: boolean
  totalChunks: number
  totalFiles: number
  addReferenceFiles: (files: File[]) => void
  addReferenceEntry: (entry: { name: string; size: string; source: Exclude<NoteSource, "file"> }) => void
  deleteReferenceDocument: (id: string) => void
  reindexAll: () => void
}

const CorpusContext = React.createContext<CorpusContextType | undefined>(undefined)

export function CorpusProvider({ children }: { children: React.ReactNode }) {
  const [referenceDocuments, setReferenceDocuments] = React.useState<ReferenceDocumentItem[]>([])

  const isEmbedding = referenceDocuments.some(
    (d) => d.embeddingStatus === "embedding" || d.embeddingStatus === "queued"
  )

  const totalChunks = referenceDocuments
    .filter((d) => d.embeddingStatus === "ready")
    .reduce((acc, d) => acc + d.chunks, 0)

  const totalFiles = referenceDocuments.length

  const addReferenceFiles = React.useCallback((files: File[]) => {
    if (files.length === 0) return

    const newDocs: ReferenceDocumentItem[] = files.map((file, idx) => ({
      id: `ref-${Date.now()}-${idx}`,
      file,
      name: file.name,
      size: formatFileSize(file.size),
      role: "reference",
      uploadedAt: new Date(),
      embeddingStatus: "embedding",
      embeddingProgress: 10,
      chunks: Math.max(12, Math.round(file.size / 800)),
      isStale: false,
    }))

    setReferenceDocuments((prev) => [...newDocs, ...prev])

    // Kick off vector embedding pipeline for each reference document
    newDocs.forEach((doc) => {
      if (doc.file) {
        uploadFileApi(doc.file, "reference", (progress) => {
          setReferenceDocuments((prev) =>
            prev.map((d) =>
              d.id === doc.id
                ? {
                    ...d,
                    embeddingProgress: progress,
                    embeddingStatus: progress >= 100 ? "ready" : "embedding",
                  }
                : d
            )
          )
        }).then((res) => {
          setReferenceDocuments((prev) =>
            prev.map((d) =>
              d.id === doc.id
                ? {
                    ...d,
                    id: res.id,
                    chunks: res.chunks,
                    embeddingProgress: 100,
                    embeddingStatus: "ready",
                  }
                : d
            )
          )
        })
      }
    })
  }, [])

  const addReferenceEntry = React.useCallback(
    (entry: { name: string; size: string; source: Exclude<NoteSource, "file"> }) => {
      const doc: ReferenceDocumentItem = {
        id: `ref-${Date.now()}`,
        name: entry.name,
        size: entry.size,
        role: "reference",
        source: entry.source,
        uploadedAt: new Date(),
        embeddingStatus: "queued",
        embeddingProgress: 0,
        chunks: 0,
        isStale: false,
      }
      setReferenceDocuments((prev) => [doc, ...prev])
    },
    []
  )

  const deleteReferenceDocument = React.useCallback((id: string) => {
    setReferenceDocuments((prev) => prev.filter((d) => d.id !== id))
  }, [])

  const reindexAll = React.useCallback(() => {
    setReferenceDocuments((prev) =>
      prev.map((d) => ({
        ...d,
        embeddingStatus: "embedding",
        embeddingProgress: 20,
      }))
    )

    setTimeout(() => {
      setReferenceDocuments((prev) =>
        prev.map((d) => ({
          ...d,
          embeddingProgress: 60,
        }))
      )
    }, 400)

    setTimeout(() => {
      setReferenceDocuments((prev) =>
        prev.map((d) => ({
          ...d,
          embeddingProgress: 100,
          embeddingStatus: "ready",
          isStale: false,
        }))
      )
    }, 900)
  }, [])

  const value = React.useMemo(
    () => ({
      referenceDocuments,
      isEmbedding,
      totalChunks,
      totalFiles,
      addReferenceFiles,
      addReferenceEntry,
      deleteReferenceDocument,
      reindexAll,
    }),
    [
      referenceDocuments,
      isEmbedding,
      totalChunks,
      totalFiles,
      addReferenceFiles,
      addReferenceEntry,
      deleteReferenceDocument,
      reindexAll,
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
