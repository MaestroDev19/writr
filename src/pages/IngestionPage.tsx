import { Database, UploadCloud, FileCode2, Check } from "lucide-react"

export default function IngestionPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Pipeline
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary">
            <Database className="size-3" />
            Vector & Document Store
          </span>
        </div>
        <h1 className="text-3xl font-normal tracking-tight sm:text-4xl">
          Data <span className="font-semibold text-primary">Ingestion</span>
        </h1>
        <p className="max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
          Upload reference manuscripts, research papers, archives, and style corpora for embeddings and RAG retrieval.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border-2 border-dashed border-border p-8 text-center bg-card/40">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
          <UploadCloud className="size-6" />
        </div>
        <h3 className="mt-4 text-sm font-semibold text-foreground">
          Upload reference documents
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Drag & drop PDF, DOCX, TXT or Markdown files (up to 50MB each)
        </p>
        <button
          type="button"
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 cursor-pointer shadow-xs"
        >
          Select Files
        </button>
      </div>

      <div className="mt-8 rounded-2xl border border-border p-6 bg-card text-card-foreground">
        <h2 className="text-base font-semibold">Indexed Sources</h2>
        <div className="mt-4 divide-y divide-border text-xs">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <FileCode2 className="size-4 text-primary" />
              <div>
                <p className="font-medium text-foreground">
                  woolf_modern_fiction_1919.md
                </p>
                <p className="text-[11px] text-muted-foreground">14.2 KB • Chunk size: 512</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary">
              <Check className="size-3" />
              Indexed
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <FileCode2 className="size-4 text-primary" />
              <div>
                <p className="font-medium text-foreground">
                  narrative_structure_notes.pdf
                </p>
                <p className="text-[11px] text-muted-foreground">2.1 MB • Chunk size: 512</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary">
              <Check className="size-3" />
              Indexed
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
