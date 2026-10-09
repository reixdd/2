// Generates ORIGINAL character artwork (lightweight inline-vector SVG). No official assets are used or traced.
// Run: node scripts/gen-art.mjs   → client/public/art/<key>.svg and <key>-portrait.svg
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'client', 'public', 'art');
fs.mkdirSync(out, { recursive: true });

const frame = (accent, dark, body, overlay = '') => `
<defs><radialGradient id="bg" cx="50%" cy="36%" r="78%"><stop offset="0" stop-color="${accent}" stop-opacity=".38"/><stop offset=".6" stop-color="${dark}" stop-opacity=".55"/><stop offset="1" stop-color="#06080a"/></radialGradient></defs>
<rect width="400" height="500" fill="url(#bg)"/>
<g fill="none" stroke="${accent}"><ellipse cx="200" cy="448" rx="160" ry="28" stroke-width="2" opacity=".75"/><ellipse cx="200" cy="448" rx="118" ry="20" stroke-width="1" stroke-dasharray="3 7" opacity=".6"/></g>
${body}${overlay}`;

const BODIES = {
  qwen: (a) => `
<circle cx="200" cy="170" r="104" fill="none" stroke="${a}" stroke-width="3" opacity=".75"/>
<rect x="298" y="190" width="7" height="250" rx="3" fill="#c9b79c"/><circle cx="301" cy="184" r="15" fill="${a}"/>
<path d="M112 446C112 336 146 292 200 292s88 44 88 154z" fill="#33485a"/>
<path d="M168 300 200 366 232 300z" fill="#e9eef1" opacity=".88"/>
<ellipse cx="144" cy="142" rx="17" ry="15" fill="#85623f"/><ellipse cx="256" cy="142" rx="17" ry="15" fill="#85623f"/>
<ellipse cx="200" cy="196" rx="80" ry="68" fill="#9b7653"/>
<ellipse cx="200" cy="226" rx="48" ry="33" fill="#b08a62"/><ellipse cx="200" cy="211" rx="11" ry="7.5" fill="#2b1d12"/>
<path d="M156 182q14 10 28 0M216 182q14 10 28 0M186 238q14 8 28 0" stroke="#2b1d12" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  deepseek: (a) => `
<path d="M96 450C96 300 138 190 200 140c62 50 104 160 104 310z" fill="#0c1a33"/>
<path d="M120 440C130 330 160 250 200 214c40 36 70 116 80 226" fill="none" stroke="${a}" stroke-width="1.5" opacity=".5"/>
<ellipse cx="200" cy="204" rx="64" ry="76" fill="#02060d"/>
<g fill="${a}"><circle cx="172" cy="200" r="9"/><circle cx="228" cy="200" r="9"/><circle cx="200" cy="168" r="9"/></g>
<g fill="${a}" opacity=".25"><circle cx="172" cy="200" r="17"/><circle cx="228" cy="200" r="17"/><circle cx="200" cy="168" r="17"/></g>
<path d="M116 380c30-30 50 30 84 0s54 30 84 0" fill="none" stroke="${a}" stroke-width="2" opacity=".7"/>
<circle cx="200" cy="350" r="28" fill="none" stroke="${a}" stroke-width="2"/><circle cx="200" cy="350" r="11" fill="${a}" opacity=".8"/>`,
  llama: (a) => `
<path d="M166 448 172 262h56l6 186z" fill="#efe6d2"/>
<g fill="#f6f0e0"><circle cx="176" cy="300" r="20"/><circle cx="224" cy="310" r="22"/><circle cx="196" cy="340" r="22"/><circle cx="212" cy="378" r="20"/></g>
<ellipse cx="170" cy="124" rx="12" ry="34" fill="#e3d6bb" transform="rotate(-12 170 124)"/><ellipse cx="230" cy="124" rx="12" ry="34" fill="#e3d6bb" transform="rotate(12 230 124)"/>
<ellipse cx="200" cy="196" rx="54" ry="66" fill="#f3ecdc"/><ellipse cx="200" cy="236" rx="32" ry="25" fill="#e3d6bb"/>
<ellipse cx="200" cy="228" rx="9" ry="6" fill="#5a4a2c"/>
<path d="M120 112 200 78l80 34-80 32z" fill="#2a2214"/><path d="M280 112v34" stroke="${a}" stroke-width="3"/><circle cx="280" cy="150" r="6" fill="${a}"/>
<g fill="none" stroke="#5a4a2c" stroke-width="3"><circle cx="178" cy="190" r="17"/><circle cx="222" cy="190" r="17"/><path d="M195 190h10"/></g>
<g fill="#2a2214"><circle cx="178" cy="190" r="4"/><circle cx="222" cy="190" r="4"/></g>
<rect x="238" y="356" width="104" height="30" rx="15" fill="#d8c08a"/><rect x="238" y="356" width="14" height="30" rx="7" fill="#b89a58"/><rect x="328" y="356" width="14" height="30" rx="7" fill="#b89a58"/>`,
  gemma: (a) => `
<g fill="${a}" opacity=".7"><polygon points="86,170 102,150 112,184"/><polygon points="304,130 326,150 300,174"/><polygon points="92,330 114,316 122,348"/><polygon points="296,310 316,330 292,350"/></g>
<polygon points="200,300 252,340 232,440 168,440 148,340" fill="${a}" opacity=".28" stroke="${a}" stroke-width="1.5"/>
<polygon points="200,96 266,158 248,254 200,296 152,254 134,158" fill="${a}" opacity=".55" stroke="#eaf8fc" stroke-width="2"/>
<g stroke="#eaf8fc" stroke-width="1.2" opacity=".75" fill="none"><path d="M200 96v200M134 158l66 50 66-50M152 254l48-46 48 46"/></g>
<polygon points="200,208 134,158 152,254" fill="#eaf8fc" opacity=".16"/>
<g fill="#06161c"><rect x="168" y="178" width="22" height="5" rx="2"/><rect x="210" y="178" width="22" height="5" rx="2"/></g>`,
  grok: (a) => `
<path d="M104 446C104 346 140 300 200 300s96 46 96 146z" fill="#10151a" stroke="#27313a" stroke-width="2"/>
<polygon points="214,304 176,382 204,382 188,446 238,360 208,360" fill="${a}"/>
<polygon points="128,150 140,92 162,128 180,76 200,122 222,74 238,128 260,90 272,150" fill="#e9eef1"/>
<path d="M200 118a72 84 0 0 0 0 168z" fill="#e9eef1"/><path d="M200 118a72 84 0 0 1 0 168z" fill="#10151a" stroke="#5d6e7a" stroke-width="2"/>
<circle cx="170" cy="186" r="11" fill="#06080a"/><circle cx="170" cy="186" r="5" fill="${a}"/>
<path d="M222 174l28 24M250 174l-28 24" stroke="${a}" stroke-width="5" stroke-linecap="round"/>
<path d="M150 244l16 14 16-14 16 14 16-14 16 14 16-14 16 14" fill="none" stroke="#06080a" stroke-width="5" stroke-linejoin="round"/>`,
};

const OVERLAYS = {
  research: (a) => `<g><circle cx="244" cy="184" r="24" fill="none" stroke="#e7c76a" stroke-width="4"/><path d="M262 202 292 250" stroke="#e7c76a" stroke-width="3"/>
<path d="M96 396l56-14v54l-56 14zM152 382l56 14v54l-56-14z" fill="#e9eef1" opacity=".92" stroke="#5d6e7a"/><path d="M106 404l36-9M106 418l36-9M162 396l36 9M162 410l36 9" stroke="#5d6e7a" stroke-width="2"/></g>`,
  quant: (a) => `<g><rect x="78" y="360" width="94" height="76" rx="6" fill="none" stroke="#e7c76a" stroke-width="3"/>
<path d="M78 398h94" stroke="#e7c76a" stroke-width="2"/><g fill="#e9eef1"><circle cx="96" cy="379" r="7"/><circle cx="118" cy="379" r="7"/><circle cx="148" cy="379" r="7"/><circle cx="104" cy="417" r="7"/><circle cx="132" cy="417" r="7"/><circle cx="154" cy="417" r="7"/></g>
<circle cx="244" cy="184" r="24" fill="none" stroke="#e7c76a" stroke-width="4"/></g>`,
  verifier: (a) => `<g fill="none" stroke="${a}" stroke-width="3" opacity=".85"><circle cx="200" cy="180" r="124" stroke-dasharray="6 8"/><path d="M296 76l14 16 28-34" stroke-linecap="round" stroke-linejoin="round" stroke-width="5"/></g>`,
};

const portrait = (svg) => svg.replace('viewBox="0 0 400 500"', 'viewBox="70 60 260 260"');
const COLORS = { qwen: ['#9fcbb6', '#1c2f2c'], deepseek: ['#4f86d9', '#0a1730'], llama: ['#d2b36e', '#2e2412'], gemma: ['#9fdcf0', '#12303a'], grok: ['#f0d65a', '#202418'] };
const ART = [
  ['qwen', 'qwen'], ['deepseek', 'deepseek'], ['llama', 'llama'], ['gemma', 'gemma'], ['grok', 'grok'],
  ['qwen-research', 'qwen', 'research'], ['qwen-quant', 'qwen', 'quant'], ['qwen-verifier', 'qwen', 'verifier'], ['deepseek-verifier', 'deepseek', 'verifier'],
];
for (const [key, base, overlay] of ART) {
  const [a, dark] = COLORS[base];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" role="img" aria-label="${key} character artwork (original, unofficial)">${frame(a, dark, BODIES[base](a), overlay ? OVERLAYS[overlay](a) : '')}</svg>\n`;
  fs.writeFileSync(path.join(out, `${key}.svg`), svg);
  fs.writeFileSync(path.join(out, `${key}-portrait.svg`), portrait(svg));
}
console.log(`wrote ${ART.length * 2} svg files to ${out}`);
