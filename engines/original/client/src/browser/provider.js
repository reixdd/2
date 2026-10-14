/** WebLLM runs in a worker. Terminating it cancels downloads AND stalled GPU work. */
export function createDeviceProvider() {
  let worker, engine, loaded = null, sdk, progress;
  const dispose = () => { worker?.terminate(); worker = null; engine = null; loaded = null; };
  async function getEngine() {
    sdk ??= await import('@mlc-ai/web-llm');
    if (!engine) {
      worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
      engine = new sdk.WebWorkerMLCEngine(worker, { initProgressCallback: (report) => progress?.(report), appConfig: sdk.prebuiltAppConfig });
    }
    return engine;
  }
  return {
    async probe() {
      if (!globalThis.isSecureContext) return { supported: false, reason: 'Browser inference needs HTTPS.' };
      if (!navigator.gpu) return { supported: false, reason: 'WebGPU is unavailable. Try current Chrome or Edge with hardware acceleration enabled on a compatible device.' };
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) return { supported: false, reason: 'No compatible GPU adapter is available on this device.' };
        return { supported: true, reason: null, gpu: adapter.info?.description || adapter.info?.architecture || 'WebGPU adapter', features: [...adapter.features] };
      } catch (e) { return { supported: false, reason: e.message }; }
    },
    async load(model, onProgress, signal) {
      progress = onProgress;
      const current = await getEngine();
      if (signal.aborted) throw new Error('Model loading cancelled');
      const cancel = () => dispose();
      signal.addEventListener('abort', cancel, { once: true });
      try {
        const record = sdk.prebuiltAppConfig.model_list.find((r) => r.model_id === model);
        if (!record) throw new Error('Model is absent from the installed WebLLM catalog');
        if (loaded !== model) { await current.reload(model, { context_window_size: 4096 }); loaded = model; }
        return { backend: 'WebLLM / WebGPU', runtime: sdk.modelVersion, weightsUrl: record.model, runtimeUrl: record.model_lib,
          // Loaded official catalog artifact, but not independently checksum-attested by us.
          officialDownloadVerified: false, integrity: 'upstream-catalog; no independent artifact attestation' };
      } catch (e) { dispose(); throw e instanceof Error ? e : new Error(String(e)); }
      finally { signal.removeEventListener('abort', cancel); progress = null; }
    },
    async *stream({ model, messages, temperature, maxTokens, signal }) {
      if (!engine || loaded !== model) throw new Error('Model is not initialized');
      const current = engine;
      const cancel = () => dispose();
      signal.addEventListener('abort', cancel, { once: true });
      try {
        const stream = await current.chat.completions.create({ messages, model, temperature, max_tokens: maxTokens, stream: true, stream_options: { include_usage: true } });
        for await (const chunk of stream) {
          if (signal.aborted) throw new Error('Inference cancelled');
          const c = chunk.choices?.[0];
          if (c?.delta?.content) yield { type: 'delta', text: c.delta.content };
          if (c?.finish_reason) yield { type: 'finish', reason: c.finish_reason };
          if (chunk.usage) yield { type: 'usage', usage: chunk.usage };
        }
      } catch (e) { throw e instanceof Error ? e : new Error(String(e)); }
      finally { signal.removeEventListener('abort', cancel); }
    },
    cancel: dispose,
  };
}
