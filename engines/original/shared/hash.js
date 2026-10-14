import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
export const hashText = (s) => bytesToHex(sha256(new TextEncoder().encode(s)));
export const configHash = (cfg) => hashText(JSON.stringify({ s: cfg.systemPrompt || '', t: cfg.temperature, m: cfg.maxTokens })).slice(0, 8);
