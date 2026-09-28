/**
 * Single source of truth for BYOK / hosted chat provider metadata.
 *
 * Adding a provider (minimize shotgun surgery):
 * 1. Append an entry here (id, name, hint, modelPlaceholder).
 * 2. `ModelProvider` is derived from this list — no separate union edit.
 * 3. Update zod in `src/pages/settings/settings-form-schema.ts` if it does
 *    not already spread `MODEL_PROVIDER_IDS` (prefer deriving from this file).
 * 4. Backend / edge allow-list if the server validates provider ids.
 */
export const MODEL_PROVIDERS = [
  {
    id: "gemini",
    name: "Gemini",
    hint: "Google AI Studio",
    modelPlaceholder: "gemini-2.5-pro",
  },
  {
    id: "groq",
    name: "Groq",
    hint: "console.groq.com",
    modelPlaceholder: "llama-3.3-70b-versatile",
  },
  {
    id: "openai",
    name: "OpenAI",
    hint: "platform.openai.com",
    modelPlaceholder: "gpt-4o-mini",
  },
  {
    id: "claude",
    name: "Claude",
    hint: "console.anthropic.com",
    modelPlaceholder: "claude-sonnet-4-5",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    hint: "platform.deepseek.com",
    modelPlaceholder: "deepseek-chat",
  },
] as const

export type ModelProvider = (typeof MODEL_PROVIDERS)[number]["id"]

export const MODEL_PROVIDER_IDS = MODEL_PROVIDERS.map((p) => p.id) as [
  ModelProvider,
  ...ModelProvider[],
]

/** Default Writr-hosted chat model id shown in Settings / status badge. */
export const WRITR_HOSTED_MODEL = "gemini-2.5-pro"

export type ProviderMeta = (typeof MODEL_PROVIDERS)[number]

export function isModelProvider(value: string): value is ModelProvider {
  return (MODEL_PROVIDER_IDS as readonly string[]).includes(value)
}

export function getProviderMeta(id: ModelProvider): ProviderMeta {
  return MODEL_PROVIDERS.find((p) => p.id === id) ?? MODEL_PROVIDERS[0]
}

export function formatActiveModelDisplayName(input: {
  llmSource: "default" | "byok"
  modelProvider: ModelProvider
  hostedModel: string
  byokModel: string
}): string {
  if (input.llmSource !== "byok") {
    return `Writr — ${input.hostedModel || WRITR_HOSTED_MODEL}`
  }
  const label = getProviderMeta(input.modelProvider).name
  const ownModel = input.byokModel.trim()
  return ownModel ? `Your key — ${label} (${ownModel})` : `Your key — ${label}`
}
