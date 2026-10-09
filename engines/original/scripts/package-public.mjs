import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '..');
// zip is available in the prepared cloud; keep the website archive free of server code/secrets.
const target = path.join(root, '..', 'colosseum-public-site.zip');
fs.rmSync(target, { force: true });
execFileSync('zip', ['-qr', target, '.'], { cwd: path.join(root, 'client/public-dist') });
console.log(`Static website archive: ${target}`);
