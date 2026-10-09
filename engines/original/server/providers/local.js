import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { LOCAL_MODELS } from '../localModels.js';
import { ProviderError } from './openaiCompatible.js';

/** Native CPU inference. No tools, shell execution, downloads, or API keys during a battle. */
export function createLocalProvider(config) {
  const available = () => LOCAL_MODELS.filter((m) => fs.existsSync(path.join(config.localModelDir, m.filename)));
  let runtime, queue = Promise.resolve();
  const loaded = new Map();
  const artifacts = new Map();
  async function load(id) {
    const descriptor = LOCAL_MODELS.find((m) => m.id === id);
    if (!descriptor || !fs.existsSync(path.join(config.localModelDir, descriptor.filename))) throw new ProviderError('Local model is not installed', { code: 'model_missing' });
    runtime ??= import('node-llama-cpp').then(async (module) => ({ ...module, llama: await module.getLlama({ gpu: false, build: 'never' }) }));
    const { llama } = await runtime;
    if (!loaded.has(id)) loaded.set(id, (async () => {
      const modelPath = path.join(config.localModelDir, descriptor.filename);
      const hash = crypto.createHash('sha256');
      for await (const chunk of fs.createReadStream(modelPath)) hash.update(chunk);
      const sha256 = hash.digest('hex');
      let officialDownloadVerified = false;
      if (fs.existsSync(modelPath + '.json')) {
        const metadata = JSON.parse(fs.readFileSync(modelPath + '.json', 'utf8'));
        if (metadata.sha256 !== sha256 || metadata.repository !== descriptor.repository) throw new ProviderError('Local model checksum or source metadata does not match', { code: 'model_integrity' });
        officialDownloadVerified = true;
      }
      const model = await llama.loadModel({ modelPath, gpuLayers: 0 });
      artifacts.set(id, { sha256, officialDownloadVerified, sourceRepository: descriptor.source, backend: 'llama.cpp CPU', runtime: 'node-llama-cpp 3.22.1' });
      return model;
    })());
    return loaded.get(id);
  }
  return {
    id: 'local', label: 'Local CPU · no API credits', catalog: 'local',
    notConfiguredReason: 'Free local models are not downloaded yet. Run npm run setup:local.',
    isConfigured: () => available().length > 0,
    hasModel: (models, id) => models.has(id),
    modelArtifact: (id) => artifacts.get(id) ?? null,
    async listModels() {
      const models = new Set(), errors = [];
      for (const m of available()) {
        try { await load(m.id); models.add(m.id); } catch (err) { loaded.delete(m.id); errors.push(`${m.id}: ${err.message}`); }
      }
      return { ok: models.size > 0, models, error: errors.join('; ') || 'No local model installed' };
    },
    async *stream({ model: id, messages, temperature, maxTokens, signal }) {
      // Serialize CPU jobs and measure waiting separately; fresh contexts prevent cross-contestant leakage.
      const previous = queue; let release;
      queue = new Promise((resolve) => { release = resolve; });
      const queuedAt = performance.now();
      let context, session, acquired = false, abortWait;
      try {
        const aborted = new Promise((_, reject) => {
          abortWait = () => reject(signal.reason);
          if (signal?.aborted) abortWait();
          else signal?.addEventListener('abort', abortWait, { once: true });
        });
        await Promise.race([previous, aborted]);
        acquired = true;
        signal?.removeEventListener('abort', abortWait);
        signal?.throwIfAborted();
        yield { type: 'queue', queueMs: Math.round(performance.now() - queuedAt) };
        const model = await load(id);
        const { LlamaChatSession } = await runtime;
        context = await model.createContext({ contextSize: 4096, threads: config.localThreads });
        session = new LlamaChatSession({ contextSequence: context.getSequence(), systemPrompt: messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n') });
        const user = messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n\n');
        const events = []; let wake, done = false, failure, meta, tokenCount = 0;
        const push = (event) => { events.push(event); wake?.(); wake = undefined; };
        const generation = session.promptWithMeta(user, { temperature, maxTokens, signal, stopOnAbortSignal: false,
          onResponseChunk(chunk) { tokenCount += chunk.tokens.length; if (chunk.text) push({ type: chunk.type === 'segment' ? 'reasoning' : 'delta', text: chunk.text }); },
        }).then((result) => { meta = result; }, (err) => { failure = err; }).finally(() => { done = true; wake?.(); });
        try {
          while (!done || events.length) {
            if (events.length) yield events.shift();
            else await new Promise((resolve) => { wake = resolve; });
          }
          if (failure) throw failure;
          yield { type: 'usage', usage: { completion_tokens: tokenCount } };
          yield { type: 'finish', reason: meta.stopReason === 'maxTokens' ? 'length' : 'stop' };
        } finally { await generation; }
      } finally {
        signal?.removeEventListener('abort', abortWait);
        session?.dispose(); await context?.dispose();
        // A cancelled waiter must not release the next job before its predecessor finishes.
        if (acquired) release(); else previous.then(release);
      }
    },
  };
}
