import { createBrowserArena } from './arena.js';
import { createDeviceProvider } from './provider.js';
import { openBrowserStore } from './store.js';
import { createWasmProvider } from './wasm-provider.js';
import { browserBackend, browserCatalog, BROWSER_CAST } from './catalog.js';
let instance;
export async function getBrowserArena() {
  instance ??= (async () => {
    let presentation = BROWSER_CAST;
    try {
      const overlay = await (await fetch(`${import.meta.env.BASE_URL}presentation.json`)).json();
      presentation = Object.fromEntries(Object.entries(BROWSER_CAST).map(([family, base]) => [family, { ...base, ...(overlay.families?.[family] ?? {}) }]));
    } catch { /* original concept placeholders remain available */ }
    const arena = createBrowserArena({ provider: browserBackend() === 'webgpu' ? createDeviceProvider() : createWasmProvider(), store: await openBrowserStore(), catalog: browserCatalog(), cast: presentation, assetBase: import.meta.env.BASE_URL,
      onChange: () => window.dispatchEvent(new Event('colosseum-device-change')) });
    await arena.init();
    return arena;
  })();
  return instance;
}
