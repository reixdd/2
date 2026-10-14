import test from 'node:test'; import assert from 'node:assert/strict';
import { freshStore, addr, sig, req, json, feeTx } from './helpers.js';
import { treasurySplit, StoreError } from '../server/lib/store-core.js';
import { hmacHex, verifyWebhook, normalizeFeeEvent } from '../server/lib/circuit.js';
import { ingestCircuitEvent, reconcileReceipts, treasuryView, walletDelta, recordExpense } from '../server/lib/ledger.js';
import { handleApi } from '../server/api.js';

test('treasury split is exact integer math: parts always sum to the whole', () => {
  assert.deepEqual(treasurySplit(1_000_000_000, 2500), { treasury: 250_000_000, remainder: 750_000_000 });
  assert.deepEqual(treasurySplit(3, 2500), { treasury: 0, remainder: 3 });
  assert.deepEqual(treasurySplit(9_007_199_254_740_991, 2500).treasury + treasurySplit(9_007_199_254_740_991, 2500).remainder, 9_007_199_254_740_991);
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
  for (let i = 0; i < 2000; i++) { const c = rnd() * 3 + (i % 7), b = rnd() % 10001; const { treasury, remainder } = treasurySplit(c, b); assert.equal(treasury + remainder, c); assert.equal(treasury, Number((BigInt(c) * BigInt(b)) / 10000n)); }
  assert.throws(() => treasurySplit(10, 10001)); assert.throws(() => treasurySplit(-1, 2500));
});

const SECRET = 'test-secret'; const env = { CIRCUIT_WEBHOOK_SECRET: SECRET };
const hook = async (store, body, { secret = SECRET, headers = {}, e = env } = {}) => {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return handleApi(req('/api/integrations/circuit', { method: 'POST', body: raw, headers: { 'x-circuit-signature': await hmacHex(secret, raw), ...headers } }), e, { store });
};
const feeEvent = (id, wallet, lamports, signature) => ({ id, type: 'creator_fee.received', data: { tx_signature: signature, wallet, lamports } });

test('webhook: signature required and verified in constant-time form; replay window enforced', async () => {
  const s = await freshStore(); const w = addr(1);
  assert.equal((await hook(s, feeEvent('e1', w, 1000, sig(1)), { secret: 'wrong' })).status, 401);
  assert.equal((await handleApi(req('/api/integrations/circuit', { method: 'POST', body: '{}' }), env, { store: s })).status, 401);
  assert.equal((await handleApi(req('/api/integrations/circuit', { method: 'POST', body: '{}', headers: { 'x-circuit-signature': 'ab' } }), {}, { store: s })).status, 503);   // secret not configured
  const raw = '{"a":1}'; const ts = String(Math.floor(Date.now() / 1000) - 3600); const h = new Headers({ 'x-circuit-timestamp': ts, 'x-circuit-signature': await hmacHex(SECRET, `${ts}.${raw}`) });
  assert.deepEqual(await verifyWebhook(env, h, raw), { ok: false, reason: 'stale_timestamp' });
  const fresh = String(Math.floor(Date.now() / 1000)); const h2 = new Headers({ 'x-circuit-timestamp': fresh, 'x-circuit-signature': await hmacHex(SECRET, `${fresh}.${raw}`) });
  assert.equal((await verifyWebhook(env, h2, raw)).ok, true);
  assert.equal((await s.select('fee_receipts')).length, 0);
  assert.ok((await s.select('audit_logs')).some(a => a.action === 'webhook_rejected'));
});
test('webhook: replayed delivery is acknowledged once and never double counted', async () => {
  const s = await freshStore(); const ev = feeEvent('evt-1', addr(1), 5_000_000, sig(1));
  const a = await json(hook(s, ev)); const b = await json(hook(s, ev));
  assert.equal(a.status, 200); assert.equal(a.body.created, true); assert.equal(b.body.duplicate, true);
  assert.equal((await s.select('fee_receipts')).length, 1); assert.equal((await s.select('treasury_ledger')).length, 1);
});
test('webhook: same on-chain transaction via a different event id cannot be counted twice', async () => {
  const s = await freshStore(); const w = addr(1);
  await ingestCircuitEvent(s, {}, feeEvent('A', w, 100, sig(1)), { signatureValid: true });
  await assert.rejects(() => ingestCircuitEvent(s, {}, feeEvent('B', w, 100, sig(1)), { signatureValid: true }), e => e instanceof StoreError && e.code === '23505');
  assert.equal((await s.select('fee_receipts')).length, 1);
});
test('webhook: malformed or non-integer amounts are rejected', async () => {
  const s = await freshStore();
  assert.equal((await hook(s, feeEvent('f', addr(1), 0.5, sig(1)))).status, 422);
  assert.equal((await hook(s, feeEvent('g', 'not-an-address', 10, sig(1)))).status, 422);
  assert.equal((await hook(s, { type: 'creator_fee.received' })).status, 422);
  assert.equal((await hook(s, '{broken')).status, 400);
  assert.deepEqual(normalizeFeeEvent({ id: 'x', type: 'agent.heartbeat' }), { id: 'x', type: 'agent.heartbeat', kind: 'other' });
  assert.equal((await s.select('fee_receipts')).length, 0);
});

test('observed ≠ confirmed ≠ allocated ≠ transferred; allocation is 25/75 of the CHAIN amount, not the claimed amount', async () => {
  const s = await freshStore(); const w = addr(2); const tx = feeTx({ wallet: w, lamports: 2_000_000_001 });
  await ingestCircuitEvent(s, {}, feeEvent('E', w, 9_999_999_999, sig(2)), { signatureValid: true });      // the integration over-claims
  let v = await treasuryView(s, {}); assert.equal(v.totals.observed_lamports, 9_999_999_999); assert.equal(v.totals.confirmed_lamports, 0); assert.equal(v.totals.allocation_treasury_lamports, 0);
  const out = await reconcileReceipts(s, {}, { getTransaction: async () => tx }); assert.equal(out.confirmed, 1);
  v = await treasuryView(s, {}); assert.equal(v.totals.confirmed_lamports, 2_000_000_001);
  assert.equal(v.totals.allocation_treasury_lamports, 500_000_000); assert.equal(v.totals.allocation_remainder_lamports, 1_500_000_001);
  assert.equal(v.totals.transferred_lamports, 0); assert.equal(v.totals.available_treasury_lamports, 0);
  assert.equal(v.totals.pending_treasury_lamports, 500_000_000);
  const [r] = await s.select('fee_receipts'); assert.equal(r.status, 'mismatch');       // claimed ≠ chain, flagged
  const [a] = await s.select('treasury_allocations'); assert.equal(a.status, 'unsupported'); assert.equal(a.transferred_lamports, 0);
  assert.match(v.transfer.limitation, /No documented, authorised transfer mechanism/);
  assert.equal(a.treasury_lamports + a.remainder_lamports, r.confirmed_lamports);
});
test('reconciliation is idempotent and retry-safe', async () => {
  const s = await freshStore(); const w = addr(3); await ingestCircuitEvent(s, {}, feeEvent('E', w, 1000, sig(3)), { signatureValid: true });
  let calls = 0; const flaky = async () => { if (calls++ === 0) throw new Error('rpc down'); return feeTx({ wallet: w, lamports: 1000 }); };
  assert.equal((await reconcileReceipts(s, {}, { getTransaction: flaky })).retry, 1); assert.equal((await s.select('fee_receipts'))[0].status, 'observed');
  assert.equal((await reconcileReceipts(s, {}, { getTransaction: flaky })).confirmed, 1);
  assert.deepEqual(await reconcileReceipts(s, {}, { getTransaction: flaky }), { confirmed: 0, failed: 0, retry: 0, skipped: 0 });
  assert.equal((await s.select('treasury_allocations')).length, 1); assert.equal((await s.select('treasury_ledger')).length, 4);   // observed, confirmed, 2 allocations
  const dup = await s.rpc('confirm_fee_receipt', { p_receipt: (await s.select('fee_receipts'))[0].id, p_confirmed: 1, p_treasury_bps: 2500 }); assert.equal(dup.created, false);
});
test('failed integrations: unfinalized, failed, wrong-program and zero-credit transactions never become allocations', async () => {
  const s = await freshStore(); const w = addr(4);
  for (const [i, tx] of [[1, null], [2, feeTx({ wallet: w, lamports: 10, err: { InstructionError: 1 } })], [3, feeTx({ wallet: w, lamports: 10, program: addr(77) })], [4, feeTx({ wallet: w, lamports: 0 })]])
    await ingestCircuitEvent(s, {}, feeEvent('E' + i, w, 10, sig(10 + i)), { signatureValid: true }).then(() => tx);
  const txs = { [sig(11)]: null, [sig(12)]: feeTx({ wallet: w, lamports: 10, err: { InstructionError: 1 } }), [sig(13)]: feeTx({ wallet: w, lamports: 10, program: addr(77) }), [sig(14)]: feeTx({ wallet: w, lamports: 0 }) };
  const out = await reconcileReceipts(s, {}, { getTransaction: async x => txs[x] }); assert.deepEqual(out, { confirmed: 0, failed: 3, retry: 1, skipped: 0 });
  assert.equal((await s.select('treasury_allocations')).length, 0); assert.equal((await treasuryView(s, {})).totals.confirmed_lamports, 0);
});
test('walletDelta handles fee payers and failed transactions', () => {
  const w = addr(5); assert.equal(walletDelta(feeTx({ wallet: w, lamports: 777, payer: true }), w), 777); assert.equal(walletDelta(feeTx({ wallet: w, lamports: 777 }), w), 777);
  assert.equal(walletDelta(feeTx({ wallet: w, lamports: 777, err: 'x' }), w), null); assert.equal(walletDelta(feeTx({ wallet: w, lamports: 1 }), addr(6)), null);
});
test('transfers: only verified, non-simulated allocations can record a transfer, once, never above the allocation', async () => {
  const s = await freshStore(); const w = addr(7); const e = { TREASURY_BPS: '2500', TREASURY_TRANSFER_MECHANISM: 'pump_fee_sharing_config', TREASURY_WALLET: addr(8) };
  // A unit test of the privileged transfer ledger function, NOT verification of a real transfer.
  const r=await s.rpc('ingest_fee_receipt',{p_source:'manual',p_external_id:'transfer-unit-test',p_wallet:w,p_claimed:4000,p_simulated:false});
  await s.rpc('confirm_fee_receipt',{p_receipt:r.receipt_id,p_confirmed:4000,p_treasury_bps:2500,p_transfer_supported:true});
  const [a] = await s.select('treasury_allocations'); assert.equal(a.status, 'pending'); assert.equal(a.treasury_lamports, 1000);
  await assert.rejects(() => s.rpc('record_transfer', { p_allocation: a.id, p_signature: sig(70), p_lamports: 1001 }), /exceeds/);
  await s.rpc('record_transfer', { p_allocation: a.id, p_signature: sig(70), p_lamports: 1000 }); assert.equal((await s.rpc('record_transfer', { p_allocation: a.id, p_signature: sig(70), p_lamports: 1000 })).created, false);
  const v = await treasuryView(s, e); assert.equal(v.totals.transferred_lamports, 1000); assert.equal(v.totals.available_treasury_lamports, 1000); assert.equal(v.totals.pending_treasury_lamports, 0);
});
test('simulated receipts never inflate real totals and can never record transfers', async () => {
  const s = await freshStore(); const r = await s.rpc('ingest_fee_receipt', { p_source: 'manual', p_external_id: 'sim1', p_wallet: addr(9), p_claimed: 1_000_000, p_simulated: true });
  const c = await s.rpc('confirm_fee_receipt', { p_receipt: r.receipt_id, p_confirmed: 1_000_000, p_treasury_bps: 2500, p_transfer_supported: true }); assert.equal(c.status, 'simulated');
  const v = await treasuryView(s, {}); assert.equal(v.totals.confirmed_lamports, 0); assert.equal(v.totals.simulated_confirmed_lamports, 1_000_000);
  await assert.rejects(() => s.rpc('record_transfer', { p_allocation: c.allocation_id, p_signature: sig(1), p_lamports: 10 }), /simulated/);
});
test('ledger is append-only; AI expenses are recorded in their own unit and idempotently', async () => {
  const s = await freshStore(); await recordExpense(s, { jobId: 'job-1', agentId: 'GHOST_001', usdMicros: 1234 }); assert.equal(await recordExpense(s, { jobId: 'job-1', agentId: 'GHOST_001', usdMicros: 1234 }), null);
  assert.equal(await recordExpense(s, { jobId: 'job-2', agentId: 'GHOST_001', usdMicros: null }), null);
  const v = await treasuryView(s, {}); assert.equal(v.totals.expense_usd_micros, 1234); assert.equal(v.totals.expense_lamports, 0);
  await assert.rejects(() => s.update('treasury_ledger', [['id', 'eq', 1]], { amount: 0 }), /append-only/);
});
test('API: treasury endpoint states the limitation instead of inventing a balance', async () => {
  const s = await freshStore(); const { body } = await json(handleApi(req('/api/treasury'), {}, { store: s }));
  assert.equal(body.target_percent, 25); assert.equal(body.totals.available_treasury_lamports, 0); assert.equal(body.transfer.supported, false);
});
