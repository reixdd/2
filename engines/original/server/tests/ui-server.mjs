// Explicit TEST ONLY stack. Never registered by the production server.
import path from 'node:path';
import { ROOT } from '../config.js';
import { makeStack } from './helpers.js';
const stack = await makeStack({ port: 8788, timeoutMs: 1000, staticDir: path.join(ROOT, 'client', 'dist') });
console.log('TEST FIXTURE server:', stack.base);
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { stack.close(); process.exit(0); });
