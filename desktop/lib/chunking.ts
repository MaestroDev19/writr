import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";


const DEFAULT_CHUNK_SIZE = 1000
const DEFAULT_CHUNK_OVERLAP = 150
const DEFAULT_MIN_CHUNK_CHARS = 40

export interface ChunkResult {
    chunkIndex: number
    content: string
    charCount: number
    metadata: {
        documentId: string
        documentTitle?: string
        chunkIndex: number
        totalChunks?: number
        [key: string]: unknown
    }
}

export interface ChunkOptions {
    chunkSize?: number
    chunkOverlap?: number
    minChunkChars?: number
}


function normalizeText(rawText: string): string {
    if (!rawText) return "";
    let text = rawText.normalize("NFKC")
    text = text.replace(/\r\n?|\r/g, "\n")
    text = text.replace(/\f+/g, "\n\n")
    text = text.replace(/[\u0000-\u0008\u000B\u000E-\u001F\u007F]/g, "")
    text = text.replace(/[\u200B-\u200D\uFEFF\u2060\u00AD]/g, "")
    text = text.replace(/([a-zA-Z])- *\n([a-zA-Z])/g, "$1$2")
    text = text.replace(/[^\S\r\n]+/g, " ")
    text = text.replace(/ +\n/g, "\n")
    text = text.replace(/\n{3,}/g, "\n\n")
    return text.trim()
}

export async function chunkDocument(
    text: string,
    docMeta: { documentId: string; documentTitle?: string;[key: string]: unknown },
    options?: ChunkOptions
): Promise<ChunkResult[]> {
    const normalizedText = normalizeText(text)
    if (!normalizedText) return []

    const safeOptions: Required<ChunkOptions> = {
        chunkSize: options?.chunkSize ?? DEFAULT_CHUNK_SIZE,
        chunkOverlap: options?.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP,
        minChunkChars: options?.minChunkChars ?? DEFAULT_MIN_CHUNK_CHARS,
    }

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: safeOptions.chunkSize,
        chunkOverlap: safeOptions.chunkOverlap,
        separators: ["\n\n", "\n", ". ", "? ", "! ", "; ", " ", ""],
    })

    const rawChunks = await splitter.splitText(normalizedText)
    const validChunks = rawChunks
        .map((c) => c.trim())
        .filter((c) => c.length >= safeOptions.minChunkChars)

    return validChunks.map((content, index) => ({
        chunkIndex: index,
        content,
        charCount: content.length,
        metadata: {
            ...docMeta,
            chunkIndex: index,
            totalChunks: validChunks.length,
        },
    }))
}