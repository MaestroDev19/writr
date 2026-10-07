/**
 * Gemini text models whose standard tier is free of charge.
 * Source: https://ai.google.dev/gemini-api/docs/pricing
 * (paired with the model list at https://ai.google.dev/gemini-api/docs/models).
 *
 * Live, speech, image, video, and preview models are omitted: they are not
 * chat models, or their free limits are tighter than the stable Flash family.
 */
export const GEMINI_FREE_MODELS = [
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    hint: "Best free model for longer writing",
  },
  {
    id: "gemini-3.7-flash",
    name: "Gemini 3.7 Flash",
    hint: "Strong everyday writing",
  },
  {
    id: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    hint: "Balanced speed and quality",
  },
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    hint: "Fast drafts",
  },
  {
    id: "gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash-Lite",
    hint: "Highest free throughput",
  },
  {
    id: "gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash-Lite",
    hint: "Lightest free model",
  },
] as const

export type GeminiModelId = (typeof GEMINI_FREE_MODELS)[number]["id"]

export const GEMINI_MODEL_IDS = GEMINI_FREE_MODELS.map((model) => model.id) as [
  GeminiModelId,
  ...GeminiModelId[],
]

/** Default Writr-hosted chat model. Recommended free-tier model for new projects. */
export const WRITR_HOSTED_MODEL: GeminiModelId = "gemini-3.8-flash"

export function isGeminiFreeModel(value: string): value is GeminiModelId {
  return (GEMINI_MODEL_IDS as readonly string[]).includes(value)
}

export function getGeminiModelMeta(id: string) {
  return GEMINI_FREE_MODELS.find((model) => model.id === id) ?? GEMINI_FREE_MODELS[0]
}

export function formatActiveModelDisplayName(hostedModel: string): string {
  return `Writr — ${getGeminiModelMeta(hostedModel).name}`
}
