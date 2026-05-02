import { env } from "../../config.js";
import { getAISetting } from "../serverSettings.js";
import { AIDisabledError, AINotConfiguredError, AIProvider } from "./provider.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { OpenAIProvider } from "./providers/openai.js";

// Re-export for consumers that only need the interface/errors
export type { AIMessage, AIProvider, AIResult } from "./provider.js";
export { AIDisabledError, AINotConfiguredError } from "./provider.js";

type SupportedProvider = "anthropic" | "openai";

export const PROVIDER_DEFAULTS: Record<SupportedProvider, string> = {
  anthropic: "claude-haiku-4-5",
  openai: "gpt-4o-mini"
};

export const SUPPORTED_PROVIDERS: SupportedProvider[] = ["anthropic", "openai"];

/**
 * Returns a ready-to-use AIProvider based on the current server_settings.
 * Settings are read from the in-memory cache (populated at startup and after
 * every admin write), so this is safe to call in any request handler.
 *
 * Priority for API key: DB ai_api_key → env var fallback
 *
 * Pass `overrides` to bypass DB settings (used by the Admin test endpoint).
 *
 * Throws AIDisabledError  when ai_enabled != "true" (unless overrides.provider is set)
 * Throws AINotConfiguredError when provider or key are missing
 */
export function getAIProvider(overrides?: {
  provider?: string;
  model?: string;
  apiKey?: string;
}): AIProvider {
  const usingOverride = Boolean(overrides?.provider);

  if (!usingOverride) {
    const enabled = getAISetting("ai_enabled") ?? "false";
    if (enabled !== "true") {
      throw new AIDisabledError();
    }
  }

  const providerName = (
    (overrides?.provider ?? getAISetting("ai_provider") ?? "") as SupportedProvider
  ).toLowerCase() as SupportedProvider;

  if (!providerName) {
    throw new AINotConfiguredError("no provider selected");
  }

  if (!SUPPORTED_PROVIDERS.includes(providerName)) {
    throw new AINotConfiguredError(`unknown provider "${providerName}"`);
  }

  const model =
    overrides?.model ??
    getAISetting("ai_model") ??
    PROVIDER_DEFAULTS[providerName] ??
    "";

  const dbKey = getAISetting("ai_api_key") ?? "";
  const envFallback = providerName === "anthropic" ? env.ANTHROPIC_API_KEY : env.OPENAI_API_KEY;
  const apiKey = overrides?.apiKey ?? (dbKey || envFallback);

  if (!apiKey) {
    throw new AINotConfiguredError(`no API key set for provider "${providerName}"`);
  }

  switch (providerName) {
    case "anthropic":
      return new AnthropicProvider(apiKey, model || PROVIDER_DEFAULTS.anthropic);
    case "openai":
      return new OpenAIProvider(apiKey, model || PROVIDER_DEFAULTS.openai);
    default:
      throw new AINotConfiguredError(`unknown provider "${providerName}"`);
  }
}
