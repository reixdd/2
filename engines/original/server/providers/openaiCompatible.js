/**
 * Provider adapter for any OpenAI-compatible /chat/completions endpoint.
 * Adapter contract (implement this to add a new provider):
 *   id, label, isConfigured(), notConfiguredReason,
 *   listModels() -> { ok, models:Set<string>, error? }
 *   hasModel(models:Set, model) -> boolean
 *   stream({model, messages, temperature, maxTokens, signal}) -> async iterator of
 *       {type:'delta'|'reasoning', text} | {type:'usage', usage} | {type:'finish', reason}
 */
export class ProviderError extends Error {
  constructor(message, { code = 'provider_error', detail = null } = {}) {
    super(message);
    this.code = code;
    this.detail = detail;
  }
}

export function createOpenAICompatibleProvider({
  id, label, baseUrl, apiKey = '', extraHeaders = {}, requiresKey = false,
  catalog = 'openai', // 'openai' → GET {baseUrl}/models ; 'ollama' → GET {origin}/api/tags
  notConfiguredReason, cacheMs = 60_000,
}) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  const redact = (text) => apiKey ? String(text).replaceAll(apiKey, '[redacted]') : String(text);
  const headers = () => ({ 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}), ...extraHeaders });
  let cache = { at: 0, value: null };

  async function fetchCatalog() {
    try {
      if (catalog === 'ollama') {
        const origin = base.replace(/\/v1$/, '');
        const res = await fetch(`${origin}/api/tags`, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) return { ok: false, models: new Set(), error: `HTTP ${res.status}` };
        const j = await res.json();
        return { ok: true, models: new Set((j.models || []).map((m) => m.name)) };
      }
      const res = await fetch(`${base}/models`, { headers: headers(), signal: AbortSignal.timeout(6000) });
      if (!res.ok) return { ok: false, models: new Set(), error: `HTTP ${res.status}` };
      const j = await res.json();
      return { ok: true, models: new Set((j.data || []).map((m) => m.id)) };
    } catch (e) {
      return { ok: false, models: new Set(), error: e?.cause?.code || e?.message || 'unreachable' };
    }
  }

  return {
    id, label, baseUrl: base, catalog,
    notConfiguredReason: notConfiguredReason || `${label} is not configured`,
    isConfigured: () => (requiresKey ? !!apiKey : !!base),
    async listModels({ force = false } = {}) {
      if (!force && cache.value?.ok && Date.now() - cache.at < cacheMs) return cache.value;
      const value = await fetchCatalog();
      cache = { at: Date.now(), value };
      return value;
    },
    hasModel(models, model) {
      if (models.has(model)) return true;
      return catalog === 'ollama' && !model.includes(':') && models.has(`${model}:latest`);
    },
    async *stream({ model, messages, temperature, maxTokens, signal }) {
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST', headers: headers(), signal,
        body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, stream: true, stream_options: { include_usage: true } }),
      });
      if (!res.ok) {
        const body = redact(await res.text().catch(() => '')).slice(0, 600);
        throw new ProviderError(`${label} responded HTTP ${res.status}`, { code: `http_${res.status}`, detail: body });
      }
      // Some compatible servers ignore stream:true. Return their actual response progressively as one chunk.
      if (res.headers.get('content-type')?.includes('application/json')) {
        const j = await res.json(), choice = j.choices?.[0];
        if (j.error) throw new ProviderError(redact(j.error.message || 'Provider error'));
        if (choice?.message?.content) yield { type: 'delta', text: choice.message.content };
        if (j.usage) yield { type: 'usage', usage: j.usage };
        if (choice?.finish_reason) yield { type: 'finish', reason: choice.finish_reason };
        return;
      }
      if (!res.body) throw new ProviderError('Missing response body', { code: 'empty_response' });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      try { for (;;) {
        const { done, value } = await reader.read();
        buf += done ? decoder.decode() + '\n' : decoder.decode(value, { stream: true });
        if (buf.length > 1_000_000) throw new ProviderError('Oversized provider stream frame', { code: 'output_limit' });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith('data:')) continue; // also skips ": keepalive" comments
          const data = line.slice(5).trim();
          if (data === '[DONE]') return;
          let j;
          try { j = JSON.parse(data); } catch { throw new ProviderError('Malformed provider stream frame', { code: 'invalid_stream' }); }
          if (j.error) throw new ProviderError(redact(j.error.message || 'Provider stream error'), { code: 'provider_error', detail: redact(JSON.stringify(j.error)).slice(0, 600) });
          const choice = j.choices?.[0];
          const d = choice?.delta;
          if (d?.content) yield { type: 'delta', text: d.content };
          const rs = d?.reasoning ?? d?.reasoning_content;
          if (rs) yield { type: 'reasoning', text: rs };
          if (j.usage) yield { type: 'usage', usage: j.usage };
          if (choice?.finish_reason) yield { type: 'finish', reason: choice.finish_reason };
        }
        if (done) break;
      } } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    },
  };
}
