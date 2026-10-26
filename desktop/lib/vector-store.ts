import { embedQuery, embedDocuments } from "./embeddings"
import { fileHandler, acceptText, extractArticle, readDocumentFromPath } from "./document-loader"
import { isTauri } from "./tauri"
import { chunkDocument, type ChunkOptions } from "./chunking"
import { invoke } from "@tauri-apps/api/core"
import { getUserProfile, getCurrentUserId } from "./supabase"
import type { IngestProgressState, SearchHit } from "@/types/library"
import { Document } from "@langchain/core/documents"

export interface StoredDocument {
    id: string
    ownerId: string
    name: string
    chunkCount: number
    createdAt?: string
}


export interface HybridSearchResultChunk {
    id: number
    documentId: string
    documentName: string
    ownerId: string
    chunkIndex: number
    content: string
    metadata: Record<string, unknown>
    score: number
}

interface ChunkInputPayload {
    document_id: string
    owner_id?: string
    chunk_index: number
    content: string
    embedding: number[]
    metadata?: Record<string, unknown>
}

export class VectorStore {
    ownerId?: string
    chunkOptions?: ChunkOptions
    searchDefault?: { limit?: number; rrfK?: number }

    constructor(ownerId?: string, chunkOptions?: ChunkOptions, searchDefault?: { limit?: number; rrfK?: number }) {
        this.ownerId = ownerId
        this.chunkOptions = chunkOptions
        this.searchDefault = searchDefault
    }


    /**
     * Resolves the authenticated owner ID synchronously with 0 network calls.
     * Uses local in-memory auth state that automatically updates on login/logout.
     *
     * @param explicitOwnerId Optional owner ID to assert against the active session.
     */
    getOwnerId(explicitOwnerId?: string): string {
        const activeUserId = this.ownerId ?? getCurrentUserId()
        if (!activeUserId) {
            throw new Error("Authentication required: Please log in to access your personal vector store.")
        }

        if (explicitOwnerId && explicitOwnerId !== activeUserId) {
            throw new Error(
                `Unauthorized owner access: Active session is '${activeUserId}', but '${explicitOwnerId}' was requested.`
            )
        }

        if (this.ownerId && this.ownerId !== activeUserId) {
            this.ownerId = activeUserId
        } else if (!this.ownerId) {
            this.ownerId = activeUserId
        }

        return activeUserId
    }

    /**
     * Backward-compatible alias for getOwnerId.
     */
    async getValidatedOwnerId(explicitOwnerId?: string): Promise<string> {
        return this.getOwnerId(explicitOwnerId)
    }

    async _addChunks(
        text: string,
        documentName: string,
        extraMetadata?: Record<string, unknown>,
        onProgress?: (progress: IngestProgressState) => void
    ): Promise<StoredDocument> {
        onProgress?.({ stage: "chunking", percent: 30, noteTitle: documentName })
        const docID: string = crypto.randomUUID()
        const chunks = await chunkDocument(
            text,
            { documentId: docID, documentTitle: documentName, ...extraMetadata },
            this.chunkOptions
        )

        if (!chunks.length) {
            throw new Error("Document text was empty after normalization.")
        }

        onProgress?.({
            stage: "embedding",
            percent: 55,
            noteTitle: documentName,
            embeddingCurrent: 0,
            embeddingTotal: chunks.length,
        })

        const chunkContents = chunks.map((c) => c.content)
        const embeddings = await embedDocuments(chunkContents)

        onProgress?.({
            stage: "saving",
            percent: 85,
            noteTitle: documentName,
            embeddingCurrent: chunks.length,
            embeddingTotal: chunks.length,
        })

        if (!isTauri()) throw new Error("Not running in Tauri")

        // Enforce verified owner on shared PC synchronously with 0 API calls
        const ownerId = this.getOwnerId()

        const userProfile = await getUserProfile()

        const chunkPayloads: ChunkInputPayload[] = chunks.map((chunk, i) => ({
            document_id: docID,
            owner_id: ownerId,
            chunk_index: chunk.chunkIndex,
            content: chunk.content,
            embedding: embeddings[i],
            metadata: chunk.metadata,
        }))

        // 1. Mirror profile to local SQLite to satisfy foreign key (reference_documents.owner_id -> profiles.id)
        await invoke("upsert_user_profile", {
            id: ownerId,
            authorName: userProfile?.author_name ?? "Author",
            avatarUrl: userProfile?.avatar_url ?? null,
        })

        // 2. Insert parent reference document record
        await invoke("save_reference_document", {
            id: docID,
            ownerId,
            name: documentName,
            chunkCount: chunks.length,
        })

        // 3. Batch insert chunks (triggers auto-sync to FTS5 and sqlite-vec partitioned by owner)
        await invoke("save_reference_chunks", {
            chunks: chunkPayloads,
        })

        onProgress?.({
            stage: "done",
            percent: 100,
            noteTitle: documentName,
        })

        return {
            id: docID,
            ownerId,
            name: documentName,
            chunkCount: chunks.length,
            createdAt: new Date().toISOString(),
        }
    }

    async addDocuments(
        document: unknown,
        name?: string,
        metadata?: Record<string, unknown>,
        onProgress?: (progress: IngestProgressState) => void
    ): Promise<StoredDocument> {
        onProgress?.({ stage: "reading", percent: 15, noteTitle: name })

        let text: string | null = null
        let documentName = name ?? "Document"
        let extraMeta: Record<string, unknown> = { ...metadata }

        const isUrl = (val: string) => /^https?:\/\/[^\s]+$/i.test(val.trim())

        if (typeof document === "string") {
            const trimmed = document.trim()
            if (isUrl(trimmed)) {
                const article = await extractArticle(trimmed)
                text = article.textContent
                documentName = name ?? article.title ?? trimmed
                extraMeta = {
                    ...extraMeta,
                    sourceUrl: article.url,
                    siteName: article.siteName,
                    byline: article.byline,
                    sourceType: "web",
                }
            } else if (
                isTauri() &&
                (trimmed.includes("/") ||
                 trimmed.includes("\\") ||
                 /\.(txt|md|docx|pdf)$/i.test(trimmed))
            ) {
                text = await readDocumentFromPath(trimmed)
                const parts = trimmed.replace(/\\/g, "/").split("/")
                const filename = parts[parts.length - 1] || trimmed
                documentName = name ?? filename
                extraMeta = {
                    ...extraMeta,
                    sourcePath: trimmed,
                    sourceType: "file",
                }
            } else {
                text = acceptText(trimmed)
                documentName = name ?? "Pasted note"
                extraMeta = {
                    ...extraMeta,
                    sourceType: "paste",
                }
            }
        } else if (document instanceof File) {
            text = await fileHandler(document)
            documentName = name ?? document.name
            extraMeta = {
                ...extraMeta,
                sourceType: "file",
            }
        } else if (
            typeof document === "object" &&
            document !== null &&
            "path" in document &&
            typeof (document as { path: string }).path === "string"
        ) {
            const docObj = document as { path: string; name?: string; file?: File }
            if (docObj.file instanceof File) {
                text = await fileHandler(docObj.file)
                documentName = name ?? docObj.name ?? docObj.file.name
            } else {
                text = await readDocumentFromPath(docObj.path)
                const parts = docObj.path.replace(/\\/g, "/").split("/")
                const filename = parts[parts.length - 1] || docObj.path
                documentName = name ?? docObj.name ?? filename
            }
            extraMeta = {
                ...extraMeta,
                sourcePath: docObj.path,
                sourceType: "file",
            }
        }

        if (!text) {
            throw new Error("No readable text could be extracted from the document.")
        }

        return await this._addChunks(text, documentName, extraMeta, onProgress)
    }

    async addTexts(
        text: string,
        title?: string,
        extraMetadata?: Record<string, unknown>,
        onProgress?: (progress: IngestProgressState) => void
    ) {
        onProgress?.({ stage: "reading", percent: 15, noteTitle: title })
        const cleanText = acceptText(text)
        if (!cleanText) throw new Error("No text provided after normalization")
        const docTitle = title?.trim() || `Note ${new Date().toLocaleDateString()}`
        return this._addChunks(
            cleanText,
            docTitle,
            { sourceType: "paste", ...extraMetadata },
            onProgress
        )
    }

    /**
     * Performs a hybrid semantic & keyword similarity search filtered strictly
     * to the authenticated owner's private documents and chunks.
     *
     * @param query The search query string
     */
    async similaritySearch(
        query: string,

    ): Promise<HybridSearchResultChunk[]> {
        const trimmedQuery = query.trim()
        if (!trimmedQuery) return []

        if (!isTauri()) {
            throw new Error("Not running in Tauri: Hybrid search requires desktop runtime.")
        }

        const effectiveLimit = this.searchDefault?.limit ?? 5
        const effectiveRrfK = this.searchDefault?.rrfK ?? 60

        // Strictly enforce that queries are isolated to the authenticated user on this PC (synchronous, 0 API calls)
        const ownerId = this.getOwnerId()

        // Generate embedding vector for the search query
        const embedding = await embedQuery(trimmedQuery)

        // Run hybrid search combining FTS5 keyword BM25 and sqlite-vec KNN in the user's partition
        const rawResults = await invoke<Array<{
            id: number
            document_id: string
            document_name: string
            owner_id: string
            chunk_index: number
            content: string
            metadata: string
            score: number
        }>>("hybrid_search_chunks", {
            queryText: trimmedQuery,
            queryEmbedding: embedding,
            limit: effectiveLimit,
            ownerId,
            rrfK: effectiveRrfK,
        })

        const mapped: HybridSearchResultChunk[] = rawResults.map((r) => {
            let parsedMetadata: Record<string, unknown> = {}
            if (r.metadata) {
                try {
                    parsedMetadata = JSON.parse(r.metadata)
                } catch {
                    parsedMetadata = {}
                }
            }
            return {
                id: r.id,
                documentId: r.document_id,
                documentName: r.document_name,
                ownerId: r.owner_id,
                chunkIndex: r.chunk_index,
                content: r.content,
                metadata: parsedMetadata,
                score: r.score,
            }
        })


        return mapped
    }

    /**
     * Performs similarity search and formats results into SearchHit items suitable for the Library UI.
     */
    async searchHits(query: string, limit?: number): Promise<SearchHit[]> {
        if (limit) {
            this.searchDefault = { ...this.searchDefault, limit }
        }
        const hits = await this.similaritySearch(query)
        return hits.map((hit) => ({
            id: `${hit.documentId}-${hit.chunkIndex}`,
            noteId: hit.documentId,
            noteTitle: hit.documentName,
            snippet: hit.content,
            ordinal: hit.chunkIndex + 1,
            score: hit.score,
        }))
    }

    /**
     * Lists all reference documents belonging strictly to the currently authenticated user.
     */
    async listDocuments(): Promise<StoredDocument[]> {
        if (!isTauri()) return []
        const ownerId = this.getOwnerId()
        const rawDocs = await invoke<Array<{
            id: string
            owner_id: string
            name: string
            chunk_count: number
            created_at: string
        }>>("list_reference_documents", { ownerId })

        return rawDocs.map((d) => ({
            id: d.id,
            ownerId: d.owner_id,
            name: d.name,
            chunkCount: d.chunk_count,
            createdAt: d.created_at,
        }))
    }

    /**
     * Deletes a reference document and its chunks, verifying owner authorization.
     */
    async deleteDocument(documentId: string): Promise<boolean> {
        if (!isTauri()) return false
        const ownerId = this.getOwnerId()
        return await invoke<boolean>("delete_reference_document", {
            documentId,
            ownerId,
        })
    }

    asRetriever() {
        return {
            invoke: async (query: string): Promise<Document[]> => {
                const results = await this.similaritySearch(query)
                return results.map(
                    (chunk) =>
                        new Document({
                            id: String(chunk.id),
                            pageContent: chunk.content,
                            metadata: {
                                documentId: chunk.documentId,
                                documentName: chunk.documentName,
                                ownerId: chunk.ownerId,
                                chunkIndex: chunk.chunkIndex,
                                score: chunk.score,
                                ...chunk.metadata,
                            },
                        })
                )
            },
        }
    }

}