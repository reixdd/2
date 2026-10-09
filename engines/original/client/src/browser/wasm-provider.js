/** Browser CPU inference, isolated in a worker; no WebGPU or credential required. */
export function createWasmProvider() {
  let worker, sequence = 0, loaded, pending = new Map(), receiver;
  function cancel() {
    worker?.terminate(); worker = null; loaded = null;
    for (const { reject } of pending.values()) reject(new Error('Worker cancelled'));
    pending.clear(); receiver = null;
  }
  function getWorker() {
    if (!worker) {
      worker = new Worker(new URL('./wasm-worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data }) => {
        if (data.type === 'event') { receiver?.(data.event); return; }
        if (data.type === 'progress') { pending.get(data.id)?.progress?.(data.report); return; }
        const p = pending.get(data.id); if (!p) return;
        pending.delete(data.id);
        data.type === 'error' ? p.reject(new Error(data.message)) : p.resolve(data.result);
      };
      worker.onerror = (e) => { for (const p of pending.values()) p.reject(new Error(e.message || 'CPU worker failed')); cancel(); };
    }
    return worker;
  }
  function request(type, payload, progress) {
    const id = ++sequence;
    return new Promise((resolve, reject) => { pending.set(id, { resolve, reject, progress }); getWorker().postMessage({ id, type, ...payload }); });
  }
  return {
    async probe() { return { supported: !!globalThis.WebAssembly && typeof Worker !== 'undefined', reason: !globalThis.WebAssembly ? 'WebAssembly is not available in this browser.' : typeof Worker === 'undefined' ? 'Web Workers are unavailable in this browser.' : null, gpu: 'Browser CPU / WebAssembly', backend: 'wasm' }; },
    async load(model, progress, signal) {
      if (signal.aborted) throw new Error('Loading cancelled');
      signal.addEventListener('abort', cancel, { once: true });
      try { if (loaded !== model) { await request('load', { model }, progress); loaded = model; }
        return { backend: 'Transformers.js / ONNX Runtime WASM CPU', runtime: 'Transformers.js 4.3.1', weightsUrl: `https://huggingface.co/${model}/resolve/main/onnx/model_q4.onnx`, dtype: 'q4', officialDownloadVerified: false, integrity: 'upstream conversion; no independent artifact attestation' };
      } finally { signal.removeEventListener('abort', cancel); }
    },
    async *stream(req) {
      if (!worker || loaded !== req.model) throw new Error('CPU model is not initialized');
      let queue = [], wake, done = false, error;
      receiver = (ev) => { queue.push(ev); wake?.(); wake = null; };
      const signal = req.signal;
      signal.addEventListener('abort', cancel, { once: true });
      const generation = request('run', { request: { model: req.model, messages: req.messages, temperature: req.temperature, maxTokens: req.maxTokens } }).then(() => { done = true; }, (e) => { error = e; done = true; }).finally(() => wake?.());
      try {
        while (!done || queue.length) { if (queue.length) yield queue.shift(); else await new Promise((resolve) => { wake = resolve; }); }
        if (error) throw error;
      } finally { receiver = null; signal.removeEventListener('abort', cancel); await generation; }
    },
    cancel,
  };
}
