import { Readability } from "@mozilla/readability"
import { load } from "cheerio"
import { extractText, getDocumentProxy } from "unpdf"
import { isTauri } from "./tauri"
import { invoke } from "@tauri-apps/api/core"

export const TARGET_FILE_ACCEPT = ".txt,.md,.docx,.pdf"

export const TARGET_FILE_TYPES_LABEL = "Text, Markdown, Word, or PDF"

const TARGET_EXTENSIONS = new Set(["txt", "md", "docx", "pdf"])


const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB
const MAX_CHARS = 2_000_000 // guard against pathological post-parse expansion

/** Human-readable byte size for uploads and file lists. */
function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getExtension(name: string): string {
    const dot = name.lastIndexOf(".")
    if (dot <= 0 || dot === name.length - 1) return ""
    return name.slice(dot + 1).toLowerCase()
}

export async function assertTargetDraftFile(file: File): Promise<void> {
    const extension = getExtension(file.name)
    if (!TARGET_EXTENSIONS.has(extension)) {
        throw new Error("Use a .txt, .md, .docx, or .pdf file.")
    }
    if (file.size === 0) {
        throw new Error("That file is empty.")
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new Error(
            `That file is too large (${formatFileSize(file.size)}). Book files must be ${formatFileSize(MAX_FILE_SIZE_BYTES)} or smaller.`
        )
    }
}


export async function fileHandler(file: File): Promise<string> {
    assertTargetDraftFile(file)
    const extension = getExtension(file.name)
    let cleanText: string = ""
    if (extension === "txt" || extension === "md") cleanText = (await file.text()).trim()
    else if (extension === "docx") {
        const mammoth = await import("mammoth")
        const extractRawText = mammoth.extractRawText ?? mammoth.default?.extractRawText
        if (!extractRawText) throw new Error("Could not load Word file.")
        const arrayBuffer = await file.arrayBuffer()
        const result = await extractRawText({ arrayBuffer })
        cleanText = result.value.trim()
    }
    else if (extension === "pdf") {
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer))
        const { text } = await extractText(pdf, { mergePages: true })
        cleanText = text.trim()
    }
    if (!cleanText) throw new Error("No text found in file.")
    if (cleanText.length > MAX_CHARS) {
        throw new Error(
            `The document contains ${cleanText.length.toLocaleString()} characters. Files must be under ${MAX_CHARS.toLocaleString()} characters to be safely processed.`
        )
    }
    return cleanText
}

export async function readDocumentFromPath(path: string): Promise<string> {
    const extension = getExtension(path)
    if (!TARGET_EXTENSIONS.has(extension)) {
        throw new Error("Use a .txt, .md, .docx, or .pdf file.")
    }

    if (!isTauri()) {
        throw new Error("Local file reading requires desktop runtime.")
    }

    let cleanText = ""
    if (extension === "txt" || extension === "md") {
        cleanText = (await invoke<string>("read_file_text", { path })).trim()
    } else if (extension === "docx") {
        const bytes = await invoke<number[]>("read_file_bytes", { path })
        const u8 = new Uint8Array(bytes)
        const arrayBuffer = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength)
        const mammoth = await import("mammoth")
        const extractRawText = mammoth.extractRawText ?? mammoth.default?.extractRawText
        if (!extractRawText) throw new Error("Could not load Word file.")
        const result = await extractRawText({ arrayBuffer })
        cleanText = result.value.trim()
    } else if (extension === "pdf") {
        const bytes = await invoke<number[]>("read_file_bytes", { path })
        const u8 = new Uint8Array(bytes)
        const pdf = await getDocumentProxy(u8)
        const { text } = await extractText(pdf, { mergePages: true })
        cleanText = text.trim()
    }

    if (!cleanText) throw new Error("File is empty or contains no readable text.")
    if (cleanText.length > MAX_CHARS) {
        throw new Error(
            `The document contains ${cleanText.length.toLocaleString()} characters. Files must be under ${MAX_CHARS.toLocaleString()} characters to be safely processed.`
        )
    }

    return cleanText
}

export interface ExtractedArticle {
    title: string
    textContent: string
    excerpt?: string
    byline?: string
    siteName?: string
    url: string
    length: number
}

export interface ExtractArticleOptions {
    /** Request timeout in milliseconds (default: 15_000) */
    timeoutMs?: number
    /** Minimum character count for article content to be considered valid (default: 50) */
    minChars?: number
    /** Custom headers to send with the request */
    headers?: Record<string, string>
}

/** Fallback extraction using Cheerio when DOMParser is unavailable or Readability returns empty */
function extractWithCheerio(html: string): { title: string; textContent: string } {
    const $ = load(html)
    // Strip script, style, and navigation noise
    $("script, style, noscript, iframe, svg, nav, footer, header, aside, form").remove()

    const title =
        $('meta[property="og:title"]').attr("content")?.trim() ||
        $('meta[name="twitter:title"]').attr("content")?.trim() ||
        $("title").text().trim() ||
        ""

    const contentContainer = $("article, [role='main'], main")
    const target = contentContainer.length > 0 ? contentContainer : $("body")

    const textContent = target
        .text()
        .replace(/[ \t]+/g, " ")
        .replace(/\n\s*\n+/g, "\n\n")
        .trim()

    return { title, textContent }
}

function assertValidHttpUrl(url: string): URL {
    try {
        const parsed = new URL(url)
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            throw new Error("Invalid URL protocol. Only http: and https: URLs are supported.")
        }
        return parsed
    } catch (err) {
        if (err instanceof Error && err.message.includes("protocol")) throw err
        throw new Error(`Invalid URL "${url}". Please provide a full web address (e.g., https://example.com/article).`)
    }
}

/**
 * Fetches and parses an article from a URL using @mozilla/readability with Cheerio fallback.
 * Includes timeout safeguards, content-type validation, and character limits.
 */
export async function extractArticle(
    url: string,
    options?: ExtractArticleOptions
): Promise<ExtractedArticle> {
    const parsedUrl = assertValidHttpUrl(url)
    const timeoutMs = options?.timeoutMs ?? 15_000
    const minChars = options?.minChars ?? 50

    let html: string
    if (isTauri()) {
        try {
            html = await invoke<string>("fetch_url", { url: parsedUrl.toString() })
        } catch (err) {
            throw new Error(`Network error while fetching ${url}: ${err instanceof Error ? err.message : String(err)}`)
        }
    } else {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

        let response: Response
        try {
            response = await fetch(parsedUrl.toString(), {
                signal: controller.signal,
                headers: {
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                    ...options?.headers,
                },
            })
        } catch (err) {
            if (err instanceof Error && err.name === "AbortError") {
                throw new Error(`Request timed out after ${timeoutMs}ms while fetching ${url}.`)
            }
            throw new Error(`Network error while fetching ${url}: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
            clearTimeout(timeoutId)
        }

        if (!response.ok) {
            throw new Error(`Failed to fetch article: HTTP ${response.status} ${response.statusText}`)
        }

        const contentType = response.headers.get("content-type") || ""
        if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
            throw new Error(`Unsupported content type "${contentType}". Expected an HTML article.`)
        }

        html = await response.text()
    }

    if (!html.trim()) {
        throw new Error("The fetched webpage was empty.")
    }

    let title = ""
    let textContent = ""
    let excerpt: string | undefined
    let byline: string | undefined
    let siteName: string | undefined

    // 1. Primary parser: @mozilla/readability (W3C DOM in browser/webview)
    if (typeof DOMParser !== "undefined") {
        try {
            const doc = new DOMParser().parseFromString(html, "text/html")
            const reader = new Readability(doc)
            const article = reader.parse()
            if (article) {
                title = article.title?.trim() ?? ""
                textContent = article.textContent?.trim() ?? ""
                excerpt = article.excerpt?.trim() || undefined
                byline = article.byline?.trim() || undefined
                siteName = article.siteName?.trim() || undefined
            }
        } catch {
            // Fall through to Cheerio fallback if DOMParser/Readability fails
        }
    }

    // 2. Fallback parser: Cheerio (in Node or if Readability couldn't isolate the main content)
    if (!textContent) {
        const fallback = extractWithCheerio(html)
        title = title || fallback.title
        textContent = fallback.textContent
    }

    if (!textContent || textContent.length < minChars) {
        throw new Error(
            "Could not extract article content. The webpage might require JavaScript or has insufficient text content."
        )
    }

    if (textContent.length > MAX_CHARS) {
        throw new Error(
            `The extracted article contains ${textContent.length.toLocaleString()} characters. Content must be under ${MAX_CHARS.toLocaleString()} characters.`
        )
    }

    return {
        title: title || parsedUrl.hostname,
        textContent,
        excerpt,
        byline,
        siteName,
        url: parsedUrl.toString(),
        length: textContent.length,
    }
}

/** Convenience wrapper returning plain text content for compatibility */
export async function extractArticleText(
    url: string,
    options?: ExtractArticleOptions
): Promise<string> {
    const article = await extractArticle(url, options)
    return article.textContent
}


export function acceptText(text: string): string {
    if (text.length > MAX_CHARS) {
        throw new Error(`The extracted article contains ${text.length.toLocaleString()} characters. Content must be under ${MAX_CHARS.toLocaleString()} characters.`)
    }
    return text.trim()
}