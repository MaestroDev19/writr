import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { CloudUpload, Camera, Paperclip, X, AlertCircle } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "cn"

interface AvatarUploadProps {
  value?: File | null
  onChange: (file: File | null) => void
  authorName?: string
  error?: string
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

function getInitials(name?: string): string {
  if (!name?.trim()) return "W"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function AvatarUpload({
  value,
  onChange,
  authorName = "",
  error,
  disabled = false,
  className,
}: AvatarUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const previewUrl = useMemo(() => {
    if (!value) return null
    return URL.createObjectURL(value)
  }, [value])

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const validateAndProcess = useCallback(
    (file: File) => {
      if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
        setErrorMessage("Please select a JPEG, PNG, or WebP image.")
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage("Image must be smaller than 5MB.")
        return
      }

      setErrorMessage(null)
      onChange(file)

      // Simulated upload progress animation like image-upload-shadcn
      setUploadProgress(0)
      let current = 0
      const timer = setInterval(() => {
        current += 25
        if (current >= 100) {
          clearInterval(timer)
          setUploadProgress(null)
        } else {
          setUploadProgress(current)
        }
      }, 70)
    },
    [onChange]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        validateAndProcess(file)
      }
    },
    [validateAndProcess]
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
        validateAndProcess(file)
      }
    },
    [disabled, validateAndProcess]
  )

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onChange(null)
      setErrorMessage(null)
      setUploadProgress(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    },
    [onChange]
  )

  const handleTriggerClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const initials = useMemo(() => getInitials(authorName), [authorName])

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={handleFileChange}
        disabled={disabled}
        aria-label="Upload author avatar"
      />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleTriggerClick}
        className={cn(
          "relative flex items-center gap-4 rounded-xl border-2 border-dashed p-4 transition-all cursor-pointer select-none",
          isDragging
            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
            : "border-border/80 bg-muted/20 hover:border-muted-foreground/40 hover:bg-muted/30",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        <div className="relative shrink-0">
          <Avatar className="size-16 ring-2 ring-border shadow-xs" size="lg">
            {previewUrl && (
              <AvatarImage
                src={previewUrl}
                alt={authorName ? `${authorName}'s avatar` : "Author avatar"}
              />
            )}
            <AvatarFallback className="bg-muted text-sm font-semibold text-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {value ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate text-xs font-medium text-foreground">
                  {value.name}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  ({formatBytes(value.size)})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleTriggerClick()
                  }}
                  disabled={disabled}
                  className="h-6 px-2 text-[11px]"
                >
                  <Camera className="size-3" data-icon="inline-start" />
                  Change
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={handleRemove}
                  disabled={disabled}
                  className="h-6 px-2 text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="size-3" data-icon="inline-start" />
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <CloudUpload className="size-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">
                  Upload author portrait
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Drag and drop or click to browse
              </p>
              <p className="text-[10px] text-muted-foreground/75">
                JPG, PNG or WebP up to 5MB
              </p>
            </div>
          )}

          {uploadProgress !== null && (
            <div className="mt-1 flex flex-col gap-1">
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-100"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {(errorMessage || error) && (
        <div className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="size-3.5 shrink-0" />
          <span>{errorMessage || error}</span>
        </div>
      )}
    </div>
  )
}
