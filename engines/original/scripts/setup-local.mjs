// One-time HTTPS downloads. After setup, local inference requires no network or API account.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ROOT, getConfig } from '../server/config.js';
import { LOCAL_MODELS } from '../server/localModels.js';
const config = getConfig();
const dir = config.localModelDir;
fs.mkdirSync(dir, { recursive: true });
async function sha256(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
for (const model of LOCAL_MODELS) {
  const file = path.join(dir, model.filename), metadataFile = file + '.json';
  if (fs.existsSync(file) && fs.existsSync(metadataFile)) {
    const meta = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
    if (meta.repository === model.repository && meta.sha256 === await sha256(file)) {
      console.log(`${model.name}: retained download verified`); continue;
    }
    throw new Error(`Existing ${model.filename} failed integrity verification; preserve it before replacing it.`);
  }
  if (fs.existsSync(file)) throw new Error(`Existing ${model.filename} has no verification metadata; it will not be overwritten.`);
  const url = `https://huggingface.co/${model.repository}/resolve/main/${model.filename}`;
  console.log(`Downloading ${model.name} from its official repository…`);
  const head = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(30000) });
  if (head.status !== 302 && !head.ok) throw new Error(`Model metadata unavailable: HTTP ${head.status}. Check access to huggingface.co.`);
  const expected = (head.headers.get('x-linked-etag') || head.headers.get('etag') || '').replaceAll('"', '');
  if (!/^[a-f0-9]{64}$/i.test(expected)) throw new Error('Official LFS SHA-256 was not supplied. Refusing an unverified download.');
  const response = await fetch(url, { signal: AbortSignal.timeout(600000) });
  if (!response.ok || !response.body) throw new Error(`Model download failed: HTTP ${response.status}`);
  const temporary = file + '.partial';
  if (fs.existsSync(temporary)) throw new Error(`A previous partial download exists for ${model.filename}; preserve or remove it before retrying.`);
  const hash = crypto.createHash('sha256');
  const meter = new Transform({ transform(chunk, encoding, callback) { hash.update(chunk); callback(null, chunk); } });
  try {
    await pipeline(Readable.fromWeb(response.body), meter, fs.createWriteStream(temporary, { flags: 'wx' }));
    const actual = hash.digest('hex');
    if (actual !== expected.toLowerCase()) throw new Error(`SHA-256 mismatch for ${model.filename}`);
    fs.renameSync(temporary, file);
    fs.writeFileSync(metadataFile, JSON.stringify({ modelId: model.id, repository: model.repository, source: url,
      sha256: actual, bytes: fs.statSync(file).size, downloadedAt: new Date().toISOString() }, null, 2));
    console.log(`${model.name}: SHA-256 verified`);
  } catch (err) { fs.rmSync(temporary, { force: true }); throw err; }
}
console.log(`Local models prepared in ${path.relative(ROOT, dir)}. Start with npm start.`);
