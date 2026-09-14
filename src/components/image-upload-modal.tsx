import { useState } from "react"
import { CloudUpload } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ImageUpload } from "@/components/image-upload"

interface ImageUploadModalProps {
  onSave?: (file: File | null) => void
  triggerText?: string
  title?: string
  description?: string
  aspectRatio?: "video" | "square" | "wide" | "auto"
}

export function ImageUploadModal({
  onSave,
  triggerText = "Upload Image",
  title = "Upload image asset",
  description = "Drag and drop or select an image file to attach to your work.",
  aspectRatio = "video",
}: ImageUploadModalProps) {
  const [open, setOpen] = useState(false)
  const [tempFile, setTempFile] = useState<File | null>(null)

  const handleConfirm = () => {
    onSave?.(tempFile)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-2">
            <CloudUpload className="size-4" data-icon="inline-start" />
            {triggerText}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <ImageUpload
            value={tempFile}
            onChange={setTempFile}
            aspectRatio={aspectRatio}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!tempFile}
            onClick={handleConfirm}
          >
            Save image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
