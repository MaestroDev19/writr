import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { CloudUpload, Image as ImageIcon, X, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "cn"

export interface ImageUploadProps {
  value?: File | string | null
  onChange?: (file: File | null) => void
  onUploadComplete?: (url: string) => void
  maxSizeMb?: number
  acceptedTypes?: string[]
  aspectRatio?: "video" | "square" | "wide" | "auto"
  title?: string
  description?: string
  disabled?: boolean
  className?: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function ImageUpload({
  value,
  onChange,
  onUploadComplete,
  maxSizeMb = 5,
  acceptedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"],
  aspectRatio = "video",
  title = "Drag an image",
  description = "Select an image or drag here to upload directly",
  disabled = false,
  className,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isFile = value instanceof File
  const isStringUrl = typeof value === "string"

  const previewUrl = useMemo(() => {
    if (isFile) {
      return URL.createObjectURL(value)
    }
    if (isStringUrl) {
      return value
    }
    return null
  }, [value, isFile, isStringUrl])

  useEffect(() => {
    return () => {
      if (isFile && previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [isFile, previewUrl])

  const validateFile = useCallback(
    (file: File): boolean => {
      if (!acceptedTypes.includes(file.type)) {
        setErrorMessage(`Unsupported format. Accepted: ${acceptedTypes.map((t) => t.replace("image/", "")).join(", ")}`)
        return false
      }
      if (file.size > maxSizeMb * 1024 * 1024) {
        setErrorMessage(`File too large. Maximum size is ${maxSizeMb}MB.`)
        return false
      }
      setErrorMessage(null)
      return true
    },
    [acceptedTypes, maxSizeMb]
  )

  const processFile = useCallback(
    (file: File) => {
      if (!validateFile(file)) return

      onChange?.(file)

      // Simulate upload progress feedback matching image-upload-shadcn
      setUploadProgress(0)
      let current = 0
      const interval = setInterval(() => {
        current += 20
        if (current >= 100) {
          clearInterval(interval)
          setUploadProgress(null)
          onUploadComplete?.(URL.createObjectURL(file))
        } else {
          setUploadProgress(current)
        }
      }, 80)
    },
    [onChange, onUploadComplete, validateFile]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        processFile(file)
      }
    },
    [processFile]
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!disabled) setIsDragging(true)
    },
    [disabled]
  )

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      if (disabled) return

      const file = e.dataTransfer.files?.[0]
      if (file) {
        processFile(file)
      }
    },
    [disabled, processFile]
  )

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onChange?.(null)
      setErrorMessage(null)
      setUploadProgress(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    },
    [onChange]
  )

  const handleContainerClick = useCallback(() => {
    if (!disabled && !previewUrl) {
      fileInputRef.current?.click()
    }
  }, [disabled, previewUrl])

  const aspectClasses = {
    video: "aspect-[16/9]",
    square: "aspect-square",
    wide: "aspect-[21/9]",
    auto: "min-h-56",
  }[aspectRatio]

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes.join(",")}
        className="sr-only"
        onChange={handleFileChange}
        disabled={disabled}
        aria-label="Upload file"
      />

      {previewUrl ? (
        <div
          className={cn(
            "group relative overflow-hidden rounded-xl border border-border bg-card shadow-xs",
            aspectClasses
          )}
        >
          <img
            src={previewUrl}
            alt="Uploaded preview"
            className="size-full object-cover"
          />

          <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

          <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="bg-background/90 text-xs shadow-xs backdrop-blur-sm hover:bg-background"
            >
              Replace
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="icon-xs"
              onClick={handleRemove}
              disabled={disabled}
              aria-label="Remove image"
              className="shadow-xs"
            >
              <X className="size-3.5" />
            </Button>
          </div>

          {isFile && (
            <div className="absolute bottom-3 inset-x-3 z-10 flex items-center justify-between rounded-lg bg-background/90 px-3 py-1.5 text-xs backdrop-blur-sm">
              <span className="truncate font-medium text-foreground">
                {value.name}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {formatBytes(value.size)}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={handleContainerClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer select-none",
            aspectClasses,
            isDragging
              ? "border-primary bg-primary/5 ring-4 ring-primary/10"
              : "border-border/80 bg-muted/20 hover:border-muted-foreground/40 hover:bg-muted/40",
            disabled && "pointer-events-none opacity-50"
          )}
        >
          <div className="flex flex-col items-center gap-3">
            <div
              className={cn(
                "flex size-14 items-center justify-center rounded-full transition-colors",
                isDragging
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground group-hover:bg-muted/80"
              )}
            >
              <CloudUpload className="size-7" />
            </div>

            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={(e) => {
                  e.stopPropagation()
                  fileInputRef.current?.click()
                }}
                disabled={disabled}
                className="gap-1.5 text-xs"
              >
                <ImageIcon className="size-3.5" data-icon="inline-start" />
                Browse files
              </Button>
              <span className="text-[11px] text-muted-foreground">
                Up to {maxSizeMb}MB
              </span>
            </div>
          </div>

          {uploadProgress !== null && (
            <div className="absolute inset-x-6 bottom-4 flex flex-col gap-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-150"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="size-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  )
}
