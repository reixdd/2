import { createOpenAICompatibleProvider } from './openaiCompatible.js';
import { createLocalProvider } from './local.js';

/** Build the adapter registry from config. Credentials never leave this process. */
export function createProviders(config) {
  return {
    local: createLocalProvider(config),
    openrouter: createOpenAICompatibleProvider({
      id: 'openrouter', label: 'OpenRouter', baseUrl: config.openrouter.baseUrl, apiKey: config.openrouter.apiKey,
      requiresKey: true, notConfiguredReason: 'OPENROUTER_API_KEY is not set on the server',
      extraHeaders: { 'HTTP-Referer': 'http://localhost', 'X-Title': 'COLOSSEUM' },
    }),
    ollama: createOpenAICompatibleProvider({
      id: 'ollama', label: 'Ollama (local)', baseUrl: config.ollama.baseUrl, catalog: 'ollama',
      notConfiguredReason: 'OLLAMA_BASE_URL is not set', cacheMs: 5_000,
    }),
    'openai-compatible': createOpenAICompatibleProvider({
      id: 'openai-compatible', label: 'OpenAI-compatible server', baseUrl: config.openaiCompat.baseUrl,
      apiKey: config.openaiCompat.apiKey, notConfiguredReason: 'OPENAI_COMPAT_BASE_URL is not set',
    }),
  };
}
