import * as React from "react"
import {
  Controller,
  useWatch,
  type Control,
  type UseFormSetValue,
} from "react-hook-form"
import { cn } from "cn"
import { Eye, EyeOff, KeyRound, Sparkles } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { LlmSource, ModelProvider } from "@/types/settings"
import {
  MODEL_PROVIDERS,
  WRITR_HOSTED_MODEL,
  getProviderMeta,
} from "@/lib/model-providers"
import type { SettingsFormValues } from "@/pages/settings/settings-form-schema"

interface WritingModelCardProps {
  control: Control<SettingsFormValues>
  setValue: UseFormSetValue<SettingsFormValues>
  keyConfigured: boolean
  keyLast4: string
}

export const WritingModelCard = React.memo(function WritingModelCard({
  control,
  setValue,
  keyConfigured,
  keyLast4,
}: WritingModelCardProps) {
  const llmSource = useWatch({ control, name: "llmSource" }) as LlmSource
  const modelProvider = useWatch({ control, name: "modelProvider" }) as ModelProvider
  const [showKey, setShowKey] = React.useState(false)
  const selected = getProviderMeta(modelProvider)

  return (
    <Card
      aria-labelledby="writing-model-heading"
      className="rounded-[var(--radius-xl)] border-border bg-card p-4 shadow-xs sm:p-6"
    >
      <CardHeader className="gap-1 border-b border-border p-0 pb-5">
        <div className="flex items-center gap-2">
          <KeyRound className="size-5 text-primary" aria-hidden="true" />
          <CardTitle
            id="writing-model-heading"
            className="text-lg font-bold text-foreground normal-case tracking-normal"
          >
            Writing model
          </CardTitle>
        </div>
        <CardDescription className="max-w-xl text-xs">
          Use Writr&apos;s model, or your own API key for Write and Review. Notes search always
          uses Writr&apos;s embedding model.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5 p-0 pt-5">
        <div
          className="grid gap-2 sm:grid-cols-2"
          role="radiogroup"
          aria-label="Whose writing model"
        >
          <button
            type="button"
            role="radio"
            aria-checked={llmSource === "default"}
            onClick={() => setValue("llmSource", "default", { shouldDirty: true })}
            className={cn(
              "flex min-h-20 flex-col items-start gap-1 rounded-[var(--radius)] border p-3.5 text-left transition-colors",
              llmSource === "default"
                ? "border-primary bg-primary/5 shadow-xs"
                : "border-border bg-background hover:bg-muted/40"
            )}
          >
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
              Writr&apos;s model
            </span>
            <span className="text-[11px] leading-relaxed text-muted-foreground">
              Included. No key needed. Currently {WRITR_HOSTED_MODEL}.
            </span>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={llmSource === "byok"}
            onClick={() => setValue("llmSource", "byok", { shouldDirty: true })}
            className={cn(
              "flex min-h-20 flex-col items-start gap-1 rounded-[var(--radius)] border p-3.5 text-left transition-colors",
              llmSource === "byok"
                ? "border-primary bg-primary/5 shadow-xs"
                : "border-border bg-background hover:bg-muted/40"
            )}
          >
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground">
              <KeyRound className="size-3.5 text-primary" aria-hidden="true" />
              My API key
            </span>
            <span className="text-[11px] leading-relaxed text-muted-foreground">
              Gemini, Groq, OpenAI, Claude, or DeepSeek. You pay that provider.
            </span>
          </button>
        </div>

        {llmSource === "byok" ? (
          <div className="flex flex-col gap-5 rounded-[var(--radius)] border border-border bg-muted/20 p-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold">Provider</Label>
              <div
                className="grid grid-cols-2 gap-1.5 sm:grid-cols-3"
                role="group"
                aria-label="API provider"
              >
                {MODEL_PROVIDERS.map((provider) => (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() =>
                      setValue("modelProvider", provider.id, { shouldDirty: true })
                    }
                    className={cn(
                      "min-h-9 rounded-[var(--radius-sm)] border px-2 py-1.5 text-xs font-semibold transition-colors",
                      modelProvider === provider.id
                        ? "border-primary bg-background text-foreground shadow-xs"
                        : "border-border bg-background/80 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {provider.name}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">Key from {selected.hint}.</p>
            </div>

            <Controller
              control={control}
              name="apiKey"
              render={({ field, fieldState }) => (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="byok-api-key" className="text-xs font-semibold">
                    API key
                  </Label>
                  <div className="relative">
                    <Input
                      id="byok-api-key"
                      type={showKey ? "text" : "password"}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={
                        keyConfigured && keyLast4
                          ? `Saved key ending in ${keyLast4}`
                          : "Paste your key"
                      }
                      className="pr-10"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((v) => !v)}
                      className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
                      aria-label={showKey ? "Hide API key" : "Show API key"}
                    >
                      {showKey ? (
                        <EyeOff className="size-4" aria-hidden="true" />
                      ) : (
                        <Eye className="size-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  {fieldState.error ? (
                    <p className="text-xs text-destructive">{fieldState.error.message}</p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      {keyConfigured
                        ? "Leave blank to keep the saved key. The secret is not stored in this browser."
                        : "Saved with your account later. Not used for notes search."}
                    </p>
                  )}
                </div>
              )}
            />

            <Controller
              control={control}
              name="byokModel"
              render={({ field }) => (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="byok-model" className="text-xs font-semibold">
                    Model name <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="byok-model"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={selected.modelPlaceholder}
                    {...field}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Leave empty to use that provider&apos;s default.
                  </p>
                </div>
              )}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
})
