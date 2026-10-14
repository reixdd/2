import { extractFinal, parseJsonLoose, parseIntegerAnswer } from './extract.js';

// Adapted from the supplied research. These are objective math/data tasks, not
// claims that research, vision, code execution, RPC access or tools were tested.
function scalar({ id, title, user, expected, difficulty = 'medium' }) {
  return { id, title, discipline: 'math', difficulty, version: 1, seed: 1, user: `${user}\nEnd with: FINAL: <integer>`, answerFormat: 'FINAL: <integer>', expected: String(expected), referenceAnswer: String(expected),
    verify(output) { const f = extractFinal(output), got = parseIntegerAnswer(f), ok = got !== null && got === BigInt(expected); return verdict([{ name: 'exact integer', ok, weight: 1 }], f, String(expected)); } };
}
function verdict(checks, extracted, expected) {
  return { score: Math.round(100 * checks.filter((c) => c.ok).reduce((s, c) => s + c.weight, 0) / checks.reduce((s, c) => s + c.weight, 0)), maxScore: 100, passed: checks.every((c) => c.ok), checks, extracted: extracted ?? null, expected, notes: [] };
}
function objectTask({ id, title, user, expected, discipline = 'structured-reasoning', checks, difficulty = 'medium' }) {
  return { id, title, discipline, difficulty, version: 1, seed: 1, user: `${user}\nEnd with one line: FINAL: ${JSON.stringify(expected).replace(/-?\d+(?:\.\d+)?/g, '<number>').replace(/\b(?:true|false)\b/g, '<boolean>')}`, expected, referenceAnswer: JSON.stringify(expected), answerFormat: 'FINAL: <JSON object>',
    verify(output) { const f = extractFinal(output), j = parseJsonLoose(f), obj = j && typeof j === 'object' && !Array.isArray(j) ? j : null;
      return verdict(checks.map(({ name, test, weight = 1 }) => ({ name, ok: !!obj && !!test(obj), weight })), j ?? f, expected); } };
}
export function researchChallenges() {
  let crt;
  for (let x = 0; x < 1001; x++) if (x % 7 === 3 && x % 11 === 4 && x % 13 === 5) { crt = x; break; }
  const maxKeys = Math.floor((8192 - 64 - 8) / (16 + 8));
  const npv = Math.round(100 * (-1000000 + [300000, 400000, 500000].reduce((s, c, i) => s + c / 1.1 ** (i + 1), 0))) / 100;
  const nums = [10, -2, -10, 5, 20], k = 2;
  let optimal = -Infinity, path;
  for (let mask = 1; mask < 1 << nums.length; mask++) {
    const indices = nums.map((_, i) => i).filter((i) => mask & (1 << i));
    if (indices.slice(1).some((i, j) => i - indices[j] > k)) continue;
    const sum = indices.reduce((s, i) => s + nums[i], 0);
    if (sum > optimal) { optimal = sum; path = indices; }
  }
  return [
    scalar({ id: 'math.warmup', title: 'The First Sigil', difficulty: 'easy', user: 'Compute (29 × 7) + 41 exactly.', expected: 29 * 7 + 41 }),
    scalar({ id: 'math.crt', title: 'Three Remainders', user: 'Find the unique integer x with 0 ≤ x < 1001 such that x mod 7 = 3, x mod 11 = 4, and x mod 13 = 5.', expected: crt }),
    objectTask({ id: 'reason.capacity', title: 'The Archive Page', user: 'A synthetic B-tree specification: page_size=8192 bytes, header_size=64, key_bytes=16, pointer_bytes=8. A page with m keys stores m+1 child pointers. Compute the maximum number of keys and children. This is a supplied-document arithmetic task.', expected: { max_keys: maxKeys, max_children: maxKeys + 1 }, checks: [{ name: 'maximum keys', test: (j) => j.max_keys === maxKeys }, { name: 'children include the extra pointer', test: (j) => j.max_children === maxKeys + 1 }] }),
    objectTask({ id: 'reason.growth', title: 'Growth in the Ledger', user: 'The following supplied table contains quarterly active users in millions: Q1=12.5, Q2=15.0, Q3=18.0, Q4=21.6. Calculate Q1-to-Q2 percentage growth and compound quarterly growth from Q1 to Q4 (three intervals), each rounded to one decimal. This evaluates numerical table reasoning, not image recognition.', expected: { q1_q2_growth_pct: 20, cqgr_q1_q4_pct: 20 }, checks: [{ name: 'Q1 to Q2 growth', test: (j) => typeof j.q1_q2_growth_pct === 'number' && Math.abs(j.q1_q2_growth_pct - 20) < .05 }, { name: 'compound quarterly growth', test: (j) => typeof j.cqgr_q1_q4_pct === 'number' && Math.abs(j.cqgr_q1_q4_pct - 20) < .05 }] }),
    objectTask({ id: 'math.npv', title: 'Value Across Time', discipline: 'math', user: 'A fictional investment has cash flow -1000000 at t=0, then 300000 at t=1, 400000 at t=2, and 500000 at t=3. Annual discount rate is 10%. Compute NPV rounded to two decimal places. This is arithmetic only, with no investment recommendation or execution.', expected: { npv }, checks: [{ name: 'NPV to the nearest cent', test: (j) => typeof j.npv === 'number' && Math.abs(j.npv - npv) <= .005 }] }),
    objectTask({ id: 'reason.signaling', title: 'The Mimic’s Choice', user: 'In a synthetic signaling game, high-type education cost is 10e and low-type cost is 20e. The wage is 100 for e≥1 and 40 otherwise. Calculate low-type net payoff at e=1. Does this threshold sustain a separating equilibrium? Return is_separating_equilibrium as a JSON boolean.', expected: { low_type_net_payoff: 80, is_separating_equilibrium: false }, checks: [{ name: 'low-type payoff', test: (j) => j.low_type_net_payoff === 80 }, { name: 'mimicry prevents separation', test: (j) => j.is_separating_equilibrium === false }] }),
    objectTask({ id: 'reason.balances', title: 'Balance Evidence', user: 'Synthetic transaction metadata (no RPC was contacted): fee=5000; preBalances=[10000000,2000000]; postBalances=[8995000,3000000]. The SAME token account and mint have pre uiAmount=50 and post uiAmount=150. Calculate the net fee-payer lamport change including fees and the token balance delta. No instruction data is provided, so do not infer a transfer amount.', expected: { fee_payer_lamport_change: -1005000, token_balance_delta: 100 }, checks: [{ name: 'fee-payer net change includes fee already', test: (j) => j.fee_payer_lamport_change === -1005000 }, { name: 'token balance delta (not proven transfer)', test: (j) => j.token_balance_delta === 100 }] }),
    objectTask({ id: 'reason.subsequence', title: 'Across the Stepping Stones', user: `Given nums=${JSON.stringify(nums)} and k=${k}, find a non-empty subsequence maximizing its sum, where consecutive chosen zero-based indices differ by at most k. Return sum and indices in increasing order. Return data only; code is not executed.`, expected: { sum: optimal, indices: path }, checks: [{ name: 'optimal sum independently enumerated', test: (j) => j.sum === optimal }, { name: 'indices form a valid optimal subsequence', test: (j) => Array.isArray(j.indices) && j.indices.length > 0 && j.indices.length <= nums.length && j.indices.every((x, i, a) => Number.isInteger(x) && x >= 0 && x < nums.length && (i === 0 || x > a[i - 1] && x - a[i - 1] <= k)) && j.indices.reduce((s, i) => s + nums[i], 0) === optimal }] }),
  ];
}
