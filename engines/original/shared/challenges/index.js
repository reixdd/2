import { researchChallenges } from './research.js';
import { hashText } from '../hash.js';
import { extractFinal, parseIntegerAnswer, parseJsonLoose } from './extract.js';

// ── seeded RNG so every challenge is byte-identical on every run ──────────────
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ri = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const gcd = (a, b) => (b === 0n ? a : gcd(b, a % b));

const SYSTEM =
  'You are a contestant in an evaluation arena. Solve the task exactly. ' +
  'You may reason step by step, but your reply MUST end with one final line in the exact format requested. ' +
  'Only the final line is graded.';

const result = (checks, extracted, expected, notes = []) => {
  const total = checks.reduce((s, c) => s + c.weight, 0);
  const got = checks.reduce((s, c) => s + (c.ok ? c.weight : 0), 0);
  return {
    score: Math.round((got / total) * 100),
    maxScore: 100,
    passed: checks.every((c) => c.ok),
    extracted,
    expected,
    checks: checks.map(({ name, ok, weight }) => ({ name, ok, weight })),
    notes,
  };
};

// ── MATH ─────────────────────────────────────────────────────────────────────
function mathChain() {
  const r = mulberry32(1001);
  let v = BigInt(ri(r, 20, 99));
  let expr = String(v);
  for (let i = 0; i < 7; i++) {
    const op = pick(r, ['+', '-', '×', '×']);
    const n = BigInt(op === '×' ? ri(r, 3, 19) : ri(r, 100, 999));
    expr = `(${expr} ${op} ${n})`;
    v = op === '+' ? v + n : op === '-' ? v - n : v * n;
  }
  return {
    id: 'math.chain', title: 'The Long Sum', discipline: 'math', difficulty: 'easy', version: 1, seed: 1001,
    answerFormat: 'FINAL: <integer>',
    user: `Evaluate this expression exactly. Use standard order implied by the parentheses.\n\n${expr}\n\nEnd with: FINAL: <integer>`,
    expected: v.toString(), referenceAnswer: v.toString(),
    verify(output) {
      const f = extractFinal(output);
      const got = parseIntegerAnswer(f);
      return result([{ name: 'exact integer match', ok: got !== null && got === v, weight: 1 }], f, v.toString(),
        f === null ? ['No "FINAL:" line found'] : got === null ? ['FINAL line is not a plain integer'] : []);
    },
  };
}

function mathGcdLcm() {
  const r = mulberry32(2002);
  const g = BigInt(ri(r, 7, 60));
  let p, q;
  do { p = BigInt(ri(r, 20, 300)); q = BigInt(ri(r, 20, 300)); } while (gcd(p, q) !== 1n || p === q);
  const a = g * p, b = g * q, l = (a * b) / g;
  const expected = { gcd: Number(g), lcm: Number(l) };
  return {
    id: 'math.gcd-lcm', title: 'Common Ground', discipline: 'math', difficulty: 'medium', version: 1, seed: 2002,
    answerFormat: 'FINAL: {"gcd": <int>, "lcm": <int>}',
    user: `Find the greatest common divisor and the least common multiple of ${a} and ${b}.\n\nEnd with exactly one line:\nFINAL: {"gcd": <integer>, "lcm": <integer>}`,
    expected, referenceAnswer: JSON.stringify(expected),
    verify(output) {
      const f = extractFinal(output);
      const j = parseJsonLoose(f);
      const ok = j && typeof j === 'object' && !Array.isArray(j);
      return result([
        { name: 'gcd correct', ok: !!ok && Number(j.gcd) === expected.gcd, weight: 1 },
        { name: 'lcm correct', ok: !!ok && Number(j.lcm) === expected.lcm, weight: 1 },
      ], j ?? f, expected, f === null ? ['No "FINAL:" line found'] : !ok ? ['FINAL line is not a JSON object'] : []);
    },
  };
}

function mathPrimeSum() {
  const r = mulberry32(3003);
  const n = ri(r, 150, 300);
  let s = 0;
  for (let i = 2; i < n; i++) { let p = true; for (let d = 2; d * d <= i; d++) if (i % d === 0) { p = false; break; } if (p) s += i; }
  return {
    id: 'math.prime-sum', title: 'Sieve of the Arena', discipline: 'math', difficulty: 'medium', version: 1, seed: 3003,
    answerFormat: 'FINAL: <integer>',
    user: `Compute the sum of all prime numbers strictly less than ${n}.\n\nEnd with: FINAL: <integer>`,
    expected: String(s), referenceAnswer: String(s),
    verify(output) {
      const f = extractFinal(output);
      const got = parseIntegerAnswer(f);
      return result([{ name: 'exact integer match', ok: got !== null && got === BigInt(s), weight: 1 }], f, String(s),
        f === null ? ['No "FINAL:" line found'] : []);
    },
  };
}

function mathModExp() {
  const r = mulberry32(4004);
  const a = BigInt(ri(r, 3, 19)), e = BigInt(ri(r, 40, 120)), m = BigInt(ri(r, 101, 997));
  let acc = 1n, base = a % m, ex = e;
  while (ex > 0n) { if (ex & 1n) acc = (acc * base) % m; base = (base * base) % m; ex >>= 1n; }
  return {
    id: 'math.modexp', title: 'Remainder of Empire', discipline: 'math', difficulty: 'hard', version: 1, seed: 4004,
    answerFormat: 'FINAL: <integer>',
    user: `Compute ${a}^${e} mod ${m}. (The remainder when ${a} raised to the power ${e} is divided by ${m}.)\n\nEnd with: FINAL: <integer>`,
    expected: acc.toString(), referenceAnswer: acc.toString(),
    verify(output) {
      const f = extractFinal(output);
      const got = parseIntegerAnswer(f);
      return result([{ name: 'exact integer match', ok: got !== null && got === acc, weight: 1 }], f, acc.toString(),
        f === null ? ['No "FINAL:" line found'] : []);
    },
  };
}

// ── STRUCTURED REASONING ─────────────────────────────────────────────────────
const NAMES = ['Ada', 'Boris', 'Chen', 'Dara', 'Emil'];
function* permutations(arr) {
  if (arr.length <= 1) { yield arr; return; }
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest)) yield [arr[i], ...p];
  }
}
function reasonOrdering() {
  const seed = 5005;
  const r = mulberry32(seed);
  const truth = [...NAMES];
  for (let i = truth.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [truth[i], truth[j]] = [truth[j], truth[i]]; }
  if (truth.join() === NAMES.join()) truth.reverse(); // never let the answer equal the roster order
  const posOf = (perm) => Object.fromEntries(perm.map((n, i) => [n, i + 1]));
  const T = posOf(truth);
  const templates = [
    (x, y) => ({ text: `${x} stands somewhere to the left of ${y}.`, f: (P) => P[x] < P[y] }),
    (x, y) => ({ text: `${x} stands immediately to the left of ${y}.`, f: (P) => P[y] === P[x] + 1 }),
    (x, y) => ({ text: `${x} and ${y} are not next to each other.`, f: (P) => Math.abs(P[x] - P[y]) !== 1 }),
    (x) => ({ text: `${x} is not at either end of the line.`, f: (P) => P[x] !== 1 && P[x] !== 5 }),
    (x) => { const k = ri(r, 1, 5); return { text: `${x} is in position ${k} (position 1 is the far left).`, f: (P) => P[x] === k }; },
  ];
  const all = [...permutations(NAMES)].map(posOf);
  let alive = all, clues = [], guard = 0;
  while (alive.length > 1 && guard++ < 2000) {
    const x = pick(r, NAMES); let y = pick(r, NAMES); while (y === x) y = pick(r, NAMES);
    const c = pick(r, templates)(x, y);
    if (!c.f(T)) continue;
    const next = alive.filter(c.f);
    if (next.length < alive.length) { clues.push(c.text); alive = next; }
  }
  if (alive.length !== 1) throw new Error('reason.ordering: could not build a uniquely solvable puzzle');
  const expected = truth;
  return {
    id: 'reason.ordering', title: 'Order of the Line', discipline: 'structured-reasoning', difficulty: 'medium', version: 1, seed,
    answerFormat: 'FINAL: ["Name1","Name2","Name3","Name4","Name5"]',
    user: `Five people — ${NAMES.join(', ')} — stand in a single line, positions 1 to 5 from left to right. Use only these facts:\n\n${clues.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\nThe arrangement is uniquely determined. Give it left to right.\n\nEnd with exactly one line:\nFINAL: ["Name1","Name2","Name3","Name4","Name5"]`,
    expected, referenceAnswer: JSON.stringify(expected),
    verify(output) {
      const f = extractFinal(output);
      const j = parseJsonLoose(f);
      const arr = Array.isArray(j) ? j.map(String) : null;
      const correct = arr ? expected.filter((n, i) => arr[i] === n).length : 0;
      const exact = !!arr && arr.length === 5 && correct === 5;
      return {
        score: Math.round((correct / 5) * 100), maxScore: 100, passed: exact, extracted: arr ?? f, expected,
        checks: [{ name: 'exact arrangement', ok: exact, weight: 1 }, { name: `positions correct: ${correct}/5`, ok: exact, weight: 0 }],
        notes: f === null ? ['No "FINAL:" line found'] : !arr ? ['FINAL line is not a JSON array'] : [],
      };
    },
  };
}

function reasonGraph() {
  const seed = 6006;
  const r = mulberry32(seed);
  const nodes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  let edges, best;
  for (let attempt = 0; attempt < 500; attempt++) {
    edges = [];
    for (let i = 0; i < nodes.length; i++) for (let j = 0; j < nodes.length; j++) {
      if (i !== j && r() < 0.3) edges.push([nodes[i], nodes[j], ri(r, 1, 12)]);
    }
    const dist = Object.fromEntries(nodes.map((n) => [n, Infinity])); dist.A = 0;
    const done = new Set();
    for (;;) {
      let u = null;
      for (const n of nodes) if (!done.has(n) && (u === null || dist[n] < dist[u])) u = n;
      if (u === null || dist[u] === Infinity) break;
      done.add(u);
      for (const [a, b, w] of edges) if (a === u && dist[u] + w < dist[b]) dist[b] = dist[u] + w;
    }
    if (dist.H !== Infinity && dist.H >= 14 && edges.length >= 14 && edges.length <= 24) { best = dist.H; break; }
  }
  if (best === undefined) throw new Error('reason.graph: could not build graph');
  const w = new Map(edges.map(([a, b, c]) => [`${a}>${b}`, c]));
  const expected = { cost: best };
  return {
    id: 'reason.graph', title: 'Cheapest Passage', discipline: 'structured-reasoning', difficulty: 'hard', version: 1, seed,
    answerFormat: 'FINAL: {"cost": <int>, "path": ["A", ..., "H"]}',
    user: `A directed, weighted graph has these edges (from -> to : cost):\n\n${edges.map(([a, b, c]) => `${a} -> ${b} : ${c}`).join('\n')}\n\nFind a minimum-cost path from A to H. Edges can only be used in the listed direction.\n\nEnd with exactly one line:\nFINAL: {"cost": <integer>, "path": ["A", "...", "H"]}`,
    expected, referenceAnswer: JSON.stringify({ cost: best, path: ['(any minimum-cost path)'] }),
    referenceIsPartial: true,
    verify(output) {
      const f = extractFinal(output);
      const j = parseJsonLoose(f);
      const obj = j && typeof j === 'object' && !Array.isArray(j) ? j : null;
      const costOk = !!obj && Number(obj.cost) === best;
      let pathOk = false, pathCost = null;
      if (obj && Array.isArray(obj.path) && obj.path.length >= 2 && obj.path[0] === 'A' && obj.path.at(-1) === 'H') {
        pathCost = 0; pathOk = true;
        for (let i = 0; i < obj.path.length - 1; i++) {
          const c = w.get(`${obj.path[i]}>${obj.path[i + 1]}`);
          if (c === undefined) { pathOk = false; break; }
          pathCost += c;
        }
        pathOk = pathOk && pathCost === best;
      }
      return result([
        { name: 'minimum cost correct', ok: costOk, weight: 1 },
        { name: 'path is valid, A→H, and achieves minimum cost', ok: pathOk, weight: 1 },
      ], obj ?? f, expected, f === null ? ['No "FINAL:" line found'] : !obj ? ['FINAL line is not a JSON object'] : []);
    },
  };
}

function reasonLedger() {
  const seed = 7007;
  const cats = ['arms', 'armor', 'rations', 'oil'];
  const statuses = ['shipped', 'shipped', 'shipped', 'returned', 'cancelled'];
  let rows, expected;
  for (let s = seed; ; s++) {
    const r = mulberry32(s);
    rows = Array.from({ length: 14 }, (_, i) => ({
      id: `L-${100 + i}`, cat: pick(r, cats), qty: ri(r, 1, 9), price: ri(r, 5, 60), status: pick(r, statuses),
    }));
    const totals = Object.fromEntries(cats.map((c) => [c, 0]));
    let returned = 0;
    for (const x of rows) { if (x.status === 'shipped') totals[x.cat] += x.qty * x.price; if (x.status === 'returned') returned += x.qty; }
    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    if (sorted[0][1] !== sorted[1][1] && returned > 0) { expected = { totals, top_category: sorted[0][0], returned_units: returned }; break; }
  }
  return {
    id: 'reason.ledger', title: 'Ledger of the Games', discipline: 'structured-reasoning', difficulty: 'medium', version: 1, seed,
    answerFormat: 'FINAL: {"totals": {...}, "top_category": "...", "returned_units": <int>}',
    user: `Below is a ledger. Columns: id | category | quantity | unit price | status.\n\n${rows.map((x) => `${x.id} | ${x.cat} | ${x.qty} | ${x.price} | ${x.status}`).join('\n')}\n\nTasks:\n1. For each category (${cats.join(', ')}), total revenue = sum of quantity × unit price over rows with status "shipped" only (0 if none).\n2. top_category = the category with the highest total revenue.\n3. returned_units = total quantity across rows with status "returned".\n\nEnd with exactly one line:\nFINAL: {"totals": {"arms": <int>, "armor": <int>, "rations": <int>, "oil": <int>}, "top_category": "<name>", "returned_units": <int>}`,
    expected, referenceAnswer: JSON.stringify(expected),
    verify(output) {
      const f = extractFinal(output);
      const j = parseJsonLoose(f);
      const o = j && typeof j === 'object' && !Array.isArray(j) ? j : null;
      const checks = cats.map((c) => ({ name: `total: ${c}`, ok: !!o && !!o.totals && Number(o.totals[c]) === expected.totals[c], weight: 1 }));
      checks.push({ name: 'top_category', ok: !!o && o.top_category === expected.top_category, weight: 1 });
      checks.push({ name: 'returned_units', ok: !!o && Number(o.returned_units) === expected.returned_units, weight: 1 });
      return result(checks, o ?? f, expected, f === null ? ['No "FINAL:" line found'] : !o ? ['FINAL line is not a JSON object'] : []);
    },
  };
}

// ── registry ─────────────────────────────────────────────────────────────────
const adapted = researchChallenges();
const CHALLENGES = [adapted[0], mathChain(), mathGcdLcm(), mathPrimeSum(), mathModExp(), reasonOrdering(), reasonLedger(), reasonGraph(), ...adapted.slice(1)];
for (const c of CHALLENGES) {
  c.system = SYSTEM;
  c.promptHash = hashText(`${c.system}\n---\n${c.user}`).slice(0, 16);
}

export const DISCIPLINES = [
  { id: 'math', label: 'Mathematics', status: 'available', note: 'Exact-answer arithmetic and number theory, verified by BigInt computation.' },
  { id: 'structured-reasoning', label: 'Structured reasoning', status: 'available', note: 'Constraint puzzles, graph search, ledger aggregation. Verified against solvers.' },
  { id: 'chart', label: 'Chart reading', status: 'unavailable', note: 'Requires vision-capable contenders and a verified image dataset. Not shipped without both.' },
  { id: 'research', label: 'Research', status: 'unavailable', note: 'Requires a frozen source corpus with citable ground truth. Not shipped without one.' },
];

export const listChallenges = () => CHALLENGES;
export const getChallenge = (id) => CHALLENGES.find((c) => c.id === id) ?? null;
/** Public view: never includes expected answers. */
export const publicChallenge = ({ id, title, discipline, difficulty, version, seed, system, user, answerFormat, promptHash }) =>
  ({ id, title, discipline, difficulty, version, seed, system, user, answerFormat, promptHash });
export function buildMessages(challenge, extraSystem = '') {
  const sys = extraSystem?.trim() ? `${challenge.system}\n\n${extraSystem.trim()}` : challenge.system;
  return [{ role: 'system', content: sys }, { role: 'user', content: challenge.user }];
}
