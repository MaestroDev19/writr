import type { GeminiModelId } from "@/lib/model-providers"
import type { AppSettings, WorkflowPromptConfig } from "@/types/settings"
import { api } from "@/lib/axios"

export interface WorkflowSetting {
  system_prompt?: string | null
  temperature?: number | null
  max_tokens?: number | null
  top_p?: number | null
  frequency_penalty?: number | null
  context_chunks?: number | null
}

export interface WorkflowSettingUpdate extends WorkflowSetting {
  model_name?: GeminiModelId
}

export interface MySettings {
  user_id: string
  model_name?: string | null
  generate: WorkflowSetting
  critique: WorkflowSetting
  updated_at?: string | null
}

export function settingsApiEnabled(): boolean {
  return Boolean((import.meta.env.VITE_API_URL || "").replace(/\/$/, ""))
}

export function toWorkflowUpdate(
  config: WorkflowPromptConfig,
  modelName?: GeminiModelId
): WorkflowSettingUpdate {
  return {
    model_name: modelName,
    system_prompt: config.systemPrompt,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    top_p: config.topP,
    frequency_penalty: config.frequencyPenalty,
    context_chunks: config.contextChunks,
  }
}

function workflowFromRemote(row: WorkflowSetting): WorkflowPromptConfig | null {
  if (
    row.system_prompt == null ||
    row.temperature == null ||
    row.max_tokens == null ||
    row.top_p == null ||
    row.frequency_penalty == null ||
    row.context_chunks == null
  ) {
    return null
  }
  return {
    systemPrompt: row.system_prompt,
    temperature: row.temperature,
    maxTokens: row.max_tokens,
    topP: row.top_p,
    frequencyPenalty: row.frequency_penalty,
    contextChunks: row.context_chunks,
  }
}

/** Fields worth writing into local settings. Null when the server row is empty. */
export function settingsPatchFromRemote(
  remote: MySettings,
  isAllowedModel: (value: string) => value is GeminiModelId
): Partial<AppSettings> | null {
  const patch: Partial<AppSettings> = {}
  if (remote.model_name && isAllowedModel(remote.model_name)) {
    patch.geminiModel = remote.model_name
  }
  const generateConfig = workflowFromRemote(remote.generate)
  const critiqueConfig = workflowFromRemote(remote.critique)
  if (generateConfig) patch.generateConfig = generateConfig
  if (critiqueConfig) patch.critiqueConfig = critiqueConfig
  return Object.keys(patch).length > 0 ? patch : null
}

export async function getMySettings(): Promise<MySettings> {
  const response = await api.get<MySettings>("/mySetting/")
  return response.data
}

export async function saveGenerateSetting(
  setting: WorkflowSettingUpdate
): Promise<WorkflowSettingUpdate> {
  const response = await api.post<WorkflowSettingUpdate>("/mySetting/generate", setting)
  return response.data
}

export async function saveCritiqueSetting(
  setting: WorkflowSettingUpdate
): Promise<WorkflowSettingUpdate> {
  const response = await api.post<WorkflowSettingUpdate>("/mySetting/critique", setting)
  return response.data
}
