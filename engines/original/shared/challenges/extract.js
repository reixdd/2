// Deterministic answer extraction. No model output is ever executed — only parsed as text/JSON.

/** Remove reasoning-model "thinking" so only the committed answer is judged. */
export function stripThinking(text) {
  let s = String(text ?? '');
  const close = s.toLowerCase().lastIndexOf('</think>');
  if (close >= 0) return s.slice(close + 8);
  if (/<think>/i.test(s)) return ''; // thinking never closed → no committed answer
  return s;
}

/** Returns the text after the LAST "FINAL:" marker, or null. */
export function extractFinal(text) {
  const s = stripThinking(text);
  const re = /FINAL\s*:\s*/gi;
  let last = null;
  let m;
  while ((m = re.exec(s)) !== null) last = m.index + m[0].length;
  if (last === null) return null;
  return s.slice(last).trim();
}

function cleanScalar(s) {
  return s.split('\n')[0].replace(/[`*$\s]/g, '').replace(/\.$/, '').replace(/,/g, '');
}

/** Strict integer parse of the first line of a FINAL answer. Returns BigInt or null. */
export function parseIntegerAnswer(finalText) {
  if (finalText == null) return null;
  const c = cleanScalar(finalText);
  return /^-?\d+$/.test(c) ? BigInt(c) : null;
}

/** Find and parse the first balanced JSON object/array inside text. Returns value or undefined. */
export function parseJsonLoose(text) {
  if (text == null) return undefined;
  const s = String(text).replace(/```(?:json)?/gi, '');
  const start = s.search(/[{[]/);
  if (start < 0) return undefined;
  const open = s[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close && --depth === 0) {
      try { return JSON.parse(s.slice(start, i + 1)); } catch { return undefined; }
    }
  }
  return undefined;
}
