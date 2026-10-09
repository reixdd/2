import path from 'node:path';
import { getConfig, ROOT } from './config.js';
import { createProviders } from './providers/index.js';
import { loadManifest, createContenderService } from './contenders.js';
import { createStore } from './store.js';
import { createEngine } from './engine.js';
import { createApp } from './app.js';
import { createCharacterService, loadCast } from './characters.js';

const config = getConfig();
const providers = createProviders(config);
const store = createStore(config.dataDir);
const contenders = createContenderService({ manifest: loadManifest(config.manifestDir), providers, config, getBattles: store.all });
const engine = createEngine({ config, providers, contenders, store });
const characters = createCharacterService({ cast: loadCast(path.join(ROOT, 'server', 'characters')), contenders,
  getBattles: store.all, dataDir: config.dataDir, artDir: path.join(ROOT, 'client', 'public', 'art') });
const app = createApp({ config, providers, engine, contenders, store, characters, staticDir: path.join(ROOT, 'client', 'dist') });

app.listen(config.port, '127.0.0.1', () => {
  console.log(`COLOSSEUM arena open on http://localhost:${config.port}`);
  console.log(`  OpenRouter: ${providers.openrouter.isConfigured() ? 'key present' : 'no key (contenders inert)'}   Ollama: ${config.ollama.baseUrl}`);
});
