import { pipeline, TextStreamer, env } from '@huggingface/transformers';
env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;
env.useWasmCache = false;
// Self-host the smaller CPU runtime, below Cloudflare Pages' per-file limit.
env.backends.onnx.wasm.wasmPaths = {
  mjs: `${self.location.origin}${import.meta.env.BASE_URL}wasm/ort-wasm-simd-threaded.mjs`,
  wasm: `${self.location.origin}${import.meta.env.BASE_URL}wasm/ort-wasm-simd-threaded.wasm`,
};
let generator, model;
const allowed = new Set(['onnx-community/Qwen2.5-0.5B-Instruct', 'onnx-community/SmolLM2-135M-Instruct-ONNX']);
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'load') {
      if (!allowed.has(data.model)) throw new Error('No CPU adapter for this model');
      if (generator && model !== data.model) { await generator.dispose(); generator = null; }
      if (!generator) generator = await pipeline('text-generation', data.model, { device: 'wasm', dtype: 'q4', progress_callback: (p) => {
        self.postMessage({ type: 'progress', id: data.id, report: { progress: (p.progress ?? 0) / 100, text: `${p.status}${p.file ? ` · ${p.file}` : ''}` } });
      } });
      model = data.model;
    } else if (data.type === 'run') {
      const req = data.request;
      if (!generator || req.model !== model) throw new Error('CPU model is not loaded');
      let count = 0;
      const streamer = new TextStreamer(generator.tokenizer, { skip_prompt: true, skip_special_tokens: true,
        callback_function: (text) => self.postMessage({ type: 'event', event: { type: 'delta', text } }),
        token_callback_function: (tokens) => { count += tokens.length; },
      });
      await generator(req.messages, { max_new_tokens: req.maxTokens, do_sample: req.temperature > 0, ...(req.temperature > 0 ? { temperature: req.temperature } : {}), return_full_text: false, streamer });
      self.postMessage({ type: 'event', event: { type: 'usage', usage: { completion_tokens: count } } });
      self.postMessage({ type: 'event', event: { type: 'finish', reason: count >= req.maxTokens ? 'length' : 'stop' } });
    } else throw new Error('Unknown CPU request');
    self.postMessage({ type: 'done', id: data.id, result: null });
  } catch (e) { self.postMessage({ type: 'error', id: data.id, message: e?.message || String(e) }); }
};
