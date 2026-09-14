import { useState } from "react"
import { ImageUpload } from "@/components/image-upload"
import { ImageUploadModal } from "@/components/image-upload-modal"

export default function PlaygroundPage() {
  const [prompt, setPrompt] = useState("")
  const [response, setResponse] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [coverFile, setCoverFile] = useState<File | null>(null)

  const handleRun = () => {
    if (!prompt.trim()) return
    setIsLoading(true)
    setTimeout(() => {
      setResponse(
        `Simulation response for: "${prompt}"\n\nCommand R+ processed this prompt in 118ms using enterprise retrieval-augmented reasoning.`
      )
      setIsLoading(false)
    }, 600)
  }

  return (
    <div className="mx-auto max-w-5xl py-12 px-6">
      <div className="space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Studio
        </span>
        <h1 className="text-3xl font-medium tracking-tight">Playground (Dummy Page)</h1>
        <p className="text-sm text-neutral-500">
          Experiment with model generations and parameter settings.
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Left: Prompt & Response */}
        <div className="space-y-4 lg:col-span-2">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
              Input Prompt
            </label>
            <textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter a prompt to test the model..."
              className="w-full rounded-lg border border-neutral-300 bg-transparent p-3 text-sm outline-none transition focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-100"
            />
          </div>

          <button
            onClick={handleRun}
            disabled={isLoading || !prompt.trim()}
            className="rounded-full bg-neutral-900 px-6 py-2.5 text-xs font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {isLoading ? "Running..." : "Run Simulation"}
          </button>

          {response && (
            <div className="mt-6 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Model Output
              </div>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-neutral-800 dark:text-neutral-200">
                {response}
              </pre>
            </div>
          )}

          {/* Story Cover Image Upload using image-upload-shadcn pattern */}
          <div className="mt-8 rounded-xl border border-border bg-card p-5 text-card-foreground">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Story Cover & Manuscript Asset
                </h3>
                <p className="text-xs text-muted-foreground">
                  Upload an illustration or cover banner for your manuscript.
                </p>
              </div>
              <ImageUploadModal
                triggerText="Upload in Modal"
                title="Attach manuscript cover"
                description="Upload an illustration or banner for this story."
                onSave={(file) => setCoverFile(file)}
              />
            </div>
            <ImageUpload
              value={coverFile}
              onChange={setCoverFile}
              aspectRatio="video"
              title="Drag story cover image"
              description="Drop a banner illustration or click to browse files"
            />
          </div>
        </div>

        {/* Right: Dummy Parameters */}
        <div className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
            Parameters
          </h2>
          <div className="mt-4 space-y-4 text-xs">
            <div>
              <div className="flex justify-between font-medium text-neutral-600 dark:text-neutral-400">
                <span>Model</span>
                <span className="font-mono">command-r-plus</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between font-medium text-neutral-600 dark:text-neutral-400">
                <span>Temperature</span>
                <span className="font-mono">0.3</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between font-medium text-neutral-600 dark:text-neutral-400">
                <span>Max Tokens</span>
                <span className="font-mono">4096</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
