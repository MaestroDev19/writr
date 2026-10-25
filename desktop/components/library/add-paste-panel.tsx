"use client"

import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"

interface AddPasteFormValues {
  title: string
  body: string
}

export function AddPastePanel({
  open,
  onOpenChange,
  busy,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  busy: boolean
  onAdd: (payload: {
    title: string
    body: string
  }) => Promise<"ok" | "duplicate" | "error">
}) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<AddPasteFormValues>({
    defaultValues: {
      title: "",
      body: "",
    },
  })

  const watchedBody = useWatch({ control, name: "body" }) ?? ""
  const watchedTitle = useWatch({ control, name: "title" }) ?? ""
  const charCount = watchedBody.length
  const wordCount = watchedBody.trim()
    ? (watchedBody.trim().match(/\S+/g)?.length ?? 0)
    : 0

  const onSubmit = handleSubmit(async (data) => {
    const trimmedBody = data.body.trim()
    if (!trimmedBody) return

    const result = await onAdd({
      title: data.title.trim() || "Pasted note",
      body: trimmedBody,
    })
    if (result === "duplicate") {
      toast.message("Already in library.")
      return
    }
    if (result === "error") {
      toast.error("Could not add paste.")
      return
    }
    reset()
    onOpenChange(false)
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) reset()
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="sm:max-w-xl md:max-w-2xl max-h-[calc(100dvh-3rem)] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2 pe-8">
            <DialogTitle className="text-base font-semibold tracking-tight normal-case sm:text-lg">
              Paste note
            </DialogTitle>
            {wordCount > 0 ? (
              <Badge
                variant="secondary"
                className="rounded-md font-mono text-[11px] font-normal tracking-normal normal-case"
              >
                {wordCount.toLocaleString()} words · {(charCount / 1024).toFixed(1)} KB
              </Badge>
            ) : null}
          </div>
          <DialogDescription>
            Paste outline, manuscript slice, or research notes. Stored locally on this machine.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden gap-4"
        >
          <FieldGroup className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            <Field className="shrink-0 gap-1.5">
              <FieldLabel htmlFor="paste-title" className="text-xs font-medium">
                Title
              </FieldLabel>
              <Input
                id="paste-title"
                {...register("title")}
                placeholder="Optional (e.g. Chapter 4 Outline or World Canon)"
                disabled={busy}
                className="h-9 rounded-md text-sm"
              />
            </Field>

            <Field
              data-invalid={errors.body ? true : undefined}
              className="flex min-h-0 flex-1 flex-col gap-1.5"
            >
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="paste-body" className="text-xs font-medium">
                  Content
                </FieldLabel>
                {watchedBody.trim() ? (
                  <button
                    type="button"
                    onClick={() => reset({ title: watchedTitle, body: "" })}
                    className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Clear text
                  </button>
                ) : null}
              </div>
              <div className="relative flex min-h-0 flex-1 flex-col">
                <Textarea
                  id="paste-body"
                  {...register("body", {
                    required: "Content is required.",
                    validate: (val) => val.trim().length > 0 || "Content is required.",
                  })}
                  aria-invalid={errors.body ? true : undefined}
                  disabled={busy}
                  placeholder="Paste text here…"
                  className="min-h-48 max-h-72 sm:max-h-84 flex-1 resize-none overflow-y-auto rounded-lg font-sans text-sm leading-relaxed p-3.5 focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              {errors.body?.message ? (
                <FieldError>{errors.body.message}</FieldError>
              ) : (
                <FieldDescription className="text-[11px] text-muted-foreground">
                  Indexed with local embeddings for agent continuity retrieval.
                </FieldDescription>
              )}
            </Field>
          </FieldGroup>

          <DialogFooter className="shrink-0 border-t border-border/60 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-md"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="rounded-md"
              disabled={busy || !watchedBody.trim()}
            >
              {busy ? (
                <>
                  <Spinner className="size-3.5" data-icon="inline-start" />
                  Indexing…
                </>
              ) : (
                "Add note"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
