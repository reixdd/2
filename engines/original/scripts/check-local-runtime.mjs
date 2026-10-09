import { getLlama } from 'node-llama-cpp';
import { getConfig } from '../server/config.js';
import { createLocalProvider } from '../server/providers/local.js';
const llama = await getLlama({ gpu: false, build: 'never' });
console.log('Native inference runtime loaded; GPU:', llama.gpu);
const provider = createLocalProvider(getConfig());
console.log('Local models downloaded:', provider.isConfigured());
if (provider.isConfigured()) {
  const catalog = await provider.listModels();
  console.log('Operational models:', [...catalog.models]);
  if (!catalog.ok) throw new Error(catalog.error);
}
