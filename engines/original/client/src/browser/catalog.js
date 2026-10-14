import cast from '../../../server/characters/cast.json';

// These IDs and artifacts are in WebLLM's pinned built-in catalog. They remain
// offline until weights really initialize on THIS device. No API credentials.
export const GPU_MODELS = [
  { id: 'browser-qwen-05', name: 'Qwen 2.5 · 0.5B', family: 'Qwen', model: 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC', modelVersion: '2.5 / 0.5B / q4f32_1', sourceRepo: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct', memoryMB: 1060 },
  { id: 'browser-smol-135', name: 'SmolLM 2 · 135M', family: 'SmolLM', model: 'SmolLM2-135M-Instruct-q0f32-MLC', modelVersion: '2 / 135M / q0f32', sourceRepo: 'https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct', memoryMB: 720 },
];
export const CPU_MODELS = [
  { ...GPU_MODELS[0], id: 'browser-cpu-qwen', model: 'onnx-community/Qwen2.5-0.5B-Instruct', modelVersion: '2.5 / 0.5B / ONNX q4', memoryMB: null, downloadBytes: 786156820 },
  { ...GPU_MODELS[1], id: 'browser-cpu-smol', model: 'onnx-community/SmolLM2-135M-Instruct-ONNX', modelVersion: '2 / 135M / ONNX q4', memoryMB: null, downloadBytes: 180581125 },
];
export const browserBackend = () => { try { return localStorage.getItem('colosseum-device-backend') === 'webgpu' ? 'webgpu' : 'wasm'; } catch { return 'wasm'; } };
export const modelsForBackend = () => browserBackend() === 'webgpu' ? GPU_MODELS : CPU_MODELS;
const defaults = { systemPrompt: '', temperature: 0, maxTokens: 256 };
export const BROWSER_CAST = {
  ...cast.families,
  SmolLM: { characterName: 'The Small Spark', archetype: 'The apprentice challenger', entranceAnimation: 'lotus-rise', artKey: null, visualTheme: { primary: '#a6eaff' }, lore: 'A small contender with an enormous arena ahead. Its strengths must be earned in the trial.' },
};
export const browserCatalog = () => { const models = modelsForBackend(); const provider = browserBackend() === 'webgpu' ? 'webllm' : 'wasm'; return [
  ...models.map((m) => ({ ...m, provider, kind: 'model', integrated: true, openWeights: true, baseModelId: m.id, mutationParentId: null, config: { ...defaults } })),
  { ...models[0], id: browserBackend() === 'webgpu' ? 'browser-qwen-verifier' : 'browser-cpu-qwen-verifier', name: 'Qwen 2.5 · verifier', provider, kind: 'agent', integrated: true, openWeights: true, baseModelId: models[0].id, mutationParentId: models[0].id,
    config: { ...defaults, systemPrompt: 'Solve independently, check the arithmetic and the requested format, then commit one FINAL line.' } },
  ...['DeepSeek', 'Llama', 'Gemma', 'Grok', 'GPT-OSS'].map((family) => ({ id: `browser-reserved-${family.toLowerCase()}`, name: `${family} · future summon`, family, provider: null, model: null, modelVersion: null, sourceRepo: null, kind: 'model', integrated: false, openWeights: null, baseModelId: null, mutationParentId: null, config: { ...defaults } })),
]; };
